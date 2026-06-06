"use client";

import { useState } from "react";
import { relativeTime } from "@/lib/format";
import { NarrativeBody } from "@/components/shared/NarrativeBody";
import type { RegimeSnapshot } from "@/lib/supabase/types";

function classificationColor(c: RegimeSnapshot["regime_classification"]): string {
  switch (c) {
    case "risk_on":
      return "var(--regime-on)";
    case "risk_off":
      return "var(--regime-off)";
    case "transitional":
      return "var(--regime-transition)";
    case "choppy":
      return "var(--regime-choppy)";
    default:
      return "var(--text-muted)";
  }
}

// Past-briefs browser. The "current" brief lives in RegimeNarrative —
// this list is for going back. Each row expands inline to show the full
// narrative; only one row open at a time keeps the page tidy.
export function BriefHistory({ briefs }: { briefs: RegimeSnapshot[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (briefs.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="font-ui text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
        Brief history
      </div>
      <ol className="mt-3 divide-y divide-[var(--border-subtle)]">
        {briefs.map((b) => {
          const open = openId === b.id;
          const isPre = b.snapshot_type === "premarket";
          return (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : b.id)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-elevated)] focus:bg-[var(--bg-elevated)] focus:outline-none"
              >
                <div className="flex min-w-0 items-baseline gap-3">
                  <span
                    aria-hidden
                    className="font-data text-xs text-[var(--text-muted)]"
                  >
                    {open ? "▾" : "▸"}
                  </span>
                  <span className="font-ui text-sm text-[var(--text-primary)]">
                    {isPre ? "Pre-market" : "End of day"}
                  </span>
                  <span className="font-data text-xs text-[var(--text-secondary)]">
                    {b.snapshot_date}
                  </span>
                  <span className="font-ui text-[11px] text-[var(--text-muted)]">
                    {relativeTime(b.created_at)}
                  </span>
                </div>
                <span
                  className="shrink-0 font-ui text-[10px] uppercase tracking-wider"
                  style={{ color: classificationColor(b.regime_classification) }}
                >
                  {b.regime_classification ?? "—"}
                </span>
              </button>

              {open && (
                <div className="prose-editorial border-l-2 border-[var(--border)] pb-4 pl-5 pr-2 pt-1 text-[var(--text-secondary)]">
                  {b.narrative && <NarrativeBody narrative={b.narrative} />}
                  {!b.narrative && (
                    <p className="font-ui text-sm italic">
                      No narrative was saved on this snapshot.
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
