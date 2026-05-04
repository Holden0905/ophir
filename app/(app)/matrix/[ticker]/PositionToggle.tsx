"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStock, removeStock } from "../actions";
import type { Stock } from "@/lib/supabase/types";

export function PositionToggle({ stock }: { stock: Stock }) {
  const router = useRouter();
  const [isPosition, setIsPosition] = useState(stock.is_position);
  const [interested, setInterested] = useState(stock.is_interested);
  const [pending, startTransition] = useTransition();

  function toggle(field: "is_position" | "is_interested") {
    startTransition(async () => {
      if (field === "is_position") {
        const next = !isPosition;
        setIsPosition(next);
        await updateStock(stock.id, { is_position: next });
      } else {
        const next = !interested;
        setInterested(next);
        await updateStock(stock.id, { is_interested: next });
      }
    });
  }

  function archive() {
    if (!confirm("Remove this ticker from your matrix?")) return;
    startTransition(async () => {
      await removeStock(stock.id);
      router.push("/matrix");
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => toggle("is_position")}
        disabled={pending}
        className={`rounded border px-3 py-1.5 font-ui text-xs uppercase tracking-wider transition-colors ${
          isPosition
            ? "amber-glow border-[var(--accent-amber)] text-[var(--accent-amber)]"
            : "border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        }`}
      >
        {isPosition ? "Position" : "Mark position"}
      </button>
      <button
        type="button"
        onClick={() => toggle("is_interested")}
        disabled={pending}
        className={`rounded border px-3 py-1.5 font-ui text-xs uppercase tracking-wider transition-colors ${
          interested
            ? "amber-glow-soft border-[var(--accent-amber-dim)] text-[var(--accent-amber)]"
            : "border-[var(--border)] text-[var(--text-secondary)]"
        }`}
      >
        {interested ? "★ Watching" : "☆ Watch"}
      </button>
      <button
        type="button"
        onClick={archive}
        disabled={pending}
        className="rounded border border-[var(--border)] px-3 py-1.5 font-ui text-xs uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--accent-red)]"
      >
        Remove
      </button>
    </div>
  );
}
