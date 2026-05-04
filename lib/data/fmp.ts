import "server-only";

import { env } from "@/lib/env";

// FMP retired the /api/v3/* "legacy" endpoints for accounts created after
// 2025-08-31. The current free-tier surface lives at /stable/* and takes
// the ticker as a `symbol` query param rather than as a path segment.
const FMP_BASE = "https://financialmodelingprep.com/stable";

interface IncomeStatementRow {
  symbol: string;
  date: string;
  period: string;
  revenue: number | null;
}

interface RatiosRow {
  symbol: string;
  date: string;
  debtToMarketCap: number | null;
}

async function fmpFetch<T>(path: string): Promise<T | null> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${FMP_BASE}${path}${sep}apikey=${env.FMP_API_KEY}`;
  console.log(`[fmp] GET ${path}`);
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(
      `[fmp] ${path} ${res.status} ${res.statusText} → ${body.slice(0, 300)}`,
    );
    return null;
  }
  const data = (await res.json()) as T | { "Error Message"?: string };
  if (data && typeof data === "object" && "Error Message" in data) {
    console.warn(`[fmp] ${path} error: ${data["Error Message"]}`);
    return null;
  }
  return data as T;
}

// True Q/Q revenue growth from the last two quarterly income statements.
// Returns a fraction (e.g. 0.07 for +7%) so it lines up with the existing
// qq_revenue_growth field convention.
export async function fetchQuarterlyRevenueGrowth(
  ticker: string,
): Promise<number | null> {
  const rows = await fmpFetch<IncomeStatementRow[]>(
    `/income-statement?symbol=${encodeURIComponent(ticker)}&period=quarter&limit=2`,
  );
  if (!rows || rows.length < 2) return null;
  // FMP returns most-recent first.
  const [current, previous] = rows;
  if (
    !current?.revenue ||
    !previous?.revenue ||
    !Number.isFinite(current.revenue) ||
    !Number.isFinite(previous.revenue) ||
    previous.revenue === 0
  ) {
    return null;
  }
  return (current.revenue - previous.revenue) / previous.revenue;
}

// debtToMarketCap lives on /stable/ratios (annual on free tier — quarterly
// ratios are gated behind a paid plan).
export async function fetchDebtToMarketCap(
  ticker: string,
): Promise<number | null> {
  const rows = await fmpFetch<RatiosRow[]>(
    `/ratios?symbol=${encodeURIComponent(ticker)}&limit=1`,
  );
  if (!rows || rows.length === 0) return null;
  const v = rows[0]?.debtToMarketCap;
  return v !== null && v !== undefined && Number.isFinite(v) ? v : null;
}
