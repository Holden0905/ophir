# Ophir — Full Codebase Audit (2026-06-06)

A personal swing-trading research platform. **Next.js 16.2.4 / React 19.2 / Tailwind 4 / Supabase / Anthropic Claude.** Deployed on Vercel. Single-user-ish private beta (invite-code gated).

> Note: a few things below are checked against the live Supabase project (`ufedejzfpteecvalzwtm`) and the running config, not just the source.

---

## 1. File Map

### Root / config
| File | Description |
|------|-------------|
| `AGENTS.md` | Project instructions: "this is not the Next.js you know" — read `node_modules/next/dist/docs/` before coding. |
| `CLAUDE.md` | Just `@AGENTS.md` (include). |
| `README.md` | ⚠️ Still the default `create-next-app` boilerplate (references Geist; app doesn't use it). Stale. |
| `next.config.ts` | Empty `NextConfig` — no custom config. |
| `tsconfig.json` | Strict TS, `@/*` path alias → repo root, bundler resolution. |
| `eslint.config.mjs` | Flat config extending `eslint-config-next` core-web-vitals + typescript. |
| `postcss.config.mjs` | Tailwind 4 via `@tailwindcss/postcss`. |
| `proxy.ts` | **Next 16's renamed middleware.** Refreshes Supabase session cookies, redirects unauthenticated users to `/login` (with `next` param), redirects logged-in users away from `/login` & `/signup`. Public-path allowlist incl. `/api/health`, `/auth/*`, static assets. |
| `vercel.json` | 5 cron schedules (see §5). |
| `.mcp.json` | Supabase MCP HTTP server pinned to project `ufedejzfpteecvalzwtm`. |
| `.env.local` | 6 secrets (see §7). |
| `package.json` | Deps: `@anthropic-ai/sdk`, `@supabase/ssr`, `@supabase/supabase-js`, `lightweight-charts`, `recharts`, `yahoo-finance2`, `zod`. |
| `docs/framework.md` | The trading framework spec (BLC + Shannon EMA + signal rules). |
| `ophir-product-brief.md`, `ophir-claude-code-brief.md` (+ `:Zone.Identifier` files) | Original product/engineering briefs. The `:Zone.Identifier` files are Windows download-tracking cruft (WSL) — junk, safe to delete. |

### `app/` (top-level)
| File | Description |
|------|-------------|
| `app/layout.tsx` | Root layout: font loaders (Plex Mono, Outfit, Playfair, Libre Baskerville), metadata, viewport. |
| `app/page.tsx` | Redirects `/` → `/dashboard`. |
| `app/manifest.ts` | PWA manifest (name "Ophir", amber theme `#f59e0b`, standalone, `/icon.svg`). |
| `app/globals.css` | Design system: color vars, regime colors, typography, card primitives, prose, animations (amber-pulse), utilities. |
| `app/favicon.ico` | Favicon. |
| `app/auth/callback/route.ts` | Supabase OAuth/magic-link callback — exchanges code for session, redirects to dashboard. |

### `app/(app)/` — authenticated app shell
| File | Description |
|------|-------------|
| `layout.tsx` | App chrome: `Nav` header + mobile bottom tabs, max-width main, `InstallPrompt`. Auth-gated. |
| `about/page.tsx` | Static framework documentation (setups, regimes, BLC, Matrix column reference). |
| `dashboard/page.tsx` | Server: fetches latest regime snapshot, hands to `DashboardLive`. |
| `dashboard/DashboardLive.tsx` | Client: polls `/api/stocks/quotes` (60s, market-hours gated) + `/api/crypto/quotes`; renders MacroPulse, CryptoBarometer, SectorRotation. |
| `discovery/page.tsx` | Server: fetches 7 recent discovery scans → `DiscoveryClient`. |
| `discovery/DiscoveryClient.tsx` | Client: reversal/trend mode toggle, run-scan (POST `/api/discovery/scan`), results table linking to ticker detail with discovery context, past scans. |
| `matrix/page.tsx` | Server: assembles watchlist rows (stocks + fundamentals + technicals + today's signals + daily_technicals) → `MatrixClient`. |
| `matrix/MatrixClient.tsx` | Client: research matrix table; search/filter, live quote polling, setup sort, refresh-all, expandable rows. |
| `matrix/actions.ts` | Server actions: `addStock`, `updateStock`, `removeStock`, `addStockByTicker` (each best-effort refreshes technicals+fundamentals). |
| `matrix/[ticker]/page.tsx` | Server: stock detail; in-matrix vs preview mode; charts, cards, BLC selector, notes. |
| `matrix/[ticker]/StockDetailNav.tsx` | Back + prev/next discovery navigation (context-aware). |
| `matrix/[ticker]/StockNotes.tsx` | Client: auto-saving notes textarea (`updateStock`). |
| `matrix/[ticker]/AddToMatrixCta.tsx` | Client: add preview ticker to matrix (`addStockByTicker`). |
| `matrix/[ticker]/PositionToggle.tsx` | Client: Mark position / Watch / Remove (confirm before archive). |
| `trading/page.tsx` | Server: `fetchTradingPageData(today)` → `TradingClient`. |
| `trading/TradingClient.tsx` | Client: four signal sections (triggered/qualifying/recent/cooled); opens `SignalSidePanel`. |
| `trading/SignalSidePanel.tsx` | Portal side panel (slide-over/full-screen mobile): badge, conviction, condition checklist, analyze panel, swipe-dismiss. |
| `settings/page.tsx` | Server: fetches profile + invite codes → `SettingsClient`. |
| `settings/SettingsClient.tsx` | Client: display-name form, health panel, invite-code generator, delete-account zone. |
| `settings/HealthPanel.tsx` | Client: polls `/api/health` every 60s; color-coded feed freshness. |
| `settings/actions.ts` | Server actions: `updateDisplayName`, `generateInviteCode`, `deleteAccount` (service-role). |

### `app/(auth)/` — public auth
| File | Description |
|------|-------------|
| `layout.tsx` | Centered card with "Ophir" title + tagline. |
| `login/page.tsx` / `LoginForm.tsx` | Login: password / magic-link modes. |
| `signup/page.tsx` / `SignupForm.tsx` | Sign-up: email, password (min 8), optional invite code. |
| `actions.ts` | Server actions: `login`, `signup` (validates/marks invite code), `signInWithMagicLink`, `signout`. |

### `app/api/` — see §3.

### `components/`
| File | Description |
|------|-------------|
| `analyze/AnalyzeTradePanel.tsx` | On-demand Claude analysis (POST `/api/stocks/{t}/analyze`); sessionStorage cache per ticker. |
| `matrix/AddStockModal.tsx` | Add-stock modal (ticker, BLC phase, is_position). |
| `matrix/BLCPhaseSelector.tsx` | 6-phase selector grid; saves via `updateStock`; shows phase stats. |
| `matrix/TradingViewChart.tsx` | lightweight-charts weekly candles + EMA8/EMA21/SMA50. |
| `regime/RegimeBadge.tsx` | Regime classification badge (Risk On/Off/Transitional/Choppy). |
| `regime/RegimeLegend.tsx` | Static regime key. |
| `regime/RegimeNarrative.tsx` | Renders AI regime brief paragraphs + timestamp. |
| `regime/MacroPulse.tsx` | SPX/NDX/VIX pillars (premarket vs EOD labels). |
| `regime/CryptoBarometer.tsx` | BTC/ETH/SOL prices + crypto regime. |
| `regime/SectorRotation.tsx` | Client: 1d/5d/30d RS view toggle, sector bar chart, divergence flags. |
| `regime/BriefHistory.tsx` | Collapsible past-snapshot accordion (max 7). |
| `regime/GenerateBriefButton.tsx` | Client: premarket/EOD toggle, POST `/api/regime/generate`. |
| `shared/Nav.tsx` | Sticky header tabs + mobile bottom tab bar. |
| `shared/InstallPrompt.tsx` | iOS PWA install instructions (localStorage-dismissible). |
| `shared/Spinner.tsx` | Inline spinner. |
| `shared/LoadingPulse.tsx` | Skeleton pulse rows. |
| `shared/DataCell.tsx` | Number/percent cell with up/down/flat coloring. |
| `shared/SparkLine.tsx` | SVG mini line chart. |
| `signals/SignalBadge.tsx` | TC/RR setup badge by state. |
| `signals/ConvictionPills.tsx` | Conviction-grade pill row. |
| `signals/SignalChartPanel.tsx` | lightweight-charts candles + EMA(5/8/21) + volume + RSI(14); trigger marker. |

### `lib/` — see §8.

### `public/`
`sw.js` (minimal PWA service worker, caches app shell `ophir-shell-v1`), `icon.svg`, plus default create-next-app SVGs (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` — unused boilerplate).

---

## 2. Database Schema (Supabase `public`)

All 9 tables have **RLS enabled**. Pattern: authenticated users get `SELECT` on shared market data; `service_role` (crons) does all writes; user-owned tables (`profiles`, `stocks`, `invite_codes`) scope by `auth.uid()`.

### `profiles` (1 row)
- `id` uuid **PK** → FK `auth.users.id`
- `email` text
- `display_name` text null
- `invite_code_used` text null
- `created_at` timestamptz null default `now()`
- **RLS:** `users_own_profile` (ALL, authenticated) — `auth.uid() = id`

### `invite_codes` (0 rows)
- `id` uuid **PK** default `gen_random_uuid()`
- `code` text **UNIQUE**
- `created_by` uuid null → `profiles.id`
- `used_by` uuid null → `profiles.id`
- `used_at` timestamptz null
- `created_at` timestamptz null default `now()`
- **RLS:** `auth_insert_invites` (INSERT, with_check `auth.uid() = created_by`); `auth_read_own_invites` (SELECT, `auth.uid() = created_by`)

### `stocks` (20 rows) — user watchlist
- `id` uuid **PK** default `gen_random_uuid()`
- `user_id` uuid → `profiles.id`
- `ticker` text
- `company_name` text null, `sector` text null
- `blc_phase` int null (**CHECK** 1–6), `blc_phase_label` text null
- `is_position` bool null default `false`, `is_interested` bool null default `true`, `is_archived` bool null default `false`
- `notes` text null
- `created_at`, `updated_at` timestamptz null default `now()`
- **UNIQUE:** `(user_id, ticker)`
- **Indexes:** `stocks_ticker_idx (ticker)`, `stocks_user_idx (user_id)`, unique `(user_id, ticker)`
- **RLS:** `users_own_stocks` (ALL, authenticated) — `auth.uid() = user_id`

### `stock_fundamentals` (20 rows)
- `id` uuid **PK**; `ticker` text **UNIQUE**
- `market_cap`, `net_debt`, `sbc_fcf`, `gross_margin`, `net_margin` numeric null
- `net_gross_ratio` numeric — **GENERATED** (`net_margin/gross_margin` when gross>0 else null)
- `debt_market_cap_ratio`, `qq_revenue_growth`, `yy_revenue_growth` numeric null
- `last_fetched_at` timestamptz null
- `data_source` text null default `'alpha_vantage'`
- **RLS:** `auth_read_fundamentals` (SELECT) / `service_write_fundamentals` (ALL, service_role)

### `stock_technicals` (20 rows) — latest snapshot per ticker
- `id` uuid **PK**; `ticker` text **UNIQUE**
- `current_price`, `price_change_pct`, `ma_50`, `ema_8`, `ema_21`, `price_vs_ma50_pct`, `price_vs_ema8_pct`, `price_vs_ema21_pct`, `rsi_14`, `volume`, `avg_volume_20d`, `week_52_high`, `week_52_low`, `pct_from_52_high` numeric null
- `last_fetched_at` timestamptz null
- **RLS:** `auth_read_technicals` / `service_write_technicals`

### `regime_snapshots` (54 rows)
- `id` uuid **PK**
- `snapshot_type` text (**CHECK** `premarket`|`eod`); `snapshot_date` date
- SPX: `spx_price`, `spx_change_pct`, `spx_vs_ema21_pct`, `spx_trend`
- QQQ: `qqq_price`, `qqq_change_pct`
- VIX: `vix_level`, `vix_direction`, `vix_flag`
- Crypto: `btc_price`/`btc_change_24h`, `eth_*`, `sol_*`, `crypto_regime`
- `sector_data` jsonb null
- `regime_classification` text null (**CHECK** `risk_on`|`risk_off`|`transitional`|`choppy`)
- `narrative` text null; `created_at` timestamptz null default `now()`
- **Index:** `regime_snapshots_date_idx (snapshot_date DESC)`
- **RLS:** `auth_read_regime` / `service_write_regime`
- ⚠️ No unique constraint on `(snapshot_date, snapshot_type)` — duplicate snapshots per day/type are possible.

### `discovery_scans` (47 rows)
- `id` uuid **PK**; `scan_date` date; `scan_mode` text (**CHECK** `reversal`|`trend`)
- `results` jsonb; `narrative` text null; `created_at` default `now()`
- **Index:** `discovery_scans_date_idx (scan_date DESC)`
- **RLS:** `auth_read_discovery` / `service_write_discovery`

### `daily_technicals` (439 rows) — historical per-ticker daily bars
- `id` uuid **PK**; `ticker` text; `date` date
- `close` numeric, `volume` bigint, `ema_5`/`ema_8`/`ema_21`/`sma_50`/`rsi_14` numeric, `avg_volume_20` bigint
- `created_at` timestamptz default `now()`
- **UNIQUE:** `(ticker, date)`
- **Indexes:** `date_idx (date)`, `ticker_idx (ticker)`, `ticker_date_desc_idx (ticker, date DESC)`, unique `(ticker, date)`
- **RLS:** `auth_read_daily_technicals` / `service_write_daily_technicals`

### `signals` (880 rows) — daily evaluated signals
- `id` uuid **PK**; `ticker` text; `date` date
- `setup_type` text (**CHECK** `trend_continuation`|`reversal_recovery`)
- `state` text (**CHECK** `triggered_today`|`qualifies`|`none`)
- `conviction_grades` jsonb default `'[]'`
- `triggered_at` timestamptz null; `cooled_until` date null; `created_at` default `now()`
- **UNIQUE:** `(ticker, date, setup_type)`
- **Indexes:** `date_idx (date)`, `ticker_idx (ticker)`, `ticker_setup_date_desc_idx (ticker, setup_type, date DESC)`, unique `(ticker, date, setup_type)`
- **RLS:** `auth_read_signals` / `service_write_signals`

### DB functions (in Supabase, **not** in repo — no migrations folder)
- `touch_updated_at()` — updated_at trigger (flagged: mutable search_path)
- `handle_new_user()` — auto-creates a profile row on auth signup (SECURITY DEFINER)
- `rls_auto_enable()` — (SECURITY DEFINER)

---

## 3. API Routes

Auth legend: **public** / **authenticated** (`requireUser()` → Supabase session) / **service-role** (writes via `createServiceClient()`) / **CRON_SECRET** (`Authorization: Bearer`).

| Route | Method | Auth | Does |
|-------|--------|------|------|
| `/api/health` | GET | **public** | Freshness/age/stale status of all data feeds. |
| `/api/regime/generate` | POST | **authenticated** + service-role write | Build & persist a regime snapshot (premarket/eod, inferred from market hours). |
| `/api/cron/discovery` | GET, POST | **CRON_SECRET** | Run trend &/or reversal discovery scans; persist results. |
| `/api/cron/refresh-stocks` | GET, POST | **CRON_SECRET** | Refresh technicals (all) + fundamentals (7d TTL) for non-archived tickers. |
| `/api/cron/signals` | GET | **CRON_SECRET** ⚠️ | Evaluate daily signals for all stocks. **Uses a custom `isAuthorized()` that allows unauthenticated access when `NODE_ENV !== "production"`** — diverges from `authorizeCron()`. |
| `/api/cron/regime` | GET, POST | **CRON_SECRET** | Manual/fallback regime snapshot (`?type=premarket\|eod` or inferred). |
| `/api/cron/regime-premarket` | GET, POST | **CRON_SECRET** | Scheduled premarket snapshot (hardcoded type). |
| `/api/cron/regime-eod` | GET, POST | **CRON_SECRET** | Scheduled EOD snapshot (hardcoded type). |
| `/api/stocks/quotes` | GET | **authenticated** | Live quotes (price/change%/volume) for ≤100 tickers from Yahoo; no DB write. |
| `/api/stocks/refresh` | POST | **authenticated** | User-triggered refresh of given tickers (`fundamentals`, `force` flags). |
| `/api/stocks/[ticker]/analyze` | POST | **authenticated** | Gather inputs → Claude trade-analysis narrative. |
| `/api/discovery/scan` | POST | **authenticated** + service-role write | User-triggered discovery scan (default trend). |
| `/api/data/technicals` | GET | **authenticated** | Historical Yahoo bars (`range`, `interval` params). |
| `/api/data/fundamentals` | POST | **authenticated** | Fetch/refresh one ticker's fundamentals (7d TTL, `force`). |
| `/api/data/crypto` | GET | **authenticated** | CoinGecko BTC/ETH/SOL + crypto regime. |
| `/api/crypto/quotes` | GET | **authenticated** | Live 24/7 crypto quotes + regime (60s revalidate). |

Routes generally run `runtime: "nodejs"`, `dynamic: "force-dynamic"`, `maxDuration` 60–300s for long crons.

---

## 4. Page Routes (`app/(app)/` + `app/(auth)/`)

All `(app)` routes are double-gated (proxy redirect + layout `requireUser()`). `(auth)` routes are public.

| Route | Renders | Server/Client | Key components |
|-------|---------|---------------|----------------|
| `/dashboard` | Regime read + macro/crypto/sector live overlay + brief history | Server → client `DashboardLive` | RegimeBadge, RegimeNarrative, MacroPulse, CryptoBarometer, SectorRotation, BriefHistory, GenerateBriefButton, RegimeLegend |
| `/matrix` | Research-matrix watchlist table | Server → `MatrixClient` | AddStockModal, SignalBadge, ConvictionPills, LoadingPulse |
| `/matrix/[ticker]` | Stock detail (in-matrix or preview) | Server | TradingViewChart, BLCPhaseSelector, StockNotes, PositionToggle, AnalyzeTradePanel, StockDetailNav, AddToMatrixCta, DataCell |
| `/discovery` | Screener (reversal/trend) + results + past scans | Server → `DiscoveryClient` | DiscoveryClient |
| `/trading` | Daily signal board + side panel | Server → `TradingClient` | TradingClient, SignalSidePanel, SignalBadge, ConvictionPills, RegimeBadge, SignalChartPanel, AnalyzeTradePanel |
| `/settings` | Profile, data health, invite codes, delete account | Server → `SettingsClient` | SettingsClient, HealthPanel |
| `/about` | Static framework documentation | Server (static) | — |
| `/login` | Password / magic-link login | Server → `LoginForm` | LoginForm |
| `/signup` | Invite-gated signup | Server → `SignupForm` | SignupForm |

---

## 5. Cron Jobs (`vercel.json`, all UTC, Mon–Fri)

| Path | Schedule (UTC) | ET (approx) | Does |
|------|----------------|-------------|------|
| `/api/cron/regime-premarket` | `0 13 * * 1-5` | ~08:00/09:00 | Premarket regime snapshot (futures-based). |
| `/api/cron/refresh-stocks` | `0 22 * * 1-5` | ~17:00/18:00 | Refresh technicals + (TTL'd) fundamentals. |
| `/api/cron/signals` | `15 22 * * 1-5` | ~17:15 | Evaluate daily signals. |
| `/api/cron/regime-eod` | `30 22 * * 1-5` | ~17:30 | End-of-day regime snapshot (stale-bar guarded). |
| `/api/cron/discovery` | `45 22 * * 1-5` | ~17:45 | Run discovery scans. |

> Note: regime has **dedicated** premarket/eod paths because Vercel dedupes cron entries by base path (query params ignored). `/api/cron/regime` is the manual/fallback variant.

---

## 6. External APIs

| Service | Data | Auth | Rate-limit notes |
|---------|------|------|------------------|
| **Anthropic Claude** | Regime briefs, discovery briefs, per-ticker trade analysis | `ANTHROPIC_API_KEY` (SDK) | Model = `claude-sonnet-4-6` (`lib/ai/anthropic.ts`); brief's older snapshot intentionally overridden. |
| **Yahoo Finance** (`yahoo-finance2`) | Quotes, OHLCV bars, 52w hi/lo, quarterly revenue | None (unofficial) | Crumb/cookie negotiation per process; 150ms delay in batch; strict schema validation disabled. |
| **Alpha Vantage** | Market cap, margins, revenue growth, sector | `ALPHA_VANTAGE_KEY` (URL param) | **25 calls/day free tier** — primary constraint. 1s min-interval gate; quota-exhaustion returns `Note`/`Information` (logged, not thrown → silent stale data). |
| **Financial Modeling Prep** | Q/Q sequential revenue growth, debt-to-market-cap | `FMP_API_KEY` (URL param) | Uses new `/stable/*` endpoints (legacy `/api/v3` retired for accounts post-2025-08-31). No explicit rate handling. |
| **CoinGecko** | BTC/ETH/SOL price + 24h change | None (public) | Free tier; 60s revalidation cache. |
| **Supabase** | Auth + Postgres | anon key (client/SSR), service-role (crons) | — |

Fundamentals fallback chain: **AV → FMP → Yahoo** (partial upserts preserve prior values).

---

## 7. Environment Variables

| Name | Scope | Purpose | In `.env.local`? |
|------|-------|---------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | client | Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Supabase publishable/anon key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | server | RLS-bypass writes (crons, deleteAccount) | ✅ |
| `ANTHROPIC_API_KEY` | server | Claude API | ✅ |
| `ALPHA_VANTAGE_KEY` | server | AV fundamentals | ✅ |
| `FMP_API_KEY` | server | FMP fundamentals | ✅ |
| `CRON_SECRET` | server | Cron bearer auth (`lib/cron/auth.ts`, `/api/cron/signals`) | ❌ **not in `.env.local`** (set in Vercel only) |
| `NODE_ENV` | server | `/api/cron/signals` dev-auth bypass | (runtime) |
| `NEXT_PUBLIC_SITE_URL` | client | Magic-link / email-confirm redirect base (`app/(auth)/actions.ts`) | ❌ **not in `.env.local`** — falls back to `http://localhost:3000` |

`lib/env.ts` centralizes and validates the 6 core secrets (and guards against swapping `sb_secret_*` / `sb_publishable_*` keys). Notably it does **not** include `CRON_SECRET` or `NEXT_PUBLIC_SITE_URL`.

---

## 8. Shared Libraries (`lib/`)

| File | Exports | Called by |
|------|---------|-----------|
| `ai/anthropic.ts` | `CLAUDE_MODEL`, `anthropic` | ai/analyze, ai/discovery, ai/regime |
| `ai/analyze.ts` | `AnalyzeOutput`, `extractNarrative()`, `generateTradeAnalysis()` | `/api/stocks/[ticker]/analyze` |
| `ai/discovery.ts` | `generateDiscoveryBrief()` | `discovery/scan.ts` |
| `ai/regime.ts` | `RegimeInput`, `RegimeOutput`, `generateRegimeBrief()` | `regime/build.ts` |
| `analyze/inputs.ts` | `AnalysisInput` (+condition/setup/volume types), `gatherAnalysisInputs()`, `_BENCHMARK` | analyze route |
| `auth/dal.ts` | `requireUser()`, `getUserOrNull()`, `getProfile()` (all cached) | app layout, detail page, all authenticated API routes |
| `calculations/blc.ts` | `BLCPhase`, `BLC_PHASES`, `blcPhaseLabel()` | BLCPhaseSelector, AddStockModal |
| `calculations/technicals.ts` | `sma/ema/rsi/pctChange/periodReturn/relativeStrength/highestN/lowestN/avg/*Series/rollingMean` | discovery/scan, regime/build, stocks/refresh, signals/series |
| `cron/auth.ts` | `authorizeCron()` | discovery/refresh-stocks/regime* cron routes (**not** signals) |
| `cron/regimeBrief.ts` | `runRegimeBrief()`, `inferSnapshotTypeForNow()` | regime* cron routes |
| `data/alphavantage.ts` | `FundamentalsRaw`, `fetchOverview()` | stocks/refresh |
| `data/coingecko.ts` | `CryptoQuote`, `fetchCoreCrypto()`, `classifyCryptoRegime()` | regime/build, crypto API routes |
| `data/fmp.ts` | `fetchQuarterlyRevenueGrowth()`, `fetchDebtToMarketCap()` | stocks/refresh |
| `data/symbols.ts` | `SECTOR_ETFS`, `BENCHMARK_SYMBOL`, `MACRO_SYMBOLS`, `DISCOVERY_UNIVERSE` | analyze/inputs, discovery/scan, regime/build, UI |
| `data/yahoo.ts` | `YahooBar/Series/Quote`, `fetchYahooSeries()`, `fetchYahooQuotes()`, `fetchYahooBatch()`, `closes/volumes/lastBarNyDate`, `fetchYahooQuarterlyRevenueGrowth()` | analyze/inputs, discovery/scan, regime/build, signals/evaluate, stocks/refresh, data API routes |
| `discovery/scan.ts` | `runDiscoveryScan()` | cron/discovery, discovery/scan routes |
| `env.ts` | `env` | client/server supabase, all data libs |
| `format.ts` | `fmtPct/fmtPrice/fmtNumber/fmtMarketCap/fmtRatio/pctClass/relativeTime/isStale` | widely across UI |
| `marketHours.ts` | `isUsEquityMarketOpen()` | DashboardLive, SectorRotation |
| `regime/build.ts` | `RegimeBuildResult`, `buildRegimeSnapshot()` | cron/regimeBrief, regime/generate |
| `signals/dates.ts` | `nyDate()`, `dateStrToMs()`, `addCalendarDays()` | signals/evaluate, matrix/page |
| `signals/evaluate.ts` | `SignalEvaluation`, `evaluateSignalsForTicker()`, `fetchWatchlistTickers()`, `runDailySignalJob()` | cron/signals |
| `signals/labels.ts` | `SETUP_FULL/SHORT`, `CONVICTION_LABEL`, `compareSignalState()`, `consecutiveQualifyingDays()`, `dominantSignal()` | ai/regime, signal UI |
| `signals/queries.ts` | `TradingPageData`, `WatchlistSignalReport`, `fetchTradingPageData()`, `fetchWatchlistSignalReport()` | trading/page, regime/build |
| `signals/rules.ts` | `SetupEvaluation`, `evaluateTrendContinuation()`, `evaluateReversalRecovery()` | signals/evaluate |
| `signals/series.ts` | `IndicatorBar`, `indicatorBars()` | analyze/inputs, signals/evaluate |
| `stocks/refresh.ts` | `computeTechnicalsFromYahoo()`, `refreshTechnicals()`, `refreshFundamentals()` | matrix page+actions, cron/refresh-stocks, stocks/refresh |
| `supabase/client.ts` | `createClient()` (browser) | client components |
| `supabase/server.ts` | `createClient()` (RLS), `createServiceClient()` (bypass) | server pages, actions, API routes |
| `supabase/types.ts` | All row/insert/update types + `Database` | imported app-wide for typing |

---

## 9. Known Issues / Tech Debt

**Auth / security**
1. **`/api/cron/signals` auth divergence** — uses a custom `isAuthorized()` that **allows unauthenticated calls when `NODE_ENV !== "production"`**, instead of the shared `authorizeCron()`. Inconsistent and a potential staging exposure. (`app/api/cron/signals/route.ts`)
2. **Supabase advisors (live):**
   - `handle_new_user()`, `rls_auto_enable()` are **SECURITY DEFINER and executable by `anon`/`authenticated`** via `/rest/v1/rpc/...` — review/revoke EXECUTE.
   - `touch_updated_at()` has a **mutable `search_path`**.
   - **Leaked-password protection disabled** in Supabase Auth (HaveIBeenPwned check off).
3. **`CRON_SECRET` not in `.env.local`** and not validated in `lib/env.ts` — local cron testing depends on env presence; easy to misconfigure.

**Correctness / data**
4. **`NEXT_PUBLIC_SITE_URL` missing from `.env.local`** — magic-link & email-confirmation redirects fall back to `http://localhost:3000`. In production this must be set in Vercel or auth emails point to localhost. (`app/(auth)/actions.ts`)
5. **Alpha Vantage quota (25/day)** — quota exhaustion returns a `Note`/`Information` payload that is logged but **not surfaced**, so fundamentals can silently go stale. The 25/day ceiling is the app's tightest external constraint.
6. **`regime_snapshots` has no unique `(snapshot_date, snapshot_type)`** — manual + cron generation can create duplicate snapshots for the same day/type.
7. **Yahoo schema validation disabled** in `fetchYahooSeries`/`fetchYahooQuarterlyRevenueGrowth` — tolerates Yahoo field drift but means malformed responses won't be caught by the library.
8. **No request validation** on most API route query/body params (despite `zod` being a dependency) — e.g. `range`/`interval` accepted as free text.
9. **Signal cooldown fallback** uses a calendar-day (7d) approximation for the trading-day (5d) cooldown when `cooled_until` is absent on legacy rows.

**Schema / repo hygiene**
10. **No migrations in the repo** — the entire schema + 3 DB functions live only in Supabase. There's no `supabase/` dir or SQL files; schema is undocumented in-tree.
11. **Hand-written `lib/supabase/types.ts`** — not generated from the DB (a deliberate workaround for the supabase-js `Database` generic producing `never` errors). Risk of drift from actual schema; `net_gross_ratio` is a generated column that must stay read-only in inserts.
12. **`README.md` is default create-next-app boilerplate** (references Geist, wrong setup) — stale/misleading.
13. **Unused boilerplate assets** in `public/` (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`).
14. **`:Zone.Identifier` files** present next to the brief markdowns — WSL download cruft.
15. **No TODO/FIXME markers** found anywhere in source (the debt above is structural, not flagged in comments).

**Notable architecture facts worth capturing in the new CLAUDE.md**
- Middleware is named **`proxy.ts`** (Next 16 rename) — not `middleware.ts`.
- Auth is enforced in **two layers**: `proxy.ts` redirect + `(app)/layout.tsx` `requireUser()`.
- Crons write via **service-role** client (RLS bypass); the UI only ever reads shared tables.
- All timestamps/dates are computed in **America/New_York** (`en-CA` `YYYY-MM-DD`) to stay aligned with the US session regardless of server TZ.
