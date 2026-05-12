import "server-only";

import { closes, fetchYahooSeries } from "@/lib/data/yahoo";
import {
  BENCHMARK_SYMBOL,
  SECTOR_ETFS,
} from "@/lib/data/symbols";
import { indicatorBars } from "@/lib/signals/series";
import {
  createClient,
  createServiceClient,
} from "@/lib/supabase/server";
import type { IndicatorBar } from "@/lib/signals/series";
import type {
  RegimeSnapshot,
  SectorSnapshot,
  Stock,
  StockFundamentals,
} from "@/lib/supabase/types";

// Stage-1 of the Analyze Trade pipeline — pulls everything Claude needs
// in one go. Stays server-side; route handler is the only caller.

export interface AnalysisCondition {
  label: string;
  met: boolean;
  detail: string;
  proximity?: string; // populated only when met=false and we can quantify the gap
}

export interface AnalysisSetup {
  name: string;
  triggered: boolean; // all required conditions currently true
  required: AnalysisCondition[];
}

export interface VolumeContext {
  today: number | null;
  avg_20d: number | null;
  multiple_of_20d: number | null;
  up_volume_last_5d: number;
  down_volume_last_5d: number;
  accumulation: "accumulation" | "distribution" | "balanced" | "insufficient_data";
}

export interface AnalysisInput {
  ticker: string;
  asOf: string; // YYYY-MM-DD of the latest bar
  price: {
    current: number;
    change_pct: number | null;
    week_52_high: number | null;
    week_52_low: number | null;
    pct_from_52w_high: number | null;
  };
  technicals: {
    ema_5: number | null;
    ema_8: number | null;
    ema_21: number | null;
    sma_50: number | null;
    rsi_14: number | null;
  };
  volume: VolumeContext;
  setups: {
    trend_continuation: AnalysisSetup;
    reversal_recovery: AnalysisSetup;
  };
  regime: {
    classification: RegimeSnapshot["regime_classification"] | null;
    narrative_snippet: string | null;
    crypto_regime: string | null;
    btc_change_24h: number | null;
    eth_change_24h: number | null;
  } | null;
  sector: {
    name: string | null;
    etf_symbol: string | null;
    rs5d: number | null;
    rs30d: number | null;
    change_pct: number | null;
  };
  fundamentals: {
    blc_phase: number | null;
    blc_label: string | null;
    market_cap: number | null;
    gross_margin: number | null;
    net_margin: number | null;
    qq_revenue_growth: number | null;
    yy_revenue_growth: number | null;
  } | null;
}

function fmt(n: number | null | undefined, d = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/a";
  return n.toFixed(d);
}

function pct(a: number, b: number): number {
  return ((a - b) / b) * 100;
}

