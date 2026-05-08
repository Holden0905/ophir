import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, CLAUDE_MODEL } from "@/lib/ai/anthropic";
import { CONVICTION_LABEL, SETUP_FULL } from "@/lib/signals/labels";
import type { WatchlistSignalReport } from "@/lib/signals/queries";
import type {
  RegimeClassification,
  SectorSnapshot,
  SnapshotType,
} from "@/lib/supabase/types";

const SYSTEM = `You are Ophir, a personal market intelligence system for a sophisticated swing trader. Your voice is that of a senior analyst writing a concise intelligence brief — authoritative, specific, no fluff. Use the Feroldi/Stoffel business lifecycle framework and Brian Shannon's EMA methodology as context. Reference specific numbers. Never use generic phrases like "markets showed mixed signals." Say what actually happened and what it means.

Structure: 2-3 tight regime paragraphs first. Then, when WATCHLIST SIGNALS are provided, a final paragraph beginning "On your watchlist," that names specific tickers — what triggered (with setup type and conviction grades), what's still qualifying and for how long, what just fell out, and what's in cooldown. Stay in the same FT editorial voice — flowing prose, not bullets. If everything is quiet, say so plainly. Return JSON only — no preamble, no markdown fences.`;

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
  // When provided, the brief gets a closing watchlist paragraph that
  // names specific tickers. Optional so manual / older calls still work
  // without it (the brief just omits the watchlist section).
  watchlist?: WatchlistSignalReport | null;
}

export interface RegimeOutput {
  classification: RegimeClassification;
  narrative: string;
}

function fmt(n: number | null | undefined, d = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/a";
  return n.toFixed(d);
}

function watchlistBlock(w: WatchlistSignalReport | null | undefined): string {
  if (!w || w.total_watchlist === 0) return "";
  const lines: string[] = [];
  lines.push("");
  lines.push(`WATCHLIST SIGNALS (${w.total_watchlist} names):`);

  if (w.triggered_today.length === 0) {
    lines.push("- Triggered today: none");
  } else {
    for (const t of w.triggered_today) {
      const conv = t.conviction.length
        ? t.conviction.map((c) => CONVICTION_LABEL[c]).join(", ")
        : "no extra conviction";
      lines.push(
        `- Triggered today: ${t.ticker} — ${SETUP_FULL[t.setup]} (${conv})`,
      );
    }
  }

  if (w.qualifying.length === 0) {
    lines.push("- Currently qualifying: none");
  } else {
    for (const q of w.qualifying) {
      lines.push(
        `- Currently qualifying: ${q.ticker} — ${SETUP_FULL[q.setup]}, day ${q.consecutive_days} of the run`,
      );
    }
  }

  if (w.fell_out_today.length > 0) {
    for (const f of w.fell_out_today) {
      lines.push(
        `- Fell out today: ${f.ticker} — ${SETUP_FULL[f.setup]} (had been qualifying ${f.days_qualified} day${f.days_qualified === 1 ? "" : "s"})`,
      );
    }
  }

  if (w.in_cooldown.length > 0) {
    for (const c of w.in_cooldown) {
      lines.push(
        `- In cooldown: ${c.ticker} — ${SETUP_FULL[c.setup]}, ${c.days_remaining} day${c.days_remaining === 1 ? "" : "s"} remaining`,
      );
    }
  }

  lines.push(`- Quiet: ${w.quiet_count} of ${w.total_watchlist} names with no setup activity`);
  return lines.join("\n");
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
${sectorLines}${watchlistBlock(input.watchlist)}

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
