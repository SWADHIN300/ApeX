export interface ExchangeAdapter {
  name: string;
  fetchTickers: () => Promise<Ticker[]>;
  fetchKlines: (symbol: string, interval: string, limit?: number) => Promise<Candle[]>;
  fetchOrderBook: (symbol: string, limit?: number) => Promise<OrderBookData>;
  subscribeTicker: (symbol: string, callback: (ticker: Ticker) => void) => () => void;
  subscribeKlines: (symbol: string, interval: string, callback: (candle: Candle) => void) => () => void;
  subscribeOrderBook: (symbol: string, callback: (data: OrderBookData) => void) => () => void;
  normalizeSymbol: (symbol: string) => string;
  denormalizeSymbol: (symbol: string) => string;
}

export interface Ticker {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: string;
  high24h: number;
  low24h: number;
}

export interface Candle {
  time: number;
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

export interface OrderBookData {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export interface TimeAndSales {
  time: number;
  price: number;
  size: number;
  side: 'buy' | 'sell';
}

export interface VolumeProfile {
  price: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
}

export type ExchangeName = 'binance' | 'coinbase' | 'kraken';
