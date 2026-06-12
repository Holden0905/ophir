# AUDIT-RLS.md

RLS and grant audit of the live Supabase project (ufedejzfpteecvalzwtm), pulled via the Supabase MCP server on 2026-06-10. Sources: `pg_policies`, `information_schema.role_table_grants`, `information_schema.columns`, and the Supabase security advisor. Compared against the assumptions in §4 of AUDIT-RECON.md. **Nothing was changed — report only.**

All 9 tables have RLS enabled. Row counts at audit time: profiles 1, invite_codes 0, stocks 20, stock_fundamentals 20, stock_technicals 20, regime_snapshots 60, discovery_scans 51, daily_technicals 479, signals 958.

---

## 1. Per-table: what the policies actually allow

### User-owned tables

**profiles**
- `users_own_profile` — FOR ALL, role `authenticated`, USING `auth.uid() = id`, no WITH CHECK (Postgres falls back to the USING expression for new rows).
- Net effect: a signed-in user can SELECT/INSERT/UPDATE/DELETE **only their own row** — but that includes updating their own `email` and `invite_code_used` columns directly via PostgREST, and deleting their own profile row out from under the `auth.users` record. The app never does this; the API allows it.
- `anon`: no policy → no row access.

**stocks**
- `users_own_stocks` — FOR ALL, role `authenticated`, USING `auth.uid() = user_id`, WITH CHECK falls back to USING.
- Net effect: full CRUD on own rows only. Matches code exactly (`matrix/actions.ts`).
- `anon`: no policy → no row access.

**invite_codes**
- `auth_read_own_invites` — SELECT where `auth.uid() = created_by`.
- `auth_insert_invites` — INSERT with check `auth.uid() = created_by`.
- **No UPDATE or DELETE policy for `authenticated`** — marking a code as used is service-role-only, which matches the signup flow (`app/(auth)/actions.ts` uses `createServiceClient()` both to validate and to redeem).
- Net effect: users can mint and view their own codes, never redeem or revoke them client-side. One soft spot: nothing caps how many codes a user can insert (`generateInviteCode()` is the only UI path, but the API accepts unlimited inserts).
- `anon`: no policy → cannot enumerate codes. Correct, since validation happens server-side pre-auth via service role.

### Shared market-data tables (stock_fundamentals, stock_technicals, daily_technicals, signals, regime_snapshots, discovery_scans)

All six follow the identical pattern:
- `auth_read_*` — SELECT, role `authenticated`, USING `true` (any signed-in user reads everything).
- `service_write_*` — FOR ALL, role `service_role`, USING/WITH CHECK `true`.
- **No INSERT/UPDATE/DELETE policy for `authenticated`** → RLS blocks all client-side writes.
- `anon`: no policy → no row access.

---

## 2. Comparison against AUDIT-RECON.md §4 assumptions

| §4 assumption | Verdict |
|---|---|
| Shared market tables written exclusively by service-role paths | **Confirmed at the policy level.** Not confirmed at the GRANT level — see §3. |
| `stocks`/`profiles` scoped by `auth.uid()` via RLS | **Confirmed.** |
| `invite_codes` relies on RLS + service-role for redemption | **Confirmed**, and stricter than assumed: authenticated users have no UPDATE path at all. |
| RLS policies "not in the repo and cannot be verified from code" | Resolved — this document is now the record. They still live only in Supabase (no migrations folder). |
| `regime_snapshots` plain-insert, duplicates possible | **Confirmed:** no UNIQUE constraint on (snapshot_date, snapshot_type) exists in the live schema. |
| `net_gross_ratio` is a GENERATED column | **Confirmed in live schema:** `GENERATED ALWAYS AS (CASE WHEN gross_margin > 0 THEN net_margin / gross_margin END)`. |

No table allows the anon key to **read** anything, and no table allows authenticated users to write outside their own rows. The row-level model matches the recon report's assumptions.

---

## 3. Where access exceeds intent — the GRANT layer

