import "server-only";

import { closes, fetchYahooBatch, lastBarNyDate } from "@/lib/data/yahoo";
import { fetchCoreCrypto, classifyCryptoRegime } from "@/lib/data/coingecko";
import {
  ema,
  pctChange,
  relativeStrength,
} from "@/lib/calculations/technicals";
import {
  BENCHMARK_SYMBOL,
  MACRO_SYMBOLS,
  SECTOR_ETFS,
} from "@/lib/data/symbols";
import { generateRegimeBrief } from "@/lib/ai/regime";
import { fetchWatchlistSignalReport } from "@/lib/signals/queries";
import type {
  RegimeSnapshot,
  SectorSnapshot,
  SnapshotType,
} from "@/lib/supabase/types";

interface MacroPart {
  price: number | null;
  changePct: number | null;
  vsEma21Pct: number | null;
}

// Builds a macro reading from a "live" series (the one whose last bar
// represents the print we want to display) and a cash reference series
// used for the 21 EMA. For pre-market, live = ES/NQ futures and reference
// = SPX/NDX cash; for EOD, live and reference are the same cash series.
function macroFromSeries(
  liveCloses: number[],
  referenceCloses: number[],
): MacroPart {
  const last = liveCloses[liveCloses.length - 1] ?? null;
  const prev = liveCloses[liveCloses.length - 2] ?? null;
  const ema21 = ema(referenceCloses, 21);
  return {
    price: last,
    changePct: last !== null && prev !== null ? pctChange(prev, last) : null,
    vsEma21Pct: last !== null && ema21 !== null ? pctChange(ema21, last) : null,
  };
}

function vixDirection(values: number[]): string {
  if (values.length < 6) return "flat";
  const last = values[values.length - 1];
  const ago = values[values.length - 6]; // ~5 trading days
  if (last === undefined || ago === undefined) return "flat";
  const diff = ((last - ago) / ago) * 100;
  if (diff > 8) return "rising sharply";
  if (diff > 2) return "rising";
  if (diff < -8) return "compressing sharply";
  if (diff < -2) return "compressing";
  return "stable";
}

function vixFlag(level: number | null): string | null {
  if (level === null) return null;
  if (level >= 40) return "panic";
  if (level >= 30) return "elevated";
  if (level <= 13) return "complacent";
  return null;
}

export type RegimeBuildResult = Omit<RegimeSnapshot, "id" | "created_at">;

