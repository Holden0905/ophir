// Technical-indicator calculations. Pure functions — no IO.

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((acc, v) => acc + v, 0) / period;
}

/**
 * Exponential moving average — Wilder-style smoothing isn't used here;
 * we use the standard 2/(N+1) multiplier seeded with an SMA of the first N values.
 */
export function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let value =
    values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    value = values[i] * k + value * (1 - k);
  }
  return value;
}

/**
 * 14-period Wilder RSI. Returns null if insufficient data.
 */
export function rsi(values: number[], period = 14): number | null {
  if (values.length <= period) return null;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function pctChange(from: number, to: number): number | null {
  if (!from || !Number.isFinite(from)) return null;
  return ((to - from) / from) * 100;
}

/** Simple period return as a decimal (not %). */
export function periodReturn(values: number[], period: number): number | null {
  if (values.length < period + 1) return null;
  const start = values[values.length - 1 - period];
  const end = values[values.length - 1];
  if (!start) return null;
  return (end - start) / start;
}

export function relativeStrength(
  asset: number[],
  benchmark: number[],
  period: number,
): number | null {
  const a = periodReturn(asset, period);
  const b = periodReturn(benchmark, period);
  if (a === null || b === null) return null;
  return (a - b) * 100; // outperformance in percentage points
}

export function highestN(values: number[], n: number): number | null {
  if (values.length === 0) return null;
  const slice = values.slice(-Math.min(n, values.length));
  return Math.max(...slice);
}

export function lowestN(values: number[], n: number): number | null {
  if (values.length === 0) return null;
  const slice = values.slice(-Math.min(n, values.length));
  return Math.min(...slice);
}

export function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
