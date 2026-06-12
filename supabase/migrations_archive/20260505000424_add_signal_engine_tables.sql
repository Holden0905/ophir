-- Recovered from supabase_migrations.schema_migrations on 2026-06-11.
-- Original applied 2026-05-05; history entry marked reverted when the
-- post-grant-audit baseline was pulled. Kept for provenance only — do not apply.

-- Daily per-ticker technical-indicator snapshots used by the signal engine.
-- One row per ticker per trading day (NY calendar). Independent of
-- stock_technicals (which holds a single rolling-current row per ticker for
-- the Matrix UI); this table accumulates history for state-machine
-- comparisons and lookback windows (52w high, RSI min, etc.).
CREATE TABLE IF NOT EXISTS public.daily_technicals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL,
  date date NOT NULL,
  close numeric,
  volume bigint,
  ema_5 numeric,
  ema_8 numeric,
  ema_21 numeric,
  sma_50 numeric,
  rsi_14 numeric,
  avg_volume_20 bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_technicals_ticker_date_key UNIQUE (ticker, date)
);

CREATE INDEX IF NOT EXISTS daily_technicals_ticker_idx
  ON public.daily_technicals (ticker);
CREATE INDEX IF NOT EXISTS daily_technicals_date_idx
  ON public.daily_technicals (date);
CREATE INDEX IF NOT EXISTS daily_technicals_ticker_date_desc_idx
  ON public.daily_technicals (ticker, date DESC);

ALTER TABLE public.daily_technicals ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_read_daily_technicals
  ON public.daily_technicals
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY service_write_daily_technicals
  ON public.daily_technicals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- One row per (ticker, setup_type, date). Records the state of a setup on a
-- given trading day plus any conviction grades that apply. Cooldown is
-- enforced via the cooled_until column populated on triggered_today rows.
CREATE TABLE IF NOT EXISTS public.signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL,
  date date NOT NULL,
  setup_type text NOT NULL CHECK (setup_type IN ('trend_continuation','reversal_recovery')),
  state text NOT NULL CHECK (state IN ('triggered_today','qualifies','none')),
  conviction_grades jsonb NOT NULL DEFAULT '[]'::jsonb,
  triggered_at timestamptz,
  cooled_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signals_ticker_date_setup_key UNIQUE (ticker, date, setup_type)
);

CREATE INDEX IF NOT EXISTS signals_ticker_idx ON public.signals (ticker);
CREATE INDEX IF NOT EXISTS signals_date_idx ON public.signals (date);
CREATE INDEX IF NOT EXISTS signals_ticker_setup_date_desc_idx
  ON public.signals (ticker, setup_type, date DESC);

ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_read_signals
  ON public.signals
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY service_write_signals
  ON public.signals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

