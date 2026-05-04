import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/anthropic";
import type {
  RegimeClassification,
  SectorSnapshot,
  SnapshotType,
} from "@/lib/supabase/types";

const SYSTEM = `You are Ophir, a personal market intelligence system for a sophisticated swing trader. Your voice is that of a senior analyst writing a concise intelligence brief — authoritative, specific, no fluff. Use the Feroldi/Stoffel business lifecycle framework and Brian Shannon's EMA methodology as context. Reference specific numbers. Never use generic phrases like "markets showed mixed signals." Say what actually happened and what it means.

Write in 2-3 tight paragraphs. Editorial prose. No bullet points in the narrative. Return JSON only — no preamble, no markdown fences.`;

export interface RegimeInput {
  snapshot_type: SnapshotType;
  date: string;
  spx_label: string;
  nasdaq_label: string;
  spx: { price: number | null; changePct: number | null; vsEma21Pct: number | null };
  nasdaq: { price: number | null; changePct: number | null };
  vix: { level: number | null; direction: string | null };
  btc: { price: number | null; change24h: number | null };
  eth: { price: number | null; change24h: number | null };
  sol: { price: number | null; change24h: number | null };
  sectors: SectorSnapshot[];
}

export interface RegimeOutput {
  classification: RegimeClassification;
  narrative: string;
}

function fmt(n: number | null | undefined, d = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/a";
  return n.toFixed(d);
}

function buildUserPrompt(input: RegimeInput): string {
  const sectorLines = input.sectors
    .map(
      (s) =>
        `  - ${s.symbol} (${s.name}): 5d RS ${fmt(s.rs5d)}pp, 30d RS ${fmt(s.rs30d)}pp, daily ${fmt(s.changePct)}%`,
    )
    .join("\n");

  const isPremarket = input.snapshot_type === "premarket";
  const sessionNote = isPremarket
    ? "Pre-market read — SPX/Nasdaq prints below are overnight futures (ES, NQ) reflecting current price discovery, not yesterday's cash close. Compare them against the cash 21 EMA to gauge how far futures have moved."
    : "End-of-day read — SPX/Nasdaq prints below are cash settlements (^GSPC, ^NDX).";
  const changeLabel = isPremarket ? "overnight" : "today";

  return `Generate a ${input.snapshot_type} market regime brief for ${input.date}.

${sessionNote}

MACRO:
- ${input.spx_label}: ${fmt(input.spx.price)} (${fmt(input.spx.changePct)}% ${changeLabel}), ${fmt(input.spx.vsEma21Pct)}% vs SPX 21 EMA
- ${input.nasdaq_label}: ${fmt(input.nasdaq.price)} (${fmt(input.nasdaq.changePct)}% ${changeLabel})
- VIX: ${fmt(input.vix.level)} (${input.vix.direction ?? "n/a"})

CRYPTO:
- BTC: $${fmt(input.btc.price, 0)} (${fmt(input.btc.change24h)}% 24h)
- ETH: $${fmt(input.eth.price, 0)} (${fmt(input.eth.change24h)}% 24h)
- SOL: $${fmt(input.sol.price, 2)} (${fmt(input.sol.change24h)}% 24h)

SECTOR ROTATION (5-day RS vs SPY):
${sectorLines}

Classify the regime as one of: risk_on, risk_off, transitional, choppy.
Return JSON: { "classification": "...", "narrative": "..." }`;
}

export async function generateRegimeBrief(
  input: RegimeInput,
): Promise<RegimeOutput> {
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

  // Defensive parse — some completions wrap in ```json fences despite the instruction.
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Claude returned non-JSON regime brief: ${text.slice(0, 200)}`);
  }

  const obj = parsed as { classification?: string; narrative?: string };
  const cls = obj.classification as RegimeClassification | undefined;
  const validClasses: RegimeClassification[] = [
    "risk_on",
    "risk_off",
    "transitional",
    "choppy",
  ];
  if (!cls || !validClasses.includes(cls) || !obj.narrative) {
    throw new Error(`Invalid regime brief shape: ${cleaned.slice(0, 200)}`);
  }
  return { classification: cls, narrative: obj.narrative };
}
