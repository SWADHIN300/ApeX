"use client";

import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import ChartPanel from "@/components/ChartPanel";
import OrderBook from "@/components/OrderBook";
import OrderForm from "@/components/OrderForm";
import PositionPanel from "@/components/PositionPanel";
import TradeMarketHeader from "@/components/TradeMarketHeader";
import { Activity, Wifi } from "lucide-react";
import { useNetwork } from "@/contexts/WalletProvider";
import { useWallet } from "@solana/wallet-adapter-react";
import { exchangeManager, type ExchangeName } from "@/lib/exchanges";

export default function TradePage() {
  const [isPositionsOpen, setIsPositionsOpen] = useState(true);
  const [activeExchange, setActiveExchange] = useState<ExchangeName>(exchangeManager.getActiveExchange());
  const { network } = useNetwork();
  const { connected } = useWallet();

  const selectExchange = (exchange: ExchangeName) => {
    setActiveExchange(exchange);
    exchangeManager.setActiveExchange(exchange);
  };

  return (
    <AppShell>
      <div
        className={`trade-terminal h-full min-h-0 grid grid-cols-12 overflow-auto lg:overflow-hidden bg-bg-base transition-[grid-template-rows] duration-300 ${
          isPositionsOpen
            ? "lg:grid-rows-[4rem_minmax(0,1fr)_minmax(9rem,18vh)_1.75rem]"
            : "lg:grid-rows-[4rem_minmax(0,1fr)_2.25rem_1.75rem]"
        }`}
      >
        <TradeMarketHeader />
        <ChartPanel activeExchange={activeExchange} onExchangeChange={selectExchange} />
        <OrderBook selectedExchange={activeExchange} />
        <OrderForm />
        <PositionPanel
          isOpen={isPositionsOpen}
          onToggle={() => setIsPositionsOpen((value) => !value)}
        />
        <footer className="trade-status-bar col-span-12 flex min-w-0 items-center justify-between border-t border-t-border bg-bg-surface px-3 text-[10px] text-text-muted">
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-long" : "bg-amber-400"}`} />
            <span>{connected ? "Wallet connected" : "Wallet not connected"}</span>
            <span className="mx-1 h-3 w-px bg-border" />
            <Wifi size={12} />
            <span>{network === "devnet" ? "Solana Devnet" : "Solana Mainnet"}</span>
          </div>
          <span className="hidden items-center gap-1.5 sm:inline-flex"><Activity size={12} className="text-long" />Market feed</span>
          <span className="font-mono">ApeX Perpetuals</span>
        </footer>
      </div>
    </AppShell>
  );
}
