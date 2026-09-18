import { useEffect } from "react";
import { useTrade } from "@/contexts/TradeContext";
import { useMarket } from "@/contexts/MarketContext";

export function usePositions() {
  const { positions, updatePositionsWithMarkPrice } = useTrade();
  const { market } = useMarket();

  const price = market?.price;
  const symbol = market?.symbol;

  // Update position PnL against current market price
  useEffect(() => {
    if (symbol && price && price > 0) {
      updatePositionsWithMarkPrice(symbol, price);
    }
  }, [price, symbol, updatePositionsWithMarkPrice]);

  return positions;
}
