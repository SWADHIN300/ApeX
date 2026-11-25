"use client";

import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import ChartPanel from "@/components/ChartPanel";
import OrderBook from "@/components/OrderBook";
import OrderForm from "@/components/OrderForm";
import PositionPanel from "@/components/PositionPanel";
import TradeMarketHeader from "@/components/TradeMarketHeader";

export default function TradePage() {
  const [isPositionsOpen, setIsPositionsOpen] = useState(true);

  return (
    <AppShell>
      <div
        className={`h-full min-h-0 grid grid-cols-12 overflow-auto lg:overflow-hidden bg-bg-base transition-[grid-template-rows] duration-300 ${
          isPositionsOpen
            ? "lg:grid-rows-[4rem_minmax(0,1fr)_16rem]"
            : "lg:grid-rows-[4rem_minmax(0,1fr)_2.25rem]"
        }`}
      >
        <TradeMarketHeader />
        <ChartPanel />
        <OrderBook />
        <OrderForm />
        <PositionPanel
          isOpen={isPositionsOpen}
          onToggle={() => setIsPositionsOpen((value) => !value)}
        />
      </div>
    </AppShell>
  );
}
