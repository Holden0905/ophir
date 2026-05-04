import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/dal";
import { TradingViewChart } from "@/components/matrix/TradingViewChart";
import { BLCPhaseSelector } from "@/components/matrix/BLCPhaseSelector";
import { DataCell } from "@/components/shared/DataCell";
import {
  fmtMarketCap,
  fmtPrice,
  fmtPct,
  fmtRatio,
  pctClass,
  relativeTime,
  isStale,
} from "@/lib/format";
import { addStockByTicker } from "../actions";
import { StockNotes } from "./StockNotes";
import { PositionToggle } from "./PositionToggle";
import type {
  Stock,
  StockFundamentals,
  StockTechnicals,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { ticker } = await params;
  return { title: ticker.toUpperCase() };
}

export default async function StockDetailPage({ params }: PageProps) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();
  const user = await requireUser();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("stocks")
    .select("*")
    .eq("user_id", user.id)
    .eq("ticker", ticker)
    .maybeSingle();

  if (!existing) {
    // Auto-add when navigating to a ticker not yet in the matrix.
    const result = await addStockByTicker(ticker);
    if (!result.ok) notFound();
    redirect(`/matrix/${ticker}`);
  }

  const stock = existing as Stock;

  const [fRes, tRes] = await Promise.all([
    supabase
      .from("stock_fundamentals")
      .select("*")
      .eq("ticker", ticker)
      .maybeSingle(),
    supabase
      .from("stock_technicals")
      .select("*")
      .eq("ticker", ticker)
      .maybeSingle(),
  ]);
  const fundamentals = (fRes.data ?? null) as StockFundamentals | null;
  const technicals = (tRes.data ?? null) as StockTechnicals | null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/matrix"
            className="font-ui text-xs uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--accent-amber)]"
          >
            ← Matrix
          </Link>
          <div className="mt-2 flex items-baseline gap-3">
            <h1 className="font-data text-4xl tracking-tight text-[var(--text-primary)]">
              {stock.ticker}
            </h1>
            <span className="font-newspaper text-xl text-[var(--text-secondary)]">
              {stock.company_name ?? ""}
            </span>
          </div>
          {technicals && (
            <div className="mt-2 flex items-baseline gap-4">
              <span className="font-data text-2xl text-[var(--text-primary)]">
                {fmtPrice(technicals.current_price)}
              </span>
              <span
                className={`font-data text-base ${pctClass(technicals.price_change_pct)}`}
              >
                {fmtPct(technicals.price_change_pct)}
              </span>
              {isStale(technicals.last_fetched_at) && (
                <span className="rounded bg-[var(--accent-amber)]/10 px-1.5 py-0.5 font-ui text-[10px] uppercase tracking-wider text-[var(--accent-amber)]">
                  stale · {relativeTime(technicals.last_fetched_at)}
                </span>
              )}
            </div>
          )}
        </div>
        <PositionToggle stock={stock} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <TradingViewChart ticker={stock.ticker} />

          <FundamentalsCard fundamentals={fundamentals} />
        </div>

        <div className="space-y-6">
          <BLCPhaseSelector
            stockId={stock.id}
            value={stock.blc_phase}
          />
          <TechnicalsCard technicals={technicals} />
          <StockNotes stockId={stock.id} initial={stock.notes ?? ""} />
        </div>
      </div>
    </div>
  );
}

function FundamentalsCard({
  fundamentals,
}: {
  fundamentals: StockFundamentals | null;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="font-ui text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
          Fundamentals
        </div>
        <span className="font-ui text-[10px] text-[var(--text-muted)]">
          {fundamentals?.last_fetched_at
            ? `cached · ${relativeTime(fundamentals.last_fetched_at)}`
            : "no cache"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        <Stat label="Market cap" value={fmtMarketCap(fundamentals?.market_cap)} />
        <Stat
          label="Y/Y revenue"
          value={fmtPct(
            fundamentals?.yy_revenue_growth
              ? fundamentals.yy_revenue_growth * 100
              : null,
          )}
          tone={fundamentals?.yy_revenue_growth}
        />
        <Stat
          label="Q/Q revenue"
          value={fmtPct(
            fundamentals?.qq_revenue_growth
              ? fundamentals.qq_revenue_growth * 100
              : null,
          )}
          tone={fundamentals?.qq_revenue_growth}
        />
        <Stat
          label="Gross margin"
          value={fmtPct(
            fundamentals?.gross_margin ? fundamentals.gross_margin * 100 : null,
          )}
          tone={fundamentals?.gross_margin}
        />
        <Stat
          label="Net margin"
          value={fmtPct(
            fundamentals?.net_margin ? fundamentals.net_margin * 100 : null,
          )}
          tone={fundamentals?.net_margin}
        />
        <Stat
          label="Net / Gross"
          value={
            fundamentals?.net_gross_ratio !== null &&
            fundamentals?.net_gross_ratio !== undefined
              ? fmtRatio(fundamentals.net_gross_ratio)
              : "—"
          }
        />
        <Stat
          label="Debt / cap"
          value={
            fundamentals?.debt_market_cap_ratio !== null &&
            fundamentals?.debt_market_cap_ratio !== undefined
              ? fmtRatio(fundamentals.debt_market_cap_ratio)
              : "—"
          }
        />
      </div>
    </div>
  );
}

function TechnicalsCard({
  technicals,
}: {
  technicals: StockTechnicals | null;
}) {
  return (
    <div className="card p-5">
      <div className="font-ui text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
        Technicals
      </div>
      <div className="mt-4 space-y-2 text-sm">
        <Row label="vs 8 EMA" value={technicals?.price_vs_ema8_pct ?? null} />
        <Row label="vs 21 EMA" value={technicals?.price_vs_ema21_pct ?? null} />
        <Row label="vs 50 SMA" value={technicals?.price_vs_ma50_pct ?? null} />
        <Row label="RSI(14)" value={technicals?.rsi_14 ?? null} format="raw" />
        <Row
          label="From 52w high"
          value={technicals?.pct_from_52_high ?? null}
        />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  format = "pct",
}: {
  label: string;
  value: number | null;
  format?: "pct" | "raw";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-ui text-[var(--text-secondary)]">{label}</span>
      <DataCell value={value} format={format} />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: number | null;
}) {
  const cls =
    tone === undefined || tone === null
      ? ""
      : tone > 0
        ? "value-up"
        : tone < 0
          ? "value-down"
          : "";
  return (
    <div>
      <div className="font-ui text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </div>
      <div className={`mt-1 font-data text-base ${cls}`}>{value}</div>
    </div>
  );
}
