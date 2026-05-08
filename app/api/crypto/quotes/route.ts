import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { fetchCoreCrypto, classifyCryptoRegime } from "@/lib/data/coingecko";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Live BTC/ETH/SOL quote with 24h change. Used by the Regime dashboard's
// 60s poll. Crypto runs 24/7 so this is always pollable.
export async function GET() {
  await requireUser();
  try {
    const c = await fetchCoreCrypto();
    return NextResponse.json(
      {
        quotes: {
          btc: { price: c.btc.price, change24h: c.btc.change24h },
          eth: { price: c.eth.price, change24h: c.eth.change24h },
          sol: { price: c.sol.price, change24h: c.sol.change24h },
        },
        regime: classifyCryptoRegime(c.btc, c.eth, c.sol),
        fetched_at: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
