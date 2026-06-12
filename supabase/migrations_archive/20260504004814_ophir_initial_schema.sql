-- Recovered from supabase_migrations.schema_migrations on 2026-06-11.
-- Original applied 2026-05-04; history entry marked reverted when the
-- post-grant-audit baseline was pulled. Kept for provenance only — do not apply.

-- Ophir initial schema: profiles, invite codes, stocks, fundamentals,
-- technicals, regime snapshots, discovery scans, RLS, and signup trigger.

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

CREATE INDEX stocks_user_idx ON public.stocks(user_id);
CREATE INDEX stocks_ticker_idx ON public.stocks(ticker);

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

CREATE INDEX regime_snapshots_date_idx ON public.regime_snapshots(snapshot_date DESC);

CREATE TABLE public.discovery_scans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_date date NOT NULL,
  scan_mode text NOT NULL CHECK (scan_mode IN ('reversal', 'trend')),
  results jsonb NOT NULL,
  narrative text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX discovery_scans_date_idx ON public.discovery_scans(scan_date DESC);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_fundamentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_technicals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regime_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_scans ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "users_own_profile" ON public.profiles
  FOR ALL TO authenticated USING (auth.uid() = id);

-- Stocks
CREATE POLICY "users_own_stocks" ON public.stocks
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Fundamentals + technicals (shared market data)
CREATE POLICY "auth_read_fundamentals" ON public.stock_fundamentals
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_write_fundamentals" ON public.stock_fundamentals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "auth_read_technicals" ON public.stock_technicals
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_write_technicals" ON public.stock_technicals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Regime snapshots (shared)
CREATE POLICY "auth_read_regime" ON public.regime_snapshots
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_write_regime" ON public.regime_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Discovery scans (shared)
CREATE POLICY "auth_read_discovery" ON public.discovery_scans
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_write_discovery" ON public.discovery_scans
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Invite codes
CREATE POLICY "auth_read_own_invites" ON public.invite_codes
  FOR SELECT TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "auth_insert_invites" ON public.invite_codes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Keep stocks.updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stocks_touch_updated_at
  BEFORE UPDATE ON public.stocks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