// Conditions for both setups. Pulls from `bars[i]` plus a short walk-back
// for the rising-EMA and recent-RSI-min checks. Sources: framework.md
// §Setup 1 + §Setup 2. Proximity hints are best-effort — we surface the
// numeric gap when the condition is purely scalar.
function evaluateConditions(bars: IndicatorBar[], i: number): {
  trend: AnalysisSetup;
  reversal: AnalysisSetup;
} {
  const b = bars[i];
  const trend: AnalysisCondition[] = [];
  const reversal: AnalysisCondition[] = [];

  // close > EMA(8) — shared
  if (b.ema_8 !== null) {
    const met = b.close > b.ema_8;
    const distPct = pct(b.close, b.ema_8);
    const shared: AnalysisCondition = {
      label: "close > EMA(8)",
      met,
      detail: `close=${fmt(b.close)}, EMA(8)=${fmt(b.ema_8)} (${distPct >= 0 ? "+" : ""}${fmt(distPct)}%)`,
      proximity: met
        ? undefined
        : `needs to reclaim EMA(8) at ${fmt(b.ema_8)} — gap ${fmt(Math.abs(distPct))}%`,
    };
    trend.push(shared);
    reversal.push({ ...shared });
  }

  // EMA(5) rising 2+ days — shared
  const e5 = [bars[i - 2]?.ema_5, bars[i - 1]?.ema_5, b.ema_5];
  if (e5.every((v) => v !== null && v !== undefined)) {
    const [t2, t1, t] = e5 as [number, number, number];
    const met = t > t1 && t1 > t2;
    const shared: AnalysisCondition = {
      label: "EMA(5) rising 2+ days",
      met,
      detail: `EMA(5) ${fmt(t2)} → ${fmt(t1)} → ${fmt(t)}`,
      proximity: met
        ? undefined
        : t <= t1
          ? "needs today's EMA(5) to print higher than yesterday's"
          : "needs two consecutive rising days — one in the bag",
    };
    trend.push(shared);
    reversal.push({ ...shared });
  }

  // EMA(8) > EMA(21) — TC only
  if (b.ema_8 !== null && b.ema_21 !== null) {
    const met = b.ema_8 > b.ema_21;
    trend.push({
      label: "EMA(8) > EMA(21)",
      met,
      detail: `EMA(8)=${fmt(b.ema_8)}, EMA(21)=${fmt(b.ema_21)}`,
      proximity: met
        ? undefined
        : `EMA(8) below EMA(21) by ${fmt(Math.abs(pct(b.ema_8, b.ema_21)))}%`,
    });
  }

  // 40 < RSI(14) < 70 — TC
  if (b.rsi_14 !== null) {
    const r = b.rsi_14;
    const met = r > 40 && r < 70;
    let proximity: string | undefined;
    if (!met) {
      if (r <= 40)
        proximity = `RSI ${fmt(r, 1)} needs > 40 — ${
          r > 38 ? "essentially one green day away" : "still in recovery territory"
        }`;
      else
        proximity = `RSI ${fmt(r, 1)} is above the 70 ceiling — extended, would need a cool-off`;
    }
    trend.push({
      label: "RSI(14) ∈ (40, 70)",
      met,
      detail: `RSI(14)=${fmt(r, 1)}`,
      proximity,
    });
  }

  // close < 0.80 × 52w_high — Reversal
  // 52w high = max close over last ≤252 bars including today.
  const start = Math.max(0, i - 251);
  let h52 = -Infinity;
  for (let j = start; j <= i; j++) {
    if (bars[j].close > h52) h52 = bars[j].close;
  }
  if (Number.isFinite(h52)) {
    const threshold = 0.8 * h52;
    const met = b.close < threshold;
    const offHigh = pct(b.close, h52); // negative when below high
    reversal.push({
      label: "close < 0.80 × 52w high",
      met,
      detail: `close=${fmt(b.close)}, 52w high=${fmt(h52)}, threshold=${fmt(threshold)} (${fmt(offHigh)}% off high)`,
      proximity: met
        ? undefined
        : `name isn't beaten up enough — would need to fall ${fmt(Math.abs(pct(b.close, threshold)))}% to qualify`,
    });
  }

  // min(RSI(14)) over last 10 days < 35 — Reversal
  const rsiWindow = bars.slice(Math.max(0, i - 9), i + 1);
  const recentRsis = rsiWindow
    .map((x) => x.rsi_14)
    .filter((r): r is number => r !== null);
  if (recentRsis.length > 0) {
    const minR = Math.min(...recentRsis);
    const met = minR < 35;
    reversal.push({
      label: "min(RSI(14)) last 10d < 35",
      met,
      detail: `10d RSI low=${fmt(minR, 1)}`,
      proximity: met
        ? undefined
        : `name hasn't been deeply oversold recently — RSI low ${fmt(minR, 1)} vs threshold 35`,
    });
  }

  // RSI(14) > 40 today — Reversal
  if (b.rsi_14 !== null) {
    const met = b.rsi_14 > 40;
    reversal.push({
      label: "RSI(14) > 40 today",
      met,
      detail: `RSI(14)=${fmt(b.rsi_14, 1)}`,
      proximity: met
        ? undefined
        : `RSI ${fmt(b.rsi_14, 1)} needs to push above 40`,
    });
  }

  return {
    trend: {
      name: "Trend Continuation",
      triggered: trend.every((c) => c.met) && trend.length === 4,
      required: trend,
    },
    reversal: {
      name: "Reversal / Recovery",
      triggered: reversal.every((c) => c.met) && reversal.length === 5,
      required: reversal,
    },
  };
}

function computeVolume(bars: IndicatorBar[], i: number): VolumeContext {
  const today = bars[i].volume;
  const avg20 = bars[i].avg_volume_20;
  let upVol = 0;
  let downVol = 0;
  const start = Math.max(1, i - 4);
  for (let j = start; j <= i; j++) {
    const diff = bars[j].close - bars[j - 1].close;
    if (diff > 0) upVol += bars[j].volume;
    else if (diff < 0) downVol += bars[j].volume;
  }
  let accumulation: VolumeContext["accumulation"];
  if (upVol === 0 && downVol === 0) accumulation = "insufficient_data";
  else if (upVol > downVol * 1.5) accumulation = "accumulation";
  else if (downVol > upVol * 1.5) accumulation = "distribution";
  else accumulation = "balanced";
  return {
    today: today ?? null,
    avg_20d: avg20,
    multiple_of_20d:
      today !== null && avg20 !== null && avg20 > 0 ? today / avg20 : null,
    up_volume_last_5d: upVol,
    down_volume_last_5d: downVol,
    accumulation,
  };
}

// Map a Stock.sector string (Alpha Vantage convention) to a SPDR ETF
// symbol. Case-insensitive prefix / substring match — AV sometimes
// returns slightly different spellings than the SECTOR_ETFS table.
function mapSectorToEtf(sector: string | null | undefined): string | null {
  if (!sector) return null;
  const norm = sector.toLowerCase();
  // Hard map for tricky cases first.
  if (norm.startsWith("communication")) return "XLC";
  if (norm.startsWith("consumer discretion")) return "XLY";
  if (norm.startsWith("consumer stap")) return "XLP";
  if (norm.startsWith("information technology") || norm === "technology")
    return "XLK";
  // Fall back to fuzzy name match against the table.
  for (const s of SECTOR_ETFS) {
    if (s.name.toLowerCase() === norm) return s.symbol;
    if (norm.includes(s.name.toLowerCase().split(" ")[0])) return s.symbol;
  }
  return null;
}

