-- Follow-up to the 2026-06-11 grant hardening (AUDIT-RLS.md §3): strip the PG17
-- MAINTAIN privilege from the API roles. It was invisible to
-- information_schema.role_table_grants (only in pg_class.relacl), so the original
-- audit missed it. After this, anon holds no privileges on any table and
-- authenticated holds SELECT on shared tables + SELECT/INSERT/UPDATE/DELETE on
-- profiles/stocks/invite_codes only.

REVOKE MAINTAIN ON TABLE
  public.profiles, public.invite_codes, public.stocks,
  public.stock_fundamentals, public.stock_technicals, public.daily_technicals,
  public.signals, public.regime_snapshots, public.discovery_scans
FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE MAINTAIN ON TABLES FROM anon, authenticated;
