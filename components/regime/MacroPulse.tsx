import { DataCell } from "@/components/shared/DataCell";
import { fmtPrice, fmtNumber } from "@/lib/format";
import type { RegimeSnapshot } from "@/lib/supabase/types";

export function MacroPulse({ snapshot }: { snapshot: RegimeSnapshot | null }) {
  return (
    <div className="card p-5">
      <div className="font-ui text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
        Macro Pulse
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Pillar
          label="SPX"
          value={snapshot?.spx_price ? fmtPrice(snapshot.spx_price, 0) : "—"}
          changePct={snapshot?.spx_change_pct ?? null}
          subline={
            snapshot?.spx_vs_ema21_pct !== null &&
            snapshot?.spx_vs_ema21_pct !== undefined
              ? `vs 21 EMA ${snapshot.spx_vs_ema21_pct >= 0 ? "+" : ""}${snapshot.spx_vs_ema21_pct.toFixed(2)}%`
              : "—"
          }
        />
        <Pillar
          label="QQQ"
          value={snapshot?.qqq_price ? fmtPrice(snapshot.qqq_price, 2) : "—"}
          changePct={snapshot?.qqq_change_pct ?? null}
          subline={null}
        />
        <Pillar
          label="VIX"
          value={
            snapshot?.vix_level !== null && snapshot?.vix_level !== undefined
              ? fmtNumber(snapshot.vix_level, 2)
              : "—"
          }
          changePct={null}
          subline={
            <span className="font-ui">
              {snapshot?.vix_direction ?? "—"}
              {snapshot?.vix_flag && (
                <span className="ml-2 rounded bg-[var(--accent-amber)]/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--accent-amber)]">
                  {snapshot.vix_flag}
                </span>
              )}
            </span>
          }
        />
      </div>
    </div>
  );
}

function Pillar({
  label,
  value,
  changePct,
  subline,
}: {
  label: string;
  value: string;
  changePct: number | null;
  subline: React.ReactNode;
}) {
  return (
    <div>
      <div className="font-ui text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 font-data text-2xl text-[var(--text-primary)]">
        {value}
      </div>
      <div className="mt-1 text-xs">
        {changePct !== null ? (
          <DataCell value={changePct} format="pct" digits={2} align="left" />
        ) : (
          <span className="font-ui text-[var(--text-secondary)]">{subline}</span>
        )}
      </div>
      {changePct !== null && subline && (
        <div className="mt-0.5 font-ui text-[11px] text-[var(--text-secondary)]">
          {subline}
        </div>
      )}
    </div>
  );
}
