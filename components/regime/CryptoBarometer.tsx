import { DataCell } from "@/components/shared/DataCell";
import { fmtPrice } from "@/lib/format";
import type { RegimeSnapshot } from "@/lib/supabase/types";

export function CryptoBarometer({
  snapshot,
}: {
  snapshot: RegimeSnapshot | null;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="font-ui text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
          Crypto Barometer
        </div>
        {snapshot?.crypto_regime && (
          <span className="font-ui text-[10px] uppercase tracking-wider text-[var(--accent-amber)]">
            {snapshot.crypto_regime}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Coin
          label="BTC"
          price={snapshot?.btc_price ?? null}
          change24h={snapshot?.btc_change_24h ?? null}
          digits={0}
        />
        <Coin
          label="ETH"
          price={snapshot?.eth_price ?? null}
          change24h={snapshot?.eth_change_24h ?? null}
          digits={0}
        />
        <Coin
          label="SOL"
          price={snapshot?.sol_price ?? null}
          change24h={snapshot?.sol_change_24h ?? null}
          digits={2}
        />
      </div>
    </div>
  );
}

function Coin({
  label,
  price,
  change24h,
  digits,
}: {
  label: string;
  price: number | null;
  change24h: number | null;
  digits: number;
}) {
  return (
    <div>
      <div className="font-ui text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 font-data text-xl text-[var(--text-primary)]">
        {price !== null ? fmtPrice(price, digits) : "—"}
      </div>
      <div className="mt-0.5 text-xs">
        <DataCell value={change24h} format="pct" digits={2} align="left" />
      </div>
    </div>
  );
}
