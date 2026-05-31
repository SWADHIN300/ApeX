"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Position, TradeRecord, PortfolioData } from "@/lib/types";
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
};

const defaultPortfolio: PortfolioData = {
  totalValue: 10000,
  totalPnl: 0,
  totalPnlPct: 0,
  availableMargin: 10000,
  usedMargin: 0,
  unrealizedPnl: 0,
};

const TradeContext = createContext<TradeContextType | undefined>(undefined);

export function TradeProvider({ children }: { children: React.ReactNode }) {
  const { network } = useNetwork();
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioData>(defaultPortfolio);

  // Load from local storage on mount or network change
  useEffect(() => {
    const savedPositions = localStorage.getItem(`apex-positions-${network}`);
    const savedTrades = localStorage.getItem(`apex-trades-${network}`);
    const savedPortfolio = localStorage.getItem(`apex-portfolio-${network}`);

    if (savedPositions) setPositions(JSON.parse(savedPositions));
    else setPositions([]);

    if (savedTrades) setTrades(JSON.parse(savedTrades));
    else setTrades([]);

    if (savedPortfolio) setPortfolio(JSON.parse(savedPortfolio));
    else setPortfolio(defaultPortfolio);
  }, [network]);

  // Save to local storage whenever state changes
  // Use a timeout to prevent saving stale state immediately after network switch
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(`apex-positions-${network}`, JSON.stringify(positions));
      localStorage.setItem(`apex-trades-${network}`, JSON.stringify(trades));
      localStorage.setItem(`apex-portfolio-${network}`, JSON.stringify(portfolio));
    }, 100);
    return () => clearTimeout(timer);
  }, [positions, trades, portfolio, network]);

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
        totalPnlPct: ((prev.totalPnl + finalPnl) / 10000) * 100,
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
