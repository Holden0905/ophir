import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import {
  refreshFundamentals,
  refreshTechnicals,
} from "@/lib/stocks/refresh";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  tickers: string[];
  fundamentals?: boolean;
  force?: boolean;
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const body = (await request.json()) as Body;
  console.log(
    `[POST /api/stocks/refresh] user=${user.id} tickers=${JSON.stringify(
      body.tickers,
    )} fundamentals=${body.fundamentals ?? false} force=${body.force ?? false}`,
  );

  if (!body?.tickers?.length) {
    return NextResponse.json({ error: "tickers required" }, { status: 400 });
  }

  const results: Record<
    string,
    {
      technicals: "ok" | "fail";
      fundamentals?: string;
      error?: string;
    }
  > = {};

  for (const ticker of body.tickers) {
    const t = ticker.toUpperCase();
    const startedAt = Date.now();
    try {
      await refreshTechnicals(t);
      results[t] = { technicals: "ok" };
      if (body.fundamentals) {
        try {
          const f = await refreshFundamentals(t, { force: body.force });
          results[t].fundamentals = f.refreshed
            ? "refreshed"
            : (f.reason ?? "skipped");
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(
            `[POST /api/stocks/refresh] fundamentals FAILED for ${t}: ${msg}`,
          );
          results[t].fundamentals = `error:${msg}`;
        }
      }
      console.log(
        `[POST /api/stocks/refresh] ${t} done in ${Date.now() - startedAt}ms`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(
        `[POST /api/stocks/refresh] technicals FAILED for ${t}: ${msg}`,
      );
      results[t] = { technicals: "fail", error: msg };
    }
  }

  const failed = Object.values(results).filter(
    (r) => r.technicals === "fail" || r.fundamentals?.startsWith("error:"),
  ).length;
  console.log(
    `[POST /api/stocks/refresh] done — ${
      Object.keys(results).length - failed
    } ok, ${failed} failed`,
  );

  return NextResponse.json({ results });
}
