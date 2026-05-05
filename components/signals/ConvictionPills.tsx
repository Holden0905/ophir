import type { ConvictionGrade } from "@/lib/supabase/types";
import { CONVICTION_LABEL } from "@/lib/signals/labels";

export function ConvictionPills({
  grades,
  size = "sm",
}: {
  grades: ConvictionGrade[];
  size?: "xs" | "sm";
}) {
  if (grades.length === 0) return null;
  const dims =
    size === "xs"
      ? "px-1.5 py-[1px] text-[10px]"
      : "px-2 py-0.5 text-[11px]";
  return (
    <div className="flex flex-wrap gap-1">
      {grades.map((g) => (
        <span
          key={g}
          className={`rounded border border-[var(--border)] bg-[var(--bg-elevated)] font-ui uppercase tracking-wider text-[var(--text-secondary)] ${dims}`}
        >
          {CONVICTION_LABEL[g]}
        </span>
      ))}
    </div>
  );
}
