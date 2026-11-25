import { useEffect } from "react";
import { useTrade } from "@/contexts/TradeContext";
import { useMarket } from "@/contexts/MarketContext";
import { usePaperTrading } from "@/contexts/PaperTradingContext";

export function usePositions() {
  const { positions, updatePositionsWithMarkPrice } = useTrade();
  const { isPaperTrading, paperPositions } = usePaperTrading();
  const { market } = useMarket();

  const price = market?.price;
  const symbol = market?.symbol;

  // Update position PnL against current market price
  useEffect(() => {
    if (symbol && price && price > 0 && !isPaperTrading) {
      updatePositionsWithMarkPrice(symbol, price);
    }
  }, [price, symbol, updatePositionsWithMarkPrice, isPaperTrading]);

  return isPaperTrading ? paperPositions : positions;
}
