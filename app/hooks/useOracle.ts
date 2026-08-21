"use client";

import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useMarket } from "@/contexts/MarketContext";
import { getMarketPdas } from "@/lib/apexProtocol";
import {
  fetchOraclePrice,
  subscribeOraclePrice,
  type OraclePrice,
} from "@/lib/pythOracle";

export function useOracle() {
  const { market, isLoading } = useMarket();
  const { connection } = useConnection();
  const [oraclePrice, setOraclePrice] = useState<OraclePrice | null>(null);
  const [oracleAddress, setOracleAddress] = useState<PublicKey | null>(null);

  useEffect(() => {
    if (!market || isLoading) return;

    let mounted = true;

    async function loadOracle() {
      try {
        const { market: marketPda } = getMarketPdas(market.symbol);
        const marketAccount = await connection.getAccountInfo(marketPda);

        let oraclePubkey: PublicKey | null = null;

        if (marketAccount && marketAccount.data.length >= 8 + 32 + 32) {
          // Market layout: discriminator(8) + authority(32) + oracle(32)
          oraclePubkey = new PublicKey(marketAccount.data.subarray(40, 72));
        } else if (process.env.NEXT_PUBLIC_APEX_ORACLE) {
          oraclePubkey = new PublicKey(process.env.NEXT_PUBLIC_APEX_ORACLE);
        }

        if (!mounted) return;
        setOracleAddress(oraclePubkey);

        if (oraclePubkey) {
          const priceData = await fetchOraclePrice(connection, oraclePubkey);
          if (mounted) {
            setOraclePrice(priceData);
          }
        }
      } catch {
        // Fall back gracefully if PDA or oracle doesn't exist
        if (mounted) {
          setOracleAddress(null);
          setOraclePrice(null);
        }
      }
    }

    void loadOracle();

    return () => {
      mounted = false;
    };
  }, [connection, market?.symbol, isLoading]);

  // Real-time on-chain oracle subscription
  useEffect(() => {
    if (!oracleAddress) return;

    const unsubscribe = subscribeOraclePrice(
      connection,
      oracleAddress,
      (newPrice) => {
        setOraclePrice(newPrice);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [connection, oracleAddress]);

  if (isLoading || !market) {
    return null;
  }

  return {
    referencePrice: market.price,
    pair: market.symbol,
    oraclePrice: oraclePrice?.price ?? null,
    isOracleValid: oraclePrice?.isValid ?? false,
    confidence: oraclePrice?.confidence ?? null,
    oracleAddress: oracleAddress?.toBase58() ?? null,
  };
}
