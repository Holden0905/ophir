# Ophir Trading Framework

*Living document. Codifies the signal logic Ophir uses to surface trading opportunities. Edit as the framework evolves — orbital thinking becoming gravitational pull.*

**Version 1 — initial spec**

---

## Purpose

This document is the source of truth for how Ophir decides a name is worth your attention. It exists so the rules can be revisited, tweaked, and argued with over time. UI surfaces, cron jobs, and database schemas all read from this spec.

---

## The Investing Approach

The framework rests on three pillars:

- **Feroldi/Stoffel BLC phases** — what to own (fundamental quality, business lifecycle stage)
- **Brian Shannon Alpha Trends** — when to enter (EMA-based timing, 5/8/21)
- **Regime context** — whether to be aggressive or defensive (Risk On / Risk Off / Transitional / Choppy)

Two setups for action: **Trend Continuation** (the workhorse) and **Reversal/Recovery** (the specialty trade).

---

## The Watchlist as Fundamental Gate

Stocks earn their way onto the watchlist by passing manual fundamental judgment. Once a name is on the list, the system has already vouched for the underlying business. This separates two timescales:

- **Slow, judgment-based** — is this a quality business? (manual, reviewed on earnings, BLC phase classification, fundamentals review)
- **Fast, rule-based** — is this a good moment to act? (automated, daily, technical setups)

The Research Matrix shows the fundamental snapshot. The trading signals (this doc) operate on top of that vetted universe.

Note: Q/Q revenue dips, margin compression, or other fundamental softness on a watchlist name are intentional. If a name is in the list, the trader has absorbed the why and judged it acceptable. The technical signal layer does not re-evaluate that judgment.

---

## Setup 1 — Trend Continuation

*Thesis: name is in an established uptrend, just had a pullback or pause, now resuming. Catch the resumption, don't chase the extension.*

### Required (all must be true)

| Condition | Why |
|---|---|
| `close > EMA(8)` | Price above the short-term anchor; the trend is on, not off |
| `EMA(5)[t] > EMA(5)[t-1] > EMA(5)[t-2]` | 5-EMA rising 2+ days; kills the falling knife |
| `EMA(8) > EMA(21)` | Short-term trend structure intact |
| `40 < RSI(14) < 70` | Out of oversold (real momentum); not extended (not chasing climax) |

### Conviction grade (don't gate, just elevate)

| Condition | Badge |
|---|---|
| `volume(t) > 1.2 × avg_volume(20)` on trigger day | High volume |
| `EMA(21) > SMA(50)` | Mature trend |
| Sector RS positive vs SPY | Sector tailwind |

### Regime

- Active in Risk On, Transitional
- Suppressed in Risk Off, Choppy

---

## Setup 2 — Reversal/Recovery

*Thesis: quality name has been beaten up, showing signs of bottoming, momentum turning. Higher conviction because rarer — when these fire on a vetted watchlist name, stop and look.*

### Required (all must be true)

| Condition | Why |
|---|---|
| `current_price < 0.80 × 52w_high` | Down 20%+ from highs; defines "beaten up" — distinguishes from Trend Continuation |
| `min(RSI(14)) over last 10 days < 35` | Was actually oversold recently, not just pulled back |
| `RSI(14)[t] > 40` | Now recovering; the turn is underway |
| `EMA(5)[t] > EMA(5)[t-1] > EMA(5)[t-2]` | Momentum turning up |
| `close > EMA(8)` | Price reclaimed the short-term anchor |

### Conviction grade

| Condition | Badge |
|---|---|
| `volume(t) > 1.2 × avg_volume(20)` on trigger day | High volume |
| Up-volume > down-volume across last 5 sessions | Accumulation |
| `EMA(8)` crossed above `EMA(21)` recently | Trend reversal forming |

### Regime

- Active in Risk Off, Transitional, Choppy
- Lower priority in Risk On (most names won't qualify because nothing's beat up)

---

## Why Two Setups, Not One

