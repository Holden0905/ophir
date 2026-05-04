import { NextResponse } from "next/server";
import { fetchCoreCrypto, classifyCryptoRegime } from "@/lib/data/coingecko";
import { requireUser } from "@/lib/auth/dal";

export const runtime = "nodejs";

export async function GET() {
  await requireUser();
  const c = await fetchCoreCrypto();
  return NextResponse.json({
    btc: c.btc,
    eth: c.eth,
    sol: c.sol,
    regime: classifyCryptoRegime(c.btc, c.eth, c.sol),
  });
}
