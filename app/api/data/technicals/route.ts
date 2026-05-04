import { NextResponse, type NextRequest } from "next/server";
import { closes, fetchYahooSeries } from "@/lib/data/yahoo";
import { requireUser } from "@/lib/auth/dal";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  await requireUser();
  const ticker = request.nextUrl.searchParams.get("ticker");
  const range = (request.nextUrl.searchParams.get("range") ?? "1y") as
    | "5d"
    | "1mo"
    | "3mo"
    | "6mo"
    | "1y"
    | "2y"
    | "5y";
  const interval = (request.nextUrl.searchParams.get("interval") ?? "1d") as
    | "1d"
    | "1wk"
    | "1mo";
  if (!ticker) {
    return NextResponse.json({ error: "ticker required" }, { status: 400 });
  }
  const series = await fetchYahooSeries(ticker.toUpperCase(), {
    range,
    interval,
  });
  return NextResponse.json({
    symbol: series.symbol,
    bars: series.bars,
    closes: closes(series),
    meta: series.meta,
  });
}
