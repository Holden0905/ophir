import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { fetchYahooQuotes } from "@/lib/data/yahoo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TICKERS = 100;

// Lightweight live-quote endpoint for client-side polling. Returns price,
// daily change, and volume only — no fundamentals, no DB writes. The matrix
// page polls this every 60s; cost per call is one Yahoo round-trip for the
// whole batch.
export async function GET(request: NextRequest) {
  await requireUser();
  const raw = request.nextUrl.searchParams.get("tickers") ?? "";
  const tickers = raw
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
  if (tickers.length === 0) {
    return NextResponse.json({ quotes: {}, fetched_at: new Date().toISOString() });
  }
  if (tickers.length > MAX_TICKERS) {
    return NextResponse.json(
      { error: `too many tickers (max ${MAX_TICKERS})` },
      { status: 400 },
    );
  }

  const raw_quotes = await fetchYahooQuotes(tickers);
  const quotes: Record<
    string,
    { price: number | null; change_pct: number | null; volume: number | null }
  > = {};
  for (const [ticker, q] of Object.entries(raw_quotes)) {
    if ("error" in q) continue;
    quotes[ticker] = {
      price: q.price,
      change_pct: q.changePct,
      volume: q.volume,
    };
  }

  return NextResponse.json(
    { quotes, fetched_at: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
