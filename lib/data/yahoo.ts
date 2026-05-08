import "server-only";

import YahooFinance from "yahoo-finance2";

// v3 requires instantiation — the default export is the class.
// Module-level singleton: one cookie/crumb negotiation per server process.
const yahooFinance = new YahooFinance();

// The package exports types but not via path-stable subpaths, so we describe
// the slice we use inline. Shape matches yahoo-finance2's ChartResultArray.
interface ChartQuoteRow {
  date: Date | string | number;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}
interface ChartMetaSlice {
  symbol?: string;
  currency?: string;
  exchangeName?: string;
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}
interface ChartResultLike {
  meta: ChartMetaSlice;
  quotes?: ChartQuoteRow[];
}

export interface YahooBar {
  timestamp: number;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

export interface YahooSeries {
  symbol: string;
  currency: string | null;
  exchange: string | null;
  bars: YahooBar[];
  meta: {
    regularMarketPrice: number | null;
    previousClose: number | null;
    fiftyTwoWeekHigh: number | null;
    fiftyTwoWeekLow: number | null;
  };
}

type Range = "5d" | "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y";
type Interval = "60m" | "1d" | "1wk" | "1mo";

function rangeStart(range: Range): Date {
  const now = new Date();
  const d = new Date(now);
  switch (range) {
    case "5d":
      d.setDate(d.getDate() - 7);
      break;
    case "1mo":
      d.setMonth(d.getMonth() - 1);
      break;
    case "3mo":
      d.setMonth(d.getMonth() - 3);
      break;
    case "6mo":
      d.setMonth(d.getMonth() - 6);
      break;
    case "1y":
      d.setFullYear(d.getFullYear() - 1);
      break;
    case "2y":
      d.setFullYear(d.getFullYear() - 2);
      break;
    case "5y":
      d.setFullYear(d.getFullYear() - 5);
      break;
  }
  return d;
}

export async function fetchYahooSeries(
  symbol: string,
  { range = "3mo", interval = "1d" }: { range?: Range; interval?: Interval } = {},
): Promise<YahooSeries> {
  const period1 = rangeStart(range);

  // Disable schema validation — Yahoo occasionally adds fields the package's
  // strict schema rejects, even though the data we care about is fine. The
  // shape still matches ChartResultArray, so we cast on the way out.
  const result = (await yahooFinance.chart(
    symbol,
    {
      period1,
      interval,
      includePrePost: false,
      events: "div|split",
    },
    { validateResult: false },
  )) as ChartResultLike;

  const bars: YahooBar[] = (result.quotes ?? []).map((q) => ({
    timestamp: Math.floor(new Date(q.date).getTime() / 1000),
    open: q.open ?? null,
    high: q.high ?? null,
    low: q.low ?? null,
    close: q.close ?? null,
    volume: q.volume ?? null,
  }));

  return {
    symbol: result.meta?.symbol ?? symbol,
    currency: result.meta?.currency ?? null,
    exchange: result.meta?.exchangeName ?? null,
    meta: {
      regularMarketPrice: result.meta?.regularMarketPrice ?? null,
      previousClose:
        result.meta?.chartPreviousClose ?? result.meta?.previousClose ?? null,
      fiftyTwoWeekHigh: result.meta?.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: result.meta?.fiftyTwoWeekLow ?? null,
    },
    bars,
  };
}

export function closes(series: YahooSeries): number[] {
  return series.bars
    .map((b) => b.close)
    .filter((v): v is number => v !== null && Number.isFinite(v));
}

// YYYY-MM-DD (in NY time) of the most recent bar in a series. Returns null
// when the series is empty. Used to detect Yahoo lag — the chart endpoint
// can take 30-60 minutes after the close to append today's bar, so a build
// running at 4:30 PM ET may still see yesterday as the latest bar and
// silently produce a snapshot whose values match yesterday's.
const NY_DATE_FMT_BAR = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function lastBarNyDate(series: YahooSeries): string | null {
  const last = series.bars[series.bars.length - 1];
  if (!last) return null;
  return NY_DATE_FMT_BAR.format(new Date(last.timestamp * 1000));
}

export function volumes(series: YahooSeries): number[] {
  return series.bars
    .map((b) => b.volume)
    .filter((v): v is number => v !== null && Number.isFinite(v));
}

// Q/Q revenue growth from Yahoo's quarterly income-statement time series.
// Returns a fraction (e.g. 0.07 = +7%) or null if Yahoo lacks ≥2 quarters
// of totalRevenue. Used as a fallback when FMP doesn't cover a ticker.
export async function fetchYahooQuarterlyRevenueGrowth(
  symbol: string,
): Promise<number | null> {
  const period1 = new Date();
  period1.setFullYear(period1.getFullYear() - 2);

  // The package's strict schema sometimes rejects fields Yahoo recently
  // added; we only read totalRevenue + date so disable validation.
  const rows = (await yahooFinance.fundamentalsTimeSeries(
    symbol,
    {
      period1,
      type: "quarterly",
      module: "financials",
    },
    { validateResult: false },
  )) as Array<{ date: Date | string | number; totalRevenue?: number | null }>;

  const series = (rows ?? [])
    .map((r) => ({
      ts: new Date(r.date).getTime(),
      revenue:
        r.totalRevenue !== null &&
        r.totalRevenue !== undefined &&
        Number.isFinite(r.totalRevenue)
          ? r.totalRevenue
          : null,
    }))
    .filter((r): r is { ts: number; revenue: number } => r.revenue !== null)
    .sort((a, b) => a.ts - b.ts);

  if (series.length < 2) return null;
  const current = series[series.length - 1].revenue;
  const previous = series[series.length - 2].revenue;
  if (previous === 0) return null;
  return (current - previous) / previous;
}

// Lightweight quote — current price, daily change, volume — for live
// polling on the matrix. Avoids the chart endpoint's full bar history
// since we only need the four fields below per ticker.
export interface YahooQuote {
  symbol: string;
  price: number | null;
  previousClose: number | null;
  changePct: number | null;
  volume: number | null;
}

export async function fetchYahooQuotes(
  symbols: string[],
): Promise<Record<string, YahooQuote | { error: string }>> {
  const out: Record<string, YahooQuote | { error: string }> = {};
  if (symbols.length === 0) return out;
  try {
    const rows = (await yahooFinance.quote(symbols, undefined, {
      validateResult: false,
    })) as Array<{
      symbol?: string;
      regularMarketPrice?: number | null;
      regularMarketPreviousClose?: number | null;
      regularMarketChangePercent?: number | null;
      regularMarketVolume?: number | null;
    }>;
    for (const r of rows ?? []) {
      const sym = r.symbol;
      if (!sym) continue;
      const price = r.regularMarketPrice ?? null;
      const prev = r.regularMarketPreviousClose ?? null;
      out[sym] = {
        symbol: sym,
        price,
        previousClose: prev,
        changePct:
          r.regularMarketChangePercent !== null &&
          r.regularMarketChangePercent !== undefined &&
          Number.isFinite(r.regularMarketChangePercent)
            ? r.regularMarketChangePercent
            : null,
        volume: r.regularMarketVolume ?? null,
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    for (const s of symbols) out[s] = { error: msg };
    return out;
  }
  // Yahoo sometimes returns a subset of the requested tickers; backfill any
  // missing ones with an explicit null marker so callers can distinguish
  // "didn't try" from "tried but Yahoo had no quote."
  for (const s of symbols) {
    if (!(s in out)) out[s] = { error: "no quote returned" };
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sequentially fetch a list of symbols with a small inter-request delay.
 * yahoo-finance2 does its own crumb/cookie negotiation and modest internal
 * throttling, but back-to-back requests can still trip 429s on cold starts —
 * we add a 150ms pacing gap.
 */
export async function fetchYahooBatch(
  symbols: string[],
  options?: { range?: Range; interval?: Interval; delayMs?: number },
): Promise<Record<string, YahooSeries | { error: string }>> {
  const out: Record<string, YahooSeries | { error: string }> = {};
  const delay = options?.delayMs ?? 150;
  for (const s of symbols) {
    try {
      out[s] = await fetchYahooSeries(s, options);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[yahoo] ${s} failed: ${msg}`);
      out[s] = { error: msg };
    }
    await sleep(delay);
  }
  return out;
}
