"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getMint } from "@solana/spl-token";
import {
  fetchSpotBalances,
  fetchSpotMarket,
  fetchSpotOrderBook,
  getSpotMarketPda,
  subscribeSpotOrderBook,
  type DecodedSpotMarket,
  type SpotBalances,
} from "@/lib/spotProtocol";
import type { OrderBookLevel } from "@/lib/types";

export interface SpotMarketConfigEntry {
  label: string;
  baseMint: string;
  quoteMint: string;
  baseSymbol: string;
  quoteSymbol: string;
}

/**
 * Spot pairs come from NEXT_PUBLIC_APEX_SPOT_MARKETS, a JSON array of
 * { label, baseMint, quoteMint, baseSymbol, quoteSymbol }. Returning an empty
 * list is a valid state — the UI then explains how to configure one instead of
 * inventing a market that doesn't exist on chain.
 */
export function getSpotMarketConfig(): SpotMarketConfigEntry[] {
  const raw = process.env.NEXT_PUBLIC_APEX_SPOT_MARKETS;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as SpotMarketConfigEntry[];
    return parsed.filter((entry) => entry.baseMint && entry.quoteMint && entry.label);
  } catch {
    console.warn("NEXT_PUBLIC_APEX_SPOT_MARKETS is not valid JSON.");
    return [];
  }
}

interface UseSpotMarketResult {
  config: SpotMarketConfigEntry | null;
  marketPda: PublicKey | null;
  market: DecodedSpotMarket | null;
  /** True once we know the market account does not exist on chain. */
  notInitialized: boolean;
  baseDecimals: number;
  quoteDecimals: number;
  balances: SpotBalances;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useSpotMarket(config: SpotMarketConfigEntry | null): UseSpotMarketResult {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  const [market, setMarket] = useState<DecodedSpotMarket | null>(null);
  const [notInitialized, setNotInitialized] = useState(false);
  const [baseDecimals, setBaseDecimals] = useState(6);
  const [quoteDecimals, setQuoteDecimals] = useState(6);
  const [balances, setBalances] = useState<SpotBalances>({
    baseFree: 0,
    baseLocked: 0,
    quoteFree: 0,
    quoteLocked: 0,
  });
  const [bids, setBids] = useState<OrderBookLevel[]>([]);
  const [asks, setAsks] = useState<OrderBookLevel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((v) => v + 1), []);

  const mints = useMemo(() => {
    if (!config) return null;
    try {
      return {
        base: new PublicKey(config.baseMint),
        quote: new PublicKey(config.quoteMint),
      };
    } catch {
      return null;
    }
  }, [config?.baseMint, config?.quoteMint]);

  const marketPda = useMemo(
    () => (mints ? getSpotMarketPda(mints.base, mints.quote) : null),
    [mints],
  );

  useEffect(() => {
    if (!config || !mints) {
      setMarket(null);
      setNotInitialized(false);
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [baseInfo, quoteInfo] = await Promise.all([
          getMint(connection, mints.base),
          getMint(connection, mints.quote),
        ]);
        if (cancelled) return;
        setBaseDecimals(baseInfo.decimals);
        setQuoteDecimals(quoteInfo.decimals);

        const decoded = await fetchSpotMarket(connection, mints.base, mints.quote);
        if (cancelled) return;

        setMarket(decoded);
        setNotInitialized(decoded === null);

        if (!decoded) {
          setBids([]);
          setAsks([]);
          return;
        }

        const pda = getSpotMarketPda(mints.base, mints.quote);
        const book = await fetchSpotOrderBook(connection, pda, baseInfo.decimals);
        if (cancelled) return;
        setBids(book.bids);
        setAsks(book.asks);

        unsubscribe = subscribeSpotOrderBook(
          connection,
          pda,
          baseInfo.decimals,
          (update) => {
            if (cancelled) return;
            setBids(update.bids);
            setAsks(update.asks);
          },
        );

        if (publicKey) {
          const traderBalances = await fetchSpotBalances(
            connection,
            pda,
            publicKey,
            baseInfo.decimals,
            quoteInfo.decimals,
          );
          if (!cancelled) setBalances(traderBalances);
        } else {
          setBalances({ baseFree: 0, baseLocked: 0, quoteFree: 0, quoteLocked: 0 });
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [connection, mints, config, publicKey, reloadToken]);

  return {
    config,
    marketPda,
    market,
    notInitialized,
    baseDecimals,
    quoteDecimals,
    balances,
    bids,
    asks,
    isLoading,
    error,
    refresh,
  };
}
