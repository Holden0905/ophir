"use client";

import { useMemo, useState } from "react";
import { fmtPct, fmtPrice } from "@/lib/format";
import { ConvictionPills } from "@/components/signals/ConvictionPills";
import { SignalBadge } from "@/components/signals/SignalBadge";
import { RegimeBadge } from "@/components/regime/RegimeBadge";
import {
  SETUP_FULL,
  compareSignalState,
  consecutiveQualifyingDays,
  dominantSignal,
} from "@/lib/signals/labels";
import type {
  DailyTechnicals,
  Signal,
  Stock,
  StockTechnicals,
} from "@/lib/supabase/types";
import { SignalSidePanel, type SidePanelSelection } from "./SignalSidePanel";

interface SignalRowProps {
  stock: Stock;
  signal: Signal;
  stockTech: StockTechnicals | null;
  /** Optional trailing fact: e.g. "3 days qualifying" or "cooled 4d" */
  meta?: string;
  /** When set, force the row's amber treatment regardless of state. */
  loud?: boolean;
  onClick: () => void;
}

interface TradingClientProps {
  data: {
    date: string;
    regime: {
      classification: import("@/lib/supabase/types").RegimeClassification | null;
      narrative: string | null;
      snapshot_date: string | null;
    };
    stocks: Stock[];
    todaysSignals: Signal[];
    todaysDaily: DailyTechnicals[];
    stockTechnicals: StockTechnicals[];
    recentTriggers: Signal[];
    recentSignals: Signal[];
  };
}

