import { type NextRequest } from "next/server";
import { authorizeCron } from "@/lib/cron/auth";
import { runRegimeBrief } from "@/lib/cron/regimeBrief";

export const runtime = "nodejs";
export const maxDuration = 60;

// Dedicated cron path — Vercel Hobby dedups by base path, so the
// premarket and EOD schedules each need their own route. Hard-coded
// snapshot type; no query-param dispatch.
async function run(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;
  return runRegimeBrief("premarket");
}

export const GET = run;
export const POST = run;
