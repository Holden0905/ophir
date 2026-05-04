import "server-only";

import { closes, fetchYahooBatch } from "@/lib/data/yahoo";
import {
  ema,
  sma,
  rsi,
  pctChange,
} from "@/lib/calculations/technicals";
import { BENCHMARK_SYMBOL, DISCOVERY_UNIVERSE } from "@/lib/data/symbols";
import { createServiceClient } from "@/lib/supabase/server";
import { generateDiscoveryBrief } from "@/lib/ai/discovery";
import type {
  DiscoveryScanResult,
  ScanMode,
  StockFundamentals,
} from "@/lib/supabase/types";

interface TechSnapshot {
  ticker: string;
  current_price: number | null;
  price_change_pct: number | null;
  rsi_14: number | null;
  ema_8: number | null;
  ma_50: number | null;
  price_vs_ema8_pct: number | null;
  price_vs_ma50_pct: number | null;
  pct_from_52_high: number | null;
}

function snapshotFromCloses(
  ticker: string,
  c: number[],
): TechSnapshot | null {
  if (c.length < 50) return null;
  const last = c[c.length - 1];
  const prev = c[c.length - 2];
  const ema8 = ema(c, 8);
  const ma50 = sma(c.slice(-50), 50);
  const rsi14 = rsi(c.slice(-50), 14);
  const high52 = Math.max(...c.slice(-252));
  return {
    ticker,
    current_price: last,
    price_change_pct: pctChange(prev, last),
    rsi_14: rsi14,
    ema_8: ema8,
    ma_50: ma50,
    price_vs_ema8_pct: ema8 !== null ? pctChange(ema8, last) : null,
    price_vs_ma50_pct: ma50 !== null ? pctChange(ma50, last) : null,
    pct_from_52_high: pctChange(high52, last),
  };
}

function reversalFilter(
  t: TechSnapshot,
  f: StockFundamentals | null,
): { pass: boolean; reason: string } {
  const reasons: string[] = [];
  if (t.pct_from_52_high === null || t.pct_from_52_high > -20)
    return { pass: false, reason: "not -20% from high" };
  reasons.push(`${t.pct_from_52_high.toFixed(1)}% off high`);

  if (t.rsi_14 === null || t.rsi_14 < 38 || t.rsi_14 > 48)
    return { pass: false, reason: "RSI outside 38-48" };
  reasons.push(`RSI ${t.rsi_14.toFixed(1)}`);

  if (t.price_vs_ema8_pct === null || t.price_vs_ema8_pct < -5)
    return { pass: false, reason: "still below 8 EMA" };
  reasons.push(`vs 8 EMA ${t.price_vs_ema8_pct.toFixed(1)}%`);

  if (f) {
    if (f.market_cap !== null && f.market_cap < 2e9)
      return { pass: false, reason: "market cap < $2B" };
    if (f.gross_margin !== null && f.gross_margin <= 0)
      return { pass: false, reason: "negative gross margin" };
  }

  return { pass: true, reason: reasons.join(", ") };
}

function trendFilter(
  t: TechSnapshot,
  f: StockFundamentals | null,
): { pass: boolean; reason: string } {
  const reasons: string[] = [];
  if (!f) return { pass: false, reason: "no fundamentals" };

  if (f.qq_revenue_growth === null || f.qq_revenue_growth < 0.08)
    return { pass: false, reason: "Q/Q rev < 8%" };
  reasons.push(`Q/Q ${(f.qq_revenue_growth * 100).toFixed(1)}%`);

  if (f.yy_revenue_growth === null || f.yy_revenue_growth < 0.12)
    return { pass: false, reason: "Y/Y rev < 12%" };
  reasons.push(`Y/Y ${(f.yy_revenue_growth * 100).toFixed(1)}%`);

  if (f.gross_margin === null || f.gross_margin < 0.3)
    return { pass: false, reason: "GM < 30%" };
  reasons.push(`GM ${(f.gross_margin * 100).toFixed(1)}%`);

  if (f.net_margin === null || f.net_margin < 0)
    return { pass: false, reason: "negative net margin" };

  if (t.price_vs_ma50_pct === null || t.price_vs_ma50_pct < 0)
    return { pass: false, reason: "below 50 SMA" };
  reasons.push(`vs 50 SMA +${t.price_vs_ma50_pct.toFixed(1)}%`);

  return { pass: true, reason: reasons.join(", ") };
}

export async function runDiscoveryScan(
  mode: ScanMode,
): Promise<{ results: DiscoveryScanResult[]; narrative: string; scan_id: string }> {
  const symbols = [BENCHMARK_SYMBOL, ...DISCOVERY_UNIVERSE];
  const yahooData = await fetchYahooBatch(symbols, {
    range: "1y",
    interval: "1d",
  });

  const techs: TechSnapshot[] = [];
  for (const ticker of DISCOVERY_UNIVERSE) {
    const entry = yahooData[ticker];
    if (!entry || "error" in entry) continue;
    const snap = snapshotFromCloses(ticker, closes(entry));
    if (snap) techs.push(snap);
  }

  // Pull cached fundamentals in one shot.
  const svc = createServiceClient();
  const { data: fundRows } = await svc
    .from("stock_fundamentals")
    .select("*")
    .in(
      "ticker",
      techs.map((t) => t.ticker),
    );
  const fundMap = new Map<string, StockFundamentals>(
    (fundRows ?? []).map((r) => [r.ticker, r as StockFundamentals]),
  );

  const filter = mode === "reversal" ? reversalFilter : trendFilter;
  const results: DiscoveryScanResult[] = [];
  for (const t of techs) {
    const f = fundMap.get(t.ticker) ?? null;
    const verdict = filter(t, f);
    if (!verdict.pass) continue;
    results.push({
      ticker: t.ticker,
      company_name: null,
      sector: null,
      current_price: t.current_price,
      price_change_pct: t.price_change_pct,
      rsi_14: t.rsi_14,
      pct_from_52_high: t.pct_from_52_high,
      price_vs_ema8_pct: t.price_vs_ema8_pct,
      price_vs_ma50_pct: t.price_vs_ma50_pct,
      qq_revenue_growth: f?.qq_revenue_growth ?? null,
      yy_revenue_growth: f?.yy_revenue_growth ?? null,
      gross_margin: f?.gross_margin ?? null,
      net_margin: f?.net_margin ?? null,
      market_cap: f?.market_cap ?? null,
      reason: verdict.reason,
    });
  }

  // Sort: trend = best Y/Y growth, reversal = closest to 8 EMA reclaim.
  if (mode === "trend") {
    results.sort(
      (a, b) =>
        (b.yy_revenue_growth ?? 0) - (a.yy_revenue_growth ?? 0),
    );
  } else {
    results.sort(
      (a, b) =>
        (b.price_vs_ema8_pct ?? -100) - (a.price_vs_ema8_pct ?? -100),
    );
  }

  const narrative = await generateDiscoveryBrief(mode, results);

  const scanDate = new Date().toISOString().slice(0, 10);
  const { data: inserted } = await svc
    .from("discovery_scans")
    .insert({
      scan_date: scanDate,
      scan_mode: mode,
      results,
      narrative,
    })
    .select("id")
    .single();

  return { results, narrative, scan_id: inserted?.id ?? "" };
}
