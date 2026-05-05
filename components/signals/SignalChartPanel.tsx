"use client";

import { useEffect, useRef, useState } from "react";

interface Bar {
  timestamp: number;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

type Timeframe = "daily" | "hourly";

interface Props {
  ticker: string;
  /** Trigger date in YYYY-MM-DD; we drop an amber marker on the EMA8 here. */
  triggerDate: string | null;
}

const COLOR_EMA5 = "#f59e0b"; // amber
const COLOR_EMA8 = "#e8e6e1"; // primary text
const COLOR_EMA21 = "#7F77DD"; // purple per spec
const COLOR_GREEN = "#22c55e";
const COLOR_RED = "#ef4444";
const COLOR_GRID = "#1a1a1a";
const COLOR_BORDER = "#222222";
const COLOR_BG = "#0a0a0a";
const COLOR_TEXT = "#8a8680";
const COLOR_AMBER_DIM = "#92630a";

export function SignalChartPanel({ ticker, triggerDate }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // 1H is intentionally optional. yahoo-finance2's free intraday window is
  // limited (~60d for 60m bars); if the fetch fails we surface the error
  // rather than silently falling back.
  const [timeframe, setTimeframe] = useState<Timeframe>("daily");
  const [hourlyAvailable, setHourlyAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    async function go() {
      setLoading(true);
      setError(null);
      try {
        const params =
          timeframe === "hourly"
            ? "range=1mo&interval=60m"
            : "range=1y&interval=1d";
        const [
          {
            createChart,
            createSeriesMarkers,
            ColorType,
            CandlestickSeries,
            LineSeries,
            HistogramSeries,
          },
          res,
        ] = await Promise.all([
          import("lightweight-charts"),
          fetch(`/api/data/technicals?ticker=${encodeURIComponent(ticker)}&${params}`),
        ]);
        if (!res.ok) throw new Error(`Chart data ${res.status}`);
        const json = (await res.json()) as { bars: Bar[] };
        if (timeframe === "hourly") {
          setHourlyAvailable(json.bars.length > 5);
        }
        if (disposed || !containerRef.current) return;

        containerRef.current.innerHTML = "";
        const chart = createChart(containerRef.current, {
          autoSize: true,
          layout: {
            background: { type: ColorType.Solid, color: COLOR_BG },
            textColor: COLOR_TEXT,
            fontFamily: "var(--font-plex-mono), monospace",
            fontSize: 11,
            // Pane stacking: price (60%), volume (15%), RSI (25%).
            panes: { separatorColor: COLOR_BORDER, separatorHoverColor: COLOR_AMBER_DIM },
          },
          grid: {
            vertLines: { color: COLOR_GRID },
            horzLines: { color: COLOR_GRID },
          },
          rightPriceScale: { borderColor: COLOR_BORDER },
          timeScale: { borderColor: COLOR_BORDER, rightOffset: 4 },
          crosshair: {
            vertLine: { color: COLOR_AMBER_DIM, labelBackgroundColor: "#f59e0b" },
            horzLine: { color: COLOR_AMBER_DIM, labelBackgroundColor: "#f59e0b" },
          },
        });

        const cleanedBars = json.bars.filter(
          (b) =>
            b.open !== null &&
            b.high !== null &&
            b.low !== null &&
            b.close !== null &&
            b.volume !== null,
        );

        // Candlesticks (pane 0)
        const candle = chart.addSeries(CandlestickSeries, {
          upColor: COLOR_GREEN,
          downColor: COLOR_RED,
          borderUpColor: COLOR_GREEN,
          borderDownColor: COLOR_RED,
          wickUpColor: COLOR_GREEN,
          wickDownColor: COLOR_RED,
        });
        const candleData = cleanedBars.map((b) => ({
          time: b.timestamp as never,
          open: b.open as number,
          high: b.high as number,
          low: b.low as number,
          close: b.close as number,
        }));
        candle.setData(candleData);

        // EMAs on pane 0
        const closes = candleData.map((d) => d.close);
        const emaLine = (period: number) => {
          if (closes.length < period) return [];
          const k = 2 / (period + 1);
          let v = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
          const out: { time: number; value: number }[] = [
            { time: candleData[period - 1].time as unknown as number, value: v },
          ];
          for (let i = period; i < closes.length; i++) {
            v = closes[i] * k + v * (1 - k);
            out.push({ time: candleData[i].time as unknown as number, value: v });
          }
          return out;
        };
        const e5 = chart.addSeries(LineSeries, {
          color: COLOR_EMA5,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        e5.setData(emaLine(5) as never);
        const e8 = chart.addSeries(LineSeries, {
          color: COLOR_EMA8,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        const ema8Data = emaLine(8);
        e8.setData(ema8Data as never);
        const e21 = chart.addSeries(LineSeries, {
          color: COLOR_EMA21,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        e21.setData(emaLine(21) as never);

        // Trigger marker on the EMA8 at the trigger bar (only on daily, since
        // hourly doesn't carry a meaningful "trigger date" granularity).
        if (timeframe === "daily" && triggerDate) {
          // Match by ISO date prefix — Yahoo daily bars come in at midnight UTC
          // for the trading session. We compare the bar's date string.
          const point = ema8Data.find((p) => {
            const iso = new Date(p.time * 1000).toISOString().slice(0, 10);
            return iso === triggerDate;
          });
          if (point) {
            createSeriesMarkers(e8, [
              {
                time: point.time as never,
                position: "inBar",
                color: COLOR_EMA5,
                shape: "circle",
                text: "trigger",
              },
            ]);
          }
        }

        // Volume (pane 1) — colored by close direction
        const volume = chart.addSeries(
          HistogramSeries,
          {
            priceFormat: { type: "volume" },
            priceScaleId: "",
            lastValueVisible: false,
            priceLineVisible: false,
          },
          1,
        );
        const volData = cleanedBars.map((b, i) => {
          const prevClose = i > 0 ? (cleanedBars[i - 1].close as number) : (b.close as number);
          const up = (b.close as number) >= prevClose;
          const isTriggerBar =
            timeframe === "daily" &&
            triggerDate !== null &&
            new Date((b.timestamp as number) * 1000)
              .toISOString()
              .slice(0, 10) === triggerDate;
          return {
            time: b.timestamp as never,
            value: b.volume as number,
            color: isTriggerBar
              ? COLOR_EMA5
              : up
                ? "rgba(34,197,94,0.55)"
                : "rgba(239,68,68,0.55)",
          };
        });
        volume.setData(volData);

        // 20-period rolling average volume as a dashed line on pane 1
        if (cleanedBars.length >= 20) {
          const avgVolLine = chart.addSeries(
            LineSeries,
            {
              color: COLOR_AMBER_DIM,
              lineWidth: 1,
              lineStyle: 2, // dashed
              priceScaleId: "",
              priceLineVisible: false,
              lastValueVisible: false,
            },
            1,
          );
          const out: { time: number; value: number }[] = [];
          let sum = 0;
          for (let i = 0; i < 20; i++) sum += cleanedBars[i].volume as number;
          out.push({
            time: cleanedBars[19].timestamp as unknown as number,
            value: sum / 20,
          });
          for (let i = 20; i < cleanedBars.length; i++) {
            sum += (cleanedBars[i].volume as number) - (cleanedBars[i - 20].volume as number);
            out.push({
              time: cleanedBars[i].timestamp as unknown as number,
              value: sum / 20,
            });
          }
          avgVolLine.setData(out as never);
        }

        // RSI (pane 2)
        const rsiSeriesValues = (() => {
          const period = 14;
          if (closes.length <= period) return [] as { time: number; value: number }[];
          let avgGain = 0;
          let avgLoss = 0;
          for (let i = 1; i <= period; i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff >= 0) avgGain += diff;
            else avgLoss -= diff;
          }
          avgGain /= period;
          avgLoss /= period;
          const out: { time: number; value: number }[] = [];
          out.push({
            time: candleData[period].time as unknown as number,
            value:
              avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss),
          });
          for (let i = period + 1; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            const gain = diff > 0 ? diff : 0;
            const loss = diff < 0 ? -diff : 0;
            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;
            out.push({
              time: candleData[i].time as unknown as number,
              value:
                avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss),
            });
          }
          return out;
        })();
        const rsiSeries = chart.addSeries(
          LineSeries,
          {
            color: COLOR_EMA5,
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: true,
          },
          2,
        );
        rsiSeries.setData(rsiSeriesValues as never);
        // Reference lines at 30 / 40 / 70 — the 40 and 70 bracket the trend
        // continuation band; 30 is the oversold floor for reversal context.
        rsiSeries.createPriceLine({
          price: 70,
          color: COLOR_AMBER_DIM,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "70",
        });
        rsiSeries.createPriceLine({
          price: 40,
          color: COLOR_AMBER_DIM,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "40",
        });
        rsiSeries.createPriceLine({
          price: 30,
          color: "#4a4845",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "30",
        });

        // Pane sizing — price gets the most height, volume small, RSI medium.
        const panes = chart.panes();
        if (panes[0]) panes[0].setHeight(360);
        if (panes[1]) panes[1].setHeight(80);
        if (panes[2]) panes[2].setHeight(120);

        chart.timeScale().fitContent();
        cleanup = () => chart.remove();
      } catch (e) {
        if (!disposed) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    }

    void go();
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [ticker, timeframe, triggerDate]);

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between px-2 pb-2">
        <div className="flex gap-3 font-ui text-[10px] uppercase tracking-wider">
          <Legend color={COLOR_EMA5} label="EMA 5" />
          <Legend color={COLOR_EMA8} label="EMA 8" />
          <Legend color={COLOR_EMA21} label="EMA 21" />
        </div>
        <div className="flex gap-1 rounded bg-[var(--bg-elevated)] p-0.5 text-xs font-ui">
          {(["daily", "hourly"] as const).map((tf) => {
            const disabled =
              tf === "hourly" && hourlyAvailable === false;
            const active = timeframe === tf;
            return (
              <button
                key={tf}
                type="button"
                disabled={disabled}
                onClick={() => setTimeframe(tf)}
                title={
                  disabled
                    ? "Hourly bars unavailable for this ticker on the current data tier"
                    : undefined
                }
                className={`rounded px-2 py-1 ${
                  active
                    ? "bg-[var(--bg-card)] text-[var(--accent-amber)]"
                    : "text-[var(--text-secondary)]"
                } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
              >
                {tf === "daily" ? "Daily" : "1H"}
              </button>
            );
          })}
        </div>
      </div>
      <div
        ref={containerRef}
        className="h-[600px] w-full"
        style={{ background: COLOR_BG }}
      />
      {loading && (
        <div className="px-2 pt-2 font-ui text-xs text-[var(--text-muted)]">
          Loading chart…
        </div>
      )}
      {error && (
        <div className="px-2 pt-2 font-ui text-xs text-[var(--accent-red)]">
          {error}
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-[var(--text-muted)]">
      <span
        aria-hidden
        className="inline-block h-[2px] w-3"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
