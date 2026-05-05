import "server-only";

import { fetchYahooSeries } from "@/lib/data/yahoo";
import { createServiceClient } from "@/lib/supabase/server";
import { indicatorBars, type IndicatorBar } from "@/lib/signals/series";
import {
  evaluateReversalRecovery,
  evaluateTrendContinuation,
} from "@/lib/signals/rules";
import { addCalendarDays } from "@/lib/signals/dates";
import type {
  ConvictionGrade,
  RegimeClassification,
  SetupType,
  SignalState,
} from "@/lib/supabase/types";

// framework.md §False-signal controls: cooldown is "5 trading days" after a
// triggered_today event. We approximate as 7 calendar days, which always
// covers 5 trading days even across a long weekend or single holiday.
const COOLDOWN_CALENDAR_DAYS = 7;

interface EvaluatedSetup {
  setup_type: SetupType;
  state: SignalState;
  conviction_grades: ConvictionGrade[];
  triggered_at: string | null;
  cooled_until: string | null;
}

export interface SignalEvaluation {
  ticker: string;
  date: string;
  setups: EvaluatedSetup[];
  /** Today's daily_technicals row (already upserted). */
  technicals: {
    close: number;
    volume: number;
    ema_5: number | null;
    ema_8: number | null;
    ema_21: number | null;
    sma_50: number | null;
    rsi_14: number | null;
    avg_volume_20: number | null;
  };
  /** Per-setup state-vs-yesterday transition, if any. null if no prior signal row. */
  transitions: Record<SetupType, { from: SignalState | null; to: SignalState }>;
}

function deriveState(
  todayRequired: boolean,
  yesterdayRequired: boolean,
): SignalState {
  // framework.md §State Machine
  if (!todayRequired) return "none";
  return yesterdayRequired ? "qualifies" : "triggered_today";
}

function regimeAllowsTrend(regime: RegimeClassification | null): boolean {
  // framework.md §Setup 1 §Regime: Active in Risk On / Transitional;
  // suppressed in Risk Off / Choppy. Null regime → don't suppress (better
  // to surface than silently swallow).
  if (regime === null) return true;
  return regime === "risk_on" || regime === "transitional";
}

// Reversal/Recovery is allowed in every regime. The framework calls it
// "lower priority in Risk On" but doesn't gate it. Setup precedence
// (Reversal wins) handles the priority question separately.
function regimeAllowsReversal(): boolean {
  return true;
}

async function fetchLatestRegime(): Promise<RegimeClassification | null> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("regime_snapshots")
    .select("regime_classification, snapshot_date, created_at")
    .order("snapshot_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);
  const row = data?.[0] as
    | { regime_classification: RegimeClassification | null }
    | undefined;
  return row?.regime_classification ?? null;
}

async function fetchPreviousTrigger(
  ticker: string,
  setup: SetupType,
  beforeDate: string,
): Promise<{ date: string; cooled_until: string | null } | null> {
  // Most recent triggered_today row strictly before today, used to enforce
  // the cooldown window. We rely on cooled_until populated at trigger time.
  const svc = createServiceClient();
  const { data } = await svc
    .from("signals")
    .select("date, cooled_until")
    .eq("ticker", ticker)
    .eq("setup_type", setup)
    .eq("state", "triggered_today")
    .lt("date", beforeDate)
    .order("date", { ascending: false })
    .limit(1);
  const row = data?.[0] as
    | { date: string; cooled_until: string | null }
    | undefined;
  return row ?? null;
}

async function fetchYesterdaySignal(
  ticker: string,
  setup: SetupType,
  beforeDate: string,
): Promise<SignalState | null> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("signals")
    .select("state")
    .eq("ticker", ticker)
    .eq("setup_type", setup)
    .lt("date", beforeDate)
    .order("date", { ascending: false })
    .limit(1);
  const row = data?.[0] as { state: SignalState } | undefined;
  return row?.state ?? null;
}

