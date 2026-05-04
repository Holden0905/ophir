import { fmtPct, pctClass } from "@/lib/format";

interface DataCellProps {
  value: number | null | undefined;
  format?: "pct" | "ratio" | "raw";
  digits?: number;
  align?: "left" | "right" | "center";
  /** Override the auto green/red coloring */
  forceClass?: string;
  className?: string;
}

export function DataCell({
  value,
  format = "pct",
  digits = 2,
  align = "right",
  forceClass,
  className,
}: DataCellProps) {
  let display: string;
  if (value === null || value === undefined || !Number.isFinite(value)) {
    display = "—";
  } else if (format === "pct") {
    display = fmtPct(value, digits);
  } else {
    display = value.toFixed(digits);
  }

  const colorClass =
    forceClass ?? (format === "pct" ? pctClass(value) : "value-flat");
  const alignClass =
    align === "right"
      ? "text-right"
      : align === "center"
        ? "text-center"
        : "text-left";

  return (
    <span
      className={`font-data tabular-nums ${alignClass} ${colorClass} ${className ?? ""}`}
    >
      {display}
    </span>
  );
}
