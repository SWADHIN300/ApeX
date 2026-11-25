"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { useMarket } from "@/contexts/MarketContext";
import { useNetwork } from "@/contexts/WalletProvider";
import { usePaperTrading } from "@/contexts/PaperTradingContext";
import { useOracle } from "@/hooks/useOracle";
import CoinIcon from "./CoinIcon";

function money(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TradeMarketHeader() {
  const { market, markets, setMarket } = useMarket();
  const { network } = useNetwork();
  const { isPaperTrading } = usePaperTrading();
  const oracle = useOracle();
  const [marketMenuOpen, setMarketMenuOpen] = useState(false);
  const [marketSearch, setMarketSearch] = useState("");
  const marketSearchRef = useRef<HTMLInputElement>(null);
  const initialMarketHandled = useRef(false);
  const change = market?.price ? market.change24h : null;
  const changeUp = (change ?? 0) >= 0;
  const env = isPaperTrading ? "Paper · Devnet" : network === "devnet" ? "Devnet" : "Mainnet";

  const stats = [
    { label: "24h high", value: `$${money(market?.high24h)}` },
    { label: "24h low", value: `$${money(market?.low24h)}` },
    { label: "24h volume", value: market?.volume24h || "—" },
    { label: "Mark price", value: `$${money(oracle?.oraclePrice)}` },
  ];

  useEffect(() => {
    if (initialMarketHandled.current || !markets.length) return;
    if (market?.symbol === "ETH-PERP") {
      initialMarketHandled.current = true;
      return;
    }
    if (market?.symbol !== "BTC-PERP" || markets.length > 1) {
      const ethereum = markets.find((item) => item.symbol === "ETH-PERP");
      if (ethereum && market?.symbol === "BTC-PERP") setMarket(ethereum);
      initialMarketHandled.current = true;
    }
  }, [market?.symbol, markets, setMarket]);

  useEffect(() => {
    if (!marketMenuOpen) return;
    marketSearchRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMarketMenuOpen(false);
        setMarketSearch("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [marketMenuOpen]);

  const filteredMarkets = markets.filter((item) => {
    const query = marketSearch.trim().toLowerCase();
    return !query || item.symbol.toLowerCase().includes(query) || item.symbol.replace(/-perp$/i, "").toLowerCase().includes(query);
  });

  return (
    <header className="trade-market-header col-span-12 min-w-0 border-b border-t-border bg-bg-surface">
      <div className="trade-market-main relative flex min-w-0 items-center gap-3 px-3 lg:px-4">
        <button
          type="button"
          aria-expanded={marketMenuOpen}
          aria-controls="trade-market-menu"
          aria-label="Choose perpetual market"
          onClick={() => {
            setMarketMenuOpen((open) => {
              if (open) setMarketSearch("");
              return !open;
            });
          }}
          className="flex min-w-0 items-center gap-2.5 text-left hover:bg-bg-l2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <CoinIcon symbol={market?.symbol ?? "ETH-PERP"} size={34} />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="trade-symbol truncate font-semibold text-sm text-text-main">{market?.symbol ?? "Market"}</span>
              <span className="hidden border border-t-border-soft bg-bg-l2 px-1 py-0.5 text-[8px] font-mono uppercase tracking-wider text-text-muted sm:inline">Perp</span>
              <ChevronDown size={14} className="shrink-0 text-text-muted" />
            </span>
            <span className="mt-0.5 flex items-center gap-2 font-mono tabular-nums">
              <span className="trade-price font-semibold text-text-main">${money(market?.price)}</span>
              <span className={`text-[11px] font-medium ${change === null ? "text-text-muted" : changeUp ? "text-long" : "text-short"}`}>{change === null ? "—" : `${changeUp ? "+" : ""}${change.toFixed(2)}%`}</span>
            </span>
          </span>
        </button>
        {marketMenuOpen && (
          <div id="trade-market-menu" className="absolute left-3 top-[calc(100%-2px)] z-40 flex max-h-[min(24rem,calc(100vh-8rem))] w-72 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden border border-t-border bg-bg-l1 shadow-xl lg:left-4">
            <div className="flex items-center gap-2 border-b border-t-border px-3 py-2">
              <Search size={15} className="shrink-0 text-text-muted" aria-hidden="true" />
              <input
                ref={marketSearchRef}
                type="search"
                value={marketSearch}
                onChange={(event) => setMarketSearch(event.target.value)}
                placeholder="Search coins"
                aria-label="Search perpetual markets"
                autoComplete="off"
                className="h-8 min-w-0 flex-1 bg-transparent text-sm text-text-main outline-none placeholder:text-text-muted"
              />
              {marketSearch && (
                <button type="button" aria-label="Clear coin search" onClick={() => { setMarketSearch(""); marketSearchRef.current?.focus(); }} className="shrink-0 text-text-muted hover:text-text-main">
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="min-h-0 overflow-y-auto py-1">
            {filteredMarkets.length > 0 ? filteredMarkets.map((item) => (
              <button
                key={item.symbol}
                type="button"
                onClick={() => { setMarket(item); setMarketMenuOpen(false); setMarketSearch(""); }}
                aria-current={item.symbol === market?.symbol ? "true" : undefined}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-bg-l2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${item.symbol === market?.symbol ? "bg-bg-l2" : ""}`}
              >
                <CoinIcon symbol={item.symbol} size={22} />
                <span className="flex-1 font-medium text-xs text-text-main">{item.symbol}</span>
                <span className={`font-mono text-[10px] ${item.change24h >= 0 ? "text-long" : "text-short"}`}>{item.change24h >= 0 ? "+" : ""}{item.change24h.toFixed(2)}%</span>
              </button>
            )) : (
              <p className="px-3 py-4 text-center text-xs text-text-muted">No coins match “{marketSearch}”</p>
            )}
            </div>
          </div>
        )}

        <dl className="trade-stat-strip ml-auto min-w-0 flex-1 items-center">
          {stats.map((stat) => (
            <div key={stat.label} className="min-w-0 border-l border-t-border px-3">
              <dt className="truncate text-[9px] uppercase tracking-wide text-text-muted">{stat.label}</dt>
              <dd className="mt-1 truncate font-mono text-[11px] tabular-nums text-text-main">{stat.value}</dd>
            </div>
          ))}
          <div className="trade-env border-l border-t-border px-3">
            <dt className="text-[9px] uppercase tracking-wide text-text-muted">Network</dt>
            <dd className="mt-1 inline-flex items-center gap-1.5 text-[10px] text-text-main"><span className={`h-1.5 w-1.5 rounded-full ${network === "devnet" ? "bg-amber-400" : "bg-long"}`} />{env}</dd>
          </div>
        </dl>
      </div>
      <dl className="trade-stat-mobile grid grid-cols-2 border-t border-t-border px-1 py-2">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0 px-2">
            <dt className="truncate text-[8px] uppercase tracking-wide text-text-muted">{stat.label}</dt>
            <dd className="mt-1 truncate font-mono text-[10px] text-text-main">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
