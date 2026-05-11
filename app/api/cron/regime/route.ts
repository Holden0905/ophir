import { type NextRequest } from "next/server";
import { authorizeCron } from "@/lib/cron/auth";
import {
  inferSnapshotTypeForNow,
  runRegimeBrief,
} from "@/lib/cron/regimeBrief";
import type { SnapshotType } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Manual / fallback entry. Vercel Hobby deduplicates cron entries that
// share a base path (the `?type=` query is ignored), so the scheduled
// crons now live at /api/cron/regime-premarket and /api/cron/regime-eod.
// This catch-all route is preserved so manual `curl` triggers and ad-hoc
// invocations keep working — pass `?type=premarket|eod` or let it infer
// from the wall clock.
async function run(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const typeParam = request.nextUrl.searchParams.get("type") as
    | SnapshotType
    | null;
  const snapshotType: SnapshotType =
    typeParam === "premarket" || typeParam === "eod"
      ? typeParam
      : inferSnapshotTypeForNow();

  return runRegimeBrief(snapshotType);
}

export const GET = run;
export const POST = run;
