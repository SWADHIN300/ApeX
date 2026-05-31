"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { Ticker } from "@/lib/types";
import { fetchAllTickers, subscribeTicker, PAIR_TO_SYMBOL } from "@/lib/api";

type MarketContextType = {
  market: Ticker;
  setMarket: (market: Ticker) => void;
  markets: Ticker[];
  isLoading: boolean;
};

// Fallback initial market
const FALLBACK_MARKET: Ticker = {
  symbol: "BTC-PERP",
  price: 65000,
  change24h: 0,
  volume24h: "0M",
  high24h: 66000,
  low24h: 64000,
};

const MarketContext = createContext<MarketContextType | undefined>(undefined);

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const [markets, setMarkets] = useState<Ticker[]>([FALLBACK_MARKET]);
  const [market, setMarket] = useState<Ticker>(FALLBACK_MARKET);
  const [isLoading, setIsLoading] = useState(true);

  // Initial fetch of all markets
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const data = await fetchAllTickers();
      if (!mounted) return;
      if (data && data.length > 0) {
        setMarkets(data);
        // Find BTC-PERP or use the first available
        const btc = data.find((m) => m.symbol === "BTC-PERP") || data[0];
        setMarket(btc);
      }
      setIsLoading(false);
    };
    init();
    return () => {
      mounted = false;
    };
  }, []);

  // WebSocket subscription for the active market
  useEffect(() => {
    if (!market || isLoading) return;

    const unsubscribe = subscribeTicker(market.symbol, (ticker) => {
      setMarket((prev) => ({ ...prev, ...ticker }));
      setMarkets((prevList) =>
        prevList.map((m) => (m.symbol === ticker.symbol ? ticker : m))
      );
    });

    return () => unsubscribe();
  }, [market?.symbol, isLoading]);

  return (
    <MarketContext.Provider value={{ market, setMarket, markets, isLoading }}>
      {children}
    </MarketContext.Provider>
  );
}

export function useMarket() {
  const context = useContext(MarketContext);
  if (context === undefined) {
    throw new Error("useMarket must be used within a MarketProvider");
  }
  return context;
}
