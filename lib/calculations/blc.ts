export interface BLCPhase {
  phase: number;
  label: string;
  revenue: string;
  gross: string;
  net: string;
  valuation: string;
  description: string;
}

export const BLC_PHASES: BLCPhase[] = [
  {
    phase: 1,
    label: "Startup",
    revenue: "None / little",
    gross: "Low / negative",
    net: "Negative",
    valuation: "P/S",
    description:
      "Pre-product-market-fit. Burning to find traction. Story-driven; numbers tell you almost nothing yet.",
  },
  {
    phase: 2,
    label: "Hyper Growth",
    revenue: "Growing rapidly",
    gross: "Growing rapidly",
    net: "Negative / expanding",
    valuation: "P/S",
    description:
      "Reinvesting every dollar. Top-line is the only metric that matters — losses are a feature, not a bug.",
  },
  {
    phase: 3,
    label: "Self Funding",
    revenue: "Growing rapidly",
    gross: "Growing rapidly",
    net: "Near breakeven",
    valuation: "P/S → P/E",
    description:
      "Operating leverage starting to kick in. Growth still strong. Margin trajectory becomes the watch.",
  },
  {
    phase: 4,
    label: "Operating Leverage",
    revenue: "Growing modestly",
    gross: "Stable",
    net: "Growing rapidly",
    valuation: "P/E",
    description:
      "Earnings compounding ahead of revenue. The classic compounder window. Reinvestment runway matters.",
  },
  {
    phase: 5,
    label: "Capital Return",
    revenue: "Growing slowly",
    gross: "Stable",
    net: "Growing slowly",
    valuation: "P/E, dividend",
    description:
      "Mature franchise. Buybacks and dividends drive the return. Watch capital allocation discipline.",
  },
  {
    phase: 6,
    label: "Decline",
    revenue: "Declining",
    gross: "Declining",
    net: "Declining",
    valuation: "Avoid",
    description:
      "Secular pressure. Often value-trap territory. Pass unless you have a specific reorg / break-up thesis.",
  },
];

export function blcPhaseLabel(phase: number | null | undefined): string {
  if (phase === null || phase === undefined) return "—";
  return BLC_PHASES.find((p) => p.phase === phase)?.label ?? "—";
}
