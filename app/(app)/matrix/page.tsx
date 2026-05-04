import { createClient } from "@/lib/supabase/server";
import { MatrixClient } from "./MatrixClient";
import type {
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
}

export default async function MatrixPage() {
  const supabase = await createClient();

  const { data: stocks } = await supabase
    .from("stocks")
    .select("*")
    .eq("is_archived", false)
    .order("ticker", { ascending: true });

  const tickers = (stocks ?? []).map((s) => s.ticker);

  let fundamentals: StockFundamentals[] = [];
  let technicals: StockTechnicals[] = [];
  if (tickers.length > 0) {
    const [fRes, tRes] = await Promise.all([
      supabase.from("stock_fundamentals").select("*").in("ticker", tickers),
      supabase.from("stock_technicals").select("*").in("ticker", tickers),
    ]);
    fundamentals = (fRes.data ?? []) as StockFundamentals[];
    technicals = (tRes.data ?? []) as StockTechnicals[];
  }

  const fMap = new Map(fundamentals.map((f) => [f.ticker, f]));
  const tMap = new Map(technicals.map((t) => [t.ticker, t]));

  const rows: MatrixRow[] = (stocks ?? []).map((stock) => ({
    stock: stock as Stock,
    fundamentals: fMap.get(stock.ticker) ?? null,
    technicals: tMap.get(stock.ticker) ?? null,
  }));

  return <MatrixClient initialRows={rows} />;
}
