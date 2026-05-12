"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/shared/Spinner";
import { addStockByTicker } from "../actions";

// Used in preview mode (ticker not in user's matrix yet). Adds the
// ticker, then refreshes — the standard detail view picks up after.
export function AddToMatrixCta({ ticker }: { ticker: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function add() {
    startTransition(async () => {
      const r = await addStockByTicker(ticker);
      if (r.ok) router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={add}
      disabled={pending}
      aria-busy={pending || undefined}
      className={`inline-flex items-center gap-1.5 rounded bg-[var(--accent-amber)] px-3 py-1.5 font-ui text-xs uppercase tracking-wider text-black transition-shadow hover:opacity-90 active:scale-[0.98] ${
        pending
          ? "shadow-[0_0_0_2px_var(--accent-amber-dim)] cursor-progress"
          : "disabled:opacity-50"
      }`}
    >
      {pending && <Spinner size={11} className="text-black" />}
      {pending ? "Adding…" : "+ Add to matrix"}
    </button>
  );
}
