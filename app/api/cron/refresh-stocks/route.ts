import { NextResponse, type NextRequest } from "next/server";
import { authorizeCron } from "@/lib/cron/auth";
import {
  refreshFundamentals,
  refreshTechnicals,
} from "@/lib/stocks/refresh";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

// Daily refresh of every ticker any user has tracked. Fundamentals
// refresh is gated by the 7-day TTL inside refreshFundamentals so the
// AlphaVantage / FMP rate budgets aren't burned every day.
async function run(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const svc = createServiceClient();
  const { data: rows, error } = await svc
    .from("stocks")
    .select("ticker")
    .eq("is_archived", false);
  if (error) {
    console.error(`[cron/refresh-stocks] stocks fetch failed:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tickers = Array.from(
    new Set((rows ?? []).map((r) => r.ticker.toUpperCase())),
  );
  console.log(`[cron/refresh-stocks] refreshing ${tickers.length} tickers`);

  const results: Record<
    string,
    { technicals: "ok" | "fail"; fundamentals?: string; error?: string }
  > = {};

  for (const ticker of tickers) {
    try {
      await refreshTechnicals(ticker);
      results[ticker] = { technicals: "ok" };
      try {
        const f = await refreshFundamentals(ticker);
        results[ticker].fundamentals = f.refreshed
          ? "refreshed"
          : (f.reason ?? "skipped");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results[ticker].fundamentals = `error:${msg}`;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results[ticker] = { technicals: "fail", error: msg };
    }
  }

  const failed = Object.values(results).filter(
    (r) => r.technicals === "fail" || r.fundamentals?.startsWith("error:"),
  ).length;
  console.log(
    `[cron/refresh-stocks] done — ${tickers.length - failed} ok, ${failed} failed`,
  );
  return NextResponse.json({ ok: true, refreshed: tickers.length, failed, results });
}

export const GET = run;
export const POST = run;
