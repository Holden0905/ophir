"use client";

import { useState, useTransition } from "react";
import { updateStock } from "../actions";

export function StockNotes({
  stockId,
  initial,
}: {
  stockId: string;
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function save() {
    if (value === initial && savedAt === null) return;
    startTransition(async () => {
      await updateStock(stockId, { notes: value });
      setSavedAt(Date.now());
    });
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="font-ui text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
          Notes
        </div>
        <span
          className={`font-ui text-[10px] ${
            pending
              ? "text-[var(--accent-amber)]"
              : "text-[var(--text-muted)]"
          }`}
          aria-live="polite"
        >
          {pending
            ? "saving…"
            : savedAt
              ? "saved"
              : "edits save on blur"}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        rows={6}
        placeholder="Thesis, catalysts, levels to watch…"
        className="mt-3 w-full px-3 py-2 font-ui text-sm text-[var(--text-primary)]"
      />
    </div>
  );
}
