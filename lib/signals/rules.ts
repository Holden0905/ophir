import "server-only";

// Pure setup-rule evaluators. No IO. See docs/framework.md for the
// canonical conditions; section references are inline.

import type {
  ConvictionGrade,
  ReversalConvictionGrade,
  TrendConvictionGrade,
} from "@/lib/supabase/types";
import type { IndicatorBar } from "@/lib/signals/series";

export interface SetupEvaluation {
  /** All required conditions met as of `bars[index]`. */
  required: boolean;
  /**
   * Conviction badges that apply on the day. Empty when `required` is false
   * (we don't decorate non-firing setups).
   */
  conviction: ConvictionGrade[];
}

const VOLUME_CONVICTION_MULT = 1.2; // framework.md §Conviction grade

function rising5EmaTwoDays(bars: IndicatorBar[], i: number): boolean {
  // framework.md §Setup 1 & §False-signal controls:
  // EMA(5) rising 2+ consecutive days kills the falling-knife trade.
  if (i < 2) return false;
  const t = bars[i].ema_5;
  const t1 = bars[i - 1].ema_5;
  const t2 = bars[i - 2].ema_5;
  if (t === null || t1 === null || t2 === null) return false;
  return t > t1 && t1 > t2;
}

function high52(bars: IndicatorBar[], i: number): number | null {
  // framework.md §Setup 2: "current_price < 0.80 × 52w_high".
  // 252 trading bars ≈ one calendar year.
  const start = Math.max(0, i - 251);
  let max = -Infinity;
  for (let j = start; j <= i; j++) {
    if (bars[j].close > max) max = bars[j].close;
  }
  return max === -Infinity ? null : max;
}

function minRsi10(bars: IndicatorBar[], i: number): number | null {
  // framework.md §Setup 2: "min(RSI(14)) over last 10 days < 35".
  const start = Math.max(0, i - 9);
  let min: number | null = null;
  for (let j = start; j <= i; j++) {
    const r = bars[j].rsi_14;
    if (r === null) continue;
    if (min === null || r < min) min = r;
  }
  return min;
}

function recentEma8AboveEma21(bars: IndicatorBar[], i: number): boolean {
  // framework.md §Setup 2 conviction: "EMA(8) crossed above EMA(21) recently".
  // We define "recent" as a cross within the last 10 bars.
  const lookback = 10;
  const start = Math.max(1, i - lookback + 1);
  for (let j = start; j <= i; j++) {
    const e8 = bars[j].ema_8;
    const e21 = bars[j].ema_21;
    const e8p = bars[j - 1].ema_8;
    const e21p = bars[j - 1].ema_21;
    if (e8 === null || e21 === null || e8p === null || e21p === null) continue;
    if (e8 > e21 && e8p <= e21p) return true;
  }
  return false;
}

function accumulationLast5(bars: IndicatorBar[], i: number): boolean {
  // framework.md §Setup 2 conviction: up-volume > down-volume across last 5 sessions.
  if (i < 5) return false;
  let upVol = 0;
  let downVol = 0;
  for (let j = i - 4; j <= i; j++) {
    if (j === 0) continue;
    const change = bars[j].close - bars[j - 1].close;
    if (change > 0) upVol += bars[j].volume;
    else if (change < 0) downVol += bars[j].volume;
  }
  return upVol > downVol;
}

/** Evaluate Trend Continuation (framework.md §Setup 1) on `bars[i]`. */
export function evaluateTrendContinuation(
  bars: IndicatorBar[],
  i: number,
): SetupEvaluation {
  const b = bars[i];
  if (
    b === undefined ||
    b.ema_5 === null ||
    b.ema_8 === null ||
    b.ema_21 === null ||
    b.rsi_14 === null
  ) {
    return { required: false, conviction: [] };
  }

  const required =
    b.close > b.ema_8 &&
    rising5EmaTwoDays(bars, i) &&
    b.ema_8 > b.ema_21 &&
    b.rsi_14 > 40 &&
    b.rsi_14 < 70;

  if (!required) return { required: false, conviction: [] };

  const conviction: TrendConvictionGrade[] = [];
  if (
    b.avg_volume_20 !== null &&
    b.volume > VOLUME_CONVICTION_MULT * b.avg_volume_20
  ) {
    conviction.push("high_volume");
  }
  if (b.sma_50 !== null && b.ema_21 > b.sma_50) {
    conviction.push("mature_trend");
  }
  // sector_tailwind is intentionally omitted here — it requires the SPY +
  // sector ETF series and a sector→ETF map, which are not in this pure
  // function's inputs. The orchestrator can append it after the fact.
  return { required, conviction };
}

/** Evaluate Reversal/Recovery (framework.md §Setup 2) on `bars[i]`. */
export function evaluateReversalRecovery(
  bars: IndicatorBar[],
  i: number,
): SetupEvaluation {
  const b = bars[i];
  if (
    b === undefined ||
    b.ema_5 === null ||
    b.ema_8 === null ||
    b.rsi_14 === null
  ) {
    return { required: false, conviction: [] };
  }

  const h52 = high52(bars, i);
  const minR = minRsi10(bars, i);
  if (h52 === null || minR === null) return { required: false, conviction: [] };

  const required =
    b.close < 0.8 * h52 &&
    minR < 35 &&
    b.rsi_14 > 40 &&
    rising5EmaTwoDays(bars, i) &&
    b.close > b.ema_8;

  if (!required) return { required: false, conviction: [] };

  const conviction: ReversalConvictionGrade[] = [];
  if (
    b.avg_volume_20 !== null &&
    b.volume > VOLUME_CONVICTION_MULT * b.avg_volume_20
  ) {
    conviction.push("high_volume");
  }
  if (accumulationLast5(bars, i)) {
    conviction.push("accumulation");
  }
  if (recentEma8AboveEma21(bars, i)) {
    conviction.push("trend_reversal_forming");
  }
  return { required, conviction };
}
