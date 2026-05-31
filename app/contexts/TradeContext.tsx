"use client";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Position, TradeRecord, PortfolioData } from "@/lib/types";
import { fetchLedgerBalance } from "@/lib/ledgerClient";
import { useNetwork } from "./WalletProvider";

type TradeContextType = {
  positions: Position[];
  trades: TradeRecord[];
  portfolio: PortfolioData;
  placeOrder: (
    pair: string,
    side: "Long" | "Short",
    sizeUsdc: number,
    leverage: number,
    price: number
  ) => void;
  closePosition: (id: string, currentPrice: number) => void;
  updatePositionsWithMarkPrice: (pair: string, markPrice: number) => void;
  refreshLedgerBalance: () => Promise<void>;
};

const defaultPortfolio: PortfolioData = {
  totalValue: 0,
  totalPnl: 0,
  totalPnlPct: 0,
  availableMargin: 0,
  usedMargin: 0,
  unrealizedPnl: 0,
};

const TradeContext = createContext<TradeContextType | undefined>(undefined);

export function TradeProvider({ children }: { children: React.ReactNode }) {
  const { publicKey } = useWallet();
  const { network } = useNetwork();
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioData>(defaultPortfolio);
  const positionsRef = useRef<Position[]>([]);

  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  const refreshLedgerBalance = useCallback(async () => {
    if (!publicKey) {
      setPortfolio(defaultPortfolio);
      setPositions((prev) => (prev.length > 0 ? [] : prev));
      setTrades((prev) => (prev.length > 0 ? [] : prev));
      return;
    }

    const ledger = await fetchLedgerBalance({
      wallet: publicKey.toBase58(),
      network,
    });
    const currentPositions = positionsRef.current;
    const usedMargin = currentPositions.reduce((total, position) => {
      return total + (position.size * position.entryPrice) / position.leverage;
    }, 0);
    const unrealizedPnl = currentPositions.reduce(
      (total, position) => total + position.pnl,
      0,
    );
    const equity = ledger.balances.USDC + unrealizedPnl;

    setPortfolio((prev) => ({
      ...prev,
      totalValue: equity,
      availableMargin: Math.max(0, ledger.balances.USDC - usedMargin),
      usedMargin,
      unrealizedPnl,
      totalPnlPct: equity > 0 ? (prev.totalPnl / equity) * 100 : 0,
    }));
  }, [network, publicKey]);

  useEffect(() => {
    void refreshLedgerBalance();
  }, [refreshLedgerBalance]);

  const placeOrder = (
    pair: string,
    side: "Long" | "Short",
    sizeUsdc: number,
    leverage: number,
    price: number
  ) => {
    const marginReq = sizeUsdc / leverage;
    if (marginReq > portfolio.availableMargin) {
      alert("Insufficient margin!");
      return;
    }

    const fee = sizeUsdc * 0.0004; // 0.04% fee
    const sizeBase = sizeUsdc / price;

    // Calc approx liq price (simplified)
    const liqPrice =
      side === "Long"
        ? price * (1 - 1 / leverage + 0.005)
        : price * (1 + 1 / leverage - 0.005);

    const newPosition: Position = {
      id: Math.random().toString(36).substring(7),
      pair,
      side,
      leverage,
      size: sizeBase,
      entryPrice: price,
      markPrice: price,
      liqPrice,
      pnl: 0,
      roi: 0,
    };

    setPositions((prev) => [...prev, newPosition]);

    setPortfolio((prev) => ({
      ...prev,
      availableMargin: prev.availableMargin - marginReq - fee,
      usedMargin: prev.usedMargin + marginReq,
      totalValue: prev.totalValue - fee, // Fee decreases total value
    }));
  };

  const closePosition = (id: string, currentPrice: number) => {
    const pos = positions.find((p) => p.id === id);
    if (!pos) return;

    // Record trade
    const sizeUsdc = pos.size * pos.entryPrice;
    const fee = sizeUsdc * 0.0004;

    // Actual close PnL
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
    setPositions((prev) => prev.filter((p) => p.id !== id));

    const marginReleased = sizeUsdc / pos.leverage;

    setPortfolio((prev) => {
      const newTotalValue = prev.totalValue + finalPnl - fee;
      return {
        ...prev,
        availableMargin: prev.availableMargin + marginReleased + finalPnl - fee,
        usedMargin: prev.usedMargin - marginReleased,
        totalValue: newTotalValue,
        totalPnl: prev.totalPnl + finalPnl,
        totalPnlPct:
          prev.totalValue > 0
            ? ((prev.totalPnl + finalPnl) / prev.totalValue) * 100
            : 0,
      };
    });
  };

  const updatePositionsWithMarkPrice = useCallback(
    (pair: string, markPrice: number) => {
      setPositions((prev) => {
        let hasChanges = false;
        const updated = prev.map((pos) => {
          if (pos.pair !== pair) return pos;

          const diff =
            pos.side === "Long"
              ? markPrice - pos.entryPrice
              : pos.entryPrice - markPrice;
          const pnl = diff * pos.size;
          const margin = (pos.size * pos.entryPrice) / pos.leverage;
          const roi = (pnl / margin) * 100;

          // Only update if price actually changed
          if (pos.markPrice === markPrice) return pos;

          hasChanges = true;
          return { ...pos, markPrice, pnl, roi };
        });

        if (!hasChanges) return prev; // Return same reference → no re-render

        // Side-effect: update portfolio unrealized PnL
        const totalUnrealized = updated.reduce((acc, p) => acc + p.pnl, 0);
        setPortfolio((prevP) => ({
          ...prevP,
          unrealizedPnl: totalUnrealized,
        }));

        return updated;
      });
    },
    [] // stable — uses only functional updaters
  );

  return (
    <TradeContext.Provider
      value={{
        positions,
        trades,
        portfolio,
        placeOrder,
        closePosition,
        updatePositionsWithMarkPrice,
        refreshLedgerBalance,
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
