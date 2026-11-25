import { useState, useEffect } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useMarket } from "@/contexts/MarketContext";
import { fetchOrderBook, subscribeOrderBook } from "@/lib/api";
import {
  fetchProtocolOrderBook,
  getMarketPdas,
} from "@/lib/apexProtocol";
import type { ExchangeName } from "@/lib/exchanges";
import { OrderBookLevel } from "@/lib/types";

/**
 * Where the displayed depth actually came from.
 * - `apex`      : the protocol's own on-chain OrderBook account
 * - exchange name: depth from that external exchange (context only)
 * - `unavailable`: nothing loaded yet
 */
export type OrderBookSource = ExchangeName | "unavailable";

/**
 * Loads order book depth and reports which source it came from.
 *
 * The previous version silently fell back from the protocol's on-chain book to
 * a Binance stream with no indication in the UI, which made reference data look
 * like ApeX liquidity. Callers now get `source` so they can label it honestly.
 *
 * The selected venue determines the source. External exchange depth is always
 * identified by its venue and is never presented as ApeX protocol liquidity.
 * ApeX depth is polled over HTTP so an unavailable RPC WebSocket cannot break it.
 */
export function useOrderBook(selectedSource: ExchangeName = "apex") {
  const { market } = useMarket();
  const { connection } = useConnection();
  const [bids, setBids] = useState<OrderBookLevel[]>([]);
  const [asks, setAsks] = useState<OrderBookLevel[]>([]);
  const [source, setSource] = useState<OrderBookSource>("unavailable");
  const marketSymbol = market?.symbol;

  useEffect(() => {
    if (!marketSymbol) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let cleanupFn: (() => void) | undefined;

    // Reset asynchronously whenever the market or selected venue changes.
    queueMicrotask(() => {
      if (!cancelled) {
        setBids([]);
        setAsks([]);
        setSource("unavailable");
      }
    });

    /** External exchange depth is context only; ApeX does not execute against it. */
    const startExchangeFeed = () => {
      if (cancelled) return;
      let receivedStreamUpdate = false;
      cleanupFn = subscribeOrderBook(marketSymbol, (data) => {
        if (cancelled) return;
        receivedStreamUpdate = true;
        setBids(data.bids);
        setAsks(data.asks);
        setSource(selectedSource);
      }, selectedSource);
      void fetchOrderBook(marketSymbol, 20, selectedSource)
        .then((data) => {
          if (cancelled || receivedStreamUpdate) return;
          setBids(data.bids);
          setAsks(data.asks);
          setSource(data.bids.length || data.asks.length ? selectedSource : "unavailable");
        })
        .catch(() => {
          // Keep the empty state visible if both snapshot and stream are unavailable.
        });
    };

    if (selectedSource !== "apex") {
      startExchangeFeed();
      return () => {
        cancelled = true;
        cleanupFn?.();
      };
    }

    try {
      getMarketPdas(marketSymbol); // throws when env vars are missing

      fetchProtocolOrderBook(connection, marketSymbol)
        .then((data) => {
          if (cancelled) return;

          setBids(data.bids);
          setAsks(data.asks);
          setSource("apex");

          pollTimer = setInterval(() => {
            void fetchProtocolOrderBook(connection, marketSymbol)
              .then((update) => {
                if (cancelled) return;
                setBids(update.bids);
                setAsks(update.asks);
                setSource("apex");
              })
              .catch(() => {});
          }, 5_000);
        })
        .catch(() => {
          // Keep the ApeX book unavailable when its on-chain account is missing.
        });
    } catch {
      // Protocol configuration is missing; don't label external depth as ApeX liquidity.
    }

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      cleanupFn?.();
    };
  }, [connection, marketSymbol, selectedSource]);

  return { bids, asks, source };
}
