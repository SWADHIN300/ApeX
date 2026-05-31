import { useMarket } from "@/contexts/MarketContext";

export function useOracle() {
  const { market, isLoading } = useMarket();
  
  if (isLoading || !market) {
    return null;
  }
  
  return {
    price: market.price,
    pair: market.symbol,
  };
}
