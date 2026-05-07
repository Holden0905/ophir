"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/shared/Spinner";
import type { SnapshotType } from "@/lib/supabase/types";

export function GenerateBriefButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<SnapshotType>("eod");

  function generate() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/regime/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot_type: type }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `Failed (${res.status})`);
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="card p-5">
      <div className="font-ui text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
        Generate brief
      </div>
      <div className="mt-3 flex gap-1 rounded bg-[var(--bg-elevated)] p-0.5 text-xs font-ui">
        {(["premarket", "eod"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`flex-1 rounded px-2 py-1 ${
              type === t
                ? "bg-[var(--bg-card)] text-[var(--accent-amber)]"
                : "text-[var(--text-secondary)]"
            }`}
          >
            {t === "premarket" ? "Pre-market" : "End of day"}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={generate}
        className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded bg-[var(--accent-amber)] px-3 py-2 font-ui text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50 ${pending ? "pulse-amber" : ""}`}
      >
        {pending && <Spinner size={14} />}
        {pending ? "Generating brief…" : "Generate new brief"}
      </button>
      {error && (
        <p className="mt-2 font-ui text-xs text-[var(--accent-red)]">
          {error}
        </p>
      )}
    </div>
  );
}