export function TradingClient({ data }: TradingClientProps) {
  const [selection, setSelection] = useState<SidePanelSelection | null>(null);

  const stockMap = useMemo(
    () => new Map(data.stocks.map((s) => [s.ticker, s])),
    [data.stocks],
  );
  const dailyMap = useMemo(
    () => new Map(data.todaysDaily.map((d) => [d.ticker, d])),
    [data.todaysDaily],
  );
  const techMap = useMemo(
    () => new Map(data.stockTechnicals.map((t) => [t.ticker, t])),
    [data.stockTechnicals],
  );

  // Per-ticker dominant setup → drives the four sections.
  const byTicker = useMemo(() => {
    const grouped = new Map<string, Signal[]>();
    for (const s of data.todaysSignals) {
      const arr = grouped.get(s.ticker) ?? [];
      arr.push(s);
      grouped.set(s.ticker, arr);
    }
    const triggered: Signal[] = [];
    const qualifying: Signal[] = [];
    for (const [, signals] of grouped) {
      const dom = dominantSignal(signals);
      if (!dom) continue;
      if (dom.state === "triggered_today") triggered.push(dom);
      else if (dom.state === "qualifies") qualifying.push(dom);
    }
    triggered.sort((a, b) => a.ticker.localeCompare(b.ticker));
    qualifying.sort((a, b) => a.ticker.localeCompare(b.ticker));
    return { triggered, qualifying };
  }, [data.todaysSignals]);

  // Recent triggers (the engine returns triggered_today rows from the last 5
  // trading days, excluding today). We sort by date desc, then by ticker.
  const recentTriggers = useMemo(() => {
    return [...data.recentTriggers].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.ticker.localeCompare(b.ticker);
    });
  }, [data.recentTriggers]);

  // Cooled down: any (ticker, setup) whose latest triggered_today row in the
  // lookback set has cooled_until > today AND is not currently triggered_today
  // (a same-day re-trigger would already be visible above; we don't double-list).
  const cooledDown = useMemo(() => {
    const today = data.date;
    const seen = new Set<string>();
    const out: Array<Signal & { remaining: number }> = [];
    // Walk recentTriggers (already sorted desc) — first hit per (ticker, setup)
    // is the latest trigger.
    for (const s of recentTriggers) {
      const key = `${s.ticker}|${s.setup_type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!s.cooled_until) continue;
      if (s.cooled_until <= today) continue;
      // Don't list if today's row for the same setup is already triggered.
      const todayMatch = compareSignalState(
        data.todaysSignals.find(
          (t) => t.ticker === s.ticker && t.setup_type === s.setup_type,
        )?.state ?? "none",
        "triggered_today",
      );
      if (todayMatch === 0) continue;
      const ms = Date.parse(`${s.cooled_until}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
      const remaining = Math.max(1, Math.ceil(ms / 86_400_000));
      out.push({ ...s, remaining });
    }
    return out;
  }, [recentTriggers, data.date, data.todaysSignals]);

  function pickRow(signal: Signal): SidePanelSelection | null {
    const stock = stockMap.get(signal.ticker);
    if (!stock) return null;
    return {
      stock,
      signal,
      daily: dailyMap.get(signal.ticker) ?? null,
      stockTechnicals: techMap.get(signal.ticker) ?? null,
    };
  }

  const hasAnyToday =
    byTicker.triggered.length > 0 || byTicker.qualifying.length > 0;

  return (
    <>
      <div className="space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-editorial text-3xl tracking-tight text-[var(--text-primary)]">
              Trading
            </h1>
            <p className="font-ui text-sm text-[var(--text-secondary)]">
              Daily setups across the watchlist · {data.date}
            </p>
          </div>
          <div className="min-w-[260px]">
            <RegimeBadge classification={data.regime.classification} />
          </div>
        </header>

        {/* Triggered today */}
        <Section
          title="Triggered today"
          subtitle="Required all true today. Stop and look."
          accent
        >
          {byTicker.triggered.length === 0 ? (
            <EmptyRow text="No setups triggered today." />
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {byTicker.triggered.map((s) => (
                <SignalRow
                  key={`${s.ticker}-${s.setup_type}`}
                  stock={stockMap.get(s.ticker)!}
                  signal={s}
                  stockTech={techMap.get(s.ticker) ?? null}
                  loud
                  onClick={() => {
                    const sel = pickRow(s);
                    if (sel) setSelection(sel);
                  }}
                />
              ))}
            </ul>
          )}
        </Section>

        {/* Currently qualifying */}
        <Section
          title="Currently qualifying"
          subtitle="Conditions still met from a prior trigger."
        >
          {byTicker.qualifying.length === 0 ? (
            <EmptyRow text="Nothing currently qualifying." />
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {byTicker.qualifying.map((s) => {
                const days = consecutiveQualifyingDays(
                  data.recentSignals,
                  s.ticker,
                  s.setup_type,
                );
                return (
                  <SignalRow
                    key={`${s.ticker}-${s.setup_type}`}
                    stock={stockMap.get(s.ticker)!}
                    signal={s}
                    stockTech={techMap.get(s.ticker) ?? null}
                    meta={`${days} day${days === 1 ? "" : "s"} qualifying`}
                    onClick={() => {
                      const sel = pickRow(s);
                      if (sel) setSelection(sel);
                    }}
                  />
                );
              })}
            </ul>
          )}
        </Section>

        {/* Recent triggers */}
        <Section
          title="Recent triggers"
          subtitle="Triggered_today within the last 5 trading days, but not today."
        >
          {recentTriggers.length === 0 ? (
            <EmptyRow text="No recent triggers in the lookback window." />
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {recentTriggers.map((s) => {
                const stock = stockMap.get(s.ticker);
                if (!stock) return null;
                return (
                  <SignalRow
                    key={`${s.ticker}-${s.setup_type}-${s.date}`}
                    stock={stock}
                    signal={s}
                    stockTech={techMap.get(s.ticker) ?? null}
                    meta={s.date}
                    onClick={() => {
                      const sel = pickRow(s);
                      if (sel) setSelection(sel);
                    }}
                  />
                );
              })}
            </ul>
          )}
        </Section>

        {/* Cooled down */}
        <Section
          title="Cooled down"
          subtitle="Recently triggered, still inside the cooldown window."
        >
          {cooledDown.length === 0 ? (
            <EmptyRow text="Nothing cooling down." />
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {cooledDown.map((s) => {
                const stock = stockMap.get(s.ticker);
                if (!stock) return null;
                return (
                  <SignalRow
                    key={`${s.ticker}-${s.setup_type}-${s.date}`}
                    stock={stock}
                    signal={s}
                    stockTech={techMap.get(s.ticker) ?? null}
                    meta={`${s.remaining}d cooldown`}
                    onClick={() => {
                      const sel = pickRow(s);
                      if (sel) setSelection(sel);
                    }}
                  />
                );
              })}
            </ul>
          )}
        </Section>

        {/* Empty-state intent line — when neither triggered nor qualifying */}
        {!hasAnyToday && (
          <div className="card p-6">
            <p className="prose-editorial text-[var(--text-secondary)]">
              Most days nothing fires. The watchlist is fundamentally vetted;
              the rule engine is only there to surface the moments when
              something tips into a tradeable setup. Today is a sit-on-hands
              day on{" "}
              <span className="text-[var(--text-primary)]">
                {data.regime.classification ?? "an unread regime"}
              </span>
              .
            </p>
          </div>
        )}
      </div>

      <SignalSidePanel
        selection={selection}
        onClose={() => setSelection(null)}
      />
    </>
  );
}

