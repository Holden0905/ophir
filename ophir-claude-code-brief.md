# Ophir — Claude Code Master Build Brief

*Drop this into Claude Code after completing the one-time manual setup. This is the autonomous build instruction set.*

---

## Context

You are building **Ophir** — a personal market intelligence PWA for a swing trader. This is a greenfield project. There is no existing codebase. Build everything from scratch with full autonomy. Do not ask for permission on implementation decisions — make the best technical choice and proceed.

When you encounter errors, fix them and continue. Run `npm run build` after major feature completions to catch TypeScript errors early. Commit after each logical unit of work.

---

## One-Time Manual Setup (Done by Human Before Running This Brief)

These are already completed before you receive this prompt:
- [ ] New Supabase project created, URL and anon key available in `.env.local`
- [ ] Supabase MCP connected to Claude Code
- [ ] Vercel project initialized and connected to GitHub repo
- [ ] API keys in `.env.local`: `ANTHROPIC_API_KEY`, `ALPHA_VANTAGE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Next.js project initialized: `npx create-next-app@latest ophir --typescript --tailwind --app --no-src-dir`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14+ App Router |
| Language | TypeScript |
| Styling | Tailwind CSS — custom design system, minimal shadcn |
| UI Components | shadcn/ui for auth forms and modals only |
| Financial Charts | TradingView Lightweight Charts (`lightweight-charts`) |
| Simple Charts | Recharts for sector bars and sparklines |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password + magic link) |
| Deployment | Vercel |
| PWA | `next-pwa` |
| Data — Fundamentals | Alpha Vantage API (cached in Supabase) |
| Data — Price/Technical | `yfinance` via Python microservice OR Yahoo Finance unofficial JSON endpoint |
| Data — Crypto | CoinGecko public API (no key required) |
| Data — VIX | Yahoo Finance `^VIX` symbol |
| Data — Sectors | Yahoo Finance sector ETFs (XLK, XLF, XLE, XLV, XLI, XLY, XLP, XLU, XLB, XLRE, XLC) |
| AI Narrative | Anthropic API (`claude-sonnet-4-20250514`) |

---

## Aesthetic System

Implement this design system globally. Do not use shadcn's default theme for primary UI surfaces.

### Colors (CSS Variables in globals.css)
```css
:root {
  --bg-primary: #0a0a0a;
  --bg-secondary: #111111;
  --bg-card: #141414;
  --bg-elevated: #1a1a1a;
  --border: #222222;
  --border-subtle: #1a1a1a;
  --text-primary: #e8e6e1;
  --text-secondary: #8a8680;
  --text-muted: #4a4845;
  --accent-amber: #f59e0b;
  --accent-amber-dim: #92630a;
  --accent-green: #22c55e;
  --accent-red: #ef4444;
  --accent-blue: #3b82f6;
  --regime-on: #22c55e;
  --regime-off: #ef4444;
  --regime-transition: #f59e0b;
  --regime-choppy: #6b7280;
}
```

### Typography
Install and configure these Google Fonts:
- **IBM Plex Mono** — all numerical data, tickers, percentages, prices
- **Playfair Display** — Claude-written briefs, regime narrative, editorial headings
- **Outfit** — UI labels, nav, buttons, non-data body text

Apply globally:
```css
.font-data { font-family: 'IBM Plex Mono', monospace; }
.font-editorial { font-family: 'Playfair Display', serif; }
.font-ui { font-family: 'Outfit', sans-serif; }
```

### Visual Rules
- Background: `var(--bg-primary)` everywhere. No white surfaces.
- Cards: `var(--bg-card)` with `1px solid var(--border)` border, `4px` border-radius
- Positive values: `var(--accent-green)`
- Negative values: `var(--accent-red)`
- Accent/highlight: `var(--accent-amber)`
- All price and percentage data: IBM Plex Mono
- All Claude-written narrative: Playfair Display
- Subtle grain texture on background (CSS noise overlay at 3% opacity)
- No drop shadows — use border and background contrast instead
- Amber glow on active/selected states: `box-shadow: 0 0 0 1px var(--accent-amber)`

---

## Database Schema

Use Supabase MCP to execute all SQL directly. Do not generate migration files.

```sql
-- Users are managed by Supabase Auth (auth.users)
-- profiles extends auth.users

CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email text NOT NULL,
  display_name text,
  invite_code_used text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.invite_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text UNIQUE NOT NULL,
  created_by uuid REFERENCES public.profiles(id),
  used_by uuid REFERENCES public.profiles(id),
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.stocks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  ticker text NOT NULL,
  company_name text,
  sector text,
  blc_phase integer CHECK (blc_phase BETWEEN 1 AND 6),
  blc_phase_label text,
  is_position boolean DEFAULT false,
  is_interested boolean DEFAULT true,
  is_archived boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, ticker)
);

CREATE TABLE public.stock_fundamentals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker text NOT NULL UNIQUE,
  market_cap numeric,
  net_debt numeric,
  sbc_fcf numeric,
  gross_margin numeric,
  net_margin numeric,
  net_gross_ratio numeric GENERATED ALWAYS AS (
    CASE WHEN gross_margin > 0 THEN net_margin / gross_margin ELSE NULL END
  ) STORED,
  debt_market_cap_ratio numeric,
  qq_revenue_growth numeric,
  yy_revenue_growth numeric,
  last_fetched_at timestamptz,
  data_source text DEFAULT 'alpha_vantage'
);

CREATE TABLE public.stock_technicals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker text NOT NULL UNIQUE,
  current_price numeric,
  price_change_pct numeric,
  ma_50 numeric,
  ema_8 numeric,
  ema_21 numeric,
  price_vs_ma50_pct numeric,
  price_vs_ema8_pct numeric,
  price_vs_ema21_pct numeric,
  rsi_14 numeric,
  volume numeric,
  avg_volume_20d numeric,
  week_52_high numeric,
  week_52_low numeric,
  pct_from_52_high numeric,
  last_fetched_at timestamptz
);

CREATE TABLE public.regime_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_type text NOT NULL CHECK (snapshot_type IN ('premarket', 'eod')),
  snapshot_date date NOT NULL,
  spx_price numeric,
  spx_change_pct numeric,
  spx_vs_ema21_pct numeric,
  spx_trend text,
  qqq_price numeric,
  qqq_change_pct numeric,
  vix_level numeric,
  vix_direction text,
  vix_flag text,
  btc_price numeric,
  btc_change_24h numeric,
  eth_price numeric,
  eth_change_24h numeric,
  sol_price numeric,
  sol_change_24h numeric,
  crypto_regime text,
  sector_data jsonb,
  regime_classification text CHECK (
    regime_classification IN ('risk_on', 'risk_off', 'transitional', 'choppy')
  ),
  narrative text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(snapshot_type, snapshot_date)
);

CREATE TABLE public.discovery_scans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_date date NOT NULL,
  scan_mode text NOT NULL CHECK (scan_mode IN ('reversal', 'trend')),
  results jsonb NOT NULL,
  narrative text,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_fundamentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_technicals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regime_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_scans ENABLE ROW LEVEL SECURITY;

-- Profiles: users see only their own
CREATE POLICY "users_own_profile" ON public.profiles
  FOR ALL TO authenticated USING (auth.uid() = id);

-- Stocks: users see only their own
CREATE POLICY "users_own_stocks" ON public.stocks
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Fundamentals and technicals: all authenticated users can read (shared market data)
CREATE POLICY "auth_read_fundamentals" ON public.stock_fundamentals
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_write_fundamentals" ON public.stock_fundamentals
  FOR ALL TO service_role USING (true);

CREATE POLICY "auth_read_technicals" ON public.stock_technicals
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_write_technicals" ON public.stock_technicals
  FOR ALL TO service_role USING (true);

-- Regime snapshots: all authenticated users read (shared market context)
CREATE POLICY "auth_read_regime" ON public.regime_snapshots
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_write_regime" ON public.regime_snapshots
  FOR ALL TO service_role USING (true);

-- Discovery scans: all authenticated users read
CREATE POLICY "auth_read_discovery" ON public.discovery_scans
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_write_discovery" ON public.discovery_scans
  FOR ALL TO service_role USING (true);

