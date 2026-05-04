# Ophir — Product Brief

*A personal market intelligence platform for the swing trader who doesn't have time to be a full-time trader.*

---

## The Name

Ophir is the mysterious biblical source of Solomon's gold. Ancient, sought by many, found by few. Nobody knows exactly where it was. The name fits a tool designed to surface opportunity that others miss — not through noise, but through clarity.

---

## The Problem

You're a sophisticated investor with a real framework — Feroldi/Stoffel business lifecycle analysis, Shannon EMA timing, crypto as a liquidity barometer, sector rotation as a regime signal. You've made good trades. You know what you're looking for.

The problem: you have a job, a kid, a novel in progress, apps to build. The market doesn't care about your schedule. By the time you sit down to do research, the moment has passed or the setup has changed. Your Notion stock pages are scattered. Your market read lives in your head. Your watchlist is wherever you left it.

Ophir solves this by doing the reading for you and presenting only what matters.

---

## What Ophir Is

A PWA (Progressive Web App) — installable on your phone, iPad, and any browser across all your devices. Opens like a native app. Works like a personal intelligence briefing that updates itself.

Three interconnected pieces:

---

## Piece 1 — The Regime Dashboard

**The question it answers:** What kind of market are we swimming in right now?

Before looking at a single stock, you need to know the water. The Regime Dashboard reads all the macro signals and synthesizes them into a plain-English intelligence brief — written by Claude, delivered twice daily.

### Data Layers

**Macro Pulse**
- S&P 500 and Nasdaq: price, daily candle (positive/negative), distance from 8/21/50 EMA, trend direction
- VIX: current level, direction (rising/falling), flag when above 30 and 40
- Market breadth: advancing vs declining stocks (where available)

**Crypto Liquidity Barometer**
- BTC, ETH, SOL: price, 24h change, trend vs 20/50 day MA
- Alt coin composite: are speculative assets flowing?
- Interpretation: crypto as leading indicator of global risk appetite and liquidity conditions