// en-CA locale formats as YYYY-MM-DD; using America/New_York keeps the
// snapshot_date aligned with the US trading session even when the server
// runs in UTC and the brief is generated late in the evening.
const NY_DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export async function buildRegimeSnapshot(
  snapshotType: SnapshotType,
  today = new Date(),
): Promise<RegimeBuildResult> {
  const dateStr = NY_DATE_FMT.format(today);
  const isPremarket = snapshotType === "premarket";

  // Pre-market briefs lean on overnight futures so the narrative reflects
  // current price discovery, not yesterday's cash close. EOD briefs use
  // the cash indices that have just settled.
  const spxLiveSymbol = isPremarket
    ? MACRO_SYMBOLS.esFutures
    : MACRO_SYMBOLS.spx;
  const nasdaqLiveSymbol = isPremarket
    ? MACRO_SYMBOLS.nqFutures
    : MACRO_SYMBOLS.ndx;

  const macroSymbols = [
    MACRO_SYMBOLS.spx,
    MACRO_SYMBOLS.ndx,
    MACRO_SYMBOLS.vix,
    spxLiveSymbol,
    nasdaqLiveSymbol,
  ];
  const sectorSymbols = SECTOR_ETFS.map((s) => s.symbol);
  // de-dupe — when not premarket the live symbols equal the cash ones
  const allSymbols = Array.from(
    new Set([BENCHMARK_SYMBOL, ...macroSymbols, ...sectorSymbols]),
  );

  const [yahooData, crypto] = await Promise.all([
    fetchYahooBatch(allSymbols, { range: "3mo", interval: "1d" }),
    fetchCoreCrypto(),
  ]);

  function safeCloses(symbol: string): number[] {
    const entry = yahooData[symbol];
    if (!entry || "error" in entry) return [];
    return closes(entry);
  }

  // Stale-bar guard for EOD snapshots. Yahoo's chart endpoint can take
  // 30-60 min after the close to append today's bar — if we run too
  // early, every sector ETF series ends on yesterday's close and the
  // computed rs5d / rs30d come out bit-identical to yesterday's snapshot.
  // We only enforce this on a US weekday EOD; weekends and holidays
  // legitimately have no fresh bar.
  if (snapshotType === "eod") {
    const todayNyDow = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
    }).format(today);
    const isWeekday =
      todayNyDow !== "Sat" && todayNyDow !== "Sun";
    if (isWeekday) {
      const checked: Array<{ symbol: string; barDate: string | null }> = [];
      for (const symbol of [BENCHMARK_SYMBOL, ...sectorSymbols]) {
        const entry = yahooData[symbol];
        if (!entry || "error" in entry) continue;
        checked.push({ symbol, barDate: lastBarNyDate(entry) });
      }
      const stale = checked.filter((c) => c.barDate !== dateStr);
      if (stale.length > 0) {
        const detail = stale
          .slice(0, 5)
          .map((c) => `${c.symbol}=${c.barDate ?? "no-bars"}`)
          .join(", ");
        throw new Error(
          `Yahoo data not yet posted for ${dateStr} — last bars are stale (${detail}). Retry after ~5pm ET.`,
        );
      }
    }
  }

  const spxCashCloses = safeCloses(MACRO_SYMBOLS.spx);
  const ndxCashCloses = safeCloses(MACRO_SYMBOLS.ndx);
  const spxLiveCloses = safeCloses(spxLiveSymbol);
  const nasdaqLiveCloses = safeCloses(nasdaqLiveSymbol);
  const vixCloses = safeCloses(MACRO_SYMBOLS.vix);
  const spyCloses = safeCloses(BENCHMARK_SYMBOL);

  const spx = macroFromSeries(spxLiveCloses, spxCashCloses);
  const nasdaq = macroFromSeries(nasdaqLiveCloses, ndxCashCloses);
  const vixLast = vixCloses[vixCloses.length - 1] ?? null;

  const sectors: SectorSnapshot[] = SECTOR_ETFS.map((s) => {
    const sectorCloses = safeCloses(s.symbol);
    const last = sectorCloses[sectorCloses.length - 1] ?? null;
    const prev = sectorCloses[sectorCloses.length - 2] ?? null;
    const change = last !== null && prev !== null ? pctChange(prev, last) : null;
    return {
      symbol: s.symbol,
      name: s.name,
      rs5d: relativeStrength(sectorCloses, spyCloses, 5),
      rs30d: relativeStrength(sectorCloses, spyCloses, 30),
      changePct: change,
    };
  });

  // Watchlist signal report is best-effort — if the signals table is
  // empty (e.g. before the engine has ever run on this watchlist) we
  // still want a regime brief, just without the closing watchlist
  // paragraph. Premarket runs ~13:00 UTC against the prior session's
  // signals; EOD runs after the 22:15 signals cron so today's are in.
  let watchlist = null;
  try {
    watchlist = await fetchWatchlistSignalReport(dateStr);
  } catch (e) {
    console.warn(
      `[regime/build] watchlist fetch failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const aiInput = {
    snapshot_type: snapshotType,
    date: dateStr,
    spx_label: isPremarket ? "ES (S&P futures)" : "SPX",
    nasdaq_label: isPremarket ? "NQ (Nasdaq futures)" : "NDX",
    spx,
    nasdaq,
    vix: { level: vixLast, direction: vixDirection(vixCloses) },
    btc: { price: crypto.btc.price, change24h: crypto.btc.change24h },
    eth: { price: crypto.eth.price, change24h: crypto.eth.change24h },
    sol: { price: crypto.sol.price, change24h: crypto.sol.change24h },
    sectors,
    watchlist,
  };

  const ai = await generateRegimeBrief(aiInput);

  const spxTrend =
    spx.vsEma21Pct === null
      ? null
      : spx.vsEma21Pct > 1
        ? "above 21 EMA"
        : spx.vsEma21Pct < -1
          ? "below 21 EMA"
          : "at 21 EMA";

  return {
    snapshot_type: snapshotType,
    snapshot_date: dateStr,
    spx_price: spx.price,
    spx_change_pct: spx.changePct,
    spx_vs_ema21_pct: spx.vsEma21Pct,
    spx_trend: spxTrend,
    qqq_price: nasdaq.price,
    qqq_change_pct: nasdaq.changePct,
    vix_level: vixLast,
    vix_direction: vixDirection(vixCloses),
    vix_flag: vixFlag(vixLast),
    btc_price: crypto.btc.price,
    btc_change_24h: crypto.btc.change24h,
    eth_price: crypto.eth.price,
    eth_change_24h: crypto.eth.change24h,
    sol_price: crypto.sol.price,
    sol_change_24h: crypto.sol.change24h,
    crypto_regime: classifyCryptoRegime(crypto.btc, crypto.eth, crypto.sol),
    sector_data: sectors,
    regime_classification: ai.classification,
    narrative: ai.narrative,
  };
}
