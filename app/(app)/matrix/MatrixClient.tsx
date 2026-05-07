"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  fmtMarketCap,
  fmtPct,
  fmtPrice,
  fmtRatio,
  pctClass,
  relativeTime,
} from "@/lib/format";
import { AddStockModal } from "@/components/matrix/AddStockModal";
import { Spinner } from "@/components/shared/Spinner";
import { SignalBadge } from "@/components/signals/SignalBadge";
import { ConvictionPills } from "@/components/signals/ConvictionPills";
import {
  SETUP_FULL,
  compareSignalState,
  dominantSignal,
} from "@/lib/signals/labels";
import { updateStock } from "./actions";
import type { MatrixRow } from "./page";
import type { SignalState } from "@/lib/supabase/types";

type Filter = "all" | "interested" | "positions";

interface LiveQuote {
  price: number | null;
  change_pct: number | null;
  volume: number | null;
}

const QUOTE_POLL_MS = 60_000;

export function MatrixClient({ initialRows }: { initialRows: MatrixRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [quotesAt, setQuotesAt] = useState<string | null>(null);
  // useState init runs on every render but the function form runs once;
  // we use a tick counter solely to re-render the "x seconds ago" stamp.
  const [, setNowTick] = useState(0);
  // Sort by Setup column when active; null falls back to ticker order from
  // the server. We don't expose sort handles on other columns yet.
  const [setupSort, setSetupSort] = useState<"desc" | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  // Live quote polling — every 60s, ask /api/stocks/quotes for fresh price /
  // change / volume per ticker. Only runs while the tab is visible so we
  // don't burn Yahoo quota for a backgrounded page.
  const tickerKey = useMemo(
    () => initialRows.map((r) => r.stock.ticker).sort().join(","),
    [initialRows],
  );
  useEffect(() => {
    if (!tickerKey) return;
    let cancelled = false;
    async function load() {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch(
          `/api/stocks/quotes?tickers=${encodeURIComponent(tickerKey)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const j = (await res.json()) as {
          quotes: Record<string, LiveQuote>;
          fetched_at: string;
        };
        if (cancelled) return;
        setQuotes(j.quotes);
        setQuotesAt(j.fetched_at);
      } catch {
        // Silent — the cached server-side prices are still rendered as a
        // fallback. A failed poll shouldn't blank the table.
      }
    }
    void load();
    const id = window.setInterval(load, QUOTE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [tickerKey]);

  // Tick the "last updated" stamp once a second so the relative time stays
  // honest (otherwise it'd only update on the 60s poll).
  useEffect(() => {
    const id = window.setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const visible = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (filter === "interested" && !r.stock.is_interested) return false;
      if (filter === "positions" && !r.stock.is_position) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !r.stock.ticker.toLowerCase().includes(s) &&
          !(r.stock.company_name ?? "").toLowerCase().includes(s)
        ) {
          return false;
        }
      }
      return true;
    });

    if (setupSort === "desc") {
      // Triggered first, then qualifies, then none (alphabetic within).
      return [...filtered].sort((a, b) => {
        const aSig = dominantSignal(a.signals);
        const bSig = dominantSignal(b.signals);
        const aState: SignalState = aSig?.state ?? "none";
        const bState: SignalState = bSig?.state ?? "none";
        const cmp = compareSignalState(aState, bState);
        if (cmp !== 0) return cmp;
        return a.stock.ticker.localeCompare(b.stock.ticker);
      });
    }
    return filtered;
  }, [rows, search, filter, setupSort]);

  const [refreshError, setRefreshError] = useState<string | null>(null);

  function refreshAll() {
    if (rows.length === 0) return;
    setRefreshError(null);
    startRefresh(async () => {
      try {
        const res = await fetch("/api/stocks/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tickers: rows.map((r) => r.stock.ticker),
            fundamentals: true,
            force: true,
          }),
        });
        const json = (await res.json()) as {
          results?: Record<
            string,
            { technicals: string; fundamentals?: string; error?: string }
          >;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);

        const failed = Object.entries(json.results ?? {})
          .filter(
            ([, r]) =>
              r.technicals === "fail" ||
              (r.fundamentals && r.fundamentals.startsWith("error:")),
          )
          .map(([ticker, r]) => {
            const parts = [];
            if (r.technicals === "fail") parts.push(`tech: ${r.error}`);
            if (r.fundamentals?.startsWith("error:"))
              parts.push(r.fundamentals.replace(/^error:/, "fund: "));
            return `${ticker} → ${parts.join("; ")}`;
          });
        if (failed.length) setRefreshError(failed.join(" · "));
      } catch (e) {
        setRefreshError(e instanceof Error ? e.message : String(e));
      } finally {
        router.refresh();
      }
    });
  }

  function toggleSetupSort() {
    setSetupSort((prev) => (prev === "desc" ? null : "desc"));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-editorial text-3xl tracking-tight text-[var(--text-primary)]">
            Research Matrix
          </h1>
          <p className="font-ui text-sm text-[var(--text-secondary)]">
            {rows.length} on the watchlist · {rows.filter((r) => r.stock.is_position).length} positions
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticker or name"
            className="px-3 py-1.5 font-ui text-sm"
          />
          <div className="flex gap-1 rounded bg-[var(--bg-elevated)] p-0.5 text-xs font-ui">
            {(["all", "interested", "positions"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded px-2 py-1 ${
                  filter === f
                    ? "bg-[var(--bg-card)] text-[var(--accent-amber)]"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <span
            className="font-ui text-[10px] uppercase tracking-wider text-[var(--text-muted)]"
            title={
              quotesAt ? `Live quotes fetched ${new Date(quotesAt).toLocaleString()}` : undefined
            }
          >
            {quotesAt
              ? `Live · ${relativeTime(quotesAt)}`
              : "Live · loading…"}
          </span>
          <button
            type="button"
            onClick={refreshAll}
            disabled={refreshing || rows.length === 0}
            className={`inline-flex items-center gap-1.5 rounded border border-[var(--border)] px-3 py-1.5 font-ui text-xs uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--accent-amber)] disabled:opacity-50 ${refreshing ? "pulse-amber" : ""}`}
          >
            {refreshing && <Spinner size={12} />}
            {refreshing ? "Refreshing…" : "Refresh data"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded bg-[var(--accent-amber)] px-3 py-1.5 font-ui text-xs uppercase tracking-wider text-black hover:opacity-90"
          >
            Add stock
          </button>
        </div>
      </div>

      {refreshError && (
        <div className="card border-[var(--accent-red)]/40 p-3 font-ui text-xs text-[var(--accent-red)]">
          Refresh hit errors — {refreshError}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="prose-editorial text-[var(--text-secondary)]">
            {rows.length === 0
              ? "Empty room. Add the first ticker — that's where the work begins."
              : "No matches in current view."}
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[1280px] text-left text-sm">
            <thead className="border-b border-[var(--border)] font-ui text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-2">Ticker</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    onClick={toggleSetupSort}
                    className={`flex items-center gap-1 uppercase tracking-wider hover:text-[var(--accent-amber)] ${
                      setupSort ? "text-[var(--accent-amber)]" : ""
                    }`}
                    title="Sort by setup state"
                  >
                    Setup
                    <span aria-hidden className="text-[8px]">
                      {setupSort === "desc" ? "▼" : "↕"}
                    </span>
                  </button>
                </th>
                <th className="px-3 py-2">BLC</th>
                <th className="px-3 py-2 text-right">MktCap</th>
                <th className="px-3 py-2 text-right">Q/Q Rev</th>
                <th className="px-3 py-2 text-right">Y/Y Rev</th>
                <th className="px-3 py-2 text-right">GM</th>
                <th className="px-3 py-2 text-right">NM</th>
                <th className="px-3 py-2 text-right">N/G</th>
                <th className="px-3 py-2 text-right">Debt/Cap</th>
                <th className="px-3 py-2 text-right">vs 50MA</th>
                <th className="px-3 py-2 text-right">vs 21EMA</th>
                <th className="px-3 py-2 text-center">Pos</th>
                <th className="px-3 py-2 text-center">Star</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <Fragment key={r.stock.id}>
                  <Row
                    row={r}
                    quote={quotes[r.stock.ticker] ?? null}
                    expanded={expanded === r.stock.id}
                    onToggleExpand={() =>
                      setExpanded((prev) =>
                        prev === r.stock.id ? null : r.stock.id,
                      )
                    }
                    onToggle={(field) => {
                      const next = rows.map((rr) =>
                        rr.stock.id === r.stock.id
                          ? {
                              ...rr,
                              stock: {
                                ...rr.stock,
                                [field]: !rr.stock[field],
                              } as typeof rr.stock,
                            }
                          : rr,
                      );
                      setRows(next);
                      void updateStock(r.stock.id, {
                        [field]: !r.stock[field],
                      } as never);
                    }}
                  />
                  {expanded === r.stock.id && <SetupExpansion row={r} />}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddStockModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function Row({
  row,
  quote,
  expanded,
  onToggle,
  onToggleExpand,
}: {
  row: MatrixRow;
  quote: LiveQuote | null;
  expanded: boolean;
  onToggle: (field: "is_position" | "is_interested") => void;
  onToggleExpand: () => void;
}) {
  const f = row.fundamentals;
  const t = row.technicals;
  const ng =
    f?.net_margin && f?.gross_margin && f.gross_margin > 0
      ? f.net_margin / f.gross_margin
      : null;
  const dominant = dominantSignal(row.signals);

  // Live quote takes precedence over the cached technicals row when available.
  const price = quote?.price ?? t?.current_price ?? null;
  const change = quote?.change_pct ?? t?.price_change_pct ?? null;

  return (
    <tr
      className={`border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-elevated)] ${
        expanded ? "bg-[var(--bg-elevated)]" : ""
      }`}
    >
      <td className="px-3 py-2">
        <Link
          href={`/matrix/${encodeURIComponent(row.stock.ticker)}`}
          className="font-data font-medium text-[var(--text-primary)] hover:text-[var(--accent-amber)]"
        >
          {row.stock.ticker}
        </Link>
      </td>
      <td className="px-3 py-2 text-right">
        <div className="font-data text-sm text-[var(--text-primary)]">
          {fmtPrice(price)}
        </div>
        <div className={`font-data text-[11px] ${pctClass(change)}`}>
          {fmtPct(change, 2)}
        </div>
      </td>
      <td className="px-3 py-2 font-ui text-[var(--text-secondary)]">
        <span className="line-clamp-1 max-w-[18ch]">
          {row.stock.company_name ?? f?.ticker ?? "—"}
        </span>
      </td>
      <td className="px-3 py-2">
        {dominant ? (
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            className="flex items-center gap-1.5"
            title={`${SETUP_FULL[dominant.setup_type]} — ${dominant.state.replace("_", " ")}`}
          >
            <SignalBadge setup={dominant.setup_type} state={dominant.state} />
          </button>
        ) : (
          <span className="text-[var(--text-muted)]">—</span>
        )}
      </td>
      <td className="px-3 py-2 font-ui text-xs">
        {row.stock.blc_phase ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                background: blcDotColor(row.stock.blc_phase),
              }}
            />
            {row.stock.blc_phase} · {row.stock.blc_phase_label ?? ""}
          </span>
        ) : (
          <span className="text-[var(--text-muted)]">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-right font-data text-[var(--text-primary)]">
        {fmtMarketCap(f?.market_cap ?? null)}
      </td>
      <Pct val={f?.qq_revenue_growth ? f.qq_revenue_growth * 100 : null} highlight={10} />
      <Pct val={f?.yy_revenue_growth ? f.yy_revenue_growth * 100 : null} highlight={15} />
      <Pct val={f?.gross_margin ? f.gross_margin * 100 : null} highlight={35} />
      <Pct val={f?.net_margin ? f.net_margin * 100 : null} />
      <td className="px-3 py-2 text-right font-data text-[var(--text-secondary)]">
        {ng !== null ? fmtRatio(ng) : "—"}
      </td>
      <td
        className={`px-3 py-2 text-right font-data ${
          (f?.debt_market_cap_ratio ?? 0) > 0.3
            ? "value-down"
            : "value-flat"
        }`}
      >
        {f?.debt_market_cap_ratio !== null && f?.debt_market_cap_ratio !== undefined
          ? fmtRatio(f.debt_market_cap_ratio)
          : "—"}
      </td>
      <Pct val={t?.price_vs_ma50_pct ?? null} />
      <Pct val={t?.price_vs_ema21_pct ?? null} />
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={row.stock.is_position}
          onChange={() => onToggle("is_position")}
          className="h-4 w-4 accent-[var(--accent-amber)]"
        />
      </td>
      <td className="px-3 py-2 text-center">
        <button
          type="button"
          onClick={() => onToggle("is_interested")}
          className={`text-base ${
            row.stock.is_interested
              ? "text-[var(--accent-amber)]"
              : "text-[var(--text-muted)]"
          }`}
          aria-label="toggle interest"
        >
          {row.stock.is_interested ? "★" : "☆"}
        </button>
      </td>
    </tr>
  );
}

function SetupExpansion({ row }: { row: MatrixRow }) {
  const dominant = dominantSignal(row.signals);
  if (!dominant) return null;
  const d = row.daily;
  const closeVsEma8 =
    d?.close !== null &&
    d?.close !== undefined &&
    d?.ema_8 !== null &&
    d?.ema_8 !== undefined &&
    d.ema_8 !== 0
      ? ((d.close - d.ema_8) / d.ema_8) * 100
      : null;
  const volVsAvg =
    d?.volume !== null &&
    d?.volume !== undefined &&
    d?.avg_volume_20 !== null &&
    d?.avg_volume_20 !== undefined &&
    d.avg_volume_20 !== 0
      ? d.volume / d.avg_volume_20
      : null;

  return (
    <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
      <td colSpan={16} className="px-5 py-4">
        <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
          <div>
            <div className="font-ui text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
              {SETUP_FULL[dominant.setup_type]}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <SignalBadge
                setup={dominant.setup_type}
                state={dominant.state}
              />
              <span className="font-ui text-xs text-[var(--text-secondary)]">
                {dominant.state === "triggered_today"
                  ? "Triggered today"
                  : "Qualifies"}
              </span>
            </div>
            {dominant.cooled_until && (
              <div className="mt-2 font-ui text-[11px] text-[var(--text-muted)]">
                Cooled until {dominant.cooled_until}
              </div>
            )}
            {dominant.conviction_grades.length > 0 && (
              <div className="mt-3">
                <ConvictionPills grades={dominant.conviction_grades} size="xs" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <Stat label="Close" value={fmtPrice(d?.close ?? null)} />
            <Stat
              label="vs 8 EMA"
              value={fmtPct(closeVsEma8)}
              tone={closeVsEma8}
            />
            <Stat
              label="RSI(14)"
              value={
                d?.rsi_14 !== null && d?.rsi_14 !== undefined
                  ? d.rsi_14.toFixed(1)
                  : "—"
              }
            />
            <Stat
              label="Vol vs 20d avg"
              value={
                volVsAvg !== null
                  ? `${volVsAvg.toFixed(2)}×`
                  : "—"
              }
              tone={volVsAvg !== null ? volVsAvg - 1 : null}
            />
          </div>
        </div>
      </td>
    </tr>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: number | null;
}) {
  const cls =
    tone === undefined || tone === null
      ? ""
      : tone > 0
        ? "value-up"
        : tone < 0
          ? "value-down"
          : "";
  return (
    <div>
      <div className="font-ui text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </div>
      <div className={`mt-1 font-data text-sm ${cls}`}>{value}</div>
    </div>
  );
}

function Pct({ val, highlight }: { val: number | null; highlight?: number }) {
  let cls = pctClass(val);
  if (highlight !== undefined && val !== null && val < highlight && val > 0) {
    cls = "value-flat";
  }
  return (
    <td className={`px-3 py-2 text-right font-data ${cls}`}>
      {fmtPct(val, 1)}
    </td>
  );
}

function blcDotColor(phase: number): string {
  switch (phase) {
    case 1:
      return "#6b7280";
    case 2:
      return "#3b82f6";
    case 3:
      return "#22c55e";
    case 4:
      return "#f59e0b";
    case 5:
      return "#92630a";
    case 6:
      return "#ef4444";
    default:
      return "#4a4845";
  }
}