-- Invite codes
CREATE POLICY "auth_read_own_invites" ON public.invite_codes
  FOR SELECT TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "auth_insert_invites" ON public.invite_codes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## Application Structure

```
app/
  (auth)/
    login/page.tsx
    signup/page.tsx
  (app)/
    layout.tsx              # main app shell, nav, auth guard
    dashboard/page.tsx      # Regime Dashboard (default landing)
    matrix/page.tsx         # Research Matrix
    matrix/[ticker]/page.tsx # Stock detail
    discovery/page.tsx      # Discovery Feed
    settings/page.tsx       # User settings, invite codes
  api/
    regime/generate/route.ts      # triggers regime snapshot generation
    stocks/refresh/route.ts       # refreshes fundamentals + technicals
    discovery/scan/route.ts       # runs discovery screen
    data/technicals/route.ts      # fetches price data from Yahoo Finance
    data/crypto/route.ts          # fetches crypto from CoinGecko
    data/fundamentals/route.ts    # fetches from Alpha Vantage
components/
  regime/
    RegimeBadge.tsx         # Risk On/Off/Transitional/Choppy badge
    RegimeNarrative.tsx     # Editorial brief display
    MacroPulse.tsx          # SPX, QQQ, VIX cards
    CryptoBarometer.tsx     # BTC/ETH/SOL mini cards
    SectorRotation.tsx      # Sector heatmap with 5/30 day RS
  matrix/
    StockTable.tsx          # Main sortable stock table
    StockRow.tsx            # Individual row with color coding
    StockDetail.tsx         # Expanded stock view
    TradingViewChart.tsx    # Lightweight Charts wrapper
    BLCPhaseSelector.tsx    # Phase 1-6 selector with descriptions
  discovery/
    DiscoveryFeed.tsx       # Discovery scan results
    ScanNarrative.tsx       # Claude's discovery brief
  shared/
    DataCell.tsx            # Colored numeric cell (green/red)
    SparkLine.tsx           # Mini trend line
    LoadingPulse.tsx        # Amber pulsing skeleton loader
lib/
  supabase/
    client.ts
    server.ts
  data/
    yahoo.ts                # Yahoo Finance fetcher
    alphavantage.ts         # Alpha Vantage fetcher
    coingecko.ts            # CoinGecko fetcher
  ai/
    regime.ts               # Regime narrative generator
    discovery.ts            # Discovery brief generator
  calculations/
    technicals.ts           # EMA, RSI, relative strength calculations
    blc.ts                  # BLC phase inference helpers
```

---

## Feature Specifications

### Auth Flow
1. Login page: email + password, magic link option, Ophir branding
2. Signup page: email, password, optional invite code field
3. If invite code provided: validate against `invite_codes` table, mark as used
4. Auth guard on all `(app)` routes — redirect to login if unauthenticated
5. Profile auto-created by Supabase trigger on signup

### Regime Dashboard (`/dashboard`)

**Layout:** Two-column on desktop, single column on mobile.

**Left column — live data:**
- MacroPulse card: SPX price + daily change + vs 21 EMA, QQQ same, VIX level + direction + flag if >30 or >40
- CryptoBarometer card: BTC/ETH/SOL with 24h change, trend indicator, overall liquidity read
- SectorRotation card: 11 sectors as horizontal bars, colored by 5-day RS vs SPY. Toggle between 5-day and 30-day view. Divergence flags highlighted in amber.

**Right column — narrative:**
- RegimeBadge: large classification badge (Risk On/Off/Transitional/Choppy) with color
- Most recent regime narrative in Playfair Display italic
- Timestamp of last update
- "Generate New Brief" button (calls `/api/regime/generate`)

**Snapshot history:** Last 5 briefs accessible via timeline at bottom. Pre-market and EOD labeled distinctly.

### Research Matrix (`/matrix`)

**Controls bar:** Search/filter input, view toggle (All/Interested/Positions/Earnings Soon), sort column selector, "Add Stock" button.

**Table:** Horizontally scrollable on mobile. Columns:

