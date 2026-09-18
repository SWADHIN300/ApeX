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
  type SpotOpenOrder,
} from "@/lib/spotProtocol";
import type { OrderBookLevel } from "@/lib/types";

export interface SpotMarketConfigEntry {
  label: string;
  baseMint: string;
  quoteMint: string;
  baseSymbol: string;
  quoteSymbol: string;
}

export const DEFAULT_SPOT_MARKETS: SpotMarketConfigEntry[] = [
  {
    label: "SOL/USDC",
    baseSymbol: "SOL",
    quoteSymbol: "USDC",
    baseMint: "So11111111111111111111111111111111111111112",
    quoteMint:
      process.env.NEXT_PUBLIC_APEX_DEVNET_BASE_MINT ||
      process.env.NEXT_PUBLIC_APEX_BASE_MINT ||
      "3NnctwUGZ8iXfK2bFbSKQMSQVJWgxhLveiwg5H3M98NE",
  },
];

/**
 * Spot pairs come from NEXT_PUBLIC_APEX_SPOT_MARKETS, a JSON array of
 * { label, baseMint, quoteMint, baseSymbol, quoteSymbol }. Falls back to
 * DEFAULT_SPOT_MARKETS so the UI always has an operable trading pair.
 */
export function getSpotMarketConfig(): SpotMarketConfigEntry[] {
  const raw = process.env.NEXT_PUBLIC_APEX_SPOT_MARKETS;
  if (!raw) return DEFAULT_SPOT_MARKETS;

  try {
    const parsed = JSON.parse(raw) as SpotMarketConfigEntry[];
    const valid = parsed.filter((entry) => entry.baseMint && entry.quoteMint && entry.label);
    return valid.length > 0 ? valid : DEFAULT_SPOT_MARKETS;
  } catch {
    console.warn("NEXT_PUBLIC_APEX_SPOT_MARKETS is not valid JSON. Using default markets.");
    return DEFAULT_SPOT_MARKETS;
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
  openOrders: SpotOpenOrder[];
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
  const [openOrders, setOpenOrders] = useState<SpotOpenOrder[]>([]);
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
      setOpenOrders([]);
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        let baseDec = 9;
        let quoteDec = 6;
        try {
          const [baseInfo, quoteInfo] = await Promise.all([
            getMint(connection, mints.base),
            getMint(connection, mints.quote),
          ]);
          baseDec = baseInfo.decimals;
          quoteDec = quoteInfo.decimals;
        } catch {
          if (
            config.baseSymbol === "SOL" ||
            mints.base.toBase58() === "So11111111111111111111111111111111111111112"
          ) {
            baseDec = 9;
          } else {
            baseDec = 6;
          }
          quoteDec = 6;
        }

        if (cancelled) return;
        setBaseDecimals(baseDec);
        setQuoteDecimals(quoteDec);

        const decoded = await fetchSpotMarket(connection, mints.base, mints.quote);
        if (cancelled) return;

        setMarket(decoded);
        setNotInitialized(decoded === null);

        if (!decoded) {
          setBids([]);
          setAsks([]);
          setOpenOrders([]);
          return;
        }

        const pda = getSpotMarketPda(mints.base, mints.quote);
        const book = await fetchSpotOrderBook(connection, pda, baseDec);
        if (cancelled) return;
        setBids(book.bids);
        setAsks(book.asks);

        const userKey = publicKey?.toBase58();
        const allOrders = [...book.rawBids, ...book.rawAsks];
        setOpenOrders(userKey ? allOrders.filter((o) => o.owner === userKey) : []);

        unsubscribe = subscribeSpotOrderBook(
          connection,
          pda,
          baseDec,
          (update) => {
            if (cancelled) return;
            setBids(update.bids);
            setAsks(update.asks);
            const currentKey = publicKey?.toBase58();
            const liveOrders = [...update.rawBids, ...update.rawAsks];
            setOpenOrders(currentKey ? liveOrders.filter((o) => o.owner === currentKey) : []);
          },
        );

        if (publicKey) {
          const traderBalances = await fetchSpotBalances(
            connection,
            pda,
            publicKey,
            baseDec,
            quoteDec,
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
    openOrders,
    isLoading,
    error,
    refresh,
  };
}
