-- Recovered from supabase_migrations.schema_migrations on 2026-06-11.
-- Original applied 2026-05-04; history entry marked reverted when the
-- post-grant-audit baseline was pulled. Kept for provenance only — do not apply.

-- Grant table-level privileges to Supabase's three default roles.
-- Without these, RLS policies are inert because the underlying GRANT is missing.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- service_role: full access; combined with BYPASSRLS this is the trusted-server lane.
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- authenticated: row-level read/write, gated by RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- anon: only what RLS explicitly opens up (currently nothing — leave grants empty).

-- Make this stick for any tables created later in this schema.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
