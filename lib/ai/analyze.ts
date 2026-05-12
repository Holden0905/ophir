import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/anthropic";
import type { AnalysisInput } from "@/lib/analyze/inputs";

const SYSTEM = `You are Ophir, a personal market intelligence system for a sophisticated swing trader. Your voice is the voice of a senior FT analyst writing a single-name tape read — authoritative, specific, no fluff. You reference Brian Shannon's EMA methodology (5/8/21) and the Feroldi/Stoffel business lifecycle framework as context.

Write 2-3 tight paragraphs. Editorial prose. No bullet points, no markdown headers, no preamble. Always cite specific numbers from the inputs — actual price, EMA values, RSI, sector RS — never round to generic phrases.

Cover, in order:
1. Which setup is closest to triggering — Trend Continuation or Reversal/Recovery. Name exactly which conditions are met and which aren't, with the actual values. If both are far away, say so plainly.
2. Volume and accumulation — is today's volume meaningful relative to the 20-day average, is there accumulation or distribution across the last five sessions.
3. What would have to happen for a setup to trigger — name specific price levels, RSI thresholds, EMA crossovers. "RSI 37.75 — one green day from clearing 40" beats "needs more strength."
4. Regime and sector context — does the macro tape and this name's sector RS support or fight this trade right now.
5. Close with a plain-English read — "the thesis has legs but confirmation isn't here yet" or "this is setting up cleanly, watch for X" or "wrong tape for this name today." One sentence.

You are reading the framework's view of the data. You are NOT giving buy/sell recommendations. End the analysis with a single italicized line: "Framework analysis only — not financial advice."

Return JSON only: { "narrative": "..." }. No preamble, no markdown fences.`;

function fmt(n: number | null | undefined, d = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/a";
  return n.toFixed(d);
}

function pctFmt(n: number | null | undefined, d = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/a";
  return `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`;
}

function shortVolume(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "n/a";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

function setupBlock(label: string, setup: AnalysisInput["setups"]["trend_continuation"]): string {
  const lines = [`${label} (${setup.triggered ? "TRIGGERED" : "not triggered"}):`];
  for (const c of setup.required) {
    const status = c.met ? "MET" : "NOT MET";
    const tail = c.met ? "" : c.proximity ? ` — ${c.proximity}` : "";
    lines.push(`  - ${c.label}: ${status} — ${c.detail}${tail}`);
  }
  return lines.join("\n");
}

function buildUserPrompt(input: AnalysisInput): string {
  const f = input.fundamentals;
  const r = input.regime;
  const s = input.sector;
  const t = input.technicals;
  const v = input.volume;

  const fundamentalLines = f
    ? [
        `- BLC phase: ${f.blc_phase ?? "unset"}${f.blc_label ? ` (${f.blc_label})` : ""}`,
        `- Market cap: ${f.market_cap ? `$${(f.market_cap / 1e9).toFixed(2)}B` : "n/a"}`,
        `- Gross margin: ${pctFmt(f.gross_margin !== null ? f.gross_margin * 100 : null, 1)}`,
        `- Net margin: ${pctFmt(f.net_margin !== null ? f.net_margin * 100 : null, 1)}`,
        `- Q/Q revenue growth: ${pctFmt(f.qq_revenue_growth !== null ? f.qq_revenue_growth * 100 : null, 1)}`,
        `- Y/Y revenue growth: ${pctFmt(f.yy_revenue_growth !== null ? f.yy_revenue_growth * 100 : null, 1)}`,
      ].join("\n")
    : "- No cached fundamentals on file";

  const sectorLine = s.etf_symbol
    ? `- Sector: ${s.name} (${s.etf_symbol}) — 5d RS ${pctFmt(s.rs5d, 2)}, 30d RS ${pctFmt(s.rs30d, 2)}, today ${pctFmt(s.change_pct, 2)}`
    : `- Sector: ${s.name ?? "unmapped"} — no sector RS data available`;

  const regimeBlock = r
    ? [
        `- Classification: ${r.classification ?? "unclassified"}`,
        `- Crypto regime: ${r.crypto_regime ?? "n/a"} (BTC ${pctFmt(r.btc_change_24h, 2)} 24h, ETH ${pctFmt(r.eth_change_24h, 2)} 24h)`,
        r.narrative_snippet ? `- Regime brief excerpt: "${r.narrative_snippet}"` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "- No regime snapshot on file";

  return `Analyze ${input.ticker} through the Ophir framework as of ${input.asOf}.

PRICE:
- Close: ${fmt(input.price.current)}
- Daily change: ${pctFmt(input.price.change_pct, 2)}
- 52w high: ${fmt(input.price.week_52_high)} (${pctFmt(input.price.pct_from_52w_high, 1)} off)
- 52w low: ${fmt(input.price.week_52_low)}

TECHNICALS:
- EMA(5): ${fmt(t.ema_5)}
- EMA(8): ${fmt(t.ema_8)}
- EMA(21): ${fmt(t.ema_21)}
- SMA(50): ${fmt(t.sma_50)}
- RSI(14): ${fmt(t.rsi_14, 1)}

VOLUME:
- Today: ${shortVolume(v.today)}
- 20-day average: ${shortVolume(v.avg_20d)}
- Multiple of 20d avg: ${v.multiple_of_20d !== null ? `${v.multiple_of_20d.toFixed(2)}×` : "n/a"}
- Last 5 sessions — up-volume ${shortVolume(v.up_volume_last_5d)}, down-volume ${shortVolume(v.down_volume_last_5d)}, pattern: ${v.accumulation}

${setupBlock("TREND CONTINUATION", input.setups.trend_continuation)}

${setupBlock("REVERSAL / RECOVERY", input.setups.reversal_recovery)}

REGIME:
${regimeBlock}

${sectorLine}

FUNDAMENTALS:
${fundamentalLines}

Write the analysis now. Return JSON: { "narrative": "..." }.`;
}

export interface AnalyzeOutput {
  narrative: string;
}

export async function generateTradeAnalysis(
  input: AnalysisInput,
): Promise<AnalyzeOutput> {
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: [
      { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: buildUserPrompt(input) }],
  });

  const text = message.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("");

  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Claude returned non-JSON analyze response: ${text.slice(0, 200)}`,
    );
  }
  const obj = parsed as { narrative?: string };
  if (!obj.narrative) {
    throw new Error(`Invalid analyze response shape: ${cleaned.slice(0, 200)}`);
  }
  return { narrative: obj.narrative };
}
