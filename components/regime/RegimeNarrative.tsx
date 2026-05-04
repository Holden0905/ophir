import { relativeTime } from "@/lib/format";

export function RegimeNarrative({
  narrative,
  createdAt,
  snapshotType,
}: {
  narrative: string | null;
  createdAt: string | null;
  snapshotType: string | null;
}) {
  if (!narrative) {
    return (
      <div className="card p-6">
        <p className="prose-editorial text-[var(--text-secondary)]">
          No brief on file yet. Generate the first read to set the tone.
        </p>
      </div>
    );
  }

  const paras = narrative.split(/\n\n+/).filter(Boolean);

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
        <div className="font-ui text-[10px] uppercase tracking-[0.32em] text-[var(--text-muted)]">
          {snapshotType === "premarket" ? "Pre-market brief" : "End-of-day brief"}
        </div>
        <div className="font-ui text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
          {relativeTime(createdAt)}
        </div>
      </div>
      <div className="prose-editorial mt-4">
        {paras.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
    </div>
  );
}
