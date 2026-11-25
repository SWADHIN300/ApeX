"use client";

import { useMarket } from "@/contexts/MarketContext";
import { useNetwork } from "@/contexts/WalletProvider";
import { usePaperTrading } from "@/contexts/PaperTradingContext";
import { useOracle } from "@/hooks/useOracle";

function money(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TradeMarketHeader() {
  const { market } = useMarket();
  const { network } = useNetwork();
  const { isPaperTrading } = usePaperTrading();
  const oracle = useOracle();
  const change = market?.change24h ?? 0;
  const changeUp = change >= 0;
  const environmentLabel = isPaperTrading
    ? "Paper · Devnet"
    : network === "devnet"
      ? "Devnet"
      : "Mainnet";
  const compactEnvironmentLabel = isPaperTrading
    ? "Paper"
    : network === "devnet"
      ? "Devnet"
      : "Mainnet";

  const environmentBadge = (
    <span className={`inline-flex shrink-0 items-center gap-1.5 border px-2 py-1 text-[9px] font-mono font-semibold uppercase tracking-wider ${
      isPaperTrading
        ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
        : "border-t-border bg-bg-l2 text-text-muted"
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${isPaperTrading || network === "devnet" ? "bg-amber-400" : "bg-long"}`} />
      {environmentLabel}
    </span>
  );

  return (
    <header className="col-span-12 min-w-0 border-b border-t-border bg-bg-surface px-3 py-2 lg:grid lg:h-16 lg:grid-cols-12 lg:items-center lg:px-4 lg:py-0">
      <div className="flex min-w-0 items-center gap-3 lg:col-span-7 lg:h-full lg:border-r lg:border-t-border">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="hidden h-9 w-9 shrink-0 items-center justify-center border border-t-border bg-bg-l2 font-mono text-xs font-semibold text-primary sm:flex">
            {market?.symbol?.slice(0, 1) ?? "A"}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-mono text-sm font-semibold tracking-tight text-text-main sm:text-base">
                {market?.symbol ?? "BTC-PERP"}
              </h1>
              <span className="hidden border border-t-border-soft bg-bg-l2 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-text-muted sm:inline-block">
                Perpetual
              </span>
            </div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="font-mono text-lg font-semibold tabular-nums text-text-main sm:text-2xl">
                ${money(market?.price)}
              </span>
              <span className={`font-mono text-[11px] font-medium tabular-nums sm:text-xs ${changeUp ? "text-long" : "text-short"}`}>
                {changeUp ? "+" : ""}{change.toFixed(2)}%
              </span>
            </div>
          </div>
          <div className="ml-2 hidden items-center gap-2 border-l border-t-border pl-4 lg:flex">
            <span className="text-[9px] font-mono uppercase tracking-wider text-text-muted">Mark</span>
            <span className="font-mono text-xs tabular-nums text-text-main">${money(oracle?.oraclePrice)}</span>
          </div>
        </div>

        <span className="ml-auto inline-flex shrink-0 items-center gap-1 border border-t-border bg-bg-l2 px-1.5 py-1 text-[8px] font-mono font-semibold uppercase tracking-wider text-text-muted lg:hidden">
          <span className={`h-1.5 w-1.5 rounded-full ${isPaperTrading || network === "devnet" ? "bg-amber-400" : "bg-long"}`} />
          {compactEnvironmentLabel}
        </span>
      </div>

      <dl className="hidden min-w-0 grid-cols-[repeat(3,minmax(0,1fr))_auto] items-center gap-3 pl-4 lg:col-span-5 lg:grid lg:gap-4">
        <div className="min-w-0">
          <dt className="text-[9px] font-mono uppercase tracking-wider text-text-muted">24h high</dt>
          <dd className="mt-1 truncate font-mono text-xs tabular-nums text-text-main">${money(market?.high24h)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[9px] font-mono uppercase tracking-wider text-text-muted">24h low</dt>
          <dd className="mt-1 truncate font-mono text-xs tabular-nums text-text-main">${money(market?.low24h)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[9px] font-mono uppercase tracking-wider text-text-muted">24h volume</dt>
          <dd className="mt-1 truncate font-mono text-xs tabular-nums text-text-main">{market?.volume24h || "—"}</dd>
        </div>
        <div>{environmentBadge}</div>
      </dl>

      <details className="mt-2 border-t border-t-border pt-1.5 lg:hidden">
        <summary className="cursor-pointer list-none text-[9px] font-mono uppercase tracking-wider text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          Market stats
        </summary>
        <dl className="mt-2 grid grid-cols-3 gap-3 pb-1">
          <div>
            <dt className="text-[9px] font-mono uppercase tracking-wider text-text-muted">24h high</dt>
            <dd className="mt-1 font-mono text-[11px] tabular-nums text-text-main">${money(market?.high24h)}</dd>
          </div>
          <div>
            <dt className="text-[9px] font-mono uppercase tracking-wider text-text-muted">24h low</dt>
            <dd className="mt-1 font-mono text-[11px] tabular-nums text-text-main">${money(market?.low24h)}</dd>
          </div>
          <div>
            <dt className="text-[9px] font-mono uppercase tracking-wider text-text-muted">24h volume</dt>
            <dd className="mt-1 truncate font-mono text-[11px] tabular-nums text-text-main">{market?.volume24h || "—"}</dd>
          </div>
        </dl>
      </details>
    </header>
  );
}
