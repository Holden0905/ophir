-- Baseline schema pulled 2026-06-11 (UTC) after the GRANT-layer hardening from AUDIT-RLS.md §3.
-- Captures live state: RLS policies, tightened grants (anon/authenticated), pinned search_path.
-- Pre-existing migration history (May 2026, applied via MCP) recovered in supabase/migrations_archive/.

--
-- PostgreSQL database dump
--

\restrict NpHiXnRVeB1FQBpmzGQktB2n9ixlTTagWuGwnYQMwzPv6ayqhbFzF4dAK0SYigb

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "public";


--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: daily_technicals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."daily_technicals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticker" "text" NOT NULL,
    "date" "date" NOT NULL,
    "close" numeric,
    "volume" bigint,
    "ema_5" numeric,
    "ema_8" numeric,
    "ema_21" numeric,
    "sma_50" numeric,
    "rsi_14" numeric,
    "avg_volume_20" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: discovery_scans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."discovery_scans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scan_date" "date" NOT NULL,
    "scan_mode" "text" NOT NULL,
    "results" "jsonb" NOT NULL,
    "narrative" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "discovery_scans_scan_mode_check" CHECK (("scan_mode" = ANY (ARRAY['reversal'::"text", 'trend'::"text"])))
);


--
-- Name: invite_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."invite_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "created_by" "uuid",
    "used_by" "uuid",
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "display_name" "text",
    "invite_code_used" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: regime_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."regime_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "snapshot_type" "text" NOT NULL,
    "snapshot_date" "date" NOT NULL,
    "spx_price" numeric,
    "spx_change_pct" numeric,
    "spx_vs_ema21_pct" numeric,
    "spx_trend" "text",
    "qqq_price" numeric,
    "qqq_change_pct" numeric,
    "vix_level" numeric,
    "vix_direction" "text",
    "vix_flag" "text",
    "btc_price" numeric,
    "btc_change_24h" numeric,
    "eth_price" numeric,
    "eth_change_24h" numeric,
    "sol_price" numeric,
    "sol_change_24h" numeric,
    "crypto_regime" "text",
    "sector_data" "jsonb",
    "regime_classification" "text",
    "narrative" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "regime_snapshots_regime_classification_check" CHECK (("regime_classification" = ANY (ARRAY['risk_on'::"text", 'risk_off'::"text", 'transitional'::"text", 'choppy'::"text"]))),
    CONSTRAINT "regime_snapshots_snapshot_type_check" CHECK (("snapshot_type" = ANY (ARRAY['premarket'::"text", 'eod'::"text"])))
);


--
-- Name: signals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."signals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticker" "text" NOT NULL,
    "date" "date" NOT NULL,
    "setup_type" "text" NOT NULL,
    "state" "text" NOT NULL,
    "conviction_grades" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "triggered_at" timestamp with time zone,
    "cooled_until" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "signals_setup_type_check" CHECK (("setup_type" = ANY (ARRAY['trend_continuation'::"text", 'reversal_recovery'::"text"]))),
    CONSTRAINT "signals_state_check" CHECK (("state" = ANY (ARRAY['triggered_today'::"text", 'qualifies'::"text", 'none'::"text"])))
);


--
-- Name: stock_fundamentals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."stock_fundamentals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticker" "text" NOT NULL,
    "market_cap" numeric,
    "net_debt" numeric,
    "sbc_fcf" numeric,
    "gross_margin" numeric,
    "net_margin" numeric,
    "net_gross_ratio" numeric GENERATED ALWAYS AS (
CASE
    WHEN ("gross_margin" > (0)::numeric) THEN ("net_margin" / "gross_margin")
    ELSE NULL::numeric
END) STORED,
    "debt_market_cap_ratio" numeric,
    "qq_revenue_growth" numeric,
    "yy_revenue_growth" numeric,
    "last_fetched_at" timestamp with time zone,
    "data_source" "text" DEFAULT 'alpha_vantage'::"text"
);


--
-- Name: stock_technicals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."stock_technicals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticker" "text" NOT NULL,
    "current_price" numeric,
    "price_change_pct" numeric,
    "ma_50" numeric,
    "ema_8" numeric,
    "ema_21" numeric,
    "price_vs_ma50_pct" numeric,
    "price_vs_ema8_pct" numeric,
    "price_vs_ema21_pct" numeric,
    "rsi_14" numeric,
    "volume" numeric,
    "avg_volume_20d" numeric,
    "week_52_high" numeric,
    "week_52_low" numeric,
    "pct_from_52_high" numeric,
    "last_fetched_at" timestamp with time zone
);


--
-- Name: stocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE "public"."stocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "ticker" "text" NOT NULL,
    "company_name" "text",
    "sector" "text",
    "blc_phase" integer,
    "blc_phase_label" "text",
    "is_position" boolean DEFAULT false,
    "is_interested" boolean DEFAULT true,
    "is_archived" boolean DEFAULT false,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "stocks_blc_phase_check" CHECK ((("blc_phase" >= 1) AND ("blc_phase" <= 6)))
);


