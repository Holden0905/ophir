"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/shared/Spinner";
import { relativeTime } from "@/lib/format";

const POLL_MS = 60_000;

interface FeedStatus {
  last_updated: string | null;
  age_minutes: number | null;
  budget_minutes: number;
  rows: number;
  fresh: boolean | null;
}

interface HealthResponse {
  ok: boolean;
  now: string;
  stale: string[];
  feeds: Record<string, FeedStatus>;
}

// User-facing feed labels + display order. The /api/health endpoint
// keys are snake_case from the DB / route convention; we map them to
// readable labels here so the table reads cleanly.
const FEED_ROWS: Array<{ key: string; label: string; description: string }> = [
  {
    key: "regime",
    label: "Regime snapshots",
    description: "Premarket + EOD snapshots that drive the dashboard",
  },
  {
    key: "briefs",
    label: "EOD briefs",
    description: "AI-generated narrative on each snapshot",
  },
  {
    key: "sector_data",
    label: "Sector rotation",
    description: "Embedded in the latest regime snapshot",
  },
  {
    key: "signals",
    label: "Signal engine",
    description: "Daily trend / reversal evaluations across the watchlist",
  },
  {
    key: "daily_technicals",
    label: "Daily technicals",
    description: "Per-ticker close + indicator series the engine reads",
  },
  {
    key: "stock_technicals",
    label: "Stock technicals (cached)",
    description: "Live-quote-backed table the matrix renders",
  },
  {
    key: "stock_fundamentals",
    label: "Fundamentals",
    description: "AlphaVantage / FMP / Yahoo, 7-day TTL",
  },
  {
    key: "discovery_scans",
    label: "Discovery scans",
    description: "Daily trend / reversal universe screens",
  },
];

type Tone = "ok" | "warn" | "fail" | "unknown";

function tone(feed: FeedStatus): Tone {
  if (feed.fresh === null || feed.age_minutes === null) return "unknown";
  if (!feed.fresh) return "fail";
  // Yellow band: > 80% of the freshness budget. Surfaces feeds that
  // are about to age out without waiting for them to actually go red.
  if (feed.age_minutes >= feed.budget_minutes * 0.8) return "warn";
  return "ok";
}

function StatusDot({ t }: { t: Tone }) {
  const color =
    t === "ok"
      ? "var(--accent-green)"
      : t === "warn"
        ? "var(--accent-amber)"
        : t === "fail"
          ? "var(--accent-red)"
          : "var(--text-muted)";
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{ background: color }}
    />
  );
}

function formatAge(min: number | null): string {
  if (min === null) return "—";
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) {
    const m = min % 60;
    return m ? `${h}h ${m}m ago` : `${h}h ago`;
  }
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatBudget(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function HealthPanel() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as HealthResponse;
        if (cancelled) return;
        setData(json);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    }
    void load();
    const id = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // Tick once a second so the "X ago" labels stay honest between polls.
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!data && !error) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2">
          <div className="font-ui text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
            Data health
          </div>
          <Spinner size={11} className="text-[var(--text-muted)]" />
        </div>
      </div>
    );
  }

  const overall: Tone =
    error || (data && !data.ok)
      ? "fail"
      : data?.stale.length === 0
        ? "ok"
        : "warn";

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="font-ui text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
            Data health
          </div>
          <StatusDot t={overall} />
        </div>
        {data && (
          <span
            className="font-ui text-[10px] text-[var(--text-muted)]"
            title={`Polled ${new Date(data.now).toLocaleString()}`}
          >
            checked {relativeTime(data.now)}
          </span>
        )}
      </div>

      {error && (
        <p className="mt-3 font-ui text-xs text-[var(--accent-red)]">
          /api/health unreachable — {error}
        </p>
      )}

      {data && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-[var(--border-subtle)] font-ui text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              <tr>
                <th className="py-2 pr-3">Feed</th>
                <th className="py-2 pr-3 text-right">Last updated</th>
                <th className="py-2 pr-3 text-right">Budget</th>
                <th className="py-2 pr-3 text-right">Rows</th>
                <th className="py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {FEED_ROWS.map(({ key, label, description }) => {
                const feed = data.feeds[key];
                if (!feed) return null;
                const t = tone(feed);
                return (
                  <tr
                    key={key}
                    className="border-b border-[var(--border-subtle)] last:border-none align-top"
                  >
                    <td className="py-3 pr-3">
                      <div className="font-ui text-sm text-[var(--text-primary)]">
                        {label}
                      </div>
                      <div className="mt-0.5 font-ui text-[11px] text-[var(--text-muted)]">
                        {description}
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <div className="font-data text-xs text-[var(--text-secondary)]">
                        {formatAge(feed.age_minutes)}
                      </div>
                      {feed.last_updated && (
                        <div className="mt-0.5 font-data text-[10px] text-[var(--text-muted)]">
                          {new Date(feed.last_updated).toLocaleString(
                            undefined,
                            { dateStyle: "short", timeStyle: "short" },
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-right font-data text-xs text-[var(--text-muted)]">
                      {formatBudget(feed.budget_minutes)}
                    </td>
                    <td className="py-3 pr-3 text-right font-data text-xs text-[var(--text-secondary)]">
                      {feed.rows.toLocaleString()}
                    </td>
                    <td className="py-3 text-center">
                      <StatusDot t={t} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 font-ui text-[11px] text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <StatusDot t="ok" /> fresh
        </span>
        <span className="ml-3 inline-flex items-center gap-1.5">
          <StatusDot t="warn" /> nearing budget
        </span>
        <span className="ml-3 inline-flex items-center gap-1.5">
          <StatusDot t="fail" /> stale
        </span>
        <span className="ml-3 inline-flex items-center gap-1.5">
          <StatusDot t="unknown" /> never written
        </span>
      </p>
    </div>
  );
}
