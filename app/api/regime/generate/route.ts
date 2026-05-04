import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { buildRegimeSnapshot } from "@/lib/regime/build";
import { createServiceClient } from "@/lib/supabase/server";
import type { SnapshotType } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  await requireUser();
  const body = (await request.json().catch(() => ({}))) as {
    snapshot_type?: SnapshotType;
  };
  const snapshotType: SnapshotType = body.snapshot_type ?? inferSnapshotType();

  const snapshot = await buildRegimeSnapshot(snapshotType);

  const svc = createServiceClient();
  // Insert as a new row each time so the briefs table accumulates a
  // history. Previously this upserted on (snapshot_type, snapshot_date),
  // which silently overwrote earlier briefs on the same trading day —
  // the dashboard's "Recent briefs" section was always near-empty as a
  // result.
  const { data, error } = await svc
    .from("regime_snapshots")
    .insert(snapshot)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ snapshot: data });
}

function inferSnapshotType(): SnapshotType {
  // Default by US market hour — pre-market before 9:30 ET, EOD after 16:00 ET.
  const nowEt = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  const hour = nowEt.getHours();
  return hour < 12 ? "premarket" : "eod";
}
