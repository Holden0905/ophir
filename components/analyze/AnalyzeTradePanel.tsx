"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/shared/Spinner";
import { relativeTime } from "@/lib/format";

interface AnalysisCache {
  narrative: string;
  as_of: string;
  fetched_at: string;
}

interface ApiResponse {
  ticker: string;
  narrative: string;
  as_of: string;
  fetched_at: string;
  elapsed_ms: number;
}

// SessionStorage shape — keyed per ticker so jumping between tickers
// and back doesn't re-fire Claude. Cleared when the tab closes.
const CACHE_KEY_PREFIX = "ophir:analyze:";

function readCache(ticker: string): AnalysisCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${CACHE_KEY_PREFIX}${ticker}`);
    if (!raw) return null;
    return JSON.parse(raw) as AnalysisCache;
  } catch {
    return null;
  }
}

function writeCache(ticker: string, cache: AnalysisCache) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      `${CACHE_KEY_PREFIX}${ticker}`,
      JSON.stringify(cache),
    );
  } catch {
    // sessionStorage may be disabled; swallow — analysis still renders for the session.
  }
}

function clearCache(ticker: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(`${CACHE_KEY_PREFIX}${ticker}`);
  } catch {
    /* noop */
  }
}

export function AnalyzeTradePanel({ ticker }: { ticker: string }) {
  const [analysis, setAnalysis] = useState<AnalysisCache | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 1s tick so the "fetched X ago" stamp doesn't lie between renders.
  const [, setTick] = useState(0);

  // Hydrate from sessionStorage on mount / ticker change. The setState
  // here is intentional — sessionStorage is an external store and we
  // can't read it during render without an SSR/CSR hydration mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnalysis(readCache(ticker));
    setError(null);
  }, [ticker]);

  useEffect(() => {
    if (!analysis) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [analysis]);

  const run = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/stocks/${encodeURIComponent(ticker)}/analyze`,
        { method: "POST" },
      );
      const json = (await res.json().catch(() => ({}))) as Partial<ApiResponse> & {
        error?: string;
      };
      if (!res.ok || !json.narrative) {
        throw new Error(json.error ?? `Analysis failed (${res.status})`);
      }
      const cache: AnalysisCache = {
        narrative: json.narrative,
        as_of: json.as_of ?? "",
        fetched_at: json.fetched_at ?? new Date().toISOString(),
      };
      setAnalysis(cache);
      writeCache(ticker, cache);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }, [ticker]);

  function refresh() {
    clearCache(ticker);
    setAnalysis(null);
    void run();
  }

  // Empty / first-render state — show the trigger button. Loading sits on
  // the same button so the user's eye stays in one place.
  if (!analysis) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="font-ui text-[10px] uppercase tracking-[0.3em] text-[var(--accent-amber)]">
              Analyze trade
            </div>
            <p className="mt-1 font-ui text-sm text-[var(--text-secondary)]">
              Reads {ticker} through the framework — setup conditions, volume,
              regime context. Doesn&apos;t recommend, just shows what&apos;s there.
            </p>
          </div>
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded bg-[var(--accent-amber)] px-3 py-2 font-ui text-xs uppercase tracking-wider text-black hover:opacity-90 disabled:opacity-50 ${pending ? "pulse-amber" : ""}`}
          >
            {pending && <Spinner size={12} />}
            {pending ? "Reading the tape…" : "Analyze"}
          </button>
        </div>
        {error && (
          <p className="mt-3 font-ui text-xs text-[var(--accent-red)]">
            {error}
          </p>
        )}
      </div>
    );
  }

  const paras = analysis.narrative.split(/\n\n+/).filter(Boolean);

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
        <div className="font-ui text-[10px] uppercase tracking-[0.32em] text-[var(--accent-amber)]">
          Analyze trade · {ticker}
        </div>
        <div className="flex items-center gap-3 font-ui text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
          <span title={`Fetched ${new Date(analysis.fetched_at).toLocaleString()}`}>
            {relativeTime(analysis.fetched_at)}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded px-1 text-[var(--text-secondary)] hover:text-[var(--accent-amber)] disabled:opacity-50"
          >
            {pending && <Spinner size={10} />}
            {pending ? "refreshing…" : "refresh"}
          </button>
        </div>
      </div>
      <div className="prose-editorial mt-4">
        {paras.map((p, idx) => (
          <p key={idx}>{p}</p>
        ))}
      </div>
      {error && (
        <p className="mt-3 font-ui text-xs text-[var(--accent-red)]">
          {error}
        </p>
      )}
    </div>
  );
}
