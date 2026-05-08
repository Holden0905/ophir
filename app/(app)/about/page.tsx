import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

// Editorial render of the Ophir trading framework. Source spec:
// docs/framework.md (treat that file as the source of truth — this page
// is the user-facing distillation, not a verbatim mirror).

interface SetupCondition {
  rule: string;
  reason: string;
}

interface ConvictionGrade {
  rule: string;
  badge: string;
}

const TREND_REQUIRED: SetupCondition[] = [
  { rule: "close > EMA(8)", reason: "Price above the short-term anchor — the trend is on, not off." },
  { rule: "EMA(5) rising 2+ days", reason: "Kills the falling knife. Persistence over a single-day flip." },
  { rule: "EMA(8) > EMA(21)", reason: "Short-term trend structure intact." },
  { rule: "40 < RSI(14) < 70", reason: "Out of oversold (real momentum) but not extended (no chase)." },
];

const TREND_CONVICTION: ConvictionGrade[] = [
  { rule: "Volume > 1.2× the 20-day average on trigger day", badge: "High volume" },
  { rule: "EMA(21) > SMA(50)", badge: "Mature trend" },
  { rule: "Sector RS positive vs SPY", badge: "Sector tailwind" },
];

const REVERSAL_REQUIRED: SetupCondition[] = [
  { rule: "close < 0.80 × 52-week high", reason: "Down 20%+ from highs — the prerequisite for a recovery setup." },
  { rule: "min(RSI(14)) over last 10 days < 35", reason: "Was actually oversold recently, not just pulled back." },
  { rule: "RSI(14) > 40 today", reason: "The turn is underway." },
  { rule: "EMA(5) rising 2+ days", reason: "Momentum turning up, not flickering." },
  { rule: "close > EMA(8)", reason: "Price has reclaimed the short-term anchor." },
];

const REVERSAL_CONVICTION: ConvictionGrade[] = [
  { rule: "Volume > 1.2× the 20-day average on trigger day", badge: "High volume" },
  { rule: "Up-volume > down-volume across last 5 sessions", badge: "Accumulation" },
  { rule: "EMA(8) crossed above EMA(21) recently", badge: "Trend reversal forming" },
];

interface RegimeRow {
  label: string;
  color: string;
  oneLiner: string;
  signals: string;
  trendActive: boolean;
  reversalActive: boolean;
}

const REGIMES: RegimeRow[] = [
  {
    label: "Risk On",
    color: "var(--regime-on)",
    oneLiner: "Trend up, breadth expanding, growth and cyclicals lead, VIX compressing.",
    signals:
      "SPX above the 21 EMA with positive momentum, leadership in XLK/XLY/XLC, VIX under 16 and not rising. Crypto risk-on flow tends to confirm.",
    trendActive: true,
    reversalActive: false,
  },
  {
    label: "Risk Off",
    color: "var(--regime-off)",
    oneLiner: "Trend down, defensives lead, VIX rising, breadth narrowing.",
    signals:
      "SPX below the 21 EMA, leadership in XLP/XLU/XLV, VIX elevated (≥ 20) and rising. Crypto bleeding in tandem.",
    trendActive: false,
    reversalActive: true,
  },
  {
    label: "Transitional",
    color: "var(--regime-transition)",
    oneLiner: "Leadership rotating, conflicting signals — the regime is in flux.",
    signals:
      "Macro hovering near the 21 EMA, sector RS top‑3 on 5D doesn't match top‑3 on 30D, VIX neither expanding nor compressing decisively.",
    trendActive: true,
    reversalActive: true,
  },
  {
    label: "Choppy",
    color: "var(--regime-choppy)",
    oneLiner: "Rangebound, no clear leadership, low-conviction tape.",
    signals:
      "SPX pinning the 21 EMA, sector RS clustered around zero, VIX flat in the 14–18 range. The tape isn't telling you anything.",
    trendActive: false,
    reversalActive: true,
  },
];

interface MatrixColumn {
  name: string;
  description: string;
  source: string;
  cadence: string;
}