RLS is only half the picture. The table GRANTs (Supabase's defaults, never tightened) are wider than the policies:

**`anon` holds `REFERENCES, TRIGGER, TRUNCATE` on all 9 tables.**
`TRUNCATE` is the one that matters: **RLS does not apply to TRUNCATE.** It is a table-level privilege, and a role holding it can empty the table regardless of policies. Mitigating factor: PostgREST does not expose TRUNCATE as an HTTP operation, so there is no known direct path from the anon key over REST today. But the grant serves zero purpose, and any future surface that executes SQL as `anon` (an RPC function, an edge function bug) inherits the ability to wipe every table. `anon` correctly lacks SELECT/INSERT/UPDATE/DELETE — someone revoked the DML grants but left these three behind.

**`authenticated` holds full DML + `TRUNCATE` on all 9 tables.**
- For the six shared tables, the only thing stopping a signed-in user from inserting/updating/deleting market data is the *absence* of an RLS write policy — a single layer of defense. The conventional belt-and-suspenders is to also revoke INSERT/UPDATE/DELETE from `authenticated` on tables it should never write.
- `TRUNCATE` again bypasses RLS entirely. Same PostgREST mitigation, same caveat.

**Recommended (when you're ready to fix — not done):** revoke `TRUNCATE, REFERENCES, TRIGGER` from `anon` and `authenticated` on all tables; revoke `INSERT, UPDATE, DELETE` from `authenticated` on the six shared tables. Note CLAUDE.md's warning that RLS needs underlying GRANTs — keep `SELECT` for `authenticated` everywhere and full DML on `profiles`/`stocks`/`invite_codes` (SELECT+INSERT only would also work for invite_codes).

### Supabase security advisor (current warnings)

1. `public.handle_new_user()` — SECURITY DEFINER, **executable by `anon` and `authenticated` via `/rest/v1/rpc/handle_new_user`**. As a trigger function it will error without trigger context when called directly, but EXECUTE should be revoked. ([lint 0028](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable))
2. `public.rls_auto_enable()` — same exposure, SECURITY DEFINER callable by `anon`/`authenticated` via RPC. ([lint 0028](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable))
3. `public.touch_updated_at()` — mutable `search_path`. ([lint 0011](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable))
4. Leaked-password protection (HaveIBeenPwned check) is disabled in Auth settings. ([docs](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection))

Items 1–3 match Known Issues #9 and #12 in CLAUDE.md; item 4 is new.

---

## 4. Type drift: hand-written `types.ts` vs generated types

Generated output saved (unimported) at `lib/supabase/types.generated.ts` for side-by-side reference. The hand-written file was **not** replaced: app code imports its named interfaces (`Profile`, `Stock`, `Signal`, `SignalState`, …) and narrowed unions, which the generated file doesn't provide, and the supabase clients are instantiated without the `Database` generic anyway (it previously produced `never`-typed results).

**Structural drift found:**

1. **Nullability — the live schema is looser than the hand-written types.** Verified via `information_schema.columns`:
   - `created_at` is nullable (with `now()` default) on `profiles`, `invite_codes`, `stocks`, `regime_snapshots`, `discovery_scans` — hand-written types declare it non-null `string` on all five.
   - `stocks.updated_at` nullable — typed non-null.
   - `stocks.is_position`, `is_interested`, `is_archived` are **nullable booleans** (defaults false/true/false) — hand-written types say plain `boolean`. UI code that branches on these would treat an explicit-null row as falsy by accident rather than by contract. Low practical risk (defaults fill values; nothing writes nulls today), but the types overpromise.
   - `stock_fundamentals.data_source` nullable (default `'alpha_vantage'`) — typed non-null `string`.
2. **`net_gross_ratio` in Insert/Update.** The generated types *include* it as writable in Insert/Update — the MCP/CLI generator does not exclude GENERATED columns, even though the live column is `GENERATED ALWAYS` and any INSERT/UPDATE naming it will be rejected by Postgres. The hand-written types correctly omit it from Insert/Update. **On this point the hand-written file is safer than the generated one** — a naive "replace with generated" would reintroduce the footgun that CLAUDE.md rule 8 warns about.
3. **Missing FK relationships.** Hand-written `Relationships: []` everywhere; live schema has `invite_codes.created_by → profiles.id`, `invite_codes.used_by → profiles.id`, `stocks.user_id → profiles.id`. Only matters for PostgREST embedded joins, which the code doesn't use.
4. **Deliberate narrowing (not drift):** hand-written types narrow `snapshot_type`, `scan_mode`, `setup_type`, `state`, `regime_classification` to string unions and `sector_data`/`results`/`conviction_grades` to structured types where the DB has plain `text`/`jsonb`. The DB has **no CHECK constraints backing these unions** (no enums exist), so the narrowing is a compile-time fiction the runtime can't enforce — acceptable, but worth knowing.
5. **`regime_snapshots` Insert strictness (hand-written quirk):** `Omit<RegimeSnapshot, "id" | "created_at">` makes every nullable column *required* at insert time, whereas the live schema only requires `snapshot_date` and `snapshot_type`. Stricter than reality; harmless.
6. Columns match 1:1 on every table otherwise — no missing or phantom columns in either direction. `daily_technicals` and `signals` are exact matches including non-null `created_at`.

**Net:** the hand-written file is column-accurate, intentionally stricter in places, and wrong only about nullability on 9 columns across 6 tables.

---

## 5. CLI status (context)

The Supabase CLI is not installed and there is no `supabase/` folder or stored login — the project has never been linked. This audit used the already-configured MCP server instead. To wire up the CLI for `supabase db pull` (which would finally version the schema + policies as migration files):

```bash
npm i -D supabase
# interactive — run as: ! npx supabase login
npx supabase link --project-ref ufedejzfpteecvalzwtm
npx supabase db pull   # writes supabase/migrations/<ts>_remote_schema.sql
```

---

*Report only — no grants revoked, no policies altered, no types replaced.*