export async function gatherAnalysisInputs(
  rawTicker: string,
): Promise<AnalysisInput> {
  const ticker = rawTicker.toUpperCase();

  const series = await fetchYahooSeries(ticker, {
    range: "1y",
    interval: "1d",
  });
  const bars = indicatorBars(series);
  if (bars.length < 30) {
    throw new Error(
      `Insufficient history for ${ticker} — only ${bars.length} bars`,
    );
  }
  const i = bars.length - 1;
  const today = bars[i];
  const prev = bars[i - 1];

  const c = closes(series);
  const high52 = Math.max(...c.slice(-252));
  const low52 = Math.min(...c.slice(-252));

  const setups = evaluateConditions(bars, i);
  const volume = computeVolume(bars, i);

  // Pull regime + stock context via service client — endpoint is auth-gated
  // upstream, so this is safe. Service client avoids RLS friction on tables
  // the user can read anyway.
  const svc = createServiceClient();
  const supabase = await createClient();
  const [regimeRes, stockRes, fundRes] = await Promise.all([
    svc
      .from("regime_snapshots")
      .select(
        "regime_classification, narrative, crypto_regime, btc_change_24h, eth_change_24h, sector_data, snapshot_date, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("stocks")
      .select("ticker, sector, blc_phase, blc_phase_label")
      .eq("ticker", ticker)
      .limit(1)
      .maybeSingle(),
    svc
      .from("stock_fundamentals")
      .select("*")
      .eq("ticker", ticker)
      .maybeSingle(),
  ]);

  const regimeRow = (regimeRes.data ?? [])[0] as
    | (Pick<
        RegimeSnapshot,
        | "regime_classification"
        | "narrative"
        | "crypto_regime"
        | "btc_change_24h"
        | "eth_change_24h"
        | "sector_data"
      > & { snapshot_date: string; created_at: string })
    | undefined;

  const sectorRow = stockRes.data as Pick<
    Stock,
    "sector" | "blc_phase" | "blc_phase_label"
  > | null;
  const sectorEtf = mapSectorToEtf(sectorRow?.sector);
  const sectorSnap: SectorSnapshot | undefined = (
    (regimeRow?.sector_data ?? []) as SectorSnapshot[]
  ).find((s) => s.symbol === sectorEtf);

  const fund = fundRes.data as StockFundamentals | null;

  const change_pct =
    prev && prev.close
      ? ((today.close - prev.close) / prev.close) * 100
      : null;

  // Trim the regime narrative to a short snippet — Claude doesn't need the
  // full FT essay, just the regime read for context.
  const narrative_snippet = regimeRow?.narrative
    ? regimeRow.narrative.split(/\n\n+/)[0].slice(0, 600)
    : null;

  return {
    ticker,
    asOf: today.date,
    price: {
      current: today.close,
      change_pct,
      week_52_high: Number.isFinite(high52) ? high52 : null,
      week_52_low: Number.isFinite(low52) ? low52 : null,
      pct_from_52w_high: Number.isFinite(high52) ? pct(today.close, high52) : null,
    },
    technicals: {
      ema_5: today.ema_5,
      ema_8: today.ema_8,
      ema_21: today.ema_21,
      sma_50: today.sma_50,
      rsi_14: today.rsi_14,
    },
    volume,
    setups: {
      trend_continuation: setups.trend,
      reversal_recovery: setups.reversal,
    },
    regime: regimeRow
      ? {
          classification: regimeRow.regime_classification,
          narrative_snippet,
          crypto_regime: regimeRow.crypto_regime,
          btc_change_24h: regimeRow.btc_change_24h,
          eth_change_24h: regimeRow.eth_change_24h,
        }
      : null,
    sector: {
      name: sectorRow?.sector ?? null,
      etf_symbol: sectorEtf,
      rs5d: sectorSnap?.rs5d ?? null,
      rs30d: sectorSnap?.rs30d ?? null,
      change_pct: sectorSnap?.changePct ?? null,
    },
    fundamentals: fund
      ? {
          blc_phase: sectorRow?.blc_phase ?? null,
          blc_label: sectorRow?.blc_phase_label ?? null,
          market_cap: fund.market_cap,
          gross_margin: fund.gross_margin,
          net_margin: fund.net_margin,
          qq_revenue_growth: fund.qq_revenue_growth,
          yy_revenue_growth: fund.yy_revenue_growth,
        }
      : sectorRow?.blc_phase
        ? {
            blc_phase: sectorRow.blc_phase,
            blc_label: sectorRow.blc_phase_label ?? null,
            market_cap: null,
            gross_margin: null,
            net_margin: null,
            qq_revenue_growth: null,
            yy_revenue_growth: null,
          }
        : null,
  };
}

// Reference to the BENCHMARK_SYMBOL so the linter doesn't drop the import —
// reserved for a future "stock RS vs SPY" extension.
export const _BENCHMARK = BENCHMARK_SYMBOL;
