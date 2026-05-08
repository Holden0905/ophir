import { createClient } from "@/lib/supabase/server";
import { RegimeBadge } from "@/components/regime/RegimeBadge";
import { RegimeNarrative } from "@/components/regime/RegimeNarrative";
import { RegimeLegend } from "@/components/regime/RegimeLegend";
import { GenerateBriefButton } from "@/components/regime/GenerateBriefButton";
import { BriefHistory } from "@/components/regime/BriefHistory";
import { DashboardLive } from "./DashboardLive";
import type { RegimeSnapshot } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Regime" };

export default async function DashboardPage() {
  const supabase = await createClient();
  // Pull a generous window so the history list goes back far enough to
  // be useful; client-side state on BriefHistory keeps render cheap.
  const { data: snapshots } = await supabase
    .from("regime_snapshots")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(60);

  const list = (snapshots ?? []) as RegimeSnapshot[];
  const latest = list[0] ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <DashboardLive snapshot={latest} />

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

        <BriefHistory briefs={list.slice(1)} />
      </div>
    </div>
  );
}
