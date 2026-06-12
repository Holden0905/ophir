# CLAUDE.md — Ophir

> Ophir is a personal market intelligence PWA for swing traders who don't have time to be full-time traders. Named after the biblical source of Solomon's gold.

**Risk level: Low** — single user (Brian), personal project, no client data, can rebuild if needed.

---

## Critical Rules

1. **Read `docs/framework.md` before touching signal logic.** It is the canonical spec for setup evaluation, conviction grades, regime gating, cooldown, and state machine. If code and doc disagree, ask Brian.

2. **Middleware is `proxy.ts`, not `middleware.ts`.** Next.js 16 renamed it. Auth is enforced in two layers: proxy.ts redirect + `(app)/layout.tsx` requireUser(). Both must stay in sync.

3. **All `/api/*` is excluded from the auth middleware by the matcher regex.** proxy.ts's matcher (`/((?!api|_next/...).*)`) skips the entire `/api` tree — route handlers manage their own auth. This is NOT a per-path allowlist for `/api/cron/*`. If you ever narrow the matcher and let `/api/*` through the auth redirect, Vercel silently swallows the redirect and crons never execute — no logs, no errors, just silence.

4. **Vercel Hobby deduplicates cron entries by base path.** Crons that share the same route path with different query params will only fire once per day. Use dedicated route files (e.g., `/api/cron/regime-premarket` and `/api/cron/regime-eod`), not query params.

5. **Service-role client for all cron/background writes.** Use `createServiceClient()` which bypasses RLS. The UI only reads shared market data tables. User-owned tables (stocks, profiles, invite_codes) scope by `auth.uid()`.

6. **All dates/times use America/New_York.** Computed via `nyDate()` in `lib/signals/dates.ts`. Date strings formatted as YYYY-MM-DD. Never `new Date()` on date-only strings — causes off-by-one timezone errors.

7. **GRANTs must follow every table creation.** RLS policies require underlying GRANTs. Without them, Postgres rejects writes before RLS even evaluates — you get empty `{}` error objects that are nearly impossible to debug.

8. **`net_gross_ratio` is a GENERATED column.** Never include it in INSERT or UPDATE operations. Read-only.

9. **Yahoo Finance schema validation is disabled.** Malformed responses won't be caught by the library — downstream null checks matter.

10. **Commit and push directly to main.** No branches, no PRs. Brian reviews after.

---

## Project Identity

| Field | Value |
|---|---|
| Name | Ophir |
| One-liner | Personal market intelligence PWA for swing traders |
| Users | Brian (single user, invite-code gated for friends) |
| Repo | github.com/Holden0905/ophir |
| Supabase ref | ufedejzfpteecvalzwtm |
| Hosting | Vercel (Hobby plan, auto-deploys on push to main) |

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.4 (App Router, TypeScript, React 19.2) |
| Styling | Tailwind CSS v4 (no shadcn/ui) |
| Backend | Supabase (PostgreSQL, Auth, RLS) |
| Hosting | Vercel Hobby (auto-deploys on push to main) |
| Charts | TradingView Lightweight Charts v5 |
| AI | Anthropic Claude (claude-sonnet-4-6) |
| Package manager | npm |

### Fonts

- **IBM Plex Mono** — all numerical data
- **Playfair Display** — AI narrative briefs, editorial text
- **Outfit** — UI elements, labels, navigation
- **Libre Baskerville** — supplementary editorial

### Design Language

- Near-black background: `#0a0a0a`
- Amber accent: `#f59e0b` — triggers, active states, loading indicators, the "current moment" cue
- Up/positive: green. Down/negative: red
- Regime colors: risk_on green, risk_off red, transitional amber, choppy grey
- Loading states: amber spinner + amber border/tint on containing card. Never grey-on-black — insufficient contrast caused a real bug
- Touch targets: minimum 44px on mobile
- `active:scale-[0.98]` on all buttons for touch feedback
- Aesthetic: "terminal meets FT editorial"

