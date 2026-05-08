import "server-only";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { consecutiveQualifyingDays } from "@/lib/signals/labels";
import type {
  ConvictionGrade,
  DailyTechnicals,
  RegimeClassification,
  SetupType,
  Signal,
  Stock,
  StockTechnicals,
} from "@/lib/supabase/types";

const RECENT_LOOKBACK = 5; // trading-day window for "Recent triggers" section

export interface TradingPageData {
  date: string;
  regime: {
    classification: RegimeClassification | null;
    narrative: string | null;
    snapshot_date: string | null;
  };
  /** All non-archived watchlist stocks. */
  stocks: Stock[];
  /** Today's signals across the watchlist (one row per ticker per setup). */
  todaysSignals: Signal[];
  /** Today's daily_technicals across the watchlist. */
  todaysDaily: DailyTechnicals[];
  /** Live stock_technicals for current price + intraday change. */
  stockTechnicals: StockTechnicals[];
  /**
   * Triggered_today rows from the last RECENT_LOOKBACK trading days, excluding
   * today. Used for the "Recent triggers" feed. The set of distinct dates here
   * is also used to drive the "consecutive days qualifying" count.
   */
  recentTriggers: Signal[];
  /**
   * The full signals history across the lookback window — used to compute
   * how many consecutive trading days each currently-qualifying setup has been
   * in the qualifies state.
   */
  recentSignals: Signal[];
}

/**
 * Pull the trading-page payload in a single batch. We do all reads through
 * the cookie-bound client so RLS sees the authenticated user; the underlying
 * tables grant SELECT to `authenticated` already.
 */
export async function fetchTradingPageData(
  todayDate: string,
): Promise<TradingPageData> {
  const supabase = await createClient();

  const [regimeRes, stocksRes] = await Promise.all([
    supabase
      .from("regime_snapshots")
      .select("regime_classification, narrative, snapshot_date, created_at")
      .order("snapshot_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("stocks")
      .select("*")
      .eq("is_archived", false)
      .order("ticker", { ascending: true }),
  ]);

  const regimeRow = (regimeRes.data ?? [])[0] as
    | {
        regime_classification: RegimeClassification | null;
        narrative: string | null;
        snapshot_date: string | null;
      }
    | undefined;
  const stocks = (stocksRes.data ?? []) as Stock[];
  const tickers = stocks.map((s) => s.ticker);

  if (tickers.length === 0) {
    return {
      date: todayDate,
      regime: {
        classification: regimeRow?.regime_classification ?? null,
        narrative: regimeRow?.narrative ?? null,
        snapshot_date: regimeRow?.snapshot_date ?? null,
      },
      stocks: [],
      todaysSignals: [],
      todaysDaily: [],
      stockTechnicals: [],
      recentTriggers: [],
      recentSignals: [],
    };
  }

  // Pull a generous calendar-day window so we always cover RECENT_LOOKBACK
  // trading days even across long weekends. We narrow to actual trading
  // days client-side using the distinct dates in the result.
  const lookbackStart = new Date(`${todayDate}T00:00:00Z`);
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - 14);
  const lookbackStartStr = lookbackStart.toISOString().slice(0, 10);

  const [todaysSignalsRes, todaysDailyRes, stockTechRes, recentSignalsRes] =
    await Promise.all([
      supabase
        .from("signals")
        .select("*")
        .in("ticker", tickers)
        .eq("date", todayDate),
      supabase
        .from("daily_technicals")
        .select("*")
        .in("ticker", tickers)
        .eq("date", todayDate),
      supabase.from("stock_technicals").select("*").in("ticker", tickers),
      supabase
        .from("signals")
        .select("*")
        .in("ticker", tickers)
        .gte("date", lookbackStartStr)
        .order("date", { ascending: false }),
    ]);

  const recentSignals = (recentSignalsRes.data ?? []) as Signal[];

  // Distinct trading dates the engine has written, excluding today, sorted
  // descending. Take the most recent RECENT_LOOKBACK as the "last 5 trading
  // days" window.
  const distinctDates = Array.from(
    new Set(
      recentSignals
        .map((s) => s.date)
        .filter((d) => d !== todayDate),
    ),
  ).sort((a, b) => (a < b ? 1 : -1));
  const recentDateSet = new Set(distinctDates.slice(0, RECENT_LOOKBACK));
  const recentTriggers = recentSignals.filter(
    (s) => s.state === "triggered_today" && recentDateSet.has(s.date),
  );

  return {
    date: todayDate,
    regime: {
      classification: regimeRow?.regime_classification ?? null,
      narrative: regimeRow?.narrative ?? null,
      snapshot_date: regimeRow?.snapshot_date ?? null,
    },
    stocks,
    todaysSignals: (todaysSignalsRes.data ?? []) as Signal[],
    todaysDaily: (todaysDailyRes.data ?? []) as DailyTechnicals[],
    stockTechnicals: (stockTechRes.data ?? []) as StockTechnicals[],
    recentTriggers,
    recentSignals,
  };
}