const MATRIX_COLUMNS: MatrixColumn[] = [
  {
    name: "Price / Day",
    description: "Last regular-session price and intraday percentage change.",
    source: "Yahoo Finance (live quote)",
    cadence: "Every 60s while the page is open",
  },
  {
    name: "Setup",
    description:
      "The dominant Trend Continuation or Reversal/Recovery state for the ticker today: triggered, qualifies, or none.",
    source: "Computed daily by the signal engine from daily_technicals",
    cadence: "Once per weekday after the close",
  },
  {
    name: "BLC",
    description:
      "Feroldi/Stoffel Business Lifecycle phase (1–6). Set manually — the system never overrides this judgment.",
    source: "Manual",
    cadence: "Set when the name is added; revised on earnings",
  },
  {
    name: "MktCap",
    description: "Market capitalization in USD.",
    source: "Alpha Vantage (OVERVIEW)",
    cadence: "Cached for 7 days; refreshes on demand",
  },
  {
    name: "Q/Q Rev",
    description:
      "Most recent quarter's revenue vs the prior quarter — a true sequential growth read.",
    source: "FMP primary, Yahoo fallback, Alpha Vantage last resort (Y/Y on free tier)",
    cadence: "Cached for 7 days; refreshes on demand",
  },
  {
    name: "Y/Y Rev",
    description: "Most recent quarter's revenue vs the same quarter a year ago.",
    source: "Alpha Vantage (OVERVIEW)",
    cadence: "Cached for 7 days; refreshes on demand",
  },
  {
    name: "GM / NM",
    description: "Gross margin and net margin, expressed as a percentage of revenue.",
    source: "Alpha Vantage",
    cadence: "Cached for 7 days; refreshes on demand",
  },
  {
    name: "N / G",
    description:
      "Net-to-gross ratio — how much of each gross-profit dollar drops to the bottom line. Tracks operating leverage.",
    source: "Computed (net_margin / gross_margin)",
    cadence: "Live with fundamentals refresh",
  },
  {
    name: "Debt / Cap",
    description: "Net debt divided by market capitalization. A coarse leverage check.",
    source: "FMP primary, Alpha Vantage fallback",
    cadence: "Cached for 7 days; refreshes on demand",
  },
  {
    name: "vs 50 MA",
    description: "Percentage distance of the last close from the 50-day simple moving average.",
    source: "Computed from Yahoo daily series",
    cadence: "Refreshes when stock data is refreshed",
  },
  {
    name: "vs 21 EMA",
    description:
      "Percentage distance of the last close from the 21-day exponential moving average — Brian Shannon's medium-term anchor.",
    source: "Computed from Yahoo daily series",
    cadence: "Refreshes when stock data is refreshed",
  },
];

function PillarBadge({ tone }: { tone: "active" | "muted" }) {
  if (tone === "active") {
    return (
      <span className="rounded-full bg-[var(--accent-amber)]/15 px-2 py-0.5 font-ui text-[10px] uppercase tracking-wider text-[var(--accent-amber)]">
        Active
      </span>
    );
  }
  return (
    <span className="rounded-full border border-[var(--border)] px-2 py-0.5 font-ui text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
      Suppressed
    </span>
  );
}

