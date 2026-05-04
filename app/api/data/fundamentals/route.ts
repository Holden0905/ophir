import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { refreshFundamentals } from "@/lib/stocks/refresh";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  await requireUser();
  const body = (await request.json().catch(() => ({}))) as {
    ticker?: string;
    force?: boolean;
  };
  if (!body.ticker)
    return NextResponse.json({ error: "ticker required" }, { status: 400 });
  const result = await refreshFundamentals(body.ticker.toUpperCase(), {
    force: body.force,
  });
  return NextResponse.json(result);
}
