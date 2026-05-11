import { type NextRequest } from "next/server";
import { authorizeCron } from "@/lib/cron/auth";
import { runRegimeBrief } from "@/lib/cron/regimeBrief";

export const runtime = "nodejs";
export const maxDuration = 60;

// Dedicated cron path — see regime-premarket/route.ts for the why.
async function run(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;
  return runRegimeBrief("eod");
}

export const GET = run;
export const POST = run;
