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
  const { data, error } = await svc
    .from("regime_snapshots")
    .upsert(snapshot, { onConflict: "snapshot_type,snapshot_date" })
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