--
-- Name: daily_technicals daily_technicals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."daily_technicals"
    ADD CONSTRAINT "daily_technicals_pkey" PRIMARY KEY ("id");


--
-- Name: daily_technicals daily_technicals_ticker_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."daily_technicals"
    ADD CONSTRAINT "daily_technicals_ticker_date_key" UNIQUE ("ticker", "date");


--
-- Name: discovery_scans discovery_scans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."discovery_scans"
    ADD CONSTRAINT "discovery_scans_pkey" PRIMARY KEY ("id");


--
-- Name: invite_codes invite_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invite_codes"
    ADD CONSTRAINT "invite_codes_code_key" UNIQUE ("code");


--
-- Name: invite_codes invite_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invite_codes"
    ADD CONSTRAINT "invite_codes_pkey" PRIMARY KEY ("id");


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");


--
-- Name: regime_snapshots regime_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."regime_snapshots"
    ADD CONSTRAINT "regime_snapshots_pkey" PRIMARY KEY ("id");


--
-- Name: signals signals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."signals"
    ADD CONSTRAINT "signals_pkey" PRIMARY KEY ("id");


--
-- Name: signals signals_ticker_date_setup_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."signals"
    ADD CONSTRAINT "signals_ticker_date_setup_key" UNIQUE ("ticker", "date", "setup_type");


--
-- Name: stock_fundamentals stock_fundamentals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."stock_fundamentals"
    ADD CONSTRAINT "stock_fundamentals_pkey" PRIMARY KEY ("id");


--
-- Name: stock_fundamentals stock_fundamentals_ticker_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."stock_fundamentals"
    ADD CONSTRAINT "stock_fundamentals_ticker_key" UNIQUE ("ticker");


--
-- Name: stock_technicals stock_technicals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."stock_technicals"
    ADD CONSTRAINT "stock_technicals_pkey" PRIMARY KEY ("id");


--
-- Name: stock_technicals stock_technicals_ticker_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."stock_technicals"
    ADD CONSTRAINT "stock_technicals_ticker_key" UNIQUE ("ticker");


--
-- Name: stocks stocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."stocks"
    ADD CONSTRAINT "stocks_pkey" PRIMARY KEY ("id");


--
-- Name: stocks stocks_user_id_ticker_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."stocks"
    ADD CONSTRAINT "stocks_user_id_ticker_key" UNIQUE ("user_id", "ticker");


--
-- Name: daily_technicals_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "daily_technicals_date_idx" ON "public"."daily_technicals" USING "btree" ("date");


--
-- Name: daily_technicals_ticker_date_desc_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "daily_technicals_ticker_date_desc_idx" ON "public"."daily_technicals" USING "btree" ("ticker", "date" DESC);


--
-- Name: daily_technicals_ticker_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "daily_technicals_ticker_idx" ON "public"."daily_technicals" USING "btree" ("ticker");


--
-- Name: discovery_scans_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "discovery_scans_date_idx" ON "public"."discovery_scans" USING "btree" ("scan_date" DESC);


--
-- Name: regime_snapshots_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "regime_snapshots_date_idx" ON "public"."regime_snapshots" USING "btree" ("snapshot_date" DESC);


--
-- Name: signals_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "signals_date_idx" ON "public"."signals" USING "btree" ("date");


--
-- Name: signals_ticker_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "signals_ticker_idx" ON "public"."signals" USING "btree" ("ticker");


--
-- Name: signals_ticker_setup_date_desc_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "signals_ticker_setup_date_desc_idx" ON "public"."signals" USING "btree" ("ticker", "setup_type", "date" DESC);


--
-- Name: stocks_ticker_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "stocks_ticker_idx" ON "public"."stocks" USING "btree" ("ticker");


--
-- Name: stocks_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "stocks_user_idx" ON "public"."stocks" USING "btree" ("user_id");


--
-- Name: stocks stocks_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER "stocks_touch_updated_at" BEFORE UPDATE ON "public"."stocks" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();


--
-- Name: invite_codes invite_codes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invite_codes"
    ADD CONSTRAINT "invite_codes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");


--
-- Name: invite_codes invite_codes_used_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."invite_codes"
    ADD CONSTRAINT "invite_codes_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "public"."profiles"("id");


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: stocks stocks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY "public"."stocks"
    ADD CONSTRAINT "stocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


--
-- Name: invite_codes auth_insert_invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth_insert_invites" ON "public"."invite_codes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));


--
-- Name: daily_technicals auth_read_daily_technicals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth_read_daily_technicals" ON "public"."daily_technicals" FOR SELECT TO "authenticated" USING (true);


