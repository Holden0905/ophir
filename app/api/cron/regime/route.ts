import { NextResponse, type NextRequest } from "next/server";
import { authorizeCron } from "@/lib/cron/auth";
import { buildRegimeSnapshot } from "@/lib/regime/build";
import { createServiceClient } from "@/lib/supabase/server";
import type { SnapshotType } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Inferred snapshot type by US market hour. Vercel cron lines pass the
// type explicitly via `?type=` so this is only a fallback for manual
// `curl` triggers.
function inferSnapshotType(): SnapshotType {
  const nowEt = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  return nowEt.getHours() < 12 ? "premarket" : "eod";
}

async function run(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const typeParam = request.nextUrl.searchParams.get("type") as
    | SnapshotType
    | null;
  const snapshotType: SnapshotType =
    typeParam === "premarket" || typeParam === "eod"
      ? typeParam
      : inferSnapshotType();

  console.log(`[cron/regime] building ${snapshotType} snapshot`);
  const snapshot = await buildRegimeSnapshot(snapshotType);
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("regime_snapshots")
    .insert(snapshot)
    .select("id, snapshot_type, snapshot_date, regime_classification, created_at")
    .single();

  if (error) {
    console.error(`[cron/regime] insert failed:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  console.log(`[cron/regime] ok`, data);
  return NextResponse.json({ ok: true, snapshot: data });
}

// Vercel cron defaults to GET. We accept POST too for manual triggers
// from clients that prefer it.
export const GET = run;
export const POST = run;