| Column | Display | Font |
|---|---|---|
| Ticker | Bold, amber on hover | Mono |
| Name | Truncated | UI |
| BLC | Phase number + colored dot | UI |
| MktCap | Formatted ($B) | Mono |
| QQ Rev | Percentage, green if >10% | Mono |
| YY Rev | Percentage, green if >15% | Mono |
| Gross Margin | Percentage, green if >35% | Mono |
| Net Margin | Percentage, green if positive | Mono |
| Net/Gross | Percentage | Mono |
| Debt/MktCap | Ratio, red if >0.3 | Mono |
| vs 50MA | %, green if positive | Mono |
| vs 21 EMA | %, green if positive | Mono |
| Position | Checkbox | — |
| Interested | Star icon | — |

Clicking a row opens the stock detail page.

**Add Stock flow:** Modal with ticker input → auto-fetch company name and initial data → set BLC phase → save.

### Stock Detail (`/matrix/[ticker]`)

- TradingView Lightweight Chart: weekly candles, amber EMA lines (8, 21, 50), volume bars
- Full fundamental card
- BLC Phase selector with Feroldi phase descriptions
- Notes textarea (saves on blur)
- Claude synthesis paragraph (generates on load if stale >24h)
- "Add to positions" / "Remove from watchlist" actions

### Discovery Feed (`/discovery`)

- Mode selector: Reversal Recovery vs Trend Continuation
- "Run Scan" button with amber loading animation
- Scan criteria displayed (collapsible) so user knows what ran
- Results: Claude narrative brief in Playfair Display, then expandable list of flagged tickers
- Each flagged ticker links to its matrix detail page (adds to matrix if not already there)
- Scan history: last 7 scans accessible

### Settings (`/settings`)

- Display name
- Invite code generator: button creates a unique code, shows list of generated codes and their status (used/unused)
- Data refresh: manual trigger for fundamentals refresh
- Account deletion

---

## Data Fetching Logic

### Price and Technical Data (Yahoo Finance)
Fetch via Yahoo Finance's unofficial JSON endpoint. No API key required.
URL pattern: `https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=3mo`

Calculate from raw OHLCV:
- 8 EMA, 21 EMA, 50 SMA: standard exponential/simple moving average
- RSI 14: standard Wilder RSI formula
- Price vs each MA: `((price - ma) / ma) * 100`
- Relative strength vs SPY: compare returns over 5d and 30d periods

For sector ETFs: XLK, XLF, XLE, XLV, XLI, XLY, XLP, XLU, XLB, XLRE, XLC
VIX: symbol `^VIX`
SPX: symbol `^GSPC`
QQQ: symbol `QQQ`

### Fundamental Data (Alpha Vantage)
Endpoint: `OVERVIEW` function for market cap, margins, growth rates.
Cache in `stock_fundamentals` table. Only re-fetch if `last_fetched_at` is >7 days old OR user manually triggers refresh.
Rate limit: 25 calls/day on free tier — batch carefully, prioritize recently-added stocks.

### Crypto Data (CoinGecko)
Free API, no key required.
Endpoint: `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true`

### AI Narrative Generation (Anthropic)

**Regime brief system prompt:**
```
You are Ophir, a personal market intelligence system for a sophisticated swing trader. 
Your voice is that of a senior analyst writing a concise intelligence brief — authoritative, 
specific, no fluff. Use the Feroldi/Stoffel business lifecycle framework and Brian Shannon's 
EMA methodology as context. Reference specific numbers. Never use generic phrases like 
"markets showed mixed signals." Say what actually happened and what it means.
Write in 2-3 tight paragraphs. Editorial prose. No bullet points in the narrative.
```

**Regime brief user prompt (inject live data):**
```
Generate a {snapshot_type} market regime brief for {date}.

MACRO:
- SPX: ${spx_price} ({spx_change_pct}% today), {spx_vs_ema21_pct}% vs 21 EMA
- QQQ: ${qqq_price} ({qqq_change_pct}% today)  
- VIX: {vix_level} ({vix_direction})

CRYPTO:
- BTC: ${btc_price} ({btc_change_24h}% 24h)
- ETH: ${eth_price} ({eth_change_24h}% 24h)
- SOL: ${sol_price} ({sol_change_24h}% 24h)

SECTOR ROTATION (5-day RS vs SPY):
{sector_data_formatted}

Classify the regime as one of: risk_on, risk_off, transitional, choppy.
Return JSON: { "classification": "...", "narrative": "..." }
```

