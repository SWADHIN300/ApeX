"use client";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useMarket } from "@/contexts/MarketContext";
import {
  fetchProtocolMarginAccount,
  subscribeProtocolMarginAccount,
} from "@/lib/apexProtocol";
import {
  fetchOnChainPosition,
  subscribeOnChainPosition,
  mapOnChainToFrontendPosition,
} from "@/lib/positionDecoder";
import { Position, PortfolioData, TradeRecord } from "@/lib/types";

const defaultPortfolio: PortfolioData = {
  totalValue: 0,
  totalPnl: 0,
  totalPnlPct: 0,
  availableMargin: 0,
  usedMargin: 0,
  unrealizedPnl: 0,
};

type TradeContextType = {
  positions: Position[];
  trades: TradeRecord[];
  portfolio: PortfolioData;
  isOnChainPosition: boolean;
  placeOrder: (
    pair: string,
    side: "Long" | "Short",
    sizeUsdc: number,
    leverage: number,
    price: number,
  ) => void;
  closePosition: (id: string, currentPrice: number) => void;
  updatePositionsWithMarkPrice: (pair: string, markPrice: number) => void;
  refreshLedgerBalance: () => Promise<void>;
  refreshPositions: () => Promise<void>;
};

const TradeContext = createContext<TradeContextType | undefined>(undefined);

export function TradeProvider({ children }: { children: React.ReactNode }) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const { market } = useMarket();
  const [onChainPosition, setOnChainPosition] = useState<Position | null>(null);
  const [localPositions, setLocalPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioData>(defaultPortfolio);

  // Combined positions: On-chain takes precedence for the active market pair
  const positions = React.useMemo(() => {
    if (onChainPosition) {
      // If there's an on-chain position for this market, filter out local positions for that pair
      const otherPairPositions = localPositions.filter(
        (p) => p.pair !== onChainPosition.pair
      );
      return [onChainPosition, ...otherPairPositions];
    }
    return localPositions;
  }, [onChainPosition, localPositions]);

  const applyMargin = useCallback(
    (margin: {
      depositedCollateral: number;
      lockedCollateral: number;
      availableCollateral: number;
    }) => {
      setPortfolio((prev) => {
        const equity = margin.depositedCollateral + prev.unrealizedPnl;

        return {
          ...prev,
          totalValue: equity,
          availableMargin: margin.availableCollateral,
          usedMargin: margin.lockedCollateral,
          totalPnlPct: equity > 0 ? (prev.totalPnl / equity) * 100 : 0,
        };
      });
    },
    []
  );

  const refreshLedgerBalance = useCallback(async () => {
    if (!publicKey || !market) {
      setPortfolio(defaultPortfolio);
      return;
    }

    try {
      const margin = await fetchProtocolMarginAccount(
        connection,
        market.symbol,
        publicKey
      );
      applyMargin(margin);
    } catch {
      // ignore
    }
  }, [applyMargin, connection, market, publicKey]);

  const refreshPositions = useCallback(async () => {
    if (!publicKey || !market) {
      setOnChainPosition(null);
      return;
    }

    try {
      const decoded = await fetchOnChainPosition(
        connection,
        market.symbol,
        publicKey
      );
      if (decoded) {
        setOnChainPosition(
          mapOnChainToFrontendPosition(decoded, market.symbol, market.price)
        );
      } else {
        setOnChainPosition(null);
      }
    } catch {
      setOnChainPosition(null);
    }
  }, [connection, market, publicKey]);

  useEffect(() => {
    void refreshLedgerBalance();
    void refreshPositions();
  }, [refreshLedgerBalance, refreshPositions]);

  // Subscribe to margin account changes
  useEffect(() => {
    if (!publicKey || !market) return;

    try {
      return subscribeProtocolMarginAccount(
        connection,
        market.symbol,
        publicKey,
        applyMargin
      );
    } catch {
      return;
    }
  }, [applyMargin, connection, market, publicKey]);

  // Subscribe to Position PDA changes
  useEffect(() => {
    if (!publicKey || !market) return;

    try {
      return subscribeOnChainPosition(
        connection,
        market.symbol,
        publicKey,
        (decoded) => {
          if (decoded) {
            setOnChainPosition(
              mapOnChainToFrontendPosition(decoded, market.symbol, market.price)
            );
          } else {
            setOnChainPosition(null);
          }
        }
      );
    } catch {
      return;
    }
  }, [connection, market, publicKey]);

  const placeOrder = () => {
    void refreshLedgerBalance();
    void refreshPositions();
  };

  const closePosition = (id: string, currentPrice: number) => {
    const pos = positions.find((p) => p.id === id);
    if (!pos) return;

    const sizeUsdc = pos.size * pos.entryPrice;
    const fee = sizeUsdc * 0.0004;
    const diff =
      pos.side === "Long"
        ? currentPrice - pos.entryPrice
        : pos.entryPrice - currentPrice;
    const finalPnl = diff * pos.size;

    const newTrade: TradeRecord = {
      id: pos.id,
      time: Math.floor(Date.now() / 1000),
      pair: pos.pair,
      side: pos.side,
      size: pos.size,
      price: currentPrice,
      fee,
      pnl: finalPnl,
      status: "Closed",
    };

    setTrades((prev) => [newTrade, ...prev]);
    setLocalPositions((prev) => prev.filter((p) => p.id !== id));
    if (onChainPosition && onChainPosition.id === id) {
      setOnChainPosition(null);
    }
  };

  const updatePositionsWithMarkPrice = useCallback(
    (pair: string, markPrice: number) => {
      // Update on-chain position mark price & PnL
      setOnChainPosition((prev) => {
        if (!prev || prev.pair !== pair) return prev;
        const diff =
          prev.side === "Long"
            ? markPrice - prev.entryPrice
            : prev.entryPrice - markPrice;
        const pnl = diff * prev.size;
        const margin = (prev.size * prev.entryPrice) / (prev.leverage || 1);
        const roi = margin > 0 ? (pnl / margin) * 100 : 0;
        return { ...prev, markPrice, pnl, roi };
      });

      // Update local optimistic positions
      setLocalPositions((prev) => {
        let hasChanges = false;
        const updated = prev.map((pos) => {
          if (pos.pair !== pair) return pos;

          const diff =
            pos.side === "Long"
              ? markPrice - pos.entryPrice
              : pos.entryPrice - markPrice;
          const pnl = diff * pos.size;
          const margin = (pos.size * pos.entryPrice) / (pos.leverage || 1);
          const roi = margin > 0 ? (pnl / margin) * 100 : 0;

          if (pos.markPrice === markPrice && pos.pnl === pnl && pos.roi === roi) {
            return pos;
          }

          hasChanges = true;
          return { ...pos, markPrice, pnl, roi };
        });

        return hasChanges ? updated : prev;
      });
    },
    []
  );

  return (
    <TradeContext.Provider
      value={{
        positions,
        trades,
        portfolio,
        isOnChainPosition: !!onChainPosition,
        placeOrder,
        closePosition,
        updatePositionsWithMarkPrice,
        refreshLedgerBalance,
        refreshPositions,
      }}
    >
      {children}
    </TradeContext.Provider>
  );
}

export function useTrade() {
  const context = useContext(TradeContext);
  if (context === undefined) {
    throw new Error("useTrade must be used within a TradeProvider");
  }
  return context;
}
