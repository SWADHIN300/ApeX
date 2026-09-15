// Legacy API - Wrapper around new exchange system for backward compatibility
import { Candle, Ticker, OrderBookLevel } from "./types";
import { cachedApi } from './cache/cachedApi';
import { exchangeManager, ExchangeName } from './exchanges';

/** Chart/market data source used when a caller doesn't specify one. */
const DEFAULT_EXCHANGE: ExchangeName = 'binance';

// Backward compatibility exports
export const getBinanceSymbol = (pair: string) => pair.replace("-PERP", "USDT");
export const getApexPair = (symbol: string) => symbol.replace("USDT", "-PERP");

export async function fetchAllTickers(): Promise<Ticker[]> {
  return cachedApi.fetchTickers('binance');
}

export async function fetchKlines(
  pair: string,
  interval: string,
  limit: number = 100,
  exchange: ExchangeName = DEFAULT_EXCHANGE
): Promise<Candle[]> {
  return cachedApi.fetchKlines(pair, interval, limit, exchange);
}

export async function fetchOrderBook(
  pair: string,
  limit: number = 20,
  exchange: ExchangeName = DEFAULT_EXCHANGE
): Promise<{ bids: OrderBookLevel[], asks: OrderBookLevel[] }> {
  return cachedApi.fetchOrderBook(pair, limit, exchange);
}

export function subscribeTicker(
  pair: string,
  callback: (ticker: Ticker) => void,
  exchange: ExchangeName = DEFAULT_EXCHANGE
): () => void {
  return exchangeManager.subscribeTicker(pair, callback, exchange);
}

export function subscribeKlines(
  pair: string,
  interval: string,
  callback: (candle: Candle) => void,
  exchange: ExchangeName = DEFAULT_EXCHANGE
): () => void {
  return exchangeManager.subscribeKlines(pair, interval, callback, exchange);
}

export function subscribeOrderBook(
  pair: string,
  callback: (data: { bids: OrderBookLevel[], asks: OrderBookLevel[] }) => void,
  exchange: ExchangeName = DEFAULT_EXCHANGE
): () => void {
  return exchangeManager.subscribeOrderBook(pair, callback, exchange);
}
