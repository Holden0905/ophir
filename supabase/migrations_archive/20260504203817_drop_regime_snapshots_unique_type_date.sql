-- Recovered from supabase_migrations.schema_migrations on 2026-06-11.
-- Original applied 2026-05-04; history entry marked reverted when the
-- post-grant-audit baseline was pulled. Kept for provenance only — do not apply.

ALTER TABLE regime_snapshots DROP CONSTRAINT IF EXISTS regime_snapshots_snapshot_type_snapshot_date_key;
