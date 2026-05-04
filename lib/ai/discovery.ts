import "server-only";

import { anthropic, CLAUDE_MODEL } from "@/lib/ai/anthropic";
import type { DiscoveryScanResult, ScanMode } from "@/lib/supabase/types";
import type Anthropic from "@anthropic-ai/sdk";

const SYSTEM = `You are Ophir, a personal market intelligence system for a sophisticated swing trader. Voice: senior analyst, concise, specific, no fluff. Use the Feroldi/Stoffel business lifecycle framework and Brian Shannon's EMA methodology.

You are writing a discovery brief: a tight editorial paragraph (or two short paragraphs) explaining what the screen surfaced, the names worth real attention, and the names to ignore. Reference specific tickers and numbers. Never generic. Editorial prose, no bullet points, no markdown.`;

function fmt(n: number | null | undefined, d = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/a";
  return n.toFixed(d);
}

function rowSummary(r: DiscoveryScanResult): string {
  return `  - ${r.ticker} (${r.sector ?? "—"}): px ${fmt(r.current_price)}, RSI ${fmt(r.rsi_14, 1)}, ${fmt(r.pct_from_52_high, 1)}% from 52w high, vs 8 EMA ${fmt(r.price_vs_ema8_pct, 1)}%, vs 50 SMA ${fmt(r.price_vs_ma50_pct, 1)}%, Y/Y rev ${fmt(r.yy_revenue_growth ? r.yy_revenue_growth * 100 : null, 1)}%, GM ${fmt(r.gross_margin ? r.gross_margin * 100 : null, 1)}%`;
}

export async function generateDiscoveryBrief(
  mode: ScanMode,
  results: DiscoveryScanResult[],
): Promise<string> {
  const modeText =
    mode === "reversal"
      ? "Reversal/Recovery — names down 20%+ from 52w highs with RSI recovering from oversold (38–48), reclaiming the 8 EMA."
      : "Trend Continuation — fundamentally healthy compounders trading above their 50 SMA with strong revenue growth.";

  const userPrompt = `Today's discovery scan ran in ${mode === "reversal" ? "Reversal/Recovery" : "Trend Continuation"} mode.

Mode definition: ${modeText}

Results (${results.length} ticker${results.length === 1 ? "" : "s"}):
${results.length === 0 ? "  (none — the screen returned no qualifying names)" : results.map(rowSummary).join("\n")}

Write the brief.`;

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 800,
    system: [
      { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  return message.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("")
    .trim();
}
