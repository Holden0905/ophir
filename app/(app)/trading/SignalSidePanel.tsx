"use client";

import { useEffect } from "react";
import Link from "next/link";
import { fmtPct, fmtPrice } from "@/lib/format";
import { ConvictionPills } from "@/components/signals/ConvictionPills";
import { SignalBadge } from "@/components/signals/SignalBadge";
import { SignalChartPanel } from "@/components/signals/SignalChartPanel";
import { SETUP_FULL } from "@/lib/signals/labels";
import type {
  DailyTechnicals,
  Signal,
  Stock,
  StockTechnicals,
} from "@/lib/supabase/types";

export interface SidePanelSelection {
  stock: Stock;
  signal: Signal;
  daily: DailyTechnicals | null;
  stockTechnicals: StockTechnicals | null;
}

interface ConditionResult {
  label: string;
  met: boolean | null;
}

function trendConditions(d: DailyTechnicals | null): ConditionResult[] {
  if (!d) {
    return [
      { label: "close > EMA(8)", met: null },
      { label: "EMA(5) rising 2+ days", met: null },
      { label: "EMA(8) > EMA(21)", met: null },
      { label: "RSI(14) ∈ (40, 70)", met: null },
    ];
  }
  return [
    {
      label: "close > EMA(8)",
      met: d.close !== null && d.ema_8 !== null ? d.close > d.ema_8 : null,
    },
    {
      // We don't carry yesterday/-2 EMA history here, so we surface the
      // engine's verdict via the parent signal's state instead. This row is
      // shown as "engine-evaluated" and inferred from the trigger alone.
      label: "EMA(5) rising 2+ days",
      met: null,
    },
    {
      label: "EMA(8) > EMA(21)",
      met: d.ema_8 !== null && d.ema_21 !== null ? d.ema_8 > d.ema_21 : null,
    },
    {
      label: "RSI(14) ∈ (40, 70)",
      met: d.rsi_14 !== null ? d.rsi_14 > 40 && d.rsi_14 < 70 : null,
    },
  ];
}

function reversalConditions(d: DailyTechnicals | null): ConditionResult[] {
  if (!d) {
    return [
      { label: "close < 0.80 × 52w high", met: null },
      { label: "RSI(14) min(10d) < 35", met: null },
      { label: "RSI(14) > 40", met: null },
      { label: "EMA(5) rising 2+ days", met: null },
      { label: "close > EMA(8)", met: null },
    ];
  }
  return [
    { label: "close < 0.80 × 52w high", met: null },
    { label: "RSI(14) min(10d) < 35", met: null },
    {
      label: "RSI(14) > 40",
      met: d.rsi_14 !== null ? d.rsi_14 > 40 : null,
    },
    { label: "EMA(5) rising 2+ days", met: null },
    {
      label: "close > EMA(8)",
      met: d.close !== null && d.ema_8 !== null ? d.close > d.ema_8 : null,
    },
  ];
}

