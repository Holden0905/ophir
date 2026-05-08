import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FeedStatus {
  last_updated: string | null;
  age_minutes: number | null;
  budget_minutes: number;
  rows: number;
  fresh: boolean | null;
}

const FRESHNESS_BUDGET_MINUTES = {
  regime: 60 * 14, // expect a snapshot at least every 14h (premarket+EOD daily)
  signals: 60 * 36, // weekday-only — give the weekend a 36h pad before flagging
  daily_technicals: 60 * 36,
  briefs: 60 * 14, // narrative is part of regime_snapshots
  sector_data: 60 * 14,
  stock_technicals: 60 * 36,
  stock_fundamentals: 60 * 24 * 9, // 7-day TTL + 2-day pad
  discovery_scans: 60 * 36,
};

function ageMinutes(ts: string | null): number | null {
  if (!ts) return null;
  const ms = Date.now() - new Date(ts).getTime();
  return Math.round(ms / 60000);
}

function freshness(
  lastTs: string | null,
  budget: number,
): { age_minutes: number | null; fresh: boolean | null } {
  const age = ageMinutes(lastTs);
  if (age === null) return { age_minutes: null, fresh: null };
  return { age_minutes: age, fresh: age <= budget };
}

export async function GET() {
  const svc = createServiceClient();

  // One round-trip per feed — small enough that a sequential await chain
  // is fine and keeps the JSON output trivially readable.
  const [
    regime,
    briefs,
    signals,
    dailyTech,
    stockTech,
    stockFund,
    discovery,
  ] = await Promise.all([
    svc
      .from("regime_snapshots")
      .select("created_at", { count: "exact", head: false })
      .order("created_at", { ascending: false })
      .limit(1),
    svc
      .from("regime_snapshots")
      .select("created_at, narrative", { count: "exact", head: false })
      .not("narrative", "is", null)
      .order("created_at", { ascending: false })
      .limit(1),
    svc
      .from("signals")
      .select("created_at", { count: "exact", head: false })
      .order("created_at", { ascending: false })
      .limit(1),
    svc
      .from("daily_technicals")
      .select("created_at", { count: "exact", head: false })
      .order("created_at", { ascending: false })
      .limit(1),
    svc
      .from("stock_technicals")
      .select("last_fetched_at", { count: "exact", head: false })
      .order("last_fetched_at", { ascending: false })
      .limit(1),
    svc
      .from("stock_fundamentals")
      .select("last_fetched_at", { count: "exact", head: false })
      .order("last_fetched_at", { ascending: false })
      .limit(1),
    svc
      .from("discovery_scans")
      .select("created_at", { count: "exact", head: false })
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  function feed(
    last: string | null,
    rows: number | null,
    budget: number,
  ): FeedStatus {
    return {
      last_updated: last,
      ...freshness(last, budget),
      budget_minutes: budget,
      rows: rows ?? 0,
    };
  }

  const feeds: Record<string, FeedStatus> = {
    regime: feed(
      regime.data?.[0]?.created_at ?? null,
      regime.count,
      FRESHNESS_BUDGET_MINUTES.regime,
    ),
    sector_data: feed(
      regime.data?.[0]?.created_at ?? null,
      regime.count,
      FRESHNESS_BUDGET_MINUTES.sector_data,
    ),
    briefs: feed(
      briefs.data?.[0]?.created_at ?? null,
      briefs.count,
      FRESHNESS_BUDGET_MINUTES.briefs,
    ),
    signals: feed(
      signals.data?.[0]?.created_at ?? null,
      signals.count,
      FRESHNESS_BUDGET_MINUTES.signals,
    ),
    daily_technicals: feed(
      dailyTech.data?.[0]?.created_at ?? null,
      dailyTech.count,
      FRESHNESS_BUDGET_MINUTES.daily_technicals,
    ),
    stock_technicals: feed(
      stockTech.data?.[0]?.last_fetched_at ?? null,
      stockTech.count,
      FRESHNESS_BUDGET_MINUTES.stock_technicals,
    ),
    stock_fundamentals: feed(
      stockFund.data?.[0]?.last_fetched_at ?? null,
      stockFund.count,
      FRESHNESS_BUDGET_MINUTES.stock_fundamentals,
    ),
    discovery_scans: feed(
      discovery.data?.[0]?.created_at ?? null,
      discovery.count,
      FRESHNESS_BUDGET_MINUTES.discovery_scans,
    ),
  };

  const stale = Object.entries(feeds)
    .filter(([, v]) => v.fresh === false || v.fresh === null)
    .map(([k]) => k);

  return NextResponse.json(
    {
      ok: stale.length === 0,
      now: new Date().toISOString(),
      stale,
      feeds,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
