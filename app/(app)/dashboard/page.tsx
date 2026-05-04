import { createClient } from "@/lib/supabase/server";
import { MacroPulse } from "@/components/regime/MacroPulse";
import { CryptoBarometer } from "@/components/regime/CryptoBarometer";
import { SectorRotation } from "@/components/regime/SectorRotation";
import { RegimeBadge } from "@/components/regime/RegimeBadge";
import { RegimeNarrative } from "@/components/regime/RegimeNarrative";
import { RegimeLegend } from "@/components/regime/RegimeLegend";
import { GenerateBriefButton } from "@/components/regime/GenerateBriefButton";
import { relativeTime } from "@/lib/format";
import type { RegimeSnapshot } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Regime" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: snapshots } = await supabase
    .from("regime_snapshots")
    .select("*")
    .order("snapshot_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5);

  const list = (snapshots ?? []) as RegimeSnapshot[];
  const latest = list[0] ?? null;
  const sectors = (latest?.sector_data ?? []) as RegimeSnapshot["sector_data"];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <div className="space-y-6">
        <MacroPulse snapshot={latest} />
        <CryptoBarometer snapshot={latest} />
        <SectorRotation sectors={sectors ?? []} />
      </div>

      <div className="space-y-6">
        <RegimeBadge
          classification={latest?.regime_classification ?? null}
          size="lg"
        />
        <RegimeLegend />
        <RegimeNarrative
          narrative={latest?.narrative ?? null}
          createdAt={latest?.created_at ?? null}
          snapshotType={latest?.snapshot_type ?? null}
        />
        <GenerateBriefButton />

        {list.length > 1 && (
          <div className="card p-5">
            <div className="font-ui text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
              Recent briefs
            </div>
            <ol className="mt-3 space-y-2">
              {list.slice(1).map((snap) => (
                <li
                  key={snap.id}
                  className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 last:border-none last:pb-0"
                >
                  <div>
                    <div className="font-ui text-sm text-[var(--text-primary)]">
                      {snap.snapshot_type === "premarket"
                        ? "Pre-market"
                        : "End of day"}{" "}
                      <span className="text-[var(--text-muted)]">
                        · {snap.snapshot_date}
                      </span>
                    </div>
                    <div className="font-ui text-[11px] text-[var(--text-muted)]">
                      {relativeTime(snap.created_at)}
                    </div>
                  </div>
                  <span
                    className="font-ui text-[10px] uppercase tracking-wider"
                    style={{
                      color:
                        snap.regime_classification === "risk_on"
                          ? "var(--regime-on)"
                          : snap.regime_classification === "risk_off"
                            ? "var(--regime-off)"
                            : snap.regime_classification === "transitional"
                              ? "var(--regime-transition)"
                              : "var(--regime-choppy)",
                    }}
                  >
                    {snap.regime_classification ?? "—"}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
