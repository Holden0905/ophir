import type { RegimeClassification } from "@/lib/supabase/types";

const COPY: Record<
  RegimeClassification,
  { label: string; subtitle: string; color: string }
> = {
  risk_on: {
    label: "Risk On",
    subtitle: "buyers in control",
    color: "var(--regime-on)",
  },
  risk_off: {
    label: "Risk Off",
    subtitle: "defensive posture warranted",
    color: "var(--regime-off)",
  },
  transitional: {
    label: "Transitional",
    subtitle: "regime in flux",
    color: "var(--regime-transition)",
  },
  choppy: {
    label: "Choppy",
    subtitle: "no edge — sit on hands",
    color: "var(--regime-choppy)",
  },
};

export function RegimeBadge({
  classification,
  size = "md",
}: {
  classification: RegimeClassification | null;
  size?: "sm" | "md" | "lg";
}) {
  if (!classification) {
    return (
      <div className="card p-5">
        <div className="font-ui text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
          Regime
        </div>
        <div className="mt-2 font-editorial text-2xl text-[var(--text-secondary)]">
          Awaiting first read
        </div>
      </div>
    );
  }

  const c = COPY[classification];
  const labelSize =
    size === "lg"
      ? "text-5xl"
      : size === "md"
        ? "text-3xl"
        : "text-xl";

  return (
    <div className="card p-5">
      <div
        className="font-ui text-xs uppercase tracking-[0.3em]"
        style={{ color: c.color }}
      >
        Regime
      </div>
      <div
        className={`mt-2 font-editorial ${labelSize} tracking-tight`}
        style={{ color: c.color }}
      >
        {c.label}
      </div>
      <div className="mt-1 font-ui text-xs italic text-[var(--text-secondary)]">
        {c.subtitle}
      </div>
    </div>
  );
}
