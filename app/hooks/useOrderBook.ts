import { useState, useEffect } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useMarket } from "@/contexts/MarketContext";
import { subscribeOrderBook } from "@/lib/api";
import {
  fetchProtocolOrderBook,
  getMarketPdas,
  subscribeProtocolOrderBook,
} from "@/lib/apexProtocol";
import { OrderBookLevel } from "@/lib/types";

export function useOrderBook() {
  const { market } = useMarket();
  const { connection } = useConnection();
  const [bids, setBids] = useState<OrderBookLevel[]>([]);
  const [asks, setAsks] = useState<OrderBookLevel[]>([]);

  useEffect(() => {
    if (!market) return;

    // Reset on market change
    setBids([]);
    setAsks([]);

    try {
      getMarketPdas(market.symbol);
      void fetchProtocolOrderBook(connection, market.symbol).then((data) => {
        setBids(data.bids);
        setAsks(data.asks);
      });

      return subscribeProtocolOrderBook(connection, market.symbol, (data) => {
        setBids(data.bids);
        setAsks(data.asks);
      });
    } catch {
      const unsubscribe = subscribeOrderBook(market.symbol, (data) => {
        setBids(data.bids);
        setAsks(data.asks);
      });

      return () => unsubscribe();
    }
  }, [connection, market?.symbol]);

  return { bids, asks };
}
