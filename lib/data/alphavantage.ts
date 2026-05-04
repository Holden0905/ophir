import "server-only";

import { env } from "@/lib/env";

const AV_BASE = "https://www.alphavantage.co/query";

export interface FundamentalsRaw {
  ticker: string;
  market_cap: number | null;
  gross_margin: number | null;
  net_margin: number | null;
  qq_revenue_growth: number | null;
  yy_revenue_growth: number | null;
  net_debt: number | null;
  debt_market_cap_ratio: number | null;
  sector: string | null;
  industry: string | null;
  name: string | null;
}

// Free tier: 25 calls/day, with a burst limit per minute. Serialize all AV
// calls and enforce ≥1s between them so a refresh-all over many tickers
// can't fire in a tight burst. The daily quota is still bounded by AV's
// own response (we surface their rate-limit `Note`/`Information` body).
const AV_MIN_INTERVAL_MS = 1_000;
let lastCallAt = 0;
let avChain: Promise<void> = Promise.resolve();

function gate(): Promise<void> {
  const next = avChain.then(async () => {
    const wait = Math.max(0, lastCallAt + AV_MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
  });
  // Swallow rejections in the chain so one failed call doesn't poison
  // every subsequent gate(); per-call errors are still thrown to callers.
  avChain = next.catch(() => {});
  return next;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "None" || v === "-") return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

export async function fetchOverview(
  ticker: string,
): Promise<FundamentalsRaw | null> {
  await gate();
  const url = `${AV_BASE}?function=OVERVIEW&symbol=${encodeURIComponent(
    ticker,
  )}&apikey=${env.ALPHA_VANTAGE_KEY}`;
  console.log(`[alphavantage] OVERVIEW ${ticker}`);
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(
      `[alphavantage] ${ticker} ${res.status} ${res.statusText} → ${body.slice(0, 300)}`,
    );
    throw new Error(`AlphaVantage ${ticker} ${res.status}`);
  }
  const data = (await res.json()) as Record<string, string>;

  // AV returns an empty object for unknown tickers, and a Note/Information
  // string when rate-limited or quota-exceeded.
  if (!data || Object.keys(data).length === 0) {
    console.warn(`[alphavantage] ${ticker} returned empty object (unknown?)`);
    return null;
  }
  if (data.Note || data.Information) {
    console.error(
      `[alphavantage] ${ticker} rate-limited: ${data.Note ?? data.Information}`,
    );
    throw new Error(`AlphaVantage limit: ${data.Note ?? data.Information}`);
  }

  const marketCap = num(data.MarketCapitalization);
  const grossMargin =
    num(data.GrossProfitTTM) !== null && num(data.RevenueTTM)
      ? (num(data.GrossProfitTTM) as number) /
        (num(data.RevenueTTM) as number)
      : num(data.ProfitMargin) !== null
        ? null // AV exposes net profit margin directly; no gross-margin field on free tier
        : null;
  const netMargin = num(data.ProfitMargin);
  const qq = num(data.QuarterlyRevenueGrowthYOY); // AV only exposes YoY at free tier
  const yy = num(data.QuarterlyRevenueGrowthYOY);

  return {
    ticker,
    name: data.Name ?? null,
    sector: data.Sector ?? null,
    industry: data.Industry ?? null,
    market_cap: marketCap,
    gross_margin: grossMargin,
    net_margin: netMargin,
    qq_revenue_growth: qq,
    yy_revenue_growth: yy,
    net_debt: null, // not on free OVERVIEW
    debt_market_cap_ratio: null,
  };
}