export function SignalSidePanel({
  selection,
  onClose,
}: {
  selection: SidePanelSelection | null;
  onClose: () => void;
}) {
  // Close on escape — common UX expectation.
  useEffect(() => {
    if (!selection) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selection, onClose]);

  if (!selection) return null;
  const { stock, signal, daily, stockTechnicals } = selection;
  const conditions =
    signal.setup_type === "trend_continuation"
      ? trendConditions(daily)
      : reversalConditions(daily);
  const triggerDate =
    signal.state === "triggered_today" ? signal.date : signal.cooled_until
      ? // qualifies — try to use the most recent trigger date if we have it.
        // We don't actually have it here; passing null hides the marker.
        null
      : null;

  return (
    <div
      className="fixed inset-0 z-30 bg-black/25"
      onClick={onClose}
      role="presentation"
    >
      <aside
        className="absolute right-0 top-0 flex h-full w-[68vw] min-w-[640px] max-w-[1280px] flex-col overflow-y-auto border-l border-[var(--border)] bg-[var(--bg-primary)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-[var(--border)] bg-[var(--bg-primary)]/95 p-5 backdrop-blur">
          <div>
            <Link
              href={`/matrix/${encodeURIComponent(stock.ticker)}`}
              className="font-data text-2xl font-medium text-[var(--text-primary)] hover:text-[var(--accent-amber)]"
            >
              {stock.ticker}
            </Link>
            {stock.company_name && (
              <span className="ml-3 font-newspaper text-base text-[var(--text-secondary)]">
                {stock.company_name}
              </span>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SignalBadge
                setup={signal.setup_type}
                state={signal.state}
              />
              <span className="font-ui text-xs text-[var(--text-secondary)]">
                {SETUP_FULL[signal.setup_type]}
              </span>
              {stockTechnicals?.current_price !== undefined &&
                stockTechnicals.current_price !== null && (
                  <span className="font-data text-sm text-[var(--text-primary)]">
                    {fmtPrice(stockTechnicals.current_price)}
                  </span>
                )}
              {stockTechnicals?.price_change_pct !== undefined &&
                stockTechnicals.price_change_pct !== null && (
                  <span
                    className={`font-data text-sm ${
                      stockTechnicals.price_change_pct >= 0
                        ? "value-up"
                        : "value-down"
                    }`}
                  >
                    {fmtPct(stockTechnicals.price_change_pct)}
                  </span>
                )}
            </div>
            {signal.conviction_grades.length > 0 && (
              <div className="mt-2">
                <ConvictionPills grades={signal.conviction_grades} size="xs" />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="rounded p-1 font-ui text-xl leading-none text-[var(--text-muted)] hover:text-[var(--accent-amber)]"
          >
            ×
          </button>
        </header>

        <div className="space-y-5 p-5">
          <SignalChartPanel ticker={stock.ticker} triggerDate={triggerDate} />

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="card p-5">
              <div className="font-ui text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
                Setup conditions
              </div>
              <ul className="mt-3 space-y-2 font-ui text-sm">
                {conditions.map((c) => (
                  <li key={c.label} className="flex items-center gap-3">
                    <ConditionMark met={c.met} />
                    <span
                      className={
                        c.met === false
                          ? "text-[var(--text-muted)] line-through"
                          : c.met === null
                            ? "text-[var(--text-muted)]"
                            : "text-[var(--text-primary)]"
                      }
                    >
                      {c.label}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 font-ui text-[11px] italic text-[var(--text-muted)]">
                Conditions reflect today&apos;s daily_technicals row. The engine
                also considers prior-day values (rising EMAs, recent RSI
                lows) — those are summarised in the state itself.
              </p>
            </div>

            <div className="card p-5">
              <div className="font-ui text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
                Conviction
              </div>
              {signal.conviction_grades.length === 0 ? (
                <p className="mt-3 font-ui text-sm text-[var(--text-secondary)]">
                  No conviction grades on this trigger.
                </p>
              ) : (
                <div className="mt-3">
                  <ConvictionPills grades={signal.conviction_grades} />
                </div>
              )}
              {signal.cooled_until && (
                <div className="mt-4 border-t border-[var(--border-subtle)] pt-3 font-ui text-xs text-[var(--text-secondary)]">
                  Cooled until{" "}
                  <span className="font-data text-[var(--text-primary)]">
                    {signal.cooled_until}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ConditionMark({ met }: { met: boolean | null }) {
  if (met === true) {
    return (
      <span
        aria-hidden
        className="inline-flex h-4 w-4 items-center justify-center rounded-full font-data text-[10px]"
        style={{
          background: "var(--accent-amber)",
          color: "#000",
        }}
      >
        ✓
      </span>
    );
  }
  if (met === false) {
    return (
      <span
        aria-hidden
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border font-data text-[10px] text-[var(--text-muted)]"
        style={{ borderColor: "var(--border)" }}
      >
        ×
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex h-4 w-4 items-center justify-center rounded-full border font-data text-[10px] text-[var(--text-muted)]"
      style={{ borderColor: "var(--border)" }}
    >
      ?
    </span>
  );
}
