import type { RegimeClassification } from "@/lib/supabase/types";

const KEY: Array<{
  classification: RegimeClassification;
  label: string;
  color: string;
  description: string;
}> = [
  {
    classification: "risk_on",
    label: "Risk On",
    color: "var(--regime-on)",
    description: "Trend up, breadth expanding, growth/cyclicals lead, VIX compressing.",
  },
  {
    classification: "risk_off",
    label: "Risk Off",
    color: "var(--regime-off)",
    description: "Trend down, defensives lead, VIX rising, breadth narrowing.",
  },
  {
    classification: "transitional",
    label: "Transitional",
    color: "var(--regime-transition)",
    description: "Leadership rotating, conflicting signals — regime in flux.",
  },
  {
    classification: "choppy",
    label: "Choppy",
    color: "var(--regime-choppy)",
    description: "Rangebound, no clear leadership, low-conviction tape.",
  },
];

export function RegimeLegend() {
  return (
    <div className="rounded border border-[var(--border-subtle)] px-4 py-3">
      <div className="font-ui text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
        Regime key
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {KEY.map((k) => (
          <li
            key={k.classification}
            className="grid grid-cols-[0.5rem_5.5rem_1fr] items-baseline gap-2"
          >
            <span
              aria-hidden
              className="h-2 w-2 translate-y-[2px] rounded-full"
              style={{ background: k.color }}
            />
            <span
              className="font-ui text-[11px] uppercase tracking-wider"
              style={{ color: k.color }}
            >
              {k.label}
            </span>
            <span className="font-ui text-[11px] leading-snug text-[var(--text-secondary)]">
              {k.description}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
