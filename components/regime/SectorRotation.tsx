"use client";

import { useState } from "react";
import { fmtPct, pctClass, relativeTime } from "@/lib/format";
import { isUsEquityMarketOpen } from "@/lib/marketHours";
import type { SectorSnapshot } from "@/lib/supabase/types";

type View = "1d" | "5d" | "30d";

// 1D is the most useful read while the session is live or just-closed —
// it answers "what rotated today." Outside that window the 1D number
// hasn't moved (everyone's stuck on yesterday's close), so we default
// to the 5D trend instead.
function defaultViewForNow(now: Date = new Date()): View {
  if (isUsEquityMarketOpen(now)) return "1d";
  // Post-close window in NY: between 16:00 and 20:00 ET on a weekday.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const isWeekday = weekday !== "Sat" && weekday !== "Sun";
  if (isWeekday && hour >= 16 && hour < 20) return "1d";
  return "5d";
}

// Display-only short names so every row fits on one line. The full names
// are still stored in the snapshot and used by the AI prompt.
const SECTOR_SHORT_NAMES: Record<string, string> = {
  XLC: "Comm. Services",
  XLY: "Cons. Discretionary",
  XLP: "Cons. Staples",
};

export function SectorRotation({
  sectors,
  asOf,
  spyChangePct,
}: {
  sectors: SectorSnapshot[];
  // ISO timestamp of the snapshot whose rs5d/rs30d values these are. The
  // card surfaces it so the user knows whether the rotation view is from
  // today's close or from an earlier session — separate from the
  // intraday "Live · Xs ago" stamp at the page level.
  asOf?: string | null;
  // Today's % change for SPY. Used as the 1D rs baseline:
  //   rs1d(sector) = sector.changePct - spyChangePct
  // Live during market hours, falls back to the snapshot's spx_change_pct
  // (SPX cash index pct change ≈ SPY pct change to within rounding).
  spyChangePct?: number | null;
}) {
  const [view, setView] = useState<View>(() => defaultViewForNow());

  if (!sectors || sectors.length === 0) {
    return (
      <div className="card p-5">
        <div className="font-ui text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
          Sector Rotation
        </div>
        <p className="mt-3 font-ui text-sm italic text-[var(--text-secondary)]">
          No sector data yet — generate a snapshot to populate.
        </p>
      </div>
    );
  }

  // 1D rs is computed live from the (possibly polled) sector.changePct
  // and the SPY benchmark. If either is missing the row gets null and
  // sorts to the bottom.
  const rs1d = (s: SectorSnapshot): number | null =>
    s.changePct === null || spyChangePct === null || spyChangePct === undefined
      ? null
      : s.changePct - spyChangePct;

  const valueFor = (s: SectorSnapshot): number | null =>
    view === "1d" ? rs1d(s) : view === "5d" ? s.rs5d : s.rs30d;

  const ranked = [...sectors].sort(
    (a, b) => (valueFor(b) ?? 0) - (valueFor(a) ?? 0),
  );

  const maxAbs = Math.max(
    ...ranked.map((s) => Math.abs(valueFor(s) ?? 0)),
    0.01,
  );

  // Divergence highlight: shown only on the 5D / 30D trend views — top
  // of 5d vs top of 30d. Doesn't apply to the 1D intraday read.
  const sorted5 = [...sectors].sort(
    (a, b) => (b.rs5d ?? 0) - (a.rs5d ?? 0),
  );
  const sorted30 = [...sectors].sort(
    (a, b) => (b.rs30d ?? 0) - (a.rs30d ?? 0),
  );
  const top5 = new Set(sorted5.slice(0, 3).map((s) => s.symbol));
  const top30 = new Set(sorted30.slice(0, 3).map((s) => s.symbol));
  const divergent =
    view === "1d" ? [] : [...top5].filter((s) => !top30.has(s));

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <div className="font-ui text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
            Sector Rotation
          </div>
          {asOf && (
            <span
              className="font-ui text-[10px] text-[var(--text-muted)]"
              title={`Snapshot generated ${new Date(asOf).toLocaleString()}`}
            >
              · snapshot {relativeTime(asOf)}
            </span>
          )}
        </div>
        <div className="flex gap-1 rounded bg-[var(--bg-elevated)] p-0.5 text-xs font-ui">
          {(["1d", "5d", "30d"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded px-2 py-0.5 ${
                view === v
                  ? "bg-[var(--bg-card)] text-[var(--accent-amber)]"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              {v.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        {ranked.map((s) => {
          const v = valueFor(s);
          const width = ((v ?? 0) / maxAbs) * 50;
          const positive = (v ?? 0) >= 0;
          const isDivergent = divergent.includes(s.symbol);
          return (
            <div
              key={s.symbol}
              className="grid grid-cols-[10rem_1fr_4rem] items-center gap-2"
            >
              <div className="truncate text-xs" title={`${s.symbol} — ${s.name}`}>
                <span className="font-data text-[var(--text-secondary)]">
                  {s.symbol}
                </span>
                <span className="ml-1.5 font-ui text-[var(--text-muted)]">
                  — {SECTOR_SHORT_NAMES[s.symbol] ?? s.name}
                </span>
              </div>
              <div className="relative h-3 rounded bg-[var(--bg-elevated)]">
                <div className="absolute left-1/2 top-0 h-full w-px bg-[var(--border)]" />
                <div
                  className="absolute top-0 h-full rounded"
                  style={{
                    left: positive ? "50%" : `${50 + width}%`,
                    width: `${Math.abs(width)}%`,
                    background: positive
                      ? "var(--accent-green)"
                      : "var(--accent-red)",
                    opacity: 0.8,
                  }}
                />
                {isDivergent && (
                  <span className="absolute -right-1 top-1/2 -translate-y-1/2 translate-x-full rounded bg-[var(--accent-amber)]/15 px-1 py-0 font-ui text-[9px] uppercase tracking-wider text-[var(--accent-amber)]">
                    div
                  </span>
                )}
              </div>
              <div className={`text-right font-data text-xs ${pctClass(v)}`}>
                {fmtPct(v)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
