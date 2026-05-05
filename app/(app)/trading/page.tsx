import { fetchTradingPageData } from "@/lib/signals/queries";
import { nyDate } from "@/lib/signals/dates";
import { TradingClient } from "./TradingClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Trading" };

export default async function TradingPage() {
  const today = nyDate();
  const data = await fetchTradingPageData(today);
  return <TradingClient data={data} />;
}
