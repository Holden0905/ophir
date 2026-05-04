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

export function TradingViewChart({ ticker }: { ticker: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    async function go() {
      try {
        const [{ createChart, ColorType, CandlestickSeries, LineSeries }, res] =
          await Promise.all([
            import("lightweight-charts"),
            fetch(
              `/api/data/technicals?ticker=${encodeURIComponent(ticker)}&range=1y&interval=1wk`,
            ),
          ]);
        if (!res.ok) throw new Error(`Chart data ${res.status}`);
        const json = (await res.json()) as { bars: Bar[] };
        if (disposed || !containerRef.current) return;

        containerRef.current.innerHTML = "";
        const chart = createChart(containerRef.current, {
          autoSize: true,
          layout: {
            background: { type: ColorType.Solid, color: "#0a0a0a" },
            textColor: "#8a8680",
            fontFamily: "var(--font-plex-mono), monospace",
            fontSize: 11,
          },
          grid: {
            vertLines: { color: "#1a1a1a" },
            horzLines: { color: "#1a1a1a" },
          },
          rightPriceScale: { borderColor: "#222222" },
          timeScale: { borderColor: "#222222" },
          crosshair: {
            vertLine: { color: "#92630a", labelBackgroundColor: "#f59e0b" },
            horzLine: { color: "#92630a", labelBackgroundColor: "#f59e0b" },
          },
        });

        const candle = chart.addSeries(CandlestickSeries, {
          upColor: "#22c55e",
          downColor: "#ef4444",
          borderUpColor: "#22c55e",
          borderDownColor: "#ef4444",
          wickUpColor: "#22c55e",
          wickDownColor: "#ef4444",
        });

        const data = json.bars
          .filter(
            (b) =>
              b.open !== null &&
              b.high !== null &&
              b.low !== null &&
              b.close !== null,
          )
          .map((b) => ({
            time: (b.timestamp as number) as never, // UTCTimestamp brand
            open: b.open as number,
            high: b.high as number,
            low: b.low as number,
            close: b.close as number,
          }));
        candle.setData(data);

        // Add EMA(8), EMA(21), SMA(50) overlays
        const closes = data.map((d) => d.close);
        const emaLine = (period: number) => {
          const k = 2 / (period + 1);
          if (closes.length < period) return [];
          let v =
            closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
          const out: { time: number; value: number }[] = [];
          for (let i = period; i < closes.length; i++) {
            v = closes[i] * k + v * (1 - k);
            out.push({ time: data[i].time as unknown as number, value: v });
          }
          return out;
        };
        const smaLine = (period: number) => {
          if (closes.length < period) return [];
          const out: { time: number; value: number }[] = [];
          for (let i = period - 1; i < closes.length; i++) {
            const slice = closes.slice(i - period + 1, i + 1);
            const avg = slice.reduce((a, b) => a + b, 0) / period;
            out.push({ time: data[i].time as unknown as number, value: avg });
          }
          return out;
        };

        const e8 = chart.addSeries(LineSeries, {
          color: "#f59e0b",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        e8.setData(emaLine(8) as never);
        const e21 = chart.addSeries(LineSeries, {
          color: "#92630a",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        e21.setData(emaLine(21) as never);
        const m50 = chart.addSeries(LineSeries, {
          color: "#3b82f6",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        m50.setData(smaLine(50) as never);

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
  }, [ticker]);

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between px-2 pb-2">
        <div className="font-data text-sm text-[var(--text-primary)]">
          {ticker}
        </div>
        <div className="flex gap-3 font-ui text-[10px] uppercase tracking-wider">
          <Legend color="#f59e0b" label="EMA 8" />
          <Legend color="#92630a" label="EMA 21" />
          <Legend color="#3b82f6" label="SMA 50" />
        </div>
      </div>
      <div
        ref={containerRef}
        className="h-[420px] w-full"
        style={{ background: "#0a0a0a" }}
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
