"use client";

import { useOracle } from "@/hooks/useOracle";
import { useMarket } from "@/contexts/MarketContext";
import { useNetwork } from "@/contexts/WalletProvider";

export default function StatsBar() {
  const oracle = useOracle();
  const { market } = useMarket();
  const { network } = useNetwork();

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2 });

  const referencePrice = oracle?.referencePrice ?? market?.price ?? 0;
  const oraclePrice = oracle?.oraclePrice ?? null;
  const isOracleValid = oracle?.isOracleValid ?? false;

  return (
    <div className="bg-surface-container-lowest border-b border-outline-variant px-gutter py-2 flex items-center justify-between overflow-x-auto whitespace-nowrap gap-8">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-headline-sm">{market?.symbol ?? "BTC/USDC"}</span>
          <span className="text-value-md text-secondary">${fmt(referencePrice)}</span>
        </div>

        {/* On-chain Pyth oracle mark price */}
        <div className="flex flex-col">
          <span className="text-label-sm text-on-surface-variant">
            Mark Price (Oracle)
          </span>
          {oraclePrice !== null ? (
            <span className={`text-value-sm ${isOracleValid ? "text-secondary" : "text-on-surface-variant"}`}>
              ${fmt(oraclePrice)}
              {!isOracleValid && (
                <span className="text-[9px] ml-1 text-on-surface-variant opacity-60">STALE</span>
              )}
            </span>
          ) : (
            <span className="text-value-sm text-on-surface-variant opacity-50">
              --
            </span>
          )}
        </div>

        <div className="flex flex-col">
          <span className="text-label-sm text-on-surface-variant">24h Change</span>
          <span
            className="text-value-sm"
            style={{ color: (market?.change24h ?? 0) >= 0 ? "var(--long)" : "var(--short)" }}
          >
            {(market?.change24h ?? 0) > 0 ? "+" : ""}
            {(market?.change24h ?? 0).toFixed(2)}%
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-label-sm text-on-surface-variant">24h Volume</span>
          <span className="text-value-sm text-on-surface">
            {market?.volume24h ?? "$0"}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-label-sm text-on-surface-variant">Funding Rate</span>
          <span className="text-value-sm text-secondary">0.01%</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: network === "devnet" ? "var(--warning, orange)" : "var(--secondary)" }}
        />
        <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">
          {network === "devnet" ? "Devnet" : "Mainnet-Beta"}
        </span>
      </div>
    </div>
  );
}
