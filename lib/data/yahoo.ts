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