--
-- Name: discovery_scans auth_read_discovery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth_read_discovery" ON "public"."discovery_scans" FOR SELECT TO "authenticated" USING (true);


--
-- Name: stock_fundamentals auth_read_fundamentals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth_read_fundamentals" ON "public"."stock_fundamentals" FOR SELECT TO "authenticated" USING (true);


--
-- Name: invite_codes auth_read_own_invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth_read_own_invites" ON "public"."invite_codes" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "created_by"));


--
-- Name: regime_snapshots auth_read_regime; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth_read_regime" ON "public"."regime_snapshots" FOR SELECT TO "authenticated" USING (true);


--
-- Name: signals auth_read_signals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth_read_signals" ON "public"."signals" FOR SELECT TO "authenticated" USING (true);


--
-- Name: stock_technicals auth_read_technicals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "auth_read_technicals" ON "public"."stock_technicals" FOR SELECT TO "authenticated" USING (true);


--
-- Name: daily_technicals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."daily_technicals" ENABLE ROW LEVEL SECURITY;

--
-- Name: discovery_scans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."discovery_scans" ENABLE ROW LEVEL SECURITY;

--
-- Name: invite_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."invite_codes" ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: regime_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."regime_snapshots" ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_technicals service_write_daily_technicals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_write_daily_technicals" ON "public"."daily_technicals" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: discovery_scans service_write_discovery; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_write_discovery" ON "public"."discovery_scans" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: stock_fundamentals service_write_fundamentals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_write_fundamentals" ON "public"."stock_fundamentals" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: regime_snapshots service_write_regime; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_write_regime" ON "public"."regime_snapshots" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: signals service_write_signals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_write_signals" ON "public"."signals" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: stock_technicals service_write_technicals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_write_technicals" ON "public"."stock_technicals" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: signals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."signals" ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_fundamentals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."stock_fundamentals" ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_technicals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."stock_technicals" ENABLE ROW LEVEL SECURITY;

--
-- Name: stocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."stocks" ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles users_own_profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users_own_profile" ON "public"."profiles" TO "authenticated" USING (("auth"."uid"() = "id"));


--
-- Name: stocks users_own_stocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users_own_stocks" ON "public"."stocks" TO "authenticated" USING (("auth"."uid"() = "user_id"));


--
-- Name: SCHEMA "public"; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


--
-- Name: FUNCTION "handle_new_user"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";


--
-- Name: FUNCTION "rls_auto_enable"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";


--
-- Name: FUNCTION "touch_updated_at"(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";


--
-- Name: TABLE "daily_technicals"; Type: ACL; Schema: public; Owner: -
--

GRANT MAINTAIN ON TABLE "public"."daily_technicals" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."daily_technicals" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_technicals" TO "service_role";


--
-- Name: TABLE "discovery_scans"; Type: ACL; Schema: public; Owner: -
--

GRANT MAINTAIN ON TABLE "public"."discovery_scans" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."discovery_scans" TO "authenticated";
GRANT ALL ON TABLE "public"."discovery_scans" TO "service_role";


--
-- Name: TABLE "invite_codes"; Type: ACL; Schema: public; Owner: -
--

GRANT MAINTAIN ON TABLE "public"."invite_codes" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."invite_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."invite_codes" TO "service_role";


--
-- Name: TABLE "profiles"; Type: ACL; Schema: public; Owner: -
--

GRANT MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";


--
-- Name: TABLE "regime_snapshots"; Type: ACL; Schema: public; Owner: -
--

GRANT MAINTAIN ON TABLE "public"."regime_snapshots" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."regime_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."regime_snapshots" TO "service_role";


--
-- Name: TABLE "signals"; Type: ACL; Schema: public; Owner: -
--

GRANT MAINTAIN ON TABLE "public"."signals" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."signals" TO "authenticated";
GRANT ALL ON TABLE "public"."signals" TO "service_role";


--
-- Name: TABLE "stock_fundamentals"; Type: ACL; Schema: public; Owner: -
--

GRANT MAINTAIN ON TABLE "public"."stock_fundamentals" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."stock_fundamentals" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_fundamentals" TO "service_role";


--
-- Name: TABLE "stock_technicals"; Type: ACL; Schema: public; Owner: -
--

GRANT MAINTAIN ON TABLE "public"."stock_technicals" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."stock_technicals" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_technicals" TO "service_role";


--
-- Name: TABLE "stocks"; Type: ACL; Schema: public; Owner: -
--

GRANT MAINTAIN ON TABLE "public"."stocks" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."stocks" TO "authenticated";
GRANT ALL ON TABLE "public"."stocks" TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- PostgreSQL database dump complete
--

\unrestrict NpHiXnRVeB1FQBpmzGQktB2n9ixlTTagWuGwnYQMwzPv6ayqhbFzF4dAK0SYigb

