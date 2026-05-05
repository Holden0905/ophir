import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  DailyTechnicals,
  RegimeClassification,
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

