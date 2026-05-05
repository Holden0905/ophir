import "server-only";

import {
  emaSeries,
  rollingMean,
  rsiSeries,
  smaSeries,
} from "@/lib/calculations/technicals";
import type { YahooBar, YahooSeries } from "@/lib/data/yahoo";
import { nyDate } from "@/lib/signals/dates";

export interface IndicatorBar {
  date: string; // YYYY-MM-DD (NY)
  close: number;
  volume: number;
  ema_5: number | null;
  ema_8: number | null;
  ema_21: number | null;
  sma_50: number | null;
  rsi_14: number | null;
  avg_volume_20: number | null;
}

function safeNumber(n: number | null | undefined): number | null {
  if (n === null || n === undefined) return null;
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * Reduce a Yahoo daily series to a parallel array of IndicatorBars,
 * dropping any bar with missing close or volume. EMA/SMA/RSI series are
 * computed once over the cleaned closes so each bar carries indicators
 * evaluated as of that day's close.
 */
export function indicatorBars(series: YahooSeries): IndicatorBar[] {
  const cleaned: { bar: YahooBar; close: number; volume: number }[] = [];
  for (const bar of series.bars) {
    if (
      bar.close === null ||
      bar.volume === null ||
      !Number.isFinite(bar.close) ||
      !Number.isFinite(bar.volume)
    )
      continue;
    cleaned.push({ bar, close: bar.close, volume: bar.volume });
  }
  if (cleaned.length === 0) return [];

  const closes = cleaned.map((c) => c.close);
  const volumes = cleaned.map((c) => c.volume);

  const ema5 = emaSeries(closes, 5);
  const ema8 = emaSeries(closes, 8);
  const ema21 = emaSeries(closes, 21);
  const sma50 = smaSeries(closes, 50);
  const rsi14 = rsiSeries(closes, 14);
  const avgVol20 = rollingMean(volumes, 20);

  return cleaned.map((c, i) => ({
    date: nyDate(new Date(c.bar.timestamp * 1000)),
    close: c.close,
    volume: c.volume,
    ema_5: safeNumber(ema5[i]),
    ema_8: safeNumber(ema8[i]),
    ema_21: safeNumber(ema21[i]),
    sma_50: safeNumber(sma50[i]),
    rsi_14: safeNumber(rsi14[i]),
    avg_volume_20: safeNumber(avgVol20[i]),
  }));
}
