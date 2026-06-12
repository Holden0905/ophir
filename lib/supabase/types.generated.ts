// Snapshot of `supabase gen types typescript` output (via Supabase MCP), 2026-06-10.
// NOT imported anywhere — kept beside the hand-written types.ts for drift comparison.
// See AUDIT-RLS.md §"Type drift" for the analysis. Do not import from this file:
// app code depends on the named interfaces (Profile, Stock, Signal, ...) and
// narrowed union types in types.ts, which this generated output does not provide.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      daily_technicals: {
        Row: {
          avg_volume_20: number | null
          close: number | null
          created_at: string
          date: string
          ema_21: number | null
          ema_5: number | null
          ema_8: number | null
          id: string
          rsi_14: number | null
          sma_50: number | null
          ticker: string
          volume: number | null
        }
        Insert: {
          avg_volume_20?: number | null
          close?: number | null
          created_at?: string
          date: string
          ema_21?: number | null
          ema_5?: number | null
          ema_8?: number | null
          id?: string
          rsi_14?: number | null
          sma_50?: number | null
          ticker: string
          volume?: number | null
        }
        Update: {
          avg_volume_20?: number | null
          close?: number | null
          created_at?: string
          date?: string
          ema_21?: number | null
          ema_5?: number | null
          ema_8?: number | null
          id?: string
          rsi_14?: number | null
          sma_50?: number | null
          ticker?: string
          volume?: number | null
        }
        Relationships: []
      }
      discovery_scans: {
        Row: {
          created_at: string | null
          id: string
          narrative: string | null
          results: Json
          scan_date: string
          scan_mode: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          narrative?: string | null
          results: Json
          scan_date: string
          scan_mode: string
        }
        Update: {
          created_at?: string | null
          id?: string
          narrative?: string | null
          results?: Json
          scan_date?: string
          scan_mode?: string
        }
        Relationships: []
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          email: string
          id: string
          invite_code_used: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email: string
          id: string
          invite_code_used?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email?: string
          id?: string
          invite_code_used?: string | null
        }
        Relationships: []
      }
      regime_snapshots: {
        Row: {
          btc_change_24h: number | null
          btc_price: number | null
          created_at: string | null
          crypto_regime: string | null
          eth_change_24h: number | null
          eth_price: number | null
          id: string
          narrative: string | null
          qqq_change_pct: number | null
          qqq_price: number | null
          regime_classification: string | null
          sector_data: Json | null
          snapshot_date: string
          snapshot_type: string
          sol_change_24h: number | null
          sol_price: number | null
          spx_change_pct: number | null
          spx_price: number | null
          spx_trend: string | null
          spx_vs_ema21_pct: number | null
          vix_direction: string | null
          vix_flag: string | null
          vix_level: number | null
        }
        Insert: {
          btc_change_24h?: number | null
          btc_price?: number | null
          created_at?: string | null
          crypto_regime?: string | null
          eth_change_24h?: number | null
          eth_price?: number | null
          id?: string
          narrative?: string | null
          qqq_change_pct?: number | null
          qqq_price?: number | null
          regime_classification?: string | null
          sector_data?: Json | null
          snapshot_date: string
          snapshot_type: string
          sol_change_24h?: number | null
          sol_price?: number | null
          spx_change_pct?: number | null
          spx_price?: number | null
          spx_trend?: string | null
          spx_vs_ema21_pct?: number | null
          vix_direction?: string | null
          vix_flag?: string | null
          vix_level?: number | null
        }
        Update: {
          btc_change_24h?: number | null
          btc_price?: number | null
          created_at?: string | null
          crypto_regime?: string | null
          eth_change_24h?: number | null
          eth_price?: number | null
          id?: string
          narrative?: string | null
          qqq_change_pct?: number | null
          qqq_price?: number | null
          regime_classification?: string | null
          sector_data?: Json | null
          snapshot_date?: string
          snapshot_type?: string
          sol_change_24h?: number | null
          sol_price?: number | null
          spx_change_pct?: number | null
          spx_price?: number | null
          spx_trend?: string | null
          spx_vs_ema21_pct?: number | null
          vix_direction?: string | null
          vix_flag?: string | null
          vix_level?: number | null
        }
        Relationships: []
      }
      signals: {
        Row: {
          conviction_grades: Json
          cooled_until: string | null
          created_at: string
          date: string
          id: string
          setup_type: string
          state: string
          ticker: string
          triggered_at: string | null
        }
        Insert: {
          conviction_grades?: Json
          cooled_until?: string | null
          created_at?: string
          date: string
          id?: string
          setup_type: string
          state: string
          ticker: string
          triggered_at?: string | null
        }
        Update: {
          conviction_grades?: Json
          cooled_until?: string | null
          created_at?: string
          date?: string
          id?: string
          setup_type?: string
          state?: string
          ticker?: string
          triggered_at?: string | null
        }
        Relationships: []
      }
      stock_fundamentals: {
        Row: {
          data_source: string | null
          debt_market_cap_ratio: number | null
          gross_margin: number | null
          id: string
          last_fetched_at: string | null
          market_cap: number | null
          net_debt: number | null
          net_gross_ratio: number | null
          net_margin: number | null
          qq_revenue_growth: number | null
          sbc_fcf: number | null
          ticker: string
          yy_revenue_growth: number | null
        }
        Insert: {
          data_source?: string | null
          debt_market_cap_ratio?: number | null
          gross_margin?: number | null
          id?: string
          last_fetched_at?: string | null
          market_cap?: number | null
          net_debt?: number | null
          net_gross_ratio?: number | null
          net_margin?: number | null
          qq_revenue_growth?: number | null
          sbc_fcf?: number | null
          ticker: string
          yy_revenue_growth?: number | null
        }
        Update: {
          data_source?: string | null
          debt_market_cap_ratio?: number | null
          gross_margin?: number | null
          id?: string
          last_fetched_at?: string | null
          market_cap?: number | null
          net_debt?: number | null
          net_gross_ratio?: number | null
          net_margin?: number | null
          qq_revenue_growth?: number | null
          sbc_fcf?: number | null
          ticker?: string
          yy_revenue_growth?: number | null
        }
        Relationships: []
      }
      stock_technicals: {
        Row: {
          avg_volume_20d: number | null
          current_price: number | null
          ema_21: number | null
          ema_8: number | null
          id: string
          last_fetched_at: string | null
          ma_50: number | null
          pct_from_52_high: number | null
          price_change_pct: number | null
          price_vs_ema21_pct: number | null
          price_vs_ema8_pct: number | null
          price_vs_ma50_pct: number | null
          rsi_14: number | null
          ticker: string
          volume: number | null
          week_52_high: number | null
          week_52_low: number | null
        }
        Insert: {
          avg_volume_20d?: number | null
          current_price?: number | null
          ema_21?: number | null
          ema_8?: number | null
          id?: string
          last_fetched_at?: string | null
          ma_50?: number | null
          pct_from_52_high?: number | null
          price_change_pct?: number | null
          price_vs_ema21_pct?: number | null
          price_vs_ema8_pct?: number | null
          price_vs_ma50_pct?: number | null
          rsi_14?: number | null
          ticker: string
          volume?: number | null
          week_52_high?: number | null
          week_52_low?: number | null
        }
        Update: {
          avg_volume_20d?: number | null
          current_price?: number | null
          ema_21?: number | null
          ema_8?: number | null
          id?: string
          last_fetched_at?: string | null
          ma_50?: number | null
          pct_from_52_high?: number | null
          price_change_pct?: number | null
          price_vs_ema21_pct?: number | null
          price_vs_ema8_pct?: number | null
          price_vs_ma50_pct?: number | null
          rsi_14?: number | null
          ticker?: string
          volume?: number | null
          week_52_high?: number | null
          week_52_low?: number | null
        }
        Relationships: []
      }
      stocks: {
        Row: {
          blc_phase: number | null
          blc_phase_label: string | null
          company_name: string | null
          created_at: string | null
          id: string
          is_archived: boolean | null
          is_interested: boolean | null
          is_position: boolean | null
          notes: string | null
          sector: string | null
          ticker: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          blc_phase?: number | null
          blc_phase_label?: string | null
          company_name?: string | null
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          is_interested?: boolean | null
          is_position?: boolean | null
          notes?: string | null
          sector?: string | null
          ticker: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          blc_phase?: number | null
          blc_phase_label?: string | null
          company_name?: string | null
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          is_interested?: boolean | null
          is_position?: boolean | null
          notes?: string | null
          sector?: string | null
          ticker?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
