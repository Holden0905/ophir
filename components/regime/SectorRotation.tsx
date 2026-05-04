"use client";

import { useState } from "react";
import { fmtPct, pctClass } from "@/lib/format";
import type { SectorSnapshot } from "@/lib/supabase/types";

export function SectorRotation({ sectors }: { sectors: SectorSnapshot[] }) {
  const [view, setView] = useState<"5d" | "30d">("5d");

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

  const ranked = [...sectors].sort((a, b) => {
    const av = view === "5d" ? a.rs5d : a.rs30d;
    const bv = view === "5d" ? b.rs5d : b.rs30d;
    return (bv ?? 0) - (av ?? 0);
  });

  const maxAbs = Math.max(
    ...ranked.map((s) =>
      Math.abs(view === "5d" ? (s.rs5d ?? 0) : (s.rs30d ?? 0)),
    ),
    0.01,
  );

  // Divergence: top of 5d vs bottom of 30d (or vice-versa)
  const sorted5 = [...sectors].sort(
    (a, b) => (b.rs5d ?? 0) - (a.rs5d ?? 0),
  );
  const sorted30 = [...sectors].sort(
    (a, b) => (b.rs30d ?? 0) - (a.rs30d ?? 0),
  );
  const top5 = new Set(sorted5.slice(0, 3).map((s) => s.symbol));
  const top30 = new Set(sorted30.slice(0, 3).map((s) => s.symbol));
  const divergent = [...top5].filter((s) => !top30.has(s));

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="font-ui text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
          Sector Rotation
        </div>
        <div className="flex gap-1 rounded bg-[var(--bg-elevated)] p-0.5 text-xs font-ui">
          {(["5d", "30d"] as const).map((v) => (
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
          const v = view === "5d" ? s.rs5d : s.rs30d;
          const width = ((v ?? 0) / maxAbs) * 50;
          const positive = (v ?? 0) >= 0;
          const isDivergent = divergent.includes(s.symbol);
          return (
            <div
              key={s.symbol}
              className="grid grid-cols-[3.2rem_1fr_4rem] items-center gap-2"
            >
              <div className="font-data text-xs text-[var(--text-secondary)]">
                {s.symbol}
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
