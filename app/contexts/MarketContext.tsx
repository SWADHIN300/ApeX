"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { Ticker } from "@/lib/types";
import { fetchAllTickers, subscribeTicker } from "@/lib/api";

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
      // 1. Try to load from cache instantly for zero-latency startup
      try {
        const cached = localStorage.getItem("apex_tickers_cache");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.length > 0) {
            setMarkets(parsed);
            const btc = parsed.find((m: Ticker) => m.symbol === "BTC-PERP") || parsed[0];
            setMarket((previous) => previous.symbol === "BTC-PERP" ? btc : previous);
            setIsLoading(false);
          }
        }
      } catch {
        // Ignore cache errors
      }

      // 2. Fetch fresh data in the background
      try {
        const data = await fetchAllTickers();
        if (!mounted) return;
        if (data && data.length > 0) {
          setMarkets(data);
          setMarket((prev) => {
            if (prev.symbol === "BTC-PERP") {
              return data.find((m) => m.symbol === "BTC-PERP") || data[0];
            }
            return prev;
          });

          try {
            localStorage.setItem("apex_tickers_cache", JSON.stringify(data.slice(0, 300)));
          } catch {
            // Storage can be unavailable in private browsing or when quota is full.
          }
        }
      } catch (error) {
        console.error("Failed to load market tickers:", error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, []);

  // WebSocket subscription for the active market
  const marketSymbol = market?.symbol;
  useEffect(() => {
    if (!marketSymbol || isLoading) return;

    const unsubscribe = subscribeTicker(marketSymbol, (ticker) => {
      setMarket((prev) => ({ ...prev, ...ticker }));
      setMarkets((prevList) =>
        prevList.map((m) => (m.symbol === ticker.symbol ? ticker : m))
      );
    });

    return () => unsubscribe();
  }, [marketSymbol, isLoading]);

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