---

## PWA Configuration

Install `next-pwa`. Configure in `next.config.js`:
- App name: "Ophir"
- Short name: "Ophir"
- Theme color: `#f59e0b` (amber)
- Background color: `#0a0a0a`
- Display: standalone
- Start URL: `/dashboard`
- Icons: generate amber "O" on dark background at 192x192 and 512x512

Add install prompt handling — show subtle "Add to Home Screen" prompt on first mobile visit.

---

## BLC Phase Definitions (For UI and Claude Context)

| Phase | Label | Revenue | Gross Profit | Net Profit | Valuation Lens |
|---|---|---|---|---|---|
| 1 | Startup | None/Little | Low/Negative | Negative | P/S |
| 2 | Hyper Growth | Growing Rapidly | Growing Rapidly | Negative/Expanding | P/S |
| 3 | Self Funding | Growing Rapidly | Growing Rapidly | Near Breakeven | P/S → P/E |
| 4 | Operating Leverage | Growing Modestly | Stable | Growing Rapidly | P/E |
| 5 | Capital Return | Growing Slowly | Stable | Growing Slowly | P/E, Dividend |
| 6 | Decline | Declining | Declining | Declining | Avoid |

---

## Discovery Screen Criteria

### Mode 1 — Reversal/Recovery
Universe: S&P 500 + Nasdaq 100 components (static list, update quarterly)
Filters:
- `pct_from_52_high` < -20 (down 20%+ from high)
- `rsi_14` currently 38-48 (was oversold, now recovering — not too early, not too late)
- `price_vs_ema8_pct` > -5 (starting to reclaim short-term EMA)
- Market cap > $2B
- Gross margin > 0 (not a burning house)

### Mode 2 — Trend Continuation
Universe: Same
Filters:
- `qq_revenue_growth` > 0.08 (8%+ Q/Q)
- `yy_revenue_growth` > 0.12 (12%+ Y/Y)
- `gross_margin` > 0.30
- `net_margin` > 0
- `price_vs_ma50_pct` > 0 (above 50 SMA)
- Sector 5-day RS vs SPY > 0

---

## Error Handling Standards

- All API calls wrapped in try/catch with fallback UI states
- Stale data indicator: show `last_fetched_at` timestamp on all data cards, amber warning if >4 hours old
- Rate limit handling: queue Alpha Vantage calls, never exceed 5/minute
- Empty states: meaningful copy, not generic "No data" messages. Use Ophir's voice.
- Loading states: amber pulsing skeleton loaders, not spinners

---

## Deployment

- Push to GitHub main branch triggers Vercel deployment automatically
- Environment variables set in Vercel dashboard (mirror `.env.local`)
- Vercel edge functions for API routes
- No server-side cron — data refresh triggered manually or on page load if stale

---

## Do Not

- Do not use purple gradients or light backgrounds anywhere
- Do not use Inter or Roboto fonts
- Do not use generic shadcn card styling for primary UI surfaces
- Do not add features not specified here without flagging them
- Do not use localStorage — all state in Supabase or React state
- Do not expose the Supabase service role key to the client

---

## Build Order

1. Database schema (via Supabase MCP)
2. Auth flow (login, signup, invite codes)
3. App shell (layout, navigation, auth guard)
4. Design system (CSS variables, fonts, base components)
5. Regime Dashboard — data fetching first, then UI, then AI narrative
6. Research Matrix — table, add stock flow, data refresh
7. Stock Detail — TradingView chart, fundamentals, BLC selector
8. Discovery Feed — screen logic, AI brief
9. Settings page
10. PWA configuration
11. Polish: loading states, error handling, empty states
12. Build check (`npm run build`), fix all TypeScript errors
13. Deploy to Vercel

---

*Build Ophir. The source of Solomon's gold.*