---

## File Map

### Root / Config

| File | Description |
|---|---|
| `proxy.ts` | Next 16 middleware. Auth redirect + session refresh. Matcher excludes all `/api/*` (handlers do their own auth); `isPublic()` allowlists `/api/health`, `/auth/*`, static assets |
| `vercel.json` | 5 weekday cron schedules (see Scheduled Jobs) |
| `.mcp.json` | Supabase MCP server config (project ufedejzfpteecvalzwtm) |
| `docs/framework.md` | Trading framework spec — canonical source of truth for signal logic |
| `ophir-product-brief.md` | Original product brief (reference only) |
| `ophir-claude-code-brief.md` | Original engineering brief (reference only) |

### App Root & co-located files

| File | Description |
|---|---|
| `app/layout.tsx` | Root layout — font loaders (Plex Mono, Outfit, Playfair, Libre Baskerville), metadata, viewport |
| `app/page.tsx` | Root `/` — redirects to `/dashboard` |
| `app/globals.css` | Design system — color vars, regime colors, typography, card primitives, animations |
| `app/manifest.ts` | PWA manifest (name, amber theme, standalone, `/icon.svg`) |
| `public/sw.js` | Minimal PWA service worker — caches app shell (`ophir-shell-v1`) for installability |
| `app/auth/callback/route.ts` | Supabase magic-link/OAuth callback — exchanges code for session, redirects to dashboard |
| `app/(app)/matrix/actions.ts` | Server actions: `addStock`, `updateStock`, `removeStock`, `addStockByTicker` |
| `app/(app)/settings/actions.ts` | Server actions: `updateDisplayName`, `generateInviteCode`, `deleteAccount` (service-role) |
| `app/(auth)/actions.ts` | Server actions: `login`, `signup`, `signInWithMagicLink`, `signout` |

### App Shell — `app/(app)/`

| Route | Description | Pattern |
|---|---|---|
| `dashboard/` | Regime Dashboard: macro pulse, crypto barometer, sector rotation (1D/5D/30D), AI briefs, brief history | Server → DashboardLive (client) |
| `matrix/` | Research Matrix: watchlist table with fundamentals, technicals, signals, live prices (60s polling) | Server → MatrixClient |
| `matrix/[ticker]/` | Stock detail: chart, fundamentals, BLC selector, notes, Analyze Trade panel. Preview mode for non-matrix tickers | Server |
| `trading/` | Trading page: triggered/qualifying/recent/cooled sections. Side panel (portal) with chart + conditions | Server → TradingClient |
| `discovery/` | Discovery: reversal/trend screener, results with prev/next cycling, links to preview mode | Server → DiscoveryClient |
| `settings/` | Settings: profile, health dashboard (60s polling), invite codes, delete account | Server → SettingsClient |
| `about/` | Static framework documentation in editorial style | Server (static) |

### Auth — `app/(auth)/`

| Route | Description |
|---|---|
| `login/` | Email/password + magic link login |
| `signup/` | Invite-code gated registration |

### API Routes — `app/api/`

| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/health` | GET | public | Data feed freshness/age/stale status |
| `/api/regime/generate` | POST | authenticated | Manual regime brief generation |
| `/api/stocks/quotes` | GET | authenticated | Live Yahoo quotes for matrix polling |
| `/api/stocks/refresh` | POST | authenticated | User-triggered fundamentals/technicals refresh |
| `/api/stocks/[ticker]/analyze` | POST | authenticated | Claude trade analysis narrative |
| `/api/crypto/quotes` | GET | authenticated | Live CoinGecko quotes (24/7) |
| `/api/data/technicals` | GET | authenticated | Historical Yahoo OHLCV bars |
| `/api/data/fundamentals` | POST | authenticated | Single-ticker fundamentals refresh |
| `/api/data/crypto` | GET | authenticated | CoinGecko BTC/ETH/SOL + regime |
| `/api/discovery/scan` | POST | authenticated | User-triggered discovery scan |
| `/api/cron/regime-premarket` | GET/POST | CRON_SECRET | Scheduled premarket snapshot |
| `/api/cron/regime-eod` | GET/POST | CRON_SECRET | Scheduled EOD snapshot |
| `/api/cron/regime` | GET/POST | CRON_SECRET | Manual/fallback regime snapshot |
| `/api/cron/refresh-stocks` | GET/POST | CRON_SECRET | Refresh technicals + fundamentals (7d TTL) |
| `/api/cron/signals` | GET | CRON_SECRET* | Evaluate daily signals (*custom auth — allows unauth in dev) |
| `/api/cron/discovery` | GET/POST | CRON_SECRET | Run discovery scans |

### Key Libraries — `lib/`

| Module | Purpose |
|---|---|
| `ai/` | Claude prompt builders + response parsers (regime, discovery, trade analysis) |
| `ai/analyze.ts` | `extractNarrative()` — 4-tier cascade with fallback that never throws on malformed Claude JSON |
| `analyze/inputs.ts` | Gathers all inputs for trade analysis (technicals, conditions, volume, regime, sector RS) |
| `auth/dal.ts` | `requireUser()`, `getUserOrNull()`, `getProfile()` — cached auth helpers |
| `calculations/technicals.ts` | All indicator math: EMA, SMA, RSI, relative strength, rolling means. Reuse these — don't reimplement |
| `cron/auth.ts` | `authorizeCron()` — shared Bearer token check |
| `cron/regimeBrief.ts` | `runRegimeBrief()` — shared builder for premarket/EOD routes |
| `data/yahoo.ts` | Yahoo Finance client: series, quotes, batch, quarterly revenue. `lastBarNyDate()` for stale-bar detection |
| `data/alphavantage.ts` | Alpha Vantage fundamentals (25 calls/day limit) |
| `data/fmp.ts` | FMP Q/Q revenue + debt-to-market-cap |
| `data/coingecko.ts` | CoinGecko crypto prices + regime classification |
| `data/symbols.ts` | SECTOR_ETFS, BENCHMARK_SYMBOL, MACRO_SYMBOLS, DISCOVERY_UNIVERSE |
| `discovery/scan.ts` | Discovery screener logic (reversal + trend modes) |
| `env.ts` | Environment variable validation (6 core secrets) |
| `format.ts` | `fmtPct`, `fmtPrice`, `fmtMarketCap`, `relativeTime`, `isStale` |
| `marketHours.ts` | `isUsEquityMarketOpen()` — NYSE hours (Mon-Fri 09:30-16:00 ET) |
| `regime/build.ts` | `buildRegimeSnapshot()` — assembles macro/crypto/sector data, stale-bar validation |
| `signals/evaluate.ts` | `runDailySignalJob()` — orchestrates signal evaluation for all tickers |
| `signals/rules.ts` | `evaluateTrendContinuation()`, `evaluateReversalRecovery()` — pure setup evaluators per framework.md |
| `signals/series.ts` | `indicatorBars()` — derives indicator stream from Yahoo daily series |
| `signals/queries.ts` | `fetchTradingPageData()`, `fetchWatchlistSignalReport()` |
| `signals/labels.ts` | Display helpers shared by server and client |
| `signals/dates.ts` | `nyDate()`, `dateStrToMs()`, `addCalendarDays()` |
| `stocks/refresh.ts` | `refreshTechnicals()`, `refreshFundamentals()`, `computeTechnicalsFromYahoo()` |
| `supabase/server.ts` | `createClient()` (RLS), `createServiceClient()` (bypass) |
| `supabase/client.ts` | `createClient()` (browser) |
| `supabase/types.ts` | Hand-written row/insert/update types (not generated — deliberate) |

### Components — `components/`

| Module | Key components |
|---|---|
| `analyze/` | AnalyzeTradePanel — on-demand Claude analysis, sessionStorage cache, amber loading state |
| `matrix/` | AddStockModal, BLCPhaseSelector, TradingViewChart (weekly candles + EMA8/21/SMA50) |
| `regime/` | RegimeBadge, RegimeNarrative, MacroPulse, CryptoBarometer, SectorRotation (1D/5D/30D), BriefHistory, GenerateBriefButton |
| `signals/` | SignalBadge (TC/RR), ConvictionPills, SignalChartPanel (daily candles + EMA5/8/21 + volume + RSI + trigger markers) |
| `shared/` | Nav (header + mobile bottom tabs), InstallPrompt, Spinner, LoadingPulse, DataCell, SparkLine |

---

## Database Schema

9 tables, all RLS-enabled. Pattern: authenticated SELECT on shared data, service_role writes, user tables scope by auth.uid().

### User-owned tables

**profiles** — auto-created on signup via handle_new_user() trigger

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | FK → auth.users.id |
| email | text | |
| display_name | text | nullable |
| invite_code_used | text | nullable |
| created_at | timestamptz | default now() |

**stocks** — user watchlist (~20 rows)

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | → profiles.id |
| ticker | text | |
| company_name, sector | text | nullable |
| blc_phase | int | CHECK 1-6, nullable |
| is_position, is_interested, is_archived | bool | defaults: false, true, false |
| notes | text | nullable |
| UNIQUE (user_id, ticker) | | |

**invite_codes** — invite-gated access

| Column | Type | Notes |
|---|---|---|
| code | text | UNIQUE |
| created_by, used_by | uuid FK | → profiles.id |
| used_at | timestamptz | nullable (null = unused) |

### Market data tables (service-role writes)

**stock_fundamentals** — one row per ticker

| Column | Type | Notes |
|---|---|---|
| ticker | text | UNIQUE |
| market_cap, gross_margin, net_margin | numeric | |
| net_debt, sbc_fcf | numeric | nullable |
| net_gross_ratio | numeric | ⚠️ GENERATED — never INSERT/UPDATE |
| qq_revenue_growth, yy_revenue_growth | numeric | |
| debt_market_cap_ratio | numeric | |
| data_source | text | default 'alpha_vantage' |
| last_fetched_at | timestamptz | |

**stock_technicals** — latest snapshot per ticker

| Column | Type | Notes |
|---|---|---|
| ticker | text | UNIQUE |
| current_price, price_change_pct | numeric | |
| ma_50, ema_8, ema_21, rsi_14 | numeric | |
| price_vs_ma50_pct, price_vs_ema8_pct, price_vs_ema21_pct | numeric | |
| volume, avg_volume_20d | numeric | |
| week_52_high, week_52_low, pct_from_52_high | numeric | |

**daily_technicals** — historical daily bars (~440 rows)

| Column | Type | Notes |
|---|---|---|
| ticker | text | |
| date | date | |
| close | numeric | volume: bigint |
| ema_5, ema_8, ema_21, sma_50, rsi_14 | numeric | |
| avg_volume_20 | bigint | |
| UNIQUE (ticker, date) | | |

**signals** — daily signal evaluation (~880 rows)

| Column | Type | Notes |
|---|---|---|
| ticker | text | |
| date | date | |
| setup_type | text | trend_continuation or reversal_recovery |
| state | text | triggered_today, qualifies, or none |
| conviction_grades | jsonb | e.g. ["high_volume", "mature_trend"] |
| triggered_at | timestamptz | nullable |
| cooled_until | date | nullable (7 calendar days ≈ 5 trading days) |
| UNIQUE (ticker, date, setup_type) | | |

**regime_snapshots** — premarket + EOD snapshots (~54 rows)

| Column | Type | Notes |
|---|---|---|
| snapshot_type | text | premarket or eod |
| snapshot_date | date | |
| spx_*, qqq_*, vix_*, btc_*, eth_*, sol_* | various | macro + crypto data |
| sector_data | jsonb | sector rotation RS data |
| regime_classification | text | risk_on, risk_off, transitional, choppy |
| narrative | text | AI-generated brief |
| ⚠️ No UNIQUE on (snapshot_date, snapshot_type) | | duplicates possible |

**discovery_scans** — screener results (~47 rows)

| Column | Type | Notes |
|---|---|---|
| scan_date | date | |
| scan_mode | text | reversal or trend |
| results | jsonb | matched tickers + metrics |
| narrative | text | AI-generated brief |

### DB Functions (in Supabase, not in repo)

- `handle_new_user()` — SECURITY DEFINER, auto-creates profile row on auth signup
- `touch_updated_at()` — updated_at trigger (mutable search_path — flagged)
- `rls_auto_enable()` — SECURITY DEFINER

---

## Scheduled Jobs (Vercel Cron)

All UTC, Monday–Friday. Hobby plan: 1-hour flexible execution window.

| UTC | Route | What it does | Depends on |
|---|---|---|---|
| 13:00 | /api/cron/regime-premarket | Premarket regime snapshot (futures) | — |
| 22:00 | /api/cron/refresh-stocks | Refresh technicals + fundamentals (7d TTL) | — |
| 22:15 | /api/cron/signals | Evaluate daily signals per framework.md | refresh-stocks |
| 22:30 | /api/cron/regime-eod | EOD regime snapshot (stale-bar guarded) | signals |
| 22:45 | /api/cron/discovery | Run discovery scans | — |

**Pipeline order matters.** Signals need fresh technicals from refresh-stocks. EOD brief needs today's signals for the watchlist report.

**Key cron lessons:**
- Vercel Hobby deduplicates by base path — dedicated route files required
- proxy.ts's matcher excludes all `/api/*` so crons aren't caught by the auth redirect — don't narrow it to let `/api/*` through, or redirects get silently swallowed
- EOD has stale-bar validation: if Yahoo hasn't published today's close, it throws and writes nothing
- `/api/cron/regime` is the manual/fallback entry (still accepts `?type=` param)
- CRON_SECRET is only in Vercel env, not .env.local

---

## External APIs

| Service | Data | Auth | Key constraint |
|---|---|---|---|
| Yahoo Finance (yahoo-finance2) | Quotes, OHLCV, 52w stats, quarterly revenue | None | Schema validation disabled; 150ms batch delay |
| Alpha Vantage | Market cap, margins, revenue growth, sector | ALPHA_VANTAGE_KEY | **25 calls/day** — tightest constraint. Quota exhaustion silently returns stale data |
| FMP | Q/Q revenue, debt-to-market-cap | FMP_API_KEY | Uses /stable/* endpoints (post-2025-08 accounts) |
| CoinGecko | BTC/ETH/SOL price + 24h change | None (public) | 60s revalidation cache |
| Anthropic Claude | Regime briefs, discovery briefs, trade analysis | ANTHROPIC_API_KEY | Model: claude-sonnet-4-6 |

**Fundamentals fallback chain:** Alpha Vantage → FMP → Yahoo. Partial upserts preserve prior values when a source fails.

---

## Environment Variables

| Name | Scope | Purpose | In .env.local? |
|---|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | client | Supabase project URL | ✅ |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | client | Supabase publishable key | ✅ |
| SUPABASE_SERVICE_ROLE_KEY | server | RLS-bypass writes | ✅ |
| ANTHROPIC_API_KEY | server | Claude API | ✅ |
| ALPHA_VANTAGE_KEY | server | Alpha Vantage | ✅ |
| FMP_API_KEY | server | FMP | ✅ |
| CRON_SECRET | server | Cron bearer auth | ❌ Vercel only |
| NEXT_PUBLIC_SITE_URL | client | Magic-link redirect base | ❌ Must be set in Vercel prod |

`lib/env.ts` validates the first 6 at startup.

---

## Trading Framework (summary)

Full spec in `docs/framework.md`. Key concepts:

**Watchlist as fundamental gate:** if a stock is in the list, it has passed Brian's fundamental judgment. Signals are purely technical.

**Two setups:**
- **Trend Continuation** — uptrend resumption after pullback. Required: close > EMA(8), EMA(5) rising 2+ days, EMA(8) > EMA(21), RSI(14) between 40-70.
- **Reversal/Recovery** — beaten-up quality name turning. Required: down 20%+ from 52w high, RSI was below 35 in last 10 days, RSI now > 40, EMA(5) rising 2+ days, close > EMA(8).

**State machine:** triggered_today → qualifies → none. Transitions (none→triggered_today) are "news." Persistence (qualifies for days) is "wallpaper."

**Controls:** 5-day cooldown (7 calendar day proxy), setup precedence (Reversal wins), regime gating (TC suppressed in Risk Off/Choppy; RR is never regime-suppressed — `regimeAllowsReversal()` is hardcoded `true`. The framework calls RR "lower priority in Risk On," but priority is handled by setup precedence, not by gating).

**Conviction grades:** high_volume (>1.2x 20d avg), mature_trend (EMA21 > SMA50), accumulation (up-vol > down-vol 5d), sector_tailwind, trend_reversal_forming.

---

## Build & Deploy

```bash
npx tsc --noEmit
npx eslint .
npm run build
# If any fail, don't push
```

Vercel auto-deploys on push to main. Cron jobs only register from the latest **production** deployment.

---

## QA Protocol

**Per-feature (automatic after each change):**
1. `tsc --noEmit` — TypeScript clean
2. `eslint` — no new errors (pre-existing setRows/InstallPrompt warnings are known)
3. Routes compile and respond (307 unauth is expected for authenticated routes)
4. Flag for Brian to eyeball on mobile when visual changes can't be tested headless

**When Brian says "run QA":**
- Load each page route, confirm render
- Trigger each cron endpoint manually, confirm 200
- Check Settings → Health Dashboard for feed freshness
- Test mobile: Trading panel open/close/back, Discovery prev/next, Matrix scroll

---

## What to Ask Brian Before Doing

- Schema changes (new tables, new columns, column type changes)
- Changes to `proxy.ts` (auth middleware)
- Changes to signal rules in `lib/signals/rules.ts`
- Changes to `docs/framework.md`
- Adding new external API dependencies
- Changes to cron scheduling or pipeline order
- Changes to `app/globals.css` design system variables

For everything else: try to fix it, if you can't, flag it and move on.

---

## Known Issues

1. `/api/cron/signals` uses custom auth diverging from shared `authorizeCron()` — should be unified
2. `regime_snapshots` missing UNIQUE on (snapshot_date, snapshot_type) — allows duplicate snapshots
3. Alpha Vantage quota exhaustion (25/day) silently returns stale fundamentals
4. ~~No migrations folder~~ **Resolved 2026-06-11:** schema versioned via baseline `supabase/migrations/20260612121349_remote_schema.sql` (CLI linked; pre-history archived in `supabase/migrations_archive/`). Types still manually maintained in `lib/supabase/types.ts`
5. `NEXT_PUBLIC_SITE_URL` missing from `.env.local` — magic links default to localhost in dev
6. README.md is default create-next-app boilerplate — stale
7. Unused boilerplate SVGs in public/
8. Zone.Identifier files (WSL cruft) in repo root — safe to delete
9. Supabase SECURITY DEFINER functions callable via REST — should revoke EXECUTE from public
10. Yahoo schema validation disabled — malformed responses pass through silently
11. No request-param validation on API routes despite `zod` being a dependency — query/body params accepted as free text
12. ~~`touch_updated_at()` has a mutable `search_path`~~ **Resolved 2026-06-11:** pinned `search_path = ''` (captured in `supabase/migrations/20260612121349_remote_schema.sql`)

---

*Ophir is built and maintained by Brian Jones using an AI-assisted development workflow (Claude + Claude Code). The codebase prioritizes rapid iteration and personal utility — a tool built by a trader, for a trader.*
