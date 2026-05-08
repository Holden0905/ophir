"use client";

import { useEffect, useMemo, useState } from "react";
import { MacroPulse } from "@/components/regime/MacroPulse";
import { CryptoBarometer } from "@/components/regime/CryptoBarometer";
import { SectorRotation } from "@/components/regime/SectorRotation";
import { relativeTime } from "@/lib/format";
import { isUsEquityMarketOpen } from "@/lib/marketHours";
import { MACRO_SYMBOLS, SECTOR_ETFS } from "@/lib/data/symbols";
import type { RegimeSnapshot, SectorSnapshot } from "@/lib/supabase/types";

const POLL_MS = 60_000;

interface StockQuote {
  price: number | null;
  change_pct: number | null;
  volume: number | null;
}

interface CryptoLive {
  btc: { price: number | null; change24h: number | null };
  eth: { price: number | null; change24h: number | null };
  sol: { price: number | null; change24h: number | null };
  regime: string | null;
}

// We poll the same symbols the snapshot was built from so the live overlay
// stays at the same scale as the cached value (e.g. premarket snapshots
// display ES futures, so we poll ES=F — not ^GSPC, whose price is ~10x).
function macroSymbolsFor(
  snapshotType: RegimeSnapshot["snapshot_type"] | null,
): { spx: string; ndx: string; vix: string } {
  const isPre = snapshotType === "premarket";
  return {
    spx: isPre ? MACRO_SYMBOLS.esFutures : MACRO_SYMBOLS.spx,
    ndx: isPre ? MACRO_SYMBOLS.nqFutures : MACRO_SYMBOLS.ndx,
    vix: MACRO_SYMBOLS.vix,
  };
}

export function DashboardLive({
  snapshot,
}: {
  snapshot: RegimeSnapshot | null;
}) {
  const initialSectors = useMemo<SectorSnapshot[]>(
    () => (snapshot?.sector_data ?? []) as SectorSnapshot[],
    [snapshot?.sector_data],
  );

  const [stockQuotes, setStockQuotes] = useState<Record<string, StockQuote>>({});
  const [crypto, setCrypto] = useState<CryptoLive | null>(null);
  const [stocksAt, setStocksAt] = useState<string | null>(null);
  const [cryptoAt, setCryptoAt] = useState<string | null>(null);
  const [, setNowTick] = useState(0);

  const macroSyms = useMemo(
    () => macroSymbolsFor(snapshot?.snapshot_type ?? null),
    [snapshot?.snapshot_type],
  );

  // Stock symbols: macro trio (or futures equivalents) + 11 sector ETFs.
  // Comma-separated key keeps the effect dependency stable across renders.
  const stockTickerKey = useMemo(
    () =>
      [
        macroSyms.spx,
        macroSyms.ndx,
        macroSyms.vix,
        ...SECTOR_ETFS.map((s) => s.symbol),
      ].join(","),
    [macroSyms],
  );

  // Stock polling — paused outside US regular market hours since cash and
  // futures both go quiet then. Crypto has its own loop below that runs 24/7.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (typeof document !== "undefined" && document.hidden) return;
      if (!isUsEquityMarketOpen()) return;
      try {
        const res = await fetch(
          `/api/stocks/quotes?tickers=${encodeURIComponent(stockTickerKey)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const j = (await res.json()) as {
          quotes: Record<string, StockQuote>;
          fetched_at: string;
        };
        if (cancelled) return;
        setStockQuotes(j.quotes);
        setStocksAt(j.fetched_at);
      } catch {
        // Silent — server-rendered snapshot values stay on screen as fallback.
      }
    }
    void load();
    const id = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [stockTickerKey]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/crypto/quotes", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as {
          quotes: CryptoLive;
          regime: string | null;
          fetched_at: string;
        };
        if (cancelled) return;
        setCrypto({ ...j.quotes, regime: j.regime });
        setCryptoAt(j.fetched_at);
      } catch {
        // Silent — fallback to snapshot values.
      }
    }
    void load();
    const id = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Compose a "display snapshot" — the cached server values overlaid with
  // any live quotes we've successfully fetched. The downstream components
  // are unchanged; they just see fresher numbers.
  const displaySnapshot: RegimeSnapshot | null = useMemo(() => {
    if (!snapshot) return null;
    const spxQ = stockQuotes[macroSyms.spx];
    const ndxQ = stockQuotes[macroSyms.ndx];
    const vixQ = stockQuotes[macroSyms.vix];
    return {
      ...snapshot,
      spx_price: spxQ?.price ?? snapshot.spx_price,
      spx_change_pct: spxQ?.change_pct ?? snapshot.spx_change_pct,
      qqq_price: ndxQ?.price ?? snapshot.qqq_price,
      qqq_change_pct: ndxQ?.change_pct ?? snapshot.qqq_change_pct,
      vix_level: vixQ?.price ?? snapshot.vix_level,
      btc_price: crypto?.btc.price ?? snapshot.btc_price,
      btc_change_24h: crypto?.btc.change24h ?? snapshot.btc_change_24h,
      eth_price: crypto?.eth.price ?? snapshot.eth_price,
      eth_change_24h: crypto?.eth.change24h ?? snapshot.eth_change_24h,
      sol_price: crypto?.sol.price ?? snapshot.sol_price,
      sol_change_24h: crypto?.sol.change24h ?? snapshot.sol_change_24h,
      crypto_regime: crypto?.regime ?? snapshot.crypto_regime,
    };
  }, [snapshot, stockQuotes, crypto, macroSyms]);

  // Sector overlay: keep the rs5d / rs30d from the snapshot (those are
  // multi-day stats and don't change intraday in any meaningful way), but
  // overwrite changePct with the live intraday value.
  const displaySectors: SectorSnapshot[] = useMemo(() => {
    if (initialSectors.length === 0) return initialSectors;
    return initialSectors.map((s) => {
      const q = stockQuotes[s.symbol];
      if (!q) return s;
      return {
        ...s,
        changePct: q.change_pct ?? s.changePct,
      };
    });
  }, [initialSectors, stockQuotes]);

  const lastFetched = newestTimestamp(stocksAt, cryptoAt);
  const marketOpen = isUsEquityMarketOpen();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <span
          className="font-ui text-[10px] uppercase tracking-wider text-[var(--text-muted)]"
          title={
            lastFetched
              ? `Last fetched ${new Date(lastFetched).toLocaleString()}`
              : undefined
          }
        >
          {lastFetched
            ? `Live · ${relativeTime(lastFetched)}`
            : "Live · loading…"}
          {!marketOpen && (
            <span className="ml-2 normal-case text-[var(--text-muted)]/80">
              (stocks paused · market closed)
            </span>
          )}
        </span>
      </div>
      <MacroPulse snapshot={displaySnapshot} />
      <CryptoBarometer snapshot={displaySnapshot} />
      <SectorRotation
        sectors={displaySectors}
        asOf={snapshot?.created_at ?? null}
      />
    </div>
  );
}

function newestTimestamp(...isos: Array<string | null>): string | null {
  let best: number | null = null;
  let bestIso: string | null = null;
  for (const iso of isos) {
    if (!iso) continue;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) continue;
    if (best === null || t > best) {
      best = t;
      bestIso = iso;
    }
  }
  return bestIso;
}
