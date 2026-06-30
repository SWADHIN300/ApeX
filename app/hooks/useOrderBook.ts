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

/**
 * Tries to load order book from the on-chain protocol account first.
 * If the protocol program or market account doesn't exist on the
 * current network (e.g. devnet without a deployed program), it
 * falls back to a Binance WebSocket stream for realistic data.
 */
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

    let cancelled = false;
    let cleanupFn: (() => void) | undefined;

    /**
     * Start the Binance WebSocket fallback. This provides realistic
     * order-book depth data from the Binance spot market.
     */
    const startBinanceFallback = () => {
      if (cancelled) return;
      const unsub = subscribeOrderBook(market.symbol, (data) => {
        if (cancelled) return;
        setBids(data.bids);
        setAsks(data.asks);
      });
      cleanupFn = unsub;
    };

    // Try the on-chain protocol first
    try {
      getMarketPdas(market.symbol); // throws if env vars are missing

      fetchProtocolOrderBook(connection, market.symbol)
        .then((data) => {
          if (cancelled) return;

          // If the on-chain account has data, use it and subscribe
          if (data.bids.length > 0 || data.asks.length > 0) {
            setBids(data.bids);
            setAsks(data.asks);

            // Subscribe for live on-chain updates
            try {
              cleanupFn = subscribeProtocolOrderBook(
                connection,
                market.symbol,
                (update) => {
                  if (cancelled) return;
                  setBids(update.bids);
                  setAsks(update.asks);
                },
              );
            } catch {
              // subscription failed, keep the fetched data
            }
          } else {
            // On-chain account exists but is empty → use Binance
            startBinanceFallback();
          }
        })
        .catch(() => {
          // Fetch failed (account doesn't exist on this network)
          if (!cancelled) startBinanceFallback();
        });
    } catch {
      // getMarketPdas threw (env vars not set) → use Binance directly
      startBinanceFallback();
    }

    return () => {
      cancelled = true;
      cleanupFn?.();
    };
  }, [connection, market?.symbol]);

  return { bids, asks };
}
