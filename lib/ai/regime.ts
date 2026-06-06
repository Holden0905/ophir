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

const SYSTEM = `You are Ophir, a market intelligence tool for a swing trader who reads this every day. State the data, note what's interesting, skip the interpretation — the trader does the interpreting. This is a daily tool, not a publication. Brevity wins.

REGIME READ — 2-3 sentences MAX. Lead with the classification and its key driver (what's leading/lagging, and what changed from the prior snapshot if anything notable). Flag anything notable: a VIX spike, a crypto/equity divergence, sectors all one direction. Cite the actual numbers. No metaphors, no "the tape suggests," no speculation about what might happen next.
Tone example: "Transitional. Tech leading 5D (+4.6%), everything else red. Crypto soft — BTC/ETH/SOL all down 1-2%, diverging from equity futures. VIX 17, contained."

WATCHLIST SIGNALS — when provided, output as a compact list, NOT a paragraph. Do not write any narrative prose for this section. One ticker per line, format: "TICKER — setup state (key reason)", with NO trailing period. Examples: "NBIS — TC triggered (high volume, mature trend)", "HOOD — quiet", "IOT — cooled (5d remaining)". List the active names first (triggered, qualifying, fell out, cooldown). For quiet names: if 5 or fewer, list each as "TICKER — quiet"; if more than 5, omit them and add one final line "N others quiet". Separate the regime read from the watchlist list with a blank line. Do not add a header label.

Return JSON only — no preamble, no markdown fences.`;

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
