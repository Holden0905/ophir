import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { gatherAnalysisInputs } from "@/lib/analyze/inputs";
import { generateTradeAnalysis } from "@/lib/ai/analyze";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ ticker: string }> },
) {
  await requireUser();
  const { ticker } = await ctx.params;
  const T = ticker.toUpperCase().trim();
  if (!T) {
    return NextResponse.json({ error: "ticker required" }, { status: 400 });
  }

  const startedAt = Date.now();
  try {
    const input = await gatherAnalysisInputs(T);
    const { narrative } = await generateTradeAnalysis(input);
    const elapsed_ms = Date.now() - startedAt;
    console.log(
      `[analyze] ${T} ok — ${narrative.length} chars in ${elapsed_ms}ms`,
    );
    return NextResponse.json(
      {
        ticker: T,
        narrative,
        as_of: input.asOf,
        fetched_at: new Date().toISOString(),
        elapsed_ms,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[analyze] ${T} failed: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
