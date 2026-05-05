import type {
  ConvictionGrade,
  Signal,
  SetupType,
  SignalState,
} from "@/lib/supabase/types";

export const SETUP_FULL: Record<SetupType, string> = {
  trend_continuation: "Trend continuation",
  reversal_recovery: "Reversal/recovery",
};

export const SETUP_SHORT: Record<SetupType, string> = {
  trend_continuation: "TC",
  reversal_recovery: "RR",
};

export const CONVICTION_LABEL: Record<ConvictionGrade, string> = {
  high_volume: "High volume",
  mature_trend: "Mature trend",
  sector_tailwind: "Sector tailwind",
  accumulation: "Accumulation",
  trend_reversal_forming: "Trend reversal forming",
};

const STATE_RANK: Record<SignalState, number> = {
  triggered_today: 2,
  qualifies: 1,
  none: 0,
};

export function compareSignalState(a: SignalState, b: SignalState): number {
  return STATE_RANK[b] - STATE_RANK[a];
}

/**
 * Count the consecutive most-recent trading days a (ticker, setup) has been
 * in `qualifies` state. Walks the lookback signal history descending. Any
 * triggered_today or none entry breaks the run.
 */
export function consecutiveQualifyingDays(
  recentSignals: Signal[],
  ticker: string,
  setup: SetupType,
): number {
  const matching = recentSignals
    .filter((s) => s.ticker === ticker && s.setup_type === setup)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  let count = 0;
  for (const s of matching) {
    if (s.state === "qualifies") count++;
    else break;
  }
  return count;
}

/**
 * Pick the "dominant" setup row for a ticker — the one whose state determines
 * the Matrix Setup cell. The engine already enforces precedence (Reversal
 * wins when both qualify, demoting Trend to `none`), so picking the higher
 * state surfaces the right one. Reversal beats Trend on a tie.
 */
export function dominantSignal<T extends { state: SignalState; setup_type: SetupType }>(
  signals: T[],
): T | null {
  if (signals.length === 0) return null;
  let best: T | null = null;
  for (const s of signals) {
    if (s.state === "none") continue;
    if (best === null) {
      best = s;
      continue;
    }
    const cmp = compareSignalState(s.state, best.state);
    if (cmp < 0) {
      best = s;
    } else if (
      cmp === 0 &&
      s.setup_type === "reversal_recovery" &&
      best.setup_type !== "reversal_recovery"
    ) {
      best = s;
    }
  }
  return best;
}
