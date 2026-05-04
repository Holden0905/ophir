// Hand-written DB types — mirrors the SQL schema applied via Supabase MCP.
// Regenerate with `supabase gen types typescript` once the CLI is wired up.

export type RegimeClassification =
  | "risk_on"
  | "risk_off"
  | "transitional"
  | "choppy";

export type SnapshotType = "premarket" | "eod";
export type ScanMode = "reversal" | "trend";

export interface SectorSnapshot {
  symbol: string;
  name: string;
  rs5d: number | null;
  rs30d: number | null;
  changePct: number | null;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  invite_code_used: string | null;
  created_at: string;
}

export interface InviteCode {
  id: string;
  code: string;
  created_by: string | null;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}

export interface Stock {
  id: string;
  user_id: string;
  ticker: string;
  company_name: string | null;
  sector: string | null;
  blc_phase: number | null;
  blc_phase_label: string | null;
  is_position: boolean;
  is_interested: boolean;
  is_archived: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockFundamentals {
  id: string;
  ticker: string;
  market_cap: number | null;
  net_debt: number | null;
  sbc_fcf: number | null;
  gross_margin: number | null;
  net_margin: number | null;
  net_gross_ratio: number | null;
  debt_market_cap_ratio: number | null;
  qq_revenue_growth: number | null;
  yy_revenue_growth: number | null;
  last_fetched_at: string | null;
  data_source: string;
}

export interface StockTechnicals {
  id: string;
  ticker: string;
  current_price: number | null;
  price_change_pct: number | null;
  ma_50: number | null;
  ema_8: number | null;
  ema_21: number | null;
  price_vs_ma50_pct: number | null;
  price_vs_ema8_pct: number | null;
  price_vs_ema21_pct: number | null;
  rsi_14: number | null;
  volume: number | null;
  avg_volume_20d: number | null;
  week_52_high: number | null;
  week_52_low: number | null;
  pct_from_52_high: number | null;
  last_fetched_at: string | null;
}

export interface RegimeSnapshot {
  id: string;
  snapshot_type: SnapshotType;
  snapshot_date: string;
  spx_price: number | null;
  spx_change_pct: number | null;
  spx_vs_ema21_pct: number | null;
  spx_trend: string | null;
  qqq_price: number | null;
  qqq_change_pct: number | null;
  vix_level: number | null;
  vix_direction: string | null;
  vix_flag: string | null;
  btc_price: number | null;
  btc_change_24h: number | null;
  eth_price: number | null;
  eth_change_24h: number | null;
  sol_price: number | null;
  sol_change_24h: number | null;
  crypto_regime: string | null;
  sector_data: SectorSnapshot[] | null;
  regime_classification: RegimeClassification | null;
  narrative: string | null;
  created_at: string;
}

export interface DiscoveryScanResult {
  ticker: string;
  company_name: string | null;
  sector: string | null;
  current_price: number | null;
  price_change_pct: number | null;
  rsi_14: number | null;
  pct_from_52_high: number | null;
  price_vs_ema8_pct: number | null;
  price_vs_ma50_pct: number | null;
  qq_revenue_growth: number | null;
  yy_revenue_growth: number | null;
  gross_margin: number | null;
  net_margin: number | null;
  market_cap: number | null;
  reason: string;
}

export interface DiscoveryScan {
  id: string;
  scan_date: string;
  scan_mode: ScanMode;
  results: DiscoveryScanResult[];
  narrative: string | null;
  created_at: string;
}

// Supabase-js v2 expects each table to expose Row / Insert / Update / Relationships.
// Insert and Update are written as separate object literal types with optional
// fields so that supabase's generic narrowing works with .upsert / .update.

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          invite_code_used?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          invite_code_used?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      invite_codes: {
        Row: InviteCode;
        Insert: {
          id?: string;
          code: string;
          created_by?: string | null;
          used_by?: string | null;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          created_by?: string | null;
          used_by?: string | null;
          used_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      stocks: {
        Row: Stock;
        Insert: {
          id?: string;
          user_id: string;
          ticker: string;
          company_name?: string | null;
          sector?: string | null;
          blc_phase?: number | null;
          blc_phase_label?: string | null;
          is_position?: boolean;
          is_interested?: boolean;
          is_archived?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          ticker?: string;
          company_name?: string | null;
          sector?: string | null;
          blc_phase?: number | null;
          blc_phase_label?: string | null;
          is_position?: boolean;
          is_interested?: boolean;
          is_archived?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stock_fundamentals: {
        Row: StockFundamentals;
        Insert: {
          id?: string;
          ticker: string;
          market_cap?: number | null;
          net_debt?: number | null;
          sbc_fcf?: number | null;
          gross_margin?: number | null;
          net_margin?: number | null;
          debt_market_cap_ratio?: number | null;
          qq_revenue_growth?: number | null;
          yy_revenue_growth?: number | null;
          last_fetched_at?: string | null;
          data_source?: string;
        };
        Update: {
          id?: string;
          ticker?: string;
          market_cap?: number | null;
          net_debt?: number | null;
          sbc_fcf?: number | null;
          gross_margin?: number | null;
          net_margin?: number | null;
          debt_market_cap_ratio?: number | null;
          qq_revenue_growth?: number | null;
          yy_revenue_growth?: number | null;
          last_fetched_at?: string | null;
          data_source?: string;
        };
        Relationships: [];
      };
      stock_technicals: {
        Row: StockTechnicals;
        Insert: {
          id?: string;
          ticker: string;
          current_price?: number | null;
          price_change_pct?: number | null;
          ma_50?: number | null;
          ema_8?: number | null;
          ema_21?: number | null;
          price_vs_ma50_pct?: number | null;
          price_vs_ema8_pct?: number | null;
          price_vs_ema21_pct?: number | null;
          rsi_14?: number | null;
          volume?: number | null;
          avg_volume_20d?: number | null;
          week_52_high?: number | null;
          week_52_low?: number | null;
          pct_from_52_high?: number | null;
          last_fetched_at?: string | null;
        };
        Update: {
          id?: string;
          ticker?: string;
          current_price?: number | null;
          price_change_pct?: number | null;
          ma_50?: number | null;
          ema_8?: number | null;
          ema_21?: number | null;
          price_vs_ma50_pct?: number | null;
          price_vs_ema8_pct?: number | null;
          price_vs_ema21_pct?: number | null;
          rsi_14?: number | null;
          volume?: number | null;
          avg_volume_20d?: number | null;
          week_52_high?: number | null;
          week_52_low?: number | null;
          pct_from_52_high?: number | null;
          last_fetched_at?: string | null;
        };
        Relationships: [];
      };
      regime_snapshots: {
        Row: RegimeSnapshot;
        Insert: Omit<RegimeSnapshot, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<RegimeSnapshot, "id">>;
        Relationships: [];
      };
      discovery_scans: {
        Row: DiscoveryScan;
        Insert: {
          id?: string;
          scan_date: string;
          scan_mode: ScanMode;
          results: DiscoveryScanResult[];
          narrative?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          scan_date?: string;
          scan_mode?: ScanMode;
          results?: DiscoveryScanResult[];
          narrative?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
