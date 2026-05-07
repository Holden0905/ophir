import "server-only";

import { NextResponse, type NextRequest } from "next/server";

// Vercel cron sends `Authorization: Bearer <CRON_SECRET>`. We accept the same
// header for manual `curl` invocations too. No fallback to user session — these
// endpoints are RLS-bypassing service-role writes that have no business
// being reachable from a logged-in browser.
export function authorizeCron(request: NextRequest): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured on server" },
      { status: 500 },
    );
  }
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (presented !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
