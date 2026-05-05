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

/**
 * EMA series. Returns one entry per input value; the first `period - 1`
 * entries are null (warm-up). The first valid entry is the SMA seed.
 * Uses the standard 2/(N+1) multiplier to match `ema()` above.
 */
export function emaSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let value =
    values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = value;
  for (let i = period; i < values.length; i++) {
    value = values[i] * k + value * (1 - k);
    out[i] = value;
  }
  return out;
}

/** SMA series, one entry per input. Warm-up entries are null. */
export function smaSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  out[period - 1] = sum / period;
  for (let i = period; i < values.length; i++) {
    sum += values[i] - values[i - period];
    out[i] = sum / period;
  }
  return out;
}

/**
 * 14-period Wilder RSI series. Output[i] is the RSI through index i.
 * The first `period` entries are null (need at least period+1 closes).
 */
export function rsiSeries(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

/** Rolling N-period mean. Output[i] is the mean of values[i-N+1..i]. */
export function rollingMean(
  values: number[],
  period: number,
): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  out[period - 1] = sum / period;
  for (let i = period; i < values.length; i++) {
    sum += values[i] - values[i - period];
    out[i] = sum / period;
  }
  return out;
}
