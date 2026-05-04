interface LoadingPulseProps {
  className?: string;
  rows?: number;
}

export function LoadingPulse({ className, rows = 1 }: LoadingPulseProps) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="pulse-amber h-4 w-full rounded border"
          style={{ borderColor: "var(--border-subtle)" }}
        />
      ))}
    </div>
  );
}