function Section({
  title,
  subtitle,
  accent,
  children,
}: {
  title: string;
  subtitle?: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`card overflow-hidden ${accent ? "amber-glow-soft" : ""}`}
    >
      <div className="flex items-baseline justify-between border-b border-[var(--border-subtle)] px-5 py-3">
        <div
          className="font-ui text-xs uppercase tracking-[0.3em]"
          style={{
            color: accent ? "var(--accent-amber)" : "var(--text-muted)",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div className="font-ui text-[11px] italic text-[var(--text-muted)]">
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <p className="px-5 py-6 text-center font-ui text-sm text-[var(--text-muted)]">
      {text}
    </p>
  );
}

function SignalRow({
  stock,
  signal,
  stockTech,
  meta,
  loud,
  onClick,
}: SignalRowProps) {
  const price = stockTech?.current_price ?? null;
  const change = stockTech?.price_change_pct ?? null;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`group flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-3 text-left transition-colors hover:bg-[var(--bg-elevated)] ${
          loud ? "bg-[var(--accent-amber)]/[0.04] hover:bg-[var(--accent-amber)]/[0.08]" : ""
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="w-[80px] shrink-0">
            <SignalBadge setup={signal.setup_type} state={signal.state} />
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-data text-base font-medium text-[var(--text-primary)]">
                {stock.ticker}
              </span>
              {stock.company_name && (
                <span className="font-ui text-xs text-[var(--text-secondary)]">
                  <span className="line-clamp-1">{stock.company_name}</span>
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 font-ui text-[11px] text-[var(--text-muted)]">
              <span>{SETUP_FULL[signal.setup_type]}</span>
              {meta && <span>· {meta}</span>}
            </div>
          </div>
        </div>

        <div className="hidden items-center sm:flex">
          <ConvictionPills grades={signal.conviction_grades} size="xs" />
        </div>

        <div className="flex w-[120px] shrink-0 flex-col items-end">
          <span className="font-data text-sm text-[var(--text-primary)]">
            {fmtPrice(price)}
          </span>
          <span
            className={`font-data text-xs ${
              change !== null && change >= 0 ? "value-up" : change !== null ? "value-down" : "value-flat"
            }`}
          >
            {fmtPct(change, 2)}
          </span>
        </div>

        <span
          aria-hidden
          className="font-data text-base text-[var(--text-muted)] transition-colors group-hover:text-[var(--accent-amber)]"
        >
          ›
        </span>
      </button>
    </li>
  );
}
