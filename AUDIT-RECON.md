# AUDIT-RECON.md

First-pass reconnaissance audit of the `ophir` repository. Findings are based on reading the code only — not CLAUDE.md, AGENTS.md, docs/, or the product briefs. No code was changed.

Audit date: 2026-06-10.

---

## 1. What this app does (from code)

A single-user (invite-gated) market intelligence PWA for swing trading. Concretely, the code implements:

- **Watchlist ("Matrix")** — per-user `stocks` rows joined against shared `stock_fundamentals` / `stock_technicals` / `signals` tables, rendered as a table with 60-second live-quote polling from Yahoo Finance (`app/(app)/matrix/`).
- **Daily technical signal engine** — two setup evaluators in `lib/signals/rules.ts` (trend continuation and reversal/recovery) driven by EMA-5/8/21, SMA-50, RSI-14, and 52-week-high math computed in `lib/calculations/technicals.ts`. A state machine (`triggered_today` → `qualifies` → `none`) with a cooldown date, persisted to a `signals` table by `lib/signals/evaluate.ts`, surfaced on `/trading`.
- **Market regime classification** — `lib/regime/build.ts` assembles SPX/QQQ/VIX + BTC/ETH/SOL + 11 sector-ETF relative strength into a snapshot classified as risk_on / risk_off / transitional / choppy, with an AI-written narrative brief, stored in `regime_snapshots` and shown on `/dashboard`.
- **Discovery screener** — `lib/discovery/scan.ts` scans a hardcoded 40-ticker universe in "trend" or "reversal" mode and stores results + AI narrative in `discovery_scans`.
- **AI narratives** — Anthropic SDK (`lib/ai/`) generates regime briefs, discovery briefs, and on-demand per-ticker trade analysis (`/api/stocks/[ticker]/analyze`).
- **Scheduled pipeline** — 5 weekday Vercel crons (`vercel.json`): premarket regime 13:00 UTC, refresh-stocks 22:00, signals 22:15, EOD regime 22:30, discovery 22:45.
- **PWA shell** — `app/manifest.ts` + minimal `public/sw.js` (caches `/`, `/dashboard`; never caches `/api/*` or `/auth/*`).

Data sources actually called in code: Yahoo Finance (`yahoo-finance2`), Alpha Vantage, FMP, CoinGecko, Anthropic.

---

## 2. Stack inventory

Framework: **Next.js 16.2.4** (App Router), **React 19.2.4**, **TypeScript 5**, **Tailwind CSS v4** (via `@tailwindcss/postcss`, no component library). Package manager: npm.

### dependencies

| Package | Version | Imported? | Where |
|---|---|---|---|
| `@anthropic-ai/sdk` | ^0.92.0 | ✅ | `lib/ai/anthropic.ts` (value), `lib/ai/{regime,discovery,analyze}.ts` (type-only) |
| `@supabase/ssr` | ^0.10.2 | ✅ | `lib/supabase/server.ts`, `lib/supabase/client.ts`, `proxy.ts` |
| `@supabase/supabase-js` | ^2.105.1 | ✅ | `lib/supabase/server.ts` (service-role client) |
| `lightweight-charts` | ^5.2.0 | ✅ (dynamic) | `await import()` in `components/matrix/TradingViewChart.tsx:27` and `components/signals/SignalChartPanel.tsx:66` — no static import, so a plain `from "..."` grep misses it |
| `next` | 16.2.4 | ✅ | everywhere |
| `react` / `react-dom` | 19.2.4 | ✅ | everywhere |
| `recharts` | ^3.8.1 | ❌ **never imported** | Dead dependency. All charting is lightweight-charts; sparklines are hand-rolled SVG (`components/shared/SparkLine.tsx`) |
| `yahoo-finance2` | ^3.14.0 | ✅ | `lib/data/yahoo.ts` only |
| `zod` | ^4.4.2 | ❌ **never imported** | Dead dependency. No request-body/query validation anywhere uses it |

### devDependencies

| Package | Used? | Notes |
|---|---|---|
| `@tailwindcss/postcss`, `tailwindcss` | ✅ | wired via `postcss.config.mjs` + `app/globals.css` |
| `@types/node`, `@types/react`, `@types/react-dom`, `typescript` | ✅ | |
| `eslint`, `eslint-config-next` | ✅ | `eslint.config.mjs` |

**Net:** 2 of 10 runtime dependencies (`recharts`, `zod`) are installed but unreferenced.

---

## 3. Route / page map

### Middleware

