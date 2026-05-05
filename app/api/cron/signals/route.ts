import { NextResponse, type NextRequest } from "next/server";
import { runDailySignalJob } from "@/lib/signals/evaluate";

export const runtime = "nodejs";
export const maxDuration = 300;
// Vercel Cron invokes route handlers with a static request — opt out of
// any framework-level caching so each scheduled run hits fresh data.
export const dynamic = "force-dynamic";

// Vercel sets `Authorization: Bearer ${CRON_SECRET}` on cron-initiated
// requests. The same header works for manual invocation in dev/staging.
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Refuse to run unauthenticated in production, but allow local dev to
    // hit the endpoint without a configured secret.
    return process.env.NODE_ENV !== "production";
  }
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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
