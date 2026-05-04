import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { runDiscoveryScan } from "@/lib/discovery/scan";
import type { ScanMode } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(request: NextRequest) {
  await requireUser();
  const body = (await request.json().catch(() => ({}))) as {
    mode?: ScanMode;
  };
  const mode: ScanMode = body.mode ?? "trend";
  if (mode !== "reversal" && mode !== "trend") {
    return NextResponse.json({ error: "invalid mode" }, { status: 400 });
  }

  const result = await runDiscoveryScan(mode);
  return NextResponse.json(result);
}