`proxy.ts` — this is Next.js 16's middleware convention (Next 16 renamed `middleware.ts` → `proxy.ts`; confirmed in the bundled Next docs, `node_modules/next/dist/docs/.../16-proxy.md`). Matcher excludes **all** of `/api/*`, `_next` assets, static files, `manifest.webmanifest`, `sw.js`. For matched paths: refreshes the Supabase session, redirects unauthenticated users to `/login?next=...` (public allowlist: `/login`, `/signup`, `/auth/*`, `/api/health`, icon/manifest/sw/favicon), and redirects authenticated users away from `/login`/`/signup` to `/dashboard`.

### Pages

| Path | Type | Renders |
|---|---|---|
| `/` | server | redirect → `/dashboard` (`app/page.tsx`) |
| `/login` | server → `LoginForm` (client) | password + magic-link modes |
| `/signup` | server → `SignupForm` (client) | email/password with invite code |
| `/auth/callback` | route handler (GET) | `exchangeCodeForSession`, redirect to `?next` or `/dashboard` |
| `/dashboard` | server → `DashboardLive` (client) | last 60 `regime_snapshots`; macro pulse, crypto barometer, sector rotation, brief history; 60s quote polling, paused outside market hours for equities |
| `/matrix` | server → `MatrixClient` (client) | user's non-archived `stocks` + fundamentals/technicals/today's signals/daily bars; 60s polling |
| `/matrix/[ticker]` | server | chart, fundamentals, BLC phase selector, notes, position toggle, AI analyze panel. Falls back to a live-Yahoo "preview mode" with Add-to-Matrix CTA when ticker isn't in the user's matrix; 404 only with no preview data and no nav context |
| `/trading` | server → `TradingClient` (client) | triggered / qualifying / recent / cooled signal sections; side panel with chart + condition checklist |
| `/discovery` | server → `DiscoveryClient` (client) | last 7 `discovery_scans`, manual scan trigger, prev/next ticker cycling into preview mode |
| `/settings` | server → `SettingsClient` (client) | profile, invite codes, health dashboard (60s polling), delete account |
| `/about` | server (static) | editorial framework documentation |

All `(app)` pages declare `dynamic = "force-dynamic"` and sit behind `app/(app)/layout.tsx` → `requireUser()`.

### Server actions

- `app/(auth)/actions.ts`: `login`, `signup` (invite-code validation via service-role client), `signInWithMagicLink`, `signout`
- `app/(app)/matrix/actions.ts`: `addStock`, `updateStock`, `removeStock`, `addStockByTicker` (the add paths fire best-effort background `refreshTechnicals`/`refreshFundamentals`)
- `app/(app)/settings/actions.ts`: `updateDisplayName`, `generateInviteCode`, `deleteAccount` (uses `svc.auth.admin.deleteUser`)

### API routes

