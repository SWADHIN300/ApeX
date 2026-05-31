import { useState, useEffect } from "react";
import { useMarket } from "@/contexts/MarketContext";
import { subscribeOrderBook } from "@/lib/api";
import { OrderBookLevel } from "@/lib/types";

export function useOrderBook() {
  const { market } = useMarket();
  const [bids, setBids] = useState<OrderBookLevel[]>([]);
  const [asks, setAsks] = useState<OrderBookLevel[]>([]);

  useEffect(() => {
    if (!market) return;

    // Reset on market change
    setBids([]);
    setAsks([]);

    const unsubscribe = subscribeOrderBook(market.symbol, (data) => {
      setBids(data.bids);
      setAsks(data.asks);
    });

    return () => unsubscribe();
  }, [market?.symbol]);

  return { bids, asks };
}
