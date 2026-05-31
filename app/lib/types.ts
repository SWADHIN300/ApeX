export interface Ticker {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: string;
  high24h: number;
  low24h: number;
}

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookLevel {
  price: number;
  size: number;
  total?: number;
}

export interface TradeRecord {
  id: string;
  time: number;
  pair: string;
  side: "Long" | "Short";
  size: number;
  price: number;
  fee: number;
  pnl: number;
  status: "Closed" | "Open" | "Canceled";
}

export interface Position {
  id: string;
  pair: string;
  side: "Long" | "Short";
  leverage: number;
  size: number;
  entryPrice: number;
  markPrice: number;
  liqPrice: number;
  pnl: number;
  roi: number;
}

export interface PortfolioData {
  totalValue: number;
  totalPnl: number;
  totalPnlPct: number;
  availableMargin: number;
  usedMargin: number;
  unrealizedPnl: number;
}