|  | Trend Continuation | Reversal/Recovery |
|---|---|---|
| **Bet on** | Persistence | Change |
| **Hit rate** | Higher | Lower |
| **Per-trade reward** | Smaller | Larger |
| **Frequency** | Common (most days, most regimes) | Rare (fear windows) |
| **Role** | Workhorse | Specialty |

The math favors Trend Continuation as the bigger aggregate contributor (more signals, higher hit rate, smaller losers). Reversal earns its place because when it fires on a high-quality watchlist name, the asymmetric payoff is real.

---

## State Machine

For each name, for each setup, the system maintains one of three states:

| State | Definition | UI treatment |
|---|---|---|
| `triggered_today` | Required all true today AND not all true yesterday | Loud — "new today" flag, top sort |
| `qualifies` | Required all true today AND all true yesterday | Calm status badge |
| `none` | Required not all true today | No badge |

State *transitions* are what make a name worth opening the chart. A name sitting in `qualifies` for a week is wallpaper. A name transitioning from `none` to `triggered_today` is news.

---

## False-Signal Controls

| Control | Rule |
|---|---|
| **Cooldown** | Once a name triggers a setup, no re-trigger of that same setup for 5 trading days. Prevents whipsaw on names oscillating around the 8-EMA. |
| **Setup precedence** | If a name qualifies for both setups simultaneously, Reversal/Recovery takes the badge. Higher conviction, rarer, more interesting. |
| **Persistence on fast EMAs** | Rising 5-EMA requires 2+ consecutive day-over-day increases, not a single-day flip. |
| **Hysteresis on RSI** *(future)* | Currently RSI conditions are point-in-time. Could add band logic (enter when RSI > 42, exit when RSI < 38) if flicker becomes a problem. |

---

## Tunable Knobs

Parameters most likely to need adjustment after live observation:

1. **Cooldown duration** — currently 5 trading days. Could be 3 (more sensitive) or 10 (more selective).
2. **Trend Continuation 50-SMA requirement** — `close > SMA(50)` is *not* required currently. Could be promoted to required for a stricter mature-trend bias. Tradeoff: fewer triggers.
3. **RSI ceiling on Trend Continuation** — currently 70. Could be 65 (more conservative) or 80 (more permissive).
4. **Drawdown threshold on Reversal** — currently 20%. Could be 15% (more triggers, lower per-trade conviction) or 25% (rarer, deeper-discount-only).
5. **Volume conviction threshold** — currently 1.2× 20-day average. Could be 1.5× (stricter) or 1.0× (above-average).

---

## Known Gaps

Real holes that need to be filled, captured here so they don't get forgotten:

- **Exit logic.** This document specifies entry signals only. A complete framework needs exit rules — when to take profits, when to cut losses. Likely candidates: stop below 21-EMA for Trend Continuation entries; stop below recent swing low for Reversal entries; profit-taking based on 8-EMA loss or RSI extremes. Needs its own design pass.
- **Position sizing.** No rules currently for how much to allocate per trade. Sizing should probably scale with conviction grade and regime confidence.
- **Discovery Feed integration.** Same rule engine should scan the broader universe (S&P 500 + Nasdaq 100) for names not on the watchlist that meet setup criteria. The rules port directly; the question is what to surface and how to vet fundamentals on names not yet in the list.
- **Catastrophic event handling.** If a name on the watchlist has a major fundamental event (guidance cut, fraud allegation, accounting issue, etc.), do technical signals still surface? Probably should be suppressed — but no current mechanism to do so.
- **Multi-timeframe confirmation.** All current rules are daily-bar. A weekly-trend filter (e.g., weekly 8 > weekly 21) could add another layer of conviction or filter weak signals. Open question whether this adds meaningful signal or just adds latency.

---

## Change Log

- **v1** — *initial spec.* Two setups (Trend Continuation, Reversal/Recovery). State machine, cooldown, regime gating defined. Entry signals only — exit and sizing logic deferred.
