import Link from "next/link";

// Stateless nav header for the stock detail page. Three modes:
//   - In matrix (no `from`): ← Matrix.
//   - From discovery (`from=discovery&list=A,B,C&i=1`): ← Discovery + prev/next arrows
//     for cycling through the result set without bouncing back to the list.
//   - Direct URL (no `from`, ticker not in matrix): ← Matrix as a sane default.
export function StockDetailNav({
  ticker,
  from,
  list,
  index,
}: {
  ticker: string;
  from: string | null;
  list: string[];
  index: number;
}) {
  const isDiscovery = from === "discovery";
  const backHref = isDiscovery ? "/discovery" : "/matrix";
  const backLabel = isDiscovery ? "Discovery" : "Matrix";

  const prev = index > 0 ? list[index - 1] : null;
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : null;
  // Encode the same context on prev/next links so the chain keeps working.
  const ctxQuery = isDiscovery
    ? `?from=discovery&list=${encodeURIComponent(list.join(","))}`
    : "";

  return (
    <div className="flex items-center justify-between">
      <Link
        href={backHref}
        aria-label={`Back to ${backLabel}`}
        className="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 rounded px-2 py-1 font-ui text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--accent-amber)]"
      >
        <span aria-hidden className="font-data text-lg leading-none">
          ←
        </span>
        <span className="uppercase tracking-wider text-xs">{backLabel}</span>
      </Link>

      {isDiscovery && list.length > 1 && (
        <nav
          aria-label="Discovery results"
          className="flex items-center gap-1 font-ui text-xs text-[var(--text-muted)]"
        >
          {prev ? (
            <Link
              href={`/matrix/${encodeURIComponent(prev)}${ctxQuery}&i=${index - 1}`}
              aria-label={`Previous result (${prev})`}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded px-2 font-data text-base text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--accent-amber)]"
            >
              ←
            </Link>
          ) : (
            <span
              aria-hidden
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-2 font-data text-base text-[var(--text-muted)]/40"
            >
              ←
            </span>
          )}
          <span className="px-1 font-data tracking-wider">
            {ticker}{" "}
            <span className="text-[var(--text-muted)]/70">
              ({Math.max(index, 0) + 1}/{list.length})
            </span>
          </span>
          {next ? (
            <Link
              href={`/matrix/${encodeURIComponent(next)}${ctxQuery}&i=${index + 1}`}
              aria-label={`Next result (${next})`}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded px-2 font-data text-base text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--accent-amber)]"
            >
              →
            </Link>
          ) : (
            <span
              aria-hidden
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-2 font-data text-base text-[var(--text-muted)]/40"
            >
              →
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