function SetupCard({
  title,
  thesis,
  required,
  conviction,
  regimeOn,
  regimeOff,
}: {
  title: string;
  thesis: string;
  required: SetupCondition[];
  conviction: ConvictionGrade[];
  regimeOn: string;
  regimeOff: string;
}) {
  return (
    <article className="card p-6">
      <h3 className="font-editorial text-2xl tracking-tight text-[var(--text-primary)]">
        {title}
      </h3>
      <p className="mt-2 prose-editorial italic text-[var(--text-secondary)]">
        {thesis}
      </p>

      <div className="mt-6">
        <div className="font-ui text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
          Required — all must be true
        </div>
        <ul className="mt-3 space-y-3">
          {required.map((c) => (
            <li key={c.rule} className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[18rem_1fr]">
              <code className="font-data text-sm text-[var(--accent-amber)]">
                {c.rule}
              </code>
              <p className="font-ui text-sm text-[var(--text-secondary)]">
                {c.reason}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        <div className="font-ui text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
          Conviction — earned, not gated
        </div>
        <ul className="mt-3 space-y-2">
          {conviction.map((c) => (
            <li key={c.rule} className="flex flex-wrap items-center gap-3">
              <span className="rounded bg-[var(--bg-elevated)] px-2 py-0.5 font-ui text-[10px] uppercase tracking-wider text-[var(--accent-amber)]">
                {c.badge}
              </span>
              <span className="font-ui text-sm text-[var(--text-secondary)]">
                {c.rule}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded border border-[var(--border-subtle)] p-3">
          <div className="font-ui text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            Active in
          </div>
          <p className="mt-1 font-ui text-sm text-[var(--text-primary)]">
            {regimeOn}
          </p>
        </div>
        <div className="rounded border border-[var(--border-subtle)] p-3">
          <div className="font-ui text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            Suppressed in
          </div>
          <p className="mt-1 font-ui text-sm text-[var(--text-primary)]">
            {regimeOff}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-12">
      <header>
        <p className="font-ui text-[10px] uppercase tracking-[0.3em] text-[var(--accent-amber)]">
          The framework
        </p>
        <h1 className="mt-2 font-editorial text-4xl tracking-tight text-[var(--text-primary)]">
          About Ophir
        </h1>
        <p className="mt-3 prose-editorial text-[var(--text-secondary)]">
          Ophir is a personal market-intelligence system for a swing trader who
          already knows what they want to own. The watchlist is the slow,
          judgment-based layer — quality businesses, vetted by hand. The signal
          engine is the fast, rule-based layer running on top of that vetted
          universe, surfacing the moments when a name tips into a tradeable
          setup. This page documents how that engine thinks.
        </p>
      </header>

      <section className="space-y-6">
        <SectionLabel label="Approach" />
        <div className="card p-6">
          <p className="prose-editorial">
            Three pillars hold the framework up.{" "}
            <strong>Feroldi/Stoffel BLC phases</strong> answer{" "}
            <em>what to own</em> — fundamental quality and where a business sits
            in its lifecycle.{" "}
            <strong>Brian Shannon&apos;s Alpha Trends</strong> answer{" "}
            <em>when to enter</em> — EMA-based timing on the 5/8/21.{" "}
            <strong>Regime context</strong> answers{" "}
            <em>how aggressive to be</em> — Risk On, Risk Off, Transitional, or
            Choppy.
          </p>
          <p className="prose-editorial">
            Two setups capture all the action. <strong>Trend Continuation</strong>{" "}
            is the workhorse — most days, most regimes — catching the resumption
            of an established uptrend after a pause.{" "}
            <strong>Reversal/Recovery</strong> is the specialty trade — rarer,
            higher conviction, fires only on quality names that have been beaten
            up and are showing the first signs of a turn.
          </p>
        </div>
      </section>

      <section className="space-y-6">
        <SectionLabel label="Signal logic" />
        <SetupCard
          title="Trend Continuation"
          thesis="The name is in an established uptrend, just had a pullback or pause, now resuming. Catch the resumption — don't chase the extension."
          required={TREND_REQUIRED}
          conviction={TREND_CONVICTION}
          regimeOn="Risk On, Transitional"
          regimeOff="Risk Off, Choppy"
        />
        <SetupCard
          title="Reversal / Recovery"
          thesis="A quality name has been beaten up and is showing signs of bottoming. Higher conviction because rarer — when one fires on a vetted watchlist name, stop and look."
          required={REVERSAL_REQUIRED}
          conviction={REVERSAL_CONVICTION}
          regimeOn="Risk Off, Transitional, Choppy"
          regimeOff="Risk On (most names won't qualify — nothing is beaten up)"
        />

        <article className="card p-6">
          <h3 className="font-editorial text-xl tracking-tight text-[var(--text-primary)]">
            State machine
          </h3>
          <p className="mt-2 prose-editorial text-[var(--text-secondary)]">
            For each name, for each setup, the engine maintains one of three
            states. Transitions are what matter — a name sitting in{" "}
            <em>qualifies</em> for a week is wallpaper, but a name moving from{" "}
            <em>none</em> to <em>triggered</em> is news.
          </p>
          <ul className="mt-4 space-y-3">
            <li className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[10rem_1fr]">
              <span className="rounded bg-[var(--accent-amber)]/15 px-2 py-1 text-center font-ui text-[10px] uppercase tracking-wider text-[var(--accent-amber)]">
                triggered_today
              </span>
              <p className="font-ui text-sm text-[var(--text-secondary)]">
                Required all true today AND not all true yesterday — the
                transition that matters.
              </p>
            </li>
            <li className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[10rem_1fr]">
              <span className="rounded border border-[var(--border)] px-2 py-1 text-center font-ui text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                qualifies
              </span>
              <p className="font-ui text-sm text-[var(--text-secondary)]">
                Required all true today AND yesterday — the conditions persist
                but the window has likely passed.
              </p>
            </li>
            <li className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[10rem_1fr]">
              <span className="rounded px-2 py-1 text-center font-ui text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                none
              </span>
              <p className="font-ui text-sm text-[var(--text-secondary)]">
                Required not all true today.
              </p>
            </li>
          </ul>
        </article>

        <article className="card p-6">
          <h3 className="font-editorial text-xl tracking-tight text-[var(--text-primary)]">
            False-signal controls
          </h3>
          <ul className="mt-4 space-y-4">
            <li>
              <div className="font-ui text-sm font-medium text-[var(--text-primary)]">
                Cooldown — 5 trading days
              </div>
              <p className="mt-1 font-ui text-sm text-[var(--text-secondary)]">
                Once a setup triggers on a name, that same setup cannot
                re-trigger for 5 trading days. Prevents whipsaw on names
                oscillating around the 8 EMA.
              </p>
            </li>
            <li>
              <div className="font-ui text-sm font-medium text-[var(--text-primary)]">
                Setup precedence
              </div>
              <p className="mt-1 font-ui text-sm text-[var(--text-secondary)]">
                If a name qualifies for both setups simultaneously, Reversal /
                Recovery takes the badge. Higher conviction, rarer, more
                interesting.
              </p>
            </li>
            <li>
              <div className="font-ui text-sm font-medium text-[var(--text-primary)]">
                EMA persistence
              </div>
              <p className="mt-1 font-ui text-sm text-[var(--text-secondary)]">
                A rising 5 EMA requires two consecutive day-over-day increases
                — a single-day uptick doesn&apos;t count.
              </p>
            </li>
          </ul>
        </article>
      </section>

      <section className="space-y-6">
        <SectionLabel label="Regime classifications" />
        <p className="prose-editorial text-[var(--text-secondary)]">
          The regime is the lens that decides which setups are even live. It is
          inferred each pre-market and end-of-day from the macro pulse, sector
          rotation, and crypto barometer. The classifier looks for the
          following shape — but the call is contextual, and the brief explains
          the reasoning each session.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {REGIMES.map((r) => (
            <article
              key={r.label}
              className="card p-5"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: r.color }}
                />
                <h3
                  className="font-editorial text-xl tracking-tight"
                  style={{ color: r.color }}
                >
                  {r.label}
                </h3>
              </div>
              <p className="mt-2 font-ui text-sm text-[var(--text-primary)]">
                {r.oneLiner}
              </p>
              <p className="mt-3 font-ui text-[13px] leading-relaxed text-[var(--text-secondary)]">
                {r.signals}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-3 font-ui text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                  Trend{" "}
                  <PillarBadge tone={r.trendActive ? "active" : "muted"} />
                </span>
                <span className="flex items-center gap-1.5">
                  Reversal{" "}
                  <PillarBadge tone={r.reversalActive ? "active" : "muted"} />
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionLabel label="Fundamentals reference" />
        <p className="prose-editorial text-[var(--text-secondary)]">
          Every column in the Research Matrix and Trading panel maps to a
          source and an update cadence. Live quotes refresh every minute the
          page is open; cached fundamentals refresh on a 7-day TTL or when you
          press <em>Refresh data</em>.
        </p>
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--bg-elevated)] font-ui text-[10px] uppercase tracking-[0.25em] text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3">Column</th>
                <th className="px-4 py-3">What it shows</th>
                <th className="hidden px-4 py-3 md:table-cell">Source</th>
                <th className="hidden px-4 py-3 md:table-cell">Updated</th>
              </tr>
            </thead>
            <tbody>
              {MATRIX_COLUMNS.map((c) => (
                <tr
                  key={c.name}
                  className="border-b border-[var(--border-subtle)] last:border-none align-top"
                >
                  <td className="px-4 py-3 font-data text-sm font-medium text-[var(--text-primary)]">
                    {c.name}
                  </td>
                  <td className="px-4 py-3 font-ui text-sm text-[var(--text-secondary)]">
                    {c.description}
                    <div className="mt-1 font-ui text-[11px] text-[var(--text-muted)] md:hidden">
                      {c.source} · {c.cadence}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 font-ui text-xs text-[var(--text-secondary)] md:table-cell">
                    {c.source}
                  </td>
                  <td className="hidden px-4 py-3 font-ui text-xs text-[var(--text-muted)] md:table-cell">
                    {c.cadence}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="border-t border-[var(--border-subtle)] pt-6 font-ui text-xs text-[var(--text-muted)]">
        Source spec lives at <code className="font-data">docs/framework.md</code>.
        Treat that file as canonical when this page and the spec diverge.
      </footer>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="font-ui text-[10px] uppercase tracking-[0.3em] text-[var(--accent-amber)]">
      {label}
    </div>
  );
}
