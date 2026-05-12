"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/shared/Spinner";
import { fmtPct, fmtPrice, pctClass, relativeTime } from "@/lib/format";
import type { DiscoveryScan, ScanMode } from "@/lib/supabase/types";
import { addStockByTicker } from "../matrix/actions";

const REVERSAL_CRITERIA = [
  "Down 20%+ from 52-week high",
  "RSI(14) between 38–48 (recovering from oversold)",
  "Price within 5% of the 8 EMA",
  "Market cap > $2B",
  "Gross margin > 0",
];

const TREND_CRITERIA = [
  "Q/Q revenue growth ≥ 8%",
  "Y/Y revenue growth ≥ 12%",
  "Gross margin ≥ 30%",
  "Net margin > 0",
  "Price above 50 SMA",
];

export function DiscoveryClient({
  initialScans,
}: {
  initialScans: DiscoveryScan[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ScanMode>("trend");
  const [scans, setScans] = useState(initialScans);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showCriteria, setShowCriteria] = useState(false);

  const latestForMode = scans.find((s) => s.scan_mode === mode);

  function runScan() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/discovery/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `Scan failed (${res.status})`);
        }
        router.refresh();
        // Optimistically reorder so the most recent appears first.
        const j = (await res.json()) as {
          results: DiscoveryScan["results"];
          narrative: string;
          scan_id: string;
        };
        const fresh: DiscoveryScan = {
          id: j.scan_id,
          scan_date: new Date().toISOString().slice(0, 10),
          scan_mode: mode,
          results: j.results,
          narrative: j.narrative,
          created_at: new Date().toISOString(),
        };
        setScans([fresh, ...scans].slice(0, 7));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-editorial text-3xl tracking-tight text-[var(--text-primary)]">
            Discovery
          </h1>
          <p className="font-ui text-sm text-[var(--text-secondary)]">
            Run a screen, read the brief, follow the leads worth following.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded bg-[var(--bg-elevated)] p-0.5 text-xs font-ui">
            {(["reversal", "trend"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded px-3 py-1.5 ${
                  mode === m
                    ? "bg-[var(--bg-card)] text-[var(--accent-amber)]"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                {m === "reversal" ? "Reversal / Recovery" : "Trend Continuation"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={runScan}
            disabled={pending}
            aria-busy={pending || undefined}
            className={`inline-flex items-center gap-1.5 rounded bg-[var(--accent-amber)] px-3 py-1.5 font-ui text-xs uppercase tracking-wider text-black transition-shadow hover:opacity-90 active:scale-[0.98] ${
              pending
                ? "shadow-[0_0_0_2px_var(--accent-amber-dim)] cursor-progress"
                : "disabled:opacity-50"
            }`}
          >
            {pending && <Spinner size={12} className="text-black" />}
            {pending ? "Scanning the universe…" : "Run scan"}
          </button>
        </div>
      </div>

      <div className="card p-5">
        <button
          type="button"
          onClick={() => setShowCriteria((v) => !v)}
          className="flex w-full items-center justify-between font-ui text-xs uppercase tracking-[0.3em] text-[var(--text-muted)] hover:text-[var(--accent-amber)]"
        >
          <span>What this scan is looking for</span>
          <span>{showCriteria ? "−" : "+"}</span>
        </button>
        {showCriteria && (
          <ul className="mt-3 space-y-1 font-ui text-sm text-[var(--text-secondary)]">
            {(mode === "reversal" ? REVERSAL_CRITERIA : TREND_CRITERIA).map(
              (c) => (
                <li key={c} className="flex gap-2">
                  <span className="text-[var(--accent-amber)]">·</span>
                  <span>{c}</span>
                </li>
              ),
            )}
          </ul>
        )}
      </div>

      {error && (
        <div className="card border-[var(--accent-red)]/40 p-4 text-sm text-[var(--accent-red)]">
          {error}
        </div>
      )}

      {latestForMode ? (
        <ScanResults scan={latestForMode} />
      ) : (
        <div className="card p-10 text-center">
          <p className="prose-editorial text-[var(--text-secondary)]">
            No scan run in this mode yet. Pull the trigger when ready.
          </p>
        </div>
      )}

      {scans.length > 1 && (
        <div className="card p-5">
          <div className="font-ui text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
            Recent scans
          </div>
          <ol className="mt-3 space-y-1.5">
            {scans.slice(0, 7).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-1.5 last:border-none last:pb-0 font-ui text-sm"
              >
                <span className="text-[var(--text-secondary)]">
                  {s.scan_mode === "reversal" ? "Reversal" : "Trend"} ·{" "}
                  {s.scan_date}{" "}
                  <span className="text-[var(--text-muted)]">
                    · {(s.results ?? []).length} hit
                    {(s.results ?? []).length === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="font-ui text-[11px] text-[var(--text-muted)]">
                  {relativeTime(s.created_at)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function ScanResults({ scan }: { scan: DiscoveryScan }) {
  // Encode the ordered ticker list once so each row can build its detail
  // link with `from=discovery&list=...&i=N`. The detail page uses this
  // to render prev/next arrows and a "Back to Discovery" link.
  const tickers = scan.results.map((r) => r.ticker);
  const listParam = encodeURIComponent(tickers.join(","));
  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div className="font-ui text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
            {scan.scan_mode === "reversal"
              ? "Reversal brief"
              : "Trend continuation brief"}
          </div>
          <span className="font-ui text-xs text-[var(--text-muted)]">
            {relativeTime(scan.created_at)}
          </span>
        </div>
        <div className="prose-editorial mt-4">
          {(scan.narrative ?? "").split(/\n\n+/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </div>

      {scan.results.length > 0 ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-[var(--border)] font-ui text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-2">Ticker</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Day</th>
                <th className="px-3 py-2 text-right">RSI</th>
                <th className="px-3 py-2 text-right">vs 8EMA</th>
                <th className="px-3 py-2 text-right">vs 50MA</th>
                <th className="px-3 py-2 text-right">Off high</th>
                <th className="px-3 py-2">Why</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {scan.results.map((r, idx) => (
                <tr
                  key={r.ticker}
                  className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)]"
                >
                  <td className="px-3 py-2 font-data font-medium text-[var(--text-primary)]">
                    <Link
                      href={`/matrix/${r.ticker}?from=discovery&list=${listParam}&i=${idx}`}
                      className="hover:text-[var(--accent-amber)]"
                    >
                      {r.ticker}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right font-data">
                    {fmtPrice(r.current_price)}
                  </td>
                  <td className={`px-3 py-2 text-right font-data ${pctClass(r.price_change_pct)}`}>
                    {fmtPct(r.price_change_pct)}
                  </td>
                  <td className="px-3 py-2 text-right font-data text-[var(--text-secondary)]">
                    {r.rsi_14 !== null ? r.rsi_14.toFixed(1) : "—"}
                  </td>
                  <td className={`px-3 py-2 text-right font-data ${pctClass(r.price_vs_ema8_pct)}`}>
                    {fmtPct(r.price_vs_ema8_pct)}
                  </td>
                  <td className={`px-3 py-2 text-right font-data ${pctClass(r.price_vs_ma50_pct)}`}>
                    {fmtPct(r.price_vs_ma50_pct)}
                  </td>
                  <td className="px-3 py-2 text-right font-data value-down">
                    {fmtPct(r.pct_from_52_high)}
                  </td>
                  <td className="px-3 py-2 font-ui text-xs text-[var(--text-secondary)]">
                    {r.reason}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <AddToMatrixButton ticker={r.ticker} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card p-10 text-center">
          <p className="prose-editorial text-[var(--text-secondary)]">
            The screen returned nothing. That itself is information — sit on hands.
          </p>
        </div>
      )}
    </div>
  );
}

function AddToMatrixButton({ ticker }: { ticker: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function add() {
    startTransition(async () => {
      const res = await addStockByTicker(ticker);
      if (res.ok) setDone(true);
    });
  }

  return (
    <button
      type="button"
      disabled={pending || done}
      onClick={add}
      aria-busy={pending || undefined}
      className={`inline-flex items-center gap-1 rounded border px-2 py-1 font-ui text-[10px] uppercase tracking-wider transition-colors ${
        pending
          ? "border-[var(--accent-amber-dim)] bg-[var(--accent-amber)] text-black cursor-progress"
          : done
            ? "border-[var(--accent-amber-dim)] text-[var(--accent-amber)]"
            : "border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--accent-amber)]"
      }`}
    >
      {pending && <Spinner size={10} className="text-black" />}
      {done ? "added" : pending ? "Adding…" : "+ matrix"}
    </button>
  );
}
