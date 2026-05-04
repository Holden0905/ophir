import "server-only";

import { closes, fetchYahooSeries, volumes } from "@/lib/data/yahoo";
import { ema, sma, rsi, pctChange, avg } from "@/lib/calculations/technicals";
import { fetchOverview } from "@/lib/data/alphavantage";
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
    `[refreshFundamentals] ${ticker} → calling Alpha Vantage OVERVIEW`,
  );
  const data = await fetchOverview(ticker);
  if (!data) {
    console.warn(
      `[refreshFundamentals] ${ticker} → Alpha Vantage returned no data`,
    );
    return { refreshed: false, reason: "not_found" };
  }
  console.log(
    `[refreshFundamentals] ${ticker} → got name="${data.name}" cap=${data.market_cap} margin=${data.net_margin} yy=${data.yy_revenue_growth}`,
  );

  const { error } = await svc.from("stock_fundamentals").upsert(
    {
      ticker,
      market_cap: safeNumber(data.market_cap),
      gross_margin: safeNumber(data.gross_margin),
      net_margin: safeNumber(data.net_margin),
      qq_revenue_growth: safeNumber(data.qq_revenue_growth),
      yy_revenue_growth: safeNumber(data.yy_revenue_growth),
      net_debt: safeNumber(data.net_debt),
      debt_market_cap_ratio:
        data.market_cap && data.net_debt
          ? safeNumber(data.net_debt / data.market_cap)
          : null,
      last_fetched_at: new Date().toISOString(),
      data_source: "alpha_vantage",
    },
    { onConflict: "ticker" },
  );

  if (error) {
    console.error(
      `[refreshFundamentals] ${ticker} → upsert FAILED:`,
      error.message,
      error.details ?? "",
      error.hint ?? "",
    );
    throw new Error(`stock_fundamentals upsert ${ticker}: ${error.message}`);
  }

  // Best-effort backfill of company name/sector on the user's stocks row.
  if (data.name || data.sector) {
    await svc
      .from("stocks")
      .update({
        company_name: data.name ?? undefined,
        sector: data.sector ?? undefined,
      })
      .eq("ticker", ticker);
  }

  console.log(`[refreshFundamentals] ${ticker} → upsert OK`);
  return { refreshed: true };
}
