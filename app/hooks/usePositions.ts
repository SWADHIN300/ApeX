import { useEffect } from "react";
import { useTrade } from "@/contexts/TradeContext";
import { useMarket } from "@/contexts/MarketContext";

export function usePositions() {
  const { positions, updatePositionsWithMarkPrice } = useTrade();
  const { market } = useMarket();

  // Update position PnL against current market price
  useEffect(() => {
    if (market && market.price > 0) {
      updatePositionsWithMarkPrice(market.symbol, market.price);
    }
  }, [market?.price, market?.symbol, updatePositionsWithMarkPrice]);

  return positions;
}
