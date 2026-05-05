import { createClient } from "@/lib/supabase/server";
import { MatrixClient } from "./MatrixClient";
import { nyDate } from "@/lib/signals/dates";
import type {
  DailyTechnicals,
  Signal,
  Stock,
  StockFundamentals,
  StockTechnicals,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Matrix" };

export interface MatrixRow {
  stock: Stock;
  fundamentals: StockFundamentals | null;
  technicals: StockTechnicals | null;
  signals: Signal[];
  daily: DailyTechnicals | null;
}

export default async function MatrixPage() {
  const supabase = await createClient();
  const today = nyDate();

  const { data: stocks } = await supabase
    .from("stocks")
    .select("*")
    .eq("is_archived", false)
    .order("ticker", { ascending: true });

  const tickers = (stocks ?? []).map((s) => s.ticker);

  let fundamentals: StockFundamentals[] = [];
  let technicals: StockTechnicals[] = [];
  let signals: Signal[] = [];
  let daily: DailyTechnicals[] = [];
  if (tickers.length > 0) {
    const [fRes, tRes, sRes, dRes] = await Promise.all([
      supabase.from("stock_fundamentals").select("*").in("ticker", tickers),
      supabase.from("stock_technicals").select("*").in("ticker", tickers),
      supabase
        .from("signals")
        .select("*")
        .in("ticker", tickers)
        .eq("date", today),
      supabase
        .from("daily_technicals")
        .select("*")
        .in("ticker", tickers)
        .eq("date", today),
    ]);
    fundamentals = (fRes.data ?? []) as StockFundamentals[];
    technicals = (tRes.data ?? []) as StockTechnicals[];
    signals = (sRes.data ?? []) as Signal[];
    daily = (dRes.data ?? []) as DailyTechnicals[];
  }

  const fMap = new Map(fundamentals.map((f) => [f.ticker, f]));
  const tMap = new Map(technicals.map((t) => [t.ticker, t]));
  const dMap = new Map(daily.map((d) => [d.ticker, d]));
  const sMap = new Map<string, Signal[]>();
  for (const s of signals) {
    const arr = sMap.get(s.ticker) ?? [];
    arr.push(s);
    sMap.set(s.ticker, arr);
  }

  const rows: MatrixRow[] = (stocks ?? []).map((stock) => ({
    stock: stock as Stock,
    fundamentals: fMap.get(stock.ticker) ?? null,
    technicals: tMap.get(stock.ticker) ?? null,
    signals: sMap.get(stock.ticker) ?? [],
    daily: dMap.get(stock.ticker) ?? null,
  }));

  return <MatrixClient initialRows={rows} />;
}
