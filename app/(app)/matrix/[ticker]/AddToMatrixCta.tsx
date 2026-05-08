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
      className={`inline-flex items-center gap-1.5 rounded bg-[var(--accent-amber)] px-3 py-1.5 font-ui text-xs uppercase tracking-wider text-black hover:opacity-90 disabled:opacity-50 ${pending ? "pulse-amber" : ""}`}
    >
      {pending && <Spinner size={11} />}
      {pending ? "Adding…" : "+ Add to matrix"}
    </button>
  );
}
