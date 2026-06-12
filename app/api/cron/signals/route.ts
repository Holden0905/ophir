import { NextResponse, type NextRequest } from "next/server";
import { authorizeCron } from "@/lib/cron/auth";
import { runDailySignalJob } from "@/lib/signals/evaluate";

export const runtime = "nodejs";
export const maxDuration = 300;
// Vercel Cron invokes route handlers with a static request — opt out of
// any framework-level caching so each scheduled run hits fresh data.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const startedAt = Date.now();
  const summary = await runDailySignalJob();
  const elapsedMs = Date.now() - startedAt;
  const ok = summary.results.filter((r) => r.ok).length;
  const failed = summary.results.length - ok;
  console.log(
    `[GET /api/cron/signals] done in ${elapsedMs}ms — ${ok} ok, ${failed} failed`,
  );

  return NextResponse.json({
    date: summary.date,
    regime: summary.regime,
    elapsed_ms: elapsedMs,
    ok,
    failed,
    results: summary.results,
  });
}
