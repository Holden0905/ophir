import "server-only";

const CG_BASE = "https://api.coingecko.com/api/v3";

export interface CryptoQuote {
  id: string;
  symbol: string;
  price: number | null;
  change24h: number | null;
}

const CG_IDS = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
} as const;

export async function fetchCoreCrypto(): Promise<{
  btc: CryptoQuote;
  eth: CryptoQuote;
  sol: CryptoQuote;
}> {
  const ids = Object.values(CG_IDS).join(",");
  const url = `${CG_BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    throw new Error(`CoinGecko ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as Record<
    string,
    { usd?: number; usd_24h_change?: number }
  >;
  const pull = (id: string, symbol: string): CryptoQuote => ({
    id,
    symbol,
    price: json[id]?.usd ?? null,
    change24h: json[id]?.usd_24h_change ?? null,
  });
  return {
    btc: pull(CG_IDS.BTC, "BTC"),
    eth: pull(CG_IDS.ETH, "ETH"),
    sol: pull(CG_IDS.SOL, "SOL"),
  };
}

export function classifyCryptoRegime(
  btc: CryptoQuote,
  eth: CryptoQuote,
  sol: CryptoQuote,
): string {
  const changes = [btc.change24h, eth.change24h, sol.change24h].filter(
    (n): n is number => n !== null,
  );
  if (changes.length === 0) return "unknown";
  const avg = changes.reduce((a, b) => a + b, 0) / changes.length;
  const allUp = changes.every((c) => c > 0);
  const allDown = changes.every((c) => c < 0);
  if (allUp && avg > 2) return "risk-on flow";
  if (allDown && avg < -2) return "risk-off bleed";
  if (avg > 0) return "constructive";
  if (avg < 0) return "soft";
  return "flat";
}