| Route | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/health` | GET | **none (public)** | feed-freshness report via service-role reads |
| `/api/stocks/quotes` | GET | `requireUser()` | live Yahoo quotes, ≤100 tickers |
| `/api/stocks/refresh` | POST | `requireUser()` | batch technicals/fundamentals refresh |
| `/api/stocks/[ticker]/analyze` | POST | `requireUser()` | Claude trade-analysis narrative |
| `/api/crypto/quotes` | GET | `requireUser()` | CoinGecko live quotes + crypto regime |
| `/api/data/technicals` | GET | `requireUser()` | historical Yahoo OHLCV |
| `/api/data/fundamentals` | POST | `requireUser()` | single-ticker fundamentals refresh |
| `/api/data/crypto` | GET | `requireUser()` | CoinGecko BTC/ETH/SOL + regime |
| `/api/discovery/scan` | POST | `requireUser()` | user-triggered discovery scan |
| `/api/regime/generate` | POST | `requireUser()` | manual regime snapshot (type inferred from ET time if omitted) |
| `/api/cron/regime` | GET/POST | `authorizeCron()` | manual/fallback regime run (`?type=` param) |
| `/api/cron/regime-premarket` | GET/POST | `authorizeCron()` | hardcoded premarket run |
| `/api/cron/regime-eod` | GET/POST | `authorizeCron()` | hardcoded EOD run |
| `/api/cron/refresh-stocks` | GET/POST | `authorizeCron()` | refresh all active tickers (fundamentals behind 7-day TTL) |
| `/api/cron/signals` | GET | **custom inline check** | daily signal job; see §5 |
| `/api/cron/discovery` | GET/POST | `authorizeCron()` | trend + reversal scans |

`regime-premarket` and `regime-eod` are near-identical thin wrappers around `runRegimeBrief()`; in-code comments explain Vercel Hobby deduplicates crons by base path, forcing separate route files.

---

## 4. Database surface

All access goes through two factories in `lib/supabase/server.ts`: `createClient()` (RLS, anon key + cookies) and `createServiceClient()` (service-role key, bypasses RLS, `persistSession: false`), plus a browser client in `lib/supabase/client.ts`. **No `.rpc()` calls, no raw SQL, no migrations folder** — schema exists only in the hosted Supabase project. Types in `lib/supabase/types.ts` are hand-written (header comment says to regenerate with the CLI "once the CLI is wired up"); all 9 tables referenced in code are typed, no orphans either direction.

| Table | Read by | Written by |
|---|---|---|
| `profiles` | `lib/auth/dal.ts:35` (RLS), `app/(app)/settings/page.tsx` (RLS) | `app/(auth)/actions.ts:75` (service-role: `invite_code_used`), `settings/actions.ts:17` (RLS: display_name) |
| `invite_codes` | `app/(auth)/actions.ts:42` (service-role, pre-signup validation), settings page (RLS) | signup mark-used (service-role), `settings/actions.ts:39` insert (RLS) |
| `stocks` | matrix page, `lib/signals/queries.ts:64,197` (RLS); `cron/refresh-stocks/route.ts:20`, `lib/signals/evaluate.ts:340` (service-role) | `matrix/actions.ts` upsert/update/delete (RLS); `lib/stocks/refresh.ts:225` company_name/sector backfill (service-role) |
| `stock_fundamentals` | matrix page, `matrix/[ticker]/page.tsx`, `lib/analyze/inputs.ts` (RLS); `lib/stocks/refresh.ts:107` TTL check, `lib/discovery/scan.ts:130` (service-role) | `lib/stocks/refresh.ts:209` upsert on `ticker` (service-role) |
| `stock_technicals` | matrix page, `lib/signals/queries.ts:116`, ticker detail, analyze inputs (RLS) | `lib/stocks/refresh.ts:84` upsert on `ticker` (service-role) |
| `daily_technicals` | matrix page, `lib/signals/queries.ts:112` (RLS) | `lib/signals/evaluate.ts:143` upsert on `ticker,date` (service-role) |
| `signals` | matrix page, `lib/signals/queries.ts` (RLS); `lib/signals/evaluate.ts:97,117`, `api/health` (service-role) | `lib/signals/evaluate.ts:170` upsert on `ticker,date,setup_type` (service-role) |
| `regime_snapshots` | dashboard (60 rows), `lib/signals/queries.ts:58`, analyze inputs, `api/regime/generate` (RLS); `lib/signals/evaluate.ts:76`, `api/health` (service-role) | `lib/cron/regimeBrief.ts:19` **insert** — no upsert/unique constraint, snapshots accumulate; duplicates per (date,type) are possible |
| `discovery_scans` | discovery page (RLS) | `lib/discovery/scan.ts:182` insert (service-role) |

Pattern: shared market-data tables are written exclusively by service-role code paths and read through the RLS client; user-owned tables (`stocks`, `profiles`, `invite_codes`) rely on RLS scoping. RLS policies themselves are not in the repo and cannot be verified from code. `auth.users` is touched only via `supabase.auth.*` APIs (including `auth.admin.deleteUser` in settings).

---

## 5. Auth model

**Sessions:** Supabase SSR cookie-based sessions. `proxy.ts` refreshes the session (`auth.getUser()`) on every matched request and rewrites cookies.

**Two protection layers for pages:**
1. `proxy.ts` redirect (unauthenticated → `/login?next=...`)
2. `app/(app)/layout.tsx` → `requireUser()` (`lib/auth/dal.ts:12`, `cache()`-wrapped, redirects to `/login` if no user)

**API routes are entirely outside the middleware** (excluded by the matcher), so each handler self-enforces:
- 9 user-facing routes call `requireUser()`
- 5 cron routes call shared `authorizeCron()` (`lib/cron/auth.ts`): requires `Authorization: Bearer ${CRON_SECRET}`; returns **500 if CRON_SECRET is unset**, 401 on mismatch
- `/api/cron/signals` uses its **own inline `isAuthorized()`** which diverges: if `CRON_SECRET` is unset it allows **unauthenticated access whenever `NODE_ENV !== "production"`** (`app/api/cron/signals/route.ts:12-21`)
- `/api/health` is deliberately public and reads via service-role

**Login flows:** password (`signInWithPassword`), magic link (`signInWithOtp` → `/auth/callback` code exchange), signup gated by optional invite code validated against `invite_codes` via the service-role client (unused codes only; **no expiry mechanism on codes**). Password minimum 8 chars enforced client- and server-side. Magic-link redirect base falls back to `http://localhost:3000` when `NEXT_PUBLIC_SITE_URL` is unset (`app/(auth)/actions.ts:56,102`).

