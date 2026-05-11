import "server-only";

import { NextResponse } from "next/server";
import { buildRegimeSnapshot } from "@/lib/regime/build";
import { createServiceClient } from "@/lib/supabase/server";
import type { SnapshotType } from "@/lib/supabase/types";

// Shared body of the regime cron routes. The three callers
//   - /api/cron/regime (manual / fallback, infers type)
//   - /api/cron/regime-premarket (dedicated cron path)
//   - /api/cron/regime-eod (dedicated cron path)
// dispatch here. Splitting routes was forced by Vercel Hobby's
// dedup-by-path behaviour: two cron entries that share a base path
// (even with different query params) collapse into one.
export async function runRegimeBrief(snapshotType: SnapshotType) {
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

export function inferSnapshotTypeForNow(): SnapshotType {
  const nowEt = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  return nowEt.getHours() < 12 ? "premarket" : "eod";
}