function inCooldown(
  todayDate: string,
  prevTriggerDate: string,
  cooledUntil: string | null,
): boolean {
  // Prefer the explicit cooled_until column when populated; fall back to the
  // calendar-day approximation if a legacy row was written without it.
  if (cooledUntil) return todayDate <= cooledUntil;
  const fallback = addCalendarDays(prevTriggerDate, COOLDOWN_CALENDAR_DAYS);
  return todayDate <= fallback;
}

async function upsertDailyTechnicals(bar: IndicatorBar, ticker: string) {
  const svc = createServiceClient();
  const { error } = await svc.from("daily_technicals").upsert(
    {
      ticker,
      date: bar.date,
      close: bar.close,
      volume: Math.round(bar.volume),
      ema_5: bar.ema_5,
      ema_8: bar.ema_8,
      ema_21: bar.ema_21,
      sma_50: bar.sma_50,
      rsi_14: bar.rsi_14,
      avg_volume_20:
        bar.avg_volume_20 !== null ? Math.round(bar.avg_volume_20) : null,
    },
    { onConflict: "ticker,date" },
  );
  if (error) {
    throw new Error(`daily_technicals upsert ${ticker}: ${error.message}`);
  }
}

async function upsertSignal(
  ticker: string,
  date: string,
  setup: EvaluatedSetup,
) {
  const svc = createServiceClient();
  const { error } = await svc.from("signals").upsert(
    {
      ticker,
      date,
      setup_type: setup.setup_type,
      state: setup.state,
      conviction_grades: setup.conviction_grades,
      triggered_at: setup.triggered_at,
      cooled_until: setup.cooled_until,
    },
    { onConflict: "ticker,date,setup_type" },
  );
  if (error) {
    throw new Error(
      `signals upsert ${ticker} ${setup.setup_type}: ${error.message}`,
    );
  }
}

/**
 * Evaluate today's signals for a single ticker. Side-effects:
 *  - upserts today's daily_technicals row
 *  - upserts both signals rows (trend_continuation, reversal_recovery)
 */