**Gaps observed:** no rate limiting on login/signup/magic-link sends; no password reset flow; no state/CSRF check around the callback code exchange beyond Supabase's cookie handling; invite codes never expire.

---

## 6. Red flags noticed in passing

**Dead dependencies**
- `recharts` and `zod` in package.json, imported nowhere (§2). zod's absence is notable: API routes accept query/body params as free text with manual parsing, no schema validation.

**Repo hygiene**
- `README.md` is untouched create-next-app boilerplate.
- Two `*:Zone.Identifier` files (WSL/NTFS metadata cruft) are **committed to git**: `ophir-claude-code-brief.md:Zone.Identifier`, `ophir-product-brief.md:Zone.Identifier`.
- Unused create-next-app SVGs in `public/`: `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`.
- `next.config.ts` is an empty boilerplate config.
- No migrations folder; schema and RLS policies are unversioned (live only in Supabase).

**Env handling**
- No `.env.example`. `.env.local` exists locally (6 vars) and is correctly not committed.
- `lib/env.ts` validates 6 vars, but two more are read raw and unvalidated: `CRON_SECRET` (`lib/cron/auth.ts:10`, `api/cron/signals/route.ts:13`) and `NEXT_PUBLIC_SITE_URL` (`app/(auth)/actions.ts:56,102`, silently falls back to localhost — broken magic links in prod if unset).
- `lib/supabase/client.ts` and `proxy.ts` read Supabase creds from `process.env` directly, bypassing `lib/env.ts`.

**Auth inconsistencies**
- `/api/cron/signals` custom auth diverges from `authorizeCron()` (allows unauthenticated in non-production when secret unset) — one-off behavior the other five cron routes don't share.

**Data integrity**
- `regime_snapshots` is plain-inserted with no unique constraint on (snapshot_date, snapshot_type) — duplicate snapshots are possible and the dashboard reads "latest 60", so duplicates surface in the UI history.
- `validateResult: false` on three `yahoo-finance2` calls (`lib/data/yahoo.ts:105,180,221`) — malformed Yahoo responses pass through to downstream null checks.
- `lib/data/alphavantage.ts:37` swallows rejections in its rate-limit chain (`avChain = next.catch(() => {})`) — commented as intentional, but combined with the 25-call/day Alpha Vantage cap, quota exhaustion degrades silently to stale fundamentals.

**Silent catches** (each carries an explanatory comment; listed for completeness)
- `DashboardLive.tsx:97,124`, `MatrixClient.tsx:83` — polling failures fall back to server-rendered values, no user-visible error
- `matrix/actions.ts:44,109` — background refresh failures non-fatal
- `InstallPrompt.tsx:22` — SW registration failure ignored

**Duplication**
- `components/matrix/TradingViewChart.tsx` vs `components/signals/SignalChartPanel.tsx`: two parallel lightweight-charts implementations with duplicated chart setup, identical `Bar` interfaces, and inconsistent color handling (inline hex literals vs named constants).
- `api/cron/regime-premarket` / `regime-eod` / `regime` are three wrappers around one function — justified in comments by Vercel Hobby cron dedup, but it's still three files to keep in sync.

**Hardcoded values**
- Claude model pinned: `CLAUDE_MODEL = "claude-sonnet-4-6"` (`lib/ai/anthropic.ts:8`).
- Signal thresholds inline in `lib/signals/rules.ts` (RSI 40/70 and 35/40 bands, 1.2× volume multiple at line 23, 0.8 × 52-week-high at line 150, 10-day lookbacks at lines 49/62, 252-bar year at line 39).
- 40-ticker `DISCOVERY_UNIVERSE` and macro symbol list hardcoded in `lib/data/symbols.ts`.
- Three independent `60_000` ms poll constants (`DashboardLive.tsx:12`, `MatrixClient.tsx:35`, `HealthPanel.tsx:7`).

**Misc**
- `lib/analyze/inputs.ts:446`: `export const _BENCHMARK = BENCHMARK_SYMBOL` — export that exists only to keep an import alive for a planned feature.
- One eslint disable (`AnalyzeTradePanel.tsx:68`, `react-hooks/set-state-in-effect`) with justification.
- No TODO/FIXME/HACK comments and no commented-out code blocks found anywhere — unusually clean in that one respect.
- Hand-written Supabase types (`lib/supabase/types.ts`) risk silent drift from the live schema since nothing regenerates or checks them.

---

*End of reconnaissance. Nothing was modified; this file is the only addition.*