**Sector Rotation**
- All 11 S&P 500 sectors
- 5-day relative strength vs SPY (what's rotating *right now*)
- 30-day relative strength vs SPY (what the *trend* is)
- Divergence flag: when 5-day and 30-day signals conflict
- Example: "Utilities strong last 5 days but weak last 30. Tech weak last 5 but strong last 30. Index flat. Possible defensive rotation — watch for confirmation."

**Regime Classification**
Claude synthesizes all layers into one of four classifications:
- 🟢 **Risk On** — broad uptrend, tech leading, crypto flowing, VIX subdued
- 🔴 **Risk Off** — defensive rotation, VIX elevated, crypto weak, indices below key EMAs
- 🟡 **Transitional** — mixed signals, rotation in progress, unclear direction
- ⚪ **Choppy** — no clear trend, whipsaw conditions, reduced position sizing warranted

### Delivery Schedule

**Pre-Market Brief (before 9:30am)**
What happened overnight. Futures. Where we closed yesterday. Regime going into the open. 30-second read. Written like an intelligence report, not a chatbot response.

**End of Day Brief (after 4:00pm)**
What the day actually did. Did today's candle confirm or contradict the morning read? Sector winners and losers. Any regime shift signals. One paragraph — the journal entry you would have written if you had time.

---

## Piece 2 — The Research Matrix

**The question it answers:** How does my curated list look right now?

A live dashboard of your personally curated stocks — up to 100+ names — with all Feroldi/Stoffel metrics auto-populated from APIs. No more typing numbers into Notion. No more stale data from last quarter.

### Columns

| Field | Source | Update Frequency |
|---|---|---|
| Ticker | Manual | Static |
| Company Name | API | Static |
| Sector | API | Static |
| Market Cap | API | Daily |
| BLC Phase | Manual (your judgment) | On earnings |
| Q/Q Revenue Growth | API | Quarterly |
| Y/Y Revenue Growth | API | Quarterly |
| Gross Margin | API | Quarterly |
| Net Margin | API | Quarterly |
| SBC FCF | API | Quarterly |
| Net Debt | API | Quarterly |
| Debt/Market Cap | Calculated | Daily |
| 50 Day SMA | API | Daily |
| Price vs 50 SMA | Calculated | Daily |
| Price vs 8 EMA | Calculated | Daily |
| Price vs 21 EMA | Calculated | Daily |
| Position | Manual checkbox | Manual |
| Interested | Manual checkbox | Manual |

### Views
- **All stocks** — full matrix, sortable by any column
- **Interested** — filtered to your watchlist
- **Positions** — filtered to what you hold
- **Earnings soon** — stocks reporting in next 2 weeks (data refresh reminder)

### Stock Detail Page
Click any ticker to expand:
- TradingView Lightweight Chart — weekly candlestick with 8/21/50 EMA overlays
- Full fundamental breakdown
- Your notes field
- BLC Phase selector with phase descriptions (Feroldi framework)
- Claude synthesis: one paragraph reading the stock's current technical and fundamental picture in your framework's language

---

## Piece 3 — The Discovery Feed

**The question it answers:** What am I not looking at that I should be?

The creativity unlock. Runs periodically against a broader universe (S&P 500 + Nasdaq 100, ~600 stocks) and surfaces names that fit your criteria — stocks you wouldn't have thought of because you've been busy living your life.

### Mode 1 — Reversal/Recovery Screen
*For volatile markets, macro fear events, VIX spikes*

Criteria:
- Down 20%+ from 52-week high
- RSI recently below 35, now recovering through 40
- Price beginning to reclaim 8 EMA
- Volume: up days exceeding down days last 5 sessions (accumulation signal)
- Quality floor: Market cap >$2B, positive gross margin, not in bankruptcy proceedings

### Mode 2 — Trend Continuation Screen
*For bull market conditions, Risk On regime*

Criteria:
- Revenue growth Q/Q >10%, Y/Y >15%
- Gross margin >35%
- Net margin positive and expanding
- Net debt negative (net cash) or Debt/Market Cap <0.2
- BLC Phase 3 or 4 (inferred from income statement pattern)
- Price above 50 day SMA
- Sector in uptrend (relative strength positive vs SPY)

### Output Format
Not a raw list of tickers. Claude reads the results and writes a brief:

*"Three names worth looking at this week: AXON has pulled back 22% from highs on no fundamental news, RSI recovering through 42, accumulation volume pattern developing — fits your reversal criteria. TTD is in Phase 3 with 28% Y/Y revenue growth, expanding net margins, price just reclaimed the 21 EMA in a sector showing relative strength. CRWD flagged on both screens — reversal setup on a Phase 4 company with strong fundamentals, which is a higher-conviction combination."*

That's the AI-native piece. It doesn't just filter — it reads.

---

## Auth and Sharing

Supabase Auth handles user accounts. Email/password or magic link.

**Invite system:** You generate invite codes for friends. They sign up with your code. Keeps it private while letting your circle in. Their curated lists are personal — you don't see theirs, they don't see yours. The Regime Dashboard is shared (same market for everyone). The Research Matrix and Discovery preferences are per-user.

---

## Data Sources

| Data Type | Source | Cost |
|---|---|---|
| Fundamental data | Alpha Vantage | Free (25 calls/day, cached) |
| Price / technical | Yahoo Finance (yfinance) | Free |
| Crypto prices | CoinGecko API | Free |
| VIX data | CBOE via Yahoo Finance | Free |
| Sector ETF data | Yahoo Finance (XLK, XLF, etc.) | Free |
| AI narrative layer | Anthropic API | ~$5-10/month personal use |

Total cost: Anthropic API usage only. Everything else is free.

---

## Aesthetic Direction

**Terminal meets FT editorial.** The feeling of opening a Bloomberg terminal that was redesigned by someone who reads the Financial Times and builds Notion databases at midnight.

- Near-black background (`#0a0a0a`)
- Amber accent (`#f59e0b`) — the color of candlelight and old financial terminals
- IBM Plex Mono for all numerical data — precise, deliberate, scannable
- Playfair Display or Lora for Claude's written briefs — editorial, authoritative
- TradingView Lightweight Charts — dark themed, amber EMA lines
- Data-dense sections balanced with open editorial sections
- Micro-animations on regime classification changes and data updates

**The test:** Does opening Ophir at 7am on your phone feel like something? It should feel like picking up a well-designed morning intelligence brief, not opening another app.

---

## What Ophir Is Not

- Not a trading platform (no execution)
- Not financial advice
- Not a replacement for your own judgment
- Not another Robinhood clone

It's a research and orientation tool. It tells you what the water is like. You decide whether to swim.

---

*Ophir. The source of Solomon's gold. The place everyone sought.*
