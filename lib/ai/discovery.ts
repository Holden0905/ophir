import "server-only";

import { anthropic, CLAUDE_MODEL } from "@/lib/ai/anthropic";
import type { DiscoveryScanResult, ScanMode } from "@/lib/supabase/types";
import type Anthropic from "@anthropic-ai/sdk";

const SYSTEM = `You are Ophir, a market intelligence tool for a swing trader. State the data, skip the editorializing. This is a daily tool — brevity wins.

Output a structured list of the flagged names, NOT prose paragraphs. One line per ticker, format: "TICKER — why it flagged (key numbers)", with NO trailing period. Example: "CRWD — down 24% from high, RSI recovering through 42, accumulation pattern". Cite the actual numbers from the inputs. No editorial about each name, no metaphors, no voice.

Optionally lead with ONE summary sentence only if there's a genuine cross-cutting pattern (e.g. "5 names, all semis, all reclaiming the 8 EMA."). If there's nothing to summarize, skip it and give just the list. If the screen returned nothing, say so in one line.

Plain text only — no markdown, no JSON. If you write a summary sentence, put a blank line between it and the list.`;

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

Write the list.`;

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 500,
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
