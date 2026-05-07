import { NextResponse, type NextRequest } from "next/server";
import { authorizeCron } from "@/lib/cron/auth";
import { runDiscoveryScan } from "@/lib/discovery/scan";
import type { ScanMode } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 300;

async function run(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const modeParam = request.nextUrl.searchParams.get("mode") as ScanMode | null;
  // No mode = run both. Single cron line that drops both daily scans into
  // discovery_scans is simpler than maintaining two cron entries.
  const modes: ScanMode[] =
    modeParam === "trend" || modeParam === "reversal"
      ? [modeParam]
      : ["trend", "reversal"];

  const summary: Record<string, { scan_id: string; count: number }> = {};
  for (const mode of modes) {
    console.log(`[cron/discovery] running ${mode} scan`);
    const r = await runDiscoveryScan(mode);
    summary[mode] = { scan_id: r.scan_id, count: r.results.length };
  }
  return NextResponse.json({ ok: true, scans: summary });
}

export const GET = run;
export const POST = run;
