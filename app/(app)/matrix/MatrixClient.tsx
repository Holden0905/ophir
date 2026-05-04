"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  fmtMarketCap,
  fmtPct,
  fmtRatio,
  pctClass,
} from "@/lib/format";
import { AddStockModal } from "@/components/matrix/AddStockModal";
import { updateStock } from "./actions";
import type { MatrixRow } from "./page";

type Filter = "all" | "interested" | "positions";

export function MatrixClient({ initialRows }: { initialRows: MatrixRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  // Sync prop → state when the server re-fetches (after add / refresh /
  // toggle). Without this, optimistic local state would mask new rows.
  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const visible = useMemo(() => {
    return rows.filter((r) => {
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
  }, [rows, search, filter]);

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

        // Surface any per-ticker errors (technicals failure or fundamentals error).
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
          <button
            type="button"
            onClick={refreshAll}
            disabled={refreshing || rows.length === 0}
            className={`rounded border border-[var(--border)] px-3 py-1.5 font-ui text-xs uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--accent-amber)] disabled:opacity-50 ${refreshing ? "pulse-amber" : ""}`}
          >
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
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b border-[var(--border)] font-ui text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-2">Ticker</th>
                <th className="px-3 py-2">Name</th>
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
                <Row
                  key={r.stock.id}
                  row={r}
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
  onToggle,
}: {
  row: MatrixRow;
  onToggle: (field: "is_position" | "is_interested") => void;
}) {
  const f = row.fundamentals;
  const t = row.technicals;
  const ng =
    f?.net_margin && f?.gross_margin && f.gross_margin > 0
      ? f.net_margin / f.gross_margin
      : null;

  return (
    <tr className="border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-elevated)]">
      <td className="px-3 py-2">
        <Link
          href={`/matrix/${encodeURIComponent(row.stock.ticker)}`}
          className="font-data font-medium text-[var(--text-primary)] hover:text-[var(--accent-amber)]"
        >
          {row.stock.ticker}
        </Link>
      </td>
      <td className="px-3 py-2 font-ui text-[var(--text-secondary)]">
        <span className="line-clamp-1 max-w-[18ch]">
          {row.stock.company_name ?? f?.ticker ?? "—"}
        </span>
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
