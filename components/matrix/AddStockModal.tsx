"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/shared/Spinner";
import { addStock } from "@/app/(app)/matrix/actions";
import { BLC_PHASES } from "@/lib/calculations/blc";

export function AddStockModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addStock(formData);
      if (result.ok) {
        router.refresh();
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-ui text-base text-[var(--text-primary)]">
            Add to matrix
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="font-ui text-xs text-[var(--text-muted)] hover:text-[var(--accent-amber)]"
          >
            close
          </button>
        </div>

        <form action={submit} className="mt-4 space-y-3">
          <div>
            <label className="font-ui text-xs uppercase tracking-wider text-[var(--text-muted)]">
              Ticker
            </label>
            <input
              name="ticker"
              required
              autoFocus
              className="mt-1 w-full px-3 py-2 font-data text-sm uppercase tracking-wider"
              placeholder="AAPL"
            />
          </div>

          <div>
            <label className="font-ui text-xs uppercase tracking-wider text-[var(--text-muted)]">
              BLC phase
            </label>
            <select
              name="blc_phase"
              className="mt-1 w-full px-3 py-2 font-ui text-sm"
              defaultValue=""
            >
              <option value="">— unset</option>
              {BLC_PHASES.map((p) => (
                <option key={p.phase} value={p.phase}>
                  Phase {p.phase} · {p.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 font-ui text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              name="is_position"
              className="h-4 w-4 accent-[var(--accent-amber)]"
            />
            Currently a position
          </label>

          {error && (
            <div className="rounded border border-[var(--accent-red)]/40 bg-[var(--accent-red)]/10 px-3 py-2 font-ui text-xs text-[var(--accent-red)]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            aria-busy={pending || undefined}
            className={`inline-flex w-full items-center justify-center gap-2 rounded bg-[var(--accent-amber)] px-3 py-2 font-ui text-sm font-medium text-black transition-shadow hover:opacity-90 active:scale-[0.98] ${
              pending
                ? "shadow-[0_0_0_2px_var(--accent-amber-dim)] cursor-progress"
                : "disabled:opacity-50"
            }`}
          >
            {pending && <Spinner size={14} className="text-black" />}
            {pending ? "Adding…" : "Add to matrix"}
          </button>
        </form>
      </div>
    </div>
  );
}