// Watchlist signal report — what each setup is doing on each watchlist
// name "as of" the given date. Service-role read so the regime cron can
// use it without a user session. Single-user assumption: pulls every
// non-archived stocks row regardless of user_id.
export interface WatchlistSignalReport {
  date: string;
  total_watchlist: number;
  triggered_today: Array<{
    ticker: string;
    setup: SetupType;
    conviction: ConvictionGrade[];
  }>;
  qualifying: Array<{
    ticker: string;
    setup: SetupType;
    consecutive_days: number;
  }>;
  fell_out_today: Array<{
    ticker: string;
    setup: SetupType;
    days_qualified: number;
  }>;
  in_cooldown: Array<{
    ticker: string;
    setup: SetupType;
    days_remaining: number;
  }>;
  /** Watchlist names with no setup activity (none today, not in cooldown). */
  quiet_count: number;
}

const WATCHLIST_LOOKBACK_DAYS = 14; // generous calendar window covers 5+ trading days for cooldown math

export async function fetchWatchlistSignalReport(
  todayDate: string,
): Promise<WatchlistSignalReport> {
  const svc = createServiceClient();

  const { data: stocksRows } = await svc
    .from("stocks")
    .select("ticker")
    .eq("is_archived", false);
  const tickers = Array.from(
    new Set(((stocksRows ?? []) as Array<{ ticker: string }>).map((r) => r.ticker)),
  );

  const empty: WatchlistSignalReport = {
    date: todayDate,
    total_watchlist: 0,
    triggered_today: [],
    qualifying: [],
    fell_out_today: [],
    in_cooldown: [],
    quiet_count: 0,
  };
  if (tickers.length === 0) return empty;

  const lookbackStart = new Date(`${todayDate}T00:00:00Z`);
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - WATCHLIST_LOOKBACK_DAYS);
  const lookbackStartStr = lookbackStart.toISOString().slice(0, 10);

  const { data: signalsRows } = await svc
    .from("signals")
    .select("*")
    .in("ticker", tickers)
    .gte("date", lookbackStartStr)
    .order("date", { ascending: false });
  const recentSignals = (signalsRows ?? []) as Signal[];

  // For premarket runs, today's signals don't exist yet (the signal
  // engine fires after the close). The "current state" the brief should
  // describe is the most recent prior session's read. We snap the
  // effective date forward to the latest date that has any signals
  // when nothing exists for todayDate yet.
  const datesWithSignals = Array.from(
    new Set(recentSignals.map((s) => s.date)),
  ).sort((a, b) => (a < b ? 1 : -1));
  const hasTodayRows = datesWithSignals.includes(todayDate);
  const effectiveDate =
    hasTodayRows || datesWithSignals.length === 0
      ? todayDate
      : datesWithSignals[0];

  // Index signals by (ticker, setup, date) for prior-day lookups.
  const byKey = new Map<string, Signal>();
  for (const s of recentSignals) {
    byKey.set(`${s.ticker}|${s.setup_type}|${s.date}`, s);
  }
  const setups: SetupType[] = ["trend_continuation", "reversal_recovery"];

  // Most recent triggered_today within the lookback (excluding the
  // effective date's matches — those go in `triggered_today` instead).
  // Used to detect cooldown rows by walking back from the effective date.
  const recentTriggers = recentSignals
    .filter((s) => s.state === "triggered_today" && s.date !== effectiveDate)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const triggered: WatchlistSignalReport["triggered_today"] = [];
  const qualifying: WatchlistSignalReport["qualifying"] = [];
  const fellOut: WatchlistSignalReport["fell_out_today"] = [];
  const cooledDown: WatchlistSignalReport["in_cooldown"] = [];
  const activeKeys = new Set<string>(); // tickers that show up anywhere

  // Walk the effective-date signals — every (ticker, setup) row the
  // engine produced for that session. Triggered is loud; qualifies tells
  // us how many consecutive sessions; none + a previous-day qualifies
  // means the setup just rolled off ("fell out").
  for (const setup of setups) {
    for (const ticker of tickers) {
      const today = byKey.get(`${ticker}|${setup}|${effectiveDate}`);
      if (!today) continue;
      if (today.state === "triggered_today") {
        triggered.push({
          ticker,
          setup,
          conviction: (today.conviction_grades ?? []) as ConvictionGrade[],
        });
        activeKeys.add(ticker);
      } else if (today.state === "qualifies") {
        qualifying.push({
          ticker,
          setup,
          consecutive_days: consecutiveQualifyingDays(
            recentSignals,
            ticker,
            setup,
          ),
        });
        activeKeys.add(ticker);
      } else if (today.state === "none") {
        // Did this setup just fall out? Look at the most recent prior
        // session for this (ticker, setup). The recentSignals array is
        // sorted desc, so the first non-effectiveDate entry is it.
        const prior = recentSignals.find(
          (s) =>
            s.ticker === ticker &&
            s.setup_type === setup &&
            s.date !== effectiveDate,
        );
        if (prior?.state === "qualifies") {
          const priorDays = consecutiveQualifyingDays(
            recentSignals.filter((s) => s.date !== effectiveDate),
            ticker,
            setup,
          );
          fellOut.push({ ticker, setup, days_qualified: priorDays });
          activeKeys.add(ticker);
        }
      }
    }
  }

  // Cooldown — walk recentTriggers (sorted desc), latest hit per
  // (ticker, setup). If cooled_until > effective AND effective-date's
  // row isn't already triggered_today (don't double-list), it's cooling.
  const seenCooldown = new Set<string>();
  for (const s of recentTriggers) {
    const key = `${s.ticker}|${s.setup_type}`;
    if (seenCooldown.has(key)) continue;
    seenCooldown.add(key);
    if (!s.cooled_until) continue;
    if (s.cooled_until <= effectiveDate) continue;
    const todayRow = byKey.get(`${s.ticker}|${s.setup_type}|${effectiveDate}`);
    if (todayRow?.state === "triggered_today") continue;
    const ms =
      Date.parse(`${s.cooled_until}T00:00:00Z`) -
      Date.parse(`${effectiveDate}T00:00:00Z`);
    const days_remaining = Math.max(1, Math.ceil(ms / 86_400_000));
    cooledDown.push({
      ticker: s.ticker,
      setup: s.setup_type,
      days_remaining,
    });
    activeKeys.add(s.ticker);
  }

  return {
    date: effectiveDate,
    total_watchlist: tickers.length,
    triggered_today: triggered.sort((a, b) => a.ticker.localeCompare(b.ticker)),
    qualifying: qualifying.sort((a, b) => a.ticker.localeCompare(b.ticker)),
    fell_out_today: fellOut.sort((a, b) => a.ticker.localeCompare(b.ticker)),
    in_cooldown: cooledDown.sort((a, b) => a.ticker.localeCompare(b.ticker)),
    quiet_count: tickers.length - activeKeys.size,
  };
}
