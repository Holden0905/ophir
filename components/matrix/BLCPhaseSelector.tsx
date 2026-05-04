"use client";

import { useState, useTransition } from "react";
import { BLC_PHASES } from "@/lib/calculations/blc";
import { updateStock } from "@/app/(app)/matrix/actions";

export function BLCPhaseSelector({
  stockId,
  value,
}: {
  stockId: string;
  value: number | null;
}) {
  const [phase, setPhase] = useState<number | null>(value);
  const [pending, startTransition] = useTransition();

  function setAndSave(next: number | null) {
    setPhase(next);
    startTransition(async () => {
      await updateStock(stockId, { blc_phase: next });
    });
  }

  const current = BLC_PHASES.find((p) => p.phase === phase);

  return (
    <div className="card p-5">
      <div className="font-ui text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
        Business Lifecycle (Feroldi)
      </div>

      <div className="mt-3 grid grid-cols-6 gap-1.5">
        {BLC_PHASES.map((p) => {
          const active = phase === p.phase;
          return (
            <button
              key={p.phase}
              type="button"
              onClick={() => setAndSave(p.phase === phase ? null : p.phase)}
              disabled={pending}
              className={`flex flex-col items-center gap-1 rounded px-2 py-2 transition-colors ${
                active
                  ? "amber-glow bg-[var(--bg-elevated)] text-[var(--accent-amber)]"
                  : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <span className="font-data text-base">{p.phase}</span>
              <span className="font-ui text-[10px] uppercase tracking-wider">
                {p.label.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>

      {current && (
        <div className="mt-4 space-y-2 text-sm">
          <div className="font-ui text-[var(--text-primary)]">
            <span className="text-[var(--accent-amber)]">{current.label}</span>
            <span className="ml-2 font-data text-xs text-[var(--text-muted)]">
              valuation · {current.valuation}
            </span>
          </div>
          <p className="font-ui text-sm text-[var(--text-secondary)]">
            {current.description}
          </p>
          <div className="grid grid-cols-3 gap-3 pt-2">
            <Stat label="Revenue" value={current.revenue} />
            <Stat label="Gross" value={current.gross} />
            <Stat label="Net" value={current.net} />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-ui text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </div>
      <div className="font-ui text-xs text-[var(--text-primary)]">{value}</div>
    </div>
  );
}
