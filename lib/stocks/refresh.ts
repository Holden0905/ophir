import "server-only";

import {
  closes,
  fetchYahooQuarterlyRevenueGrowth,
  fetchYahooSeries,
  volumes,
} from "@/lib/data/yahoo";
import { ema, sma, rsi, pctChange, avg } from "@/lib/calculations/technicals";
import { fetchOverview } from "@/lib/data/alphavantage";
import {
  fetchDebtToMarketCap,
  fetchQuarterlyRevenueGrowth,
} from "@/lib/data/fmp";
import { createServiceClient } from "@/lib/supabase/server";
import type { StockTechnicals } from "@/lib/supabase/types";

const FUNDAMENTALS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function safeNumber(n: number | null | undefined): number | null {
  if (n === null || n === undefined) return null;
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function refreshTechnicals(
  ticker: string,
): Promise<Partial<StockTechnicals>> {
  console.log(`[refreshTechnicals] ${ticker} → fetching Yahoo series`);
  const series = await fetchYahooSeries(ticker, {
    range: "1y",
    interval: "1d",
  });
  const c = closes(series);
  const v = volumes(series);
  console.log(
    `[refreshTechnicals] ${ticker} → got ${c.length} closes, ${v.length} volumes (last close ${c.at(-1) ?? "none"})`,
  );
  if (c.length < 2) {
    throw new Error(`Yahoo series for ${ticker} has fewer than 2 closes`);
  }

  const last = c[c.length - 1];
  const prev = c[c.length - 2];
  const ema8 = ema(c, 8);
  const ema21 = ema(c, 21);
  const ma50 = c.length >= 50 ? sma(c.slice(-50), 50) : null;
  const rsi14 = rsi(c.slice(-50), 14);
  const high52 = safeNumber(
    series.meta.fiftyTwoWeekHigh ?? Math.max(...c.slice(-252)),
  );
  const low52 = safeNumber(
    series.meta.fiftyTwoWeekLow ?? Math.min(...c.slice(-252)),
  );
  const avgVol20 = avg(v.slice(-20));

  const tech: Partial<StockTechnicals> = {
    ticker,
    current_price: safeNumber(last),
    price_change_pct: safeNumber(pctChange(prev, last)),
    ma_50: safeNumber(ma50),
    ema_8: safeNumber(ema8),
    ema_21: safeNumber(ema21),
    price_vs_ma50_pct: ma50 !== null ? safeNumber(pctChange(ma50, last)) : null,
    price_vs_ema8_pct: ema8 !== null ? safeNumber(pctChange(ema8, last)) : null,
    price_vs_ema21_pct:
      ema21 !== null ? safeNumber(pctChange(ema21, last)) : null,
    rsi_14: safeNumber(rsi14),
    volume: safeNumber(v[v.length - 1] ?? null),
    avg_volume_20d: safeNumber(avgVol20),
    week_52_high: high52,
    week_52_low: low52,
    pct_from_52_high: high52 ? safeNumber(pctChange(high52, last)) : null,
    last_fetched_at: new Date().toISOString(),
  };

  const svc = createServiceClient();
  const { error } = await svc
    .from("stock_technicals")
    .upsert(tech, { onConflict: "ticker" });

  if (error) {
    console.error(
      `[refreshTechnicals] ${ticker} → upsert FAILED:`,
      error.message,
      error.details ?? "",
      error.hint ?? "",
    );
    throw new Error(`stock_technicals upsert ${ticker}: ${error.message}`);
  }

  console.log(`[refreshTechnicals] ${ticker} → upsert OK`);
  return tech;
}

export async function refreshFundamentals(
  ticker: string,
  options: { force?: boolean } = {},
): Promise<{ refreshed: boolean; reason?: string }> {
  const svc = createServiceClient();
  const { data: existing } = await svc
    .from("stock_fundamentals")
    .select("ticker,last_fetched_at")
    .eq("ticker", ticker)
    .maybeSingle();

  if (
    !options.force &&
    existing?.last_fetched_at &&
    Date.now() - new Date(existing.last_fetched_at).getTime() <
      FUNDAMENTALS_TTL_MS
  ) {
    console.log(
      `[refreshFundamentals] ${ticker} → cached (fetched ${existing.last_fetched_at})`,
    );
    return { refreshed: false, reason: "fresh" };
  }

  console.log(
    `[refreshFundamentals] ${ticker} → calling Alpha Vantage OVERVIEW + FMP supplements`,
  );
  // Each source resolves independently — an AV rate-limit / daily-quota
  // failure must not prevent FMP data from saving, and vice-versa.
  const [avData, fmpQq, fmpDebtToCap] = await Promise.all([
    fetchOverview(ticker).catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[refreshFundamentals] ${ticker} → AV failed: ${msg}`);
      return null;
    }),
    fetchQuarterlyRevenueGrowth(ticker).catch((e) => {
      console.warn(`[refreshFundamentals] ${ticker} → FMP Q/Q failed: ${e}`);
      return null;
    }),
    fetchDebtToMarketCap(ticker).catch((e) => {
      console.warn(
        `[refreshFundamentals] ${ticker} → FMP debt/cap failed: ${e}`,
      );
      return null;
    }),
  ]);

  // Yahoo Q/Q fallback — only run when FMP returns null, since this costs
  // an extra Yahoo request and isn't needed when FMP covered the ticker.
  let yahooQq: number | null = null;
  if (fmpQq === null) {
    yahooQq = await fetchYahooQuarterlyRevenueGrowth(ticker).catch((e) => {
      console.warn(`[refreshFundamentals] ${ticker} → Yahoo Q/Q failed: ${e}`);
      return null;
    });
  }

  if (
    !avData &&
    fmpQq === null &&
    yahooQq === null &&
    fmpDebtToCap === null
  ) {
    console.warn(
      `[refreshFundamentals] ${ticker} → all sources empty/failed`,
    );
    return { refreshed: false, reason: "not_found" };
  }
  console.log(
    `[refreshFundamentals] ${ticker} → av=${avData ? "ok" : "null"} fmpQq=${fmpQq} yahooQq=${yahooQq} fmpDebtCap=${fmpDebtToCap}`,
  );

  // Build a partial payload — only include columns we actually have data
  // for. Supabase upsert with onConflict updates only the included columns,
  // preserving any prior values for unfilled fields. That lets a partial
  // FMP-only refresh land without clobbering existing AV-sourced fields.
  const payload: Record<string, unknown> = {
    ticker,
    last_fetched_at: new Date().toISOString(),
  };

  if (avData) {
    payload.market_cap = safeNumber(avData.market_cap);
    payload.gross_margin = safeNumber(avData.gross_margin);
    payload.net_margin = safeNumber(avData.net_margin);
    payload.yy_revenue_growth = safeNumber(avData.yy_revenue_growth);
    payload.net_debt = safeNumber(avData.net_debt);
  }

  // Q/Q priority: FMP (true sequential) → Yahoo (true sequential, free tier
  // gap fallback) → AV (YoY on free tier — a known mismatch but better than
  // null when both above are unavailable).
  const qq = fmpQq ?? yahooQq ?? avData?.qq_revenue_growth ?? null;
  if (qq !== null) payload.qq_revenue_growth = safeNumber(qq);

  const debtCap =
    fmpDebtToCap ??
    (avData?.market_cap && avData?.net_debt
      ? avData.net_debt / avData.market_cap
      : null);
  if (debtCap !== null) payload.debt_market_cap_ratio = safeNumber(debtCap);

  const sources: string[] = [];
  if (avData) sources.push("alpha_vantage");
  if (fmpQq !== null || fmpDebtToCap !== null) sources.push("fmp");
  if (yahooQq !== null) sources.push("yahoo");
  payload.data_source = sources.join("+");

  const { error } = await svc
    .from("stock_fundamentals")
    .upsert(payload, { onConflict: "ticker" });

  if (error) {
    console.error(
      `[refreshFundamentals] ${ticker} → upsert FAILED:`,
      error.message,
      error.details ?? "",
      error.hint ?? "",
    );
    throw new Error(`stock_fundamentals upsert ${ticker}: ${error.message}`);
  }

  // Best-effort backfill of company name/sector — only when AV gave them.
  if (avData?.name || avData?.sector) {
    await svc
      .from("stocks")
      .update({
        company_name: avData.name ?? undefined,
        sector: avData.sector ?? undefined,
      })
      .eq("ticker", ticker);
  }

  console.log(
    `[refreshFundamentals] ${ticker} → upsert OK (${payload.data_source})`,
  );
  return { refreshed: true };
}
