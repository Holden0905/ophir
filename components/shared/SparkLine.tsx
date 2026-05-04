interface SparkLineProps {
  values: number[];
  width?: number;
  height?: number;
  colorClass?: string;
}

export function SparkLine({
  values,
  width = 80,
  height = 24,
  colorClass,
}: SparkLineProps) {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const last = values[values.length - 1];
  const first = values[0];
  const auto = last >= first ? "var(--accent-green)" : "var(--accent-red)";

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1 || 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={colorClass}
    >
      <polyline
        fill="none"
        stroke={colorClass ? "currentColor" : auto}
        strokeWidth="1.25"
        points={points}
      />
    </svg>
  );
}
