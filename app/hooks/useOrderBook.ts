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
 * Where the displayed depth actually came from.
 * - `on-chain`  : the protocol's own OrderBook account
 * - `reference` : a centralized exchange feed (context only, not tradable here)
 * - `unavailable`: nothing loaded yet
 */
export type OrderBookSource = "on-chain" | "reference" | "unavailable";

/**
 * Loads order book depth and reports which source it came from.
 *
 * The previous version silently fell back from the protocol's on-chain book to
 * a Binance stream with no indication in the UI, which made reference data look
 * like ApeX liquidity. Callers now get `source` so they can label it honestly.
 *
 * `preferOnChain` (default true) tries the on-chain book first and only falls
 * back when it is missing or empty. Passing `false` forces the reference feed,
 * which backs the UI toggle.
 */
export function useOrderBook(preferOnChain: boolean = true) {
  const { market } = useMarket();
  const { connection } = useConnection();
  const [bids, setBids] = useState<OrderBookLevel[]>([]);
  const [asks, setAsks] = useState<OrderBookLevel[]>([]);
  const [source, setSource] = useState<OrderBookSource>("unavailable");

  useEffect(() => {
    if (!market) return;

    // Reset whenever the market or the source preference changes.
    setBids([]);
    setAsks([]);
    setSource("unavailable");

    let cancelled = false;
    let cleanupFn: (() => void) | undefined;

    /** Centralized exchange depth, used for context when ApeX has no book. */
    const startReferenceFeed = () => {
      if (cancelled) return;
      cleanupFn = subscribeOrderBook(market.symbol, (data) => {
        if (cancelled) return;
        setBids(data.bids);
        setAsks(data.asks);
        setSource("reference");
      });
    };

    if (!preferOnChain) {
      startReferenceFeed();
      return () => {
        cancelled = true;
        cleanupFn?.();
      };
    }

    try {
      getMarketPdas(market.symbol); // throws when env vars are missing

      fetchProtocolOrderBook(connection, market.symbol)
        .then((data) => {
          if (cancelled) return;

          if (data.bids.length > 0 || data.asks.length > 0) {
            setBids(data.bids);
            setAsks(data.asks);
            setSource("on-chain");

            try {
              cleanupFn = subscribeProtocolOrderBook(
                connection,
                market.symbol,
                (update) => {
                  if (cancelled) return;
                  setBids(update.bids);
                  setAsks(update.asks);
                  setSource("on-chain");
                },
              );
            } catch {
              // Subscription failed; keep the snapshot we already have.
            }
          } else {
            // The account exists but has no resting orders yet.
            startReferenceFeed();
          }
        })
        .catch(() => {
          // Market/order book account not present on this network.
          if (!cancelled) startReferenceFeed();
        });
    } catch {
      // getMarketPdas threw (env not configured) — go straight to reference.
      startReferenceFeed();
    }

    return () => {
      cancelled = true;
      cleanupFn?.();
    };
  }, [connection, market?.symbol, preferOnChain]);

  return { bids, asks, source };
}