export async function evaluateSignalsForTicker(
  ticker: string,
  options: { regime?: RegimeClassification | null } = {},
): Promise<SignalEvaluation> {
  console.log(`[signals] ${ticker} → fetching Yahoo (1y daily)`);
  const series = await fetchYahooSeries(ticker, {
    range: "1y",
    interval: "1d",
  });
  const bars = indicatorBars(series);
  if (bars.length < 2) {
    throw new Error(`insufficient indicator history for ${ticker}`);
  }

  const i = bars.length - 1;
  const today = bars[i];
  console.log(
    `[signals] ${ticker} → bars=${bars.length} latest=${today.date} close=${today.close}`,
  );

  await upsertDailyTechnicals(today, ticker);

  const regime =
    options.regime !== undefined ? options.regime : await fetchLatestRegime();

  const trendToday = evaluateTrendContinuation(bars, i);
  const trendYesterday = evaluateTrendContinuation(bars, i - 1);
  const reversalToday = evaluateReversalRecovery(bars, i);
  const reversalYesterday = evaluateReversalRecovery(bars, i - 1);

  let trendState = deriveState(trendToday.required, trendYesterday.required);
  let reversalState = deriveState(
    reversalToday.required,
    reversalYesterday.required,
  );

  // framework.md §Setup 1 §Regime: suppress in Risk Off / Choppy.
  if (!regimeAllowsTrend(regime)) trendState = "none";
  if (!regimeAllowsReversal()) reversalState = "none";

  // framework.md §False-signal controls: cooldown — once same setup
  // triggered, downgrade subsequent triggered_today to qualifies for 5
  // trading days. We don't suppress to "none": "qualifies" still
  // communicates that conditions remain met, just without the loud badge.
  const trendPrev = await fetchPreviousTrigger(
    ticker,
    "trend_continuation",
    today.date,
  );
  if (
    trendState === "triggered_today" &&
    trendPrev &&
    inCooldown(today.date, trendPrev.date, trendPrev.cooled_until)
  ) {
    trendState = "qualifies";
  }
  const reversalPrev = await fetchPreviousTrigger(
    ticker,
    "reversal_recovery",
    today.date,
  );
  if (
    reversalState === "triggered_today" &&
    reversalPrev &&
    inCooldown(today.date, reversalPrev.date, reversalPrev.cooled_until)
  ) {
    reversalState = "qualifies";
  }

  // framework.md §False-signal controls: setup precedence — Reversal wins
  // when both qualify. Implemented by demoting Trend Continuation when
  // Reversal/Recovery is firing or qualifying today. We keep Reversal's
  // state intact rather than simply muting Trend, so the higher-conviction
  // setup is the one written to UI sort.
  if (
    (reversalState === "triggered_today" || reversalState === "qualifies") &&
    (trendState === "triggered_today" || trendState === "qualifies")
  ) {
    trendState = "none";
  }

  const nowIso = new Date().toISOString();
  const trendSetup: EvaluatedSetup = {
    setup_type: "trend_continuation",
    state: trendState,
    conviction_grades:
      trendState === "none" ? [] : trendToday.conviction,
    triggered_at: trendState === "triggered_today" ? nowIso : null,
    cooled_until:
      trendState === "triggered_today"
        ? addCalendarDays(today.date, COOLDOWN_CALENDAR_DAYS)
        : null,
  };
  const reversalSetup: EvaluatedSetup = {
    setup_type: "reversal_recovery",
    state: reversalState,
    conviction_grades:
      reversalState === "none" ? [] : reversalToday.conviction,
    triggered_at: reversalState === "triggered_today" ? nowIso : null,
    cooled_until:
      reversalState === "triggered_today"
        ? addCalendarDays(today.date, COOLDOWN_CALENDAR_DAYS)
        : null,
  };

  const trendYesterdayRow = await fetchYesterdaySignal(
    ticker,
    "trend_continuation",
    today.date,
  );
  const reversalYesterdayRow = await fetchYesterdaySignal(
    ticker,
    "reversal_recovery",
    today.date,
  );

  await upsertSignal(ticker, today.date, trendSetup);
  await upsertSignal(ticker, today.date, reversalSetup);

  return {
    ticker,
    date: today.date,
    setups: [trendSetup, reversalSetup],
    technicals: {
      close: today.close,
      volume: today.volume,
      ema_5: today.ema_5,
      ema_8: today.ema_8,
      ema_21: today.ema_21,
      sma_50: today.sma_50,
      rsi_14: today.rsi_14,
      avg_volume_20: today.avg_volume_20,
    },
    transitions: {
      trend_continuation: { from: trendYesterdayRow, to: trendSetup.state },
      reversal_recovery: {
        from: reversalYesterdayRow,
        to: reversalSetup.state,
      },
    },
  };
}

export async function fetchWatchlistTickers(): Promise<string[]> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("stocks")
    .select("ticker")
    .eq("is_archived", false);
  if (error) throw new Error(`watchlist fetch: ${error.message}`);
  const tickers = (data ?? []).map((r) => (r as { ticker: string }).ticker);
  return Array.from(new Set(tickers.map((t) => t.toUpperCase()))).sort();
}

/** Run the full daily job for every active watchlist ticker. */
export async function runDailySignalJob(): Promise<{
  date: string | null;
  regime: RegimeClassification | null;
  results: Array<
    | { ticker: string; ok: true; evaluation: SignalEvaluation }
    | { ticker: string; ok: false; error: string }
  >;
}> {
  const tickers = await fetchWatchlistTickers();
  console.log(
    `[signals] daily job → ${tickers.length} tickers: ${tickers.join(",")}`,
  );
  const regime = await fetchLatestRegime();
  console.log(`[signals] regime → ${regime ?? "(none)"}`);

  const results: Array<
    | { ticker: string; ok: true; evaluation: SignalEvaluation }
    | { ticker: string; ok: false; error: string }
  > = [];
  let lastDate: string | null = null;
  for (const ticker of tickers) {
    try {
      const evaluation = await evaluateSignalsForTicker(ticker, { regime });
      results.push({ ticker, ok: true, evaluation });
      lastDate = evaluation.date;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[signals] ${ticker} FAILED: ${msg}`);
      results.push({ ticker, ok: false, error: msg });
    }
  }

  return { date: lastDate, regime, results };
}
