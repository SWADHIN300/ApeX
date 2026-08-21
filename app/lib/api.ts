// Legacy API - Wrapper around new exchange system for backward compatibility
import { Candle, Ticker, OrderBookLevel } from "./types";
import { cachedApi } from './cache/cachedApi';
import { exchangeManager } from './exchanges';

// Backward compatibility exports
export const getBinanceSymbol = (pair: string) => pair.replace("-PERP", "USDT");
export const getApexPair = (symbol: string) => symbol.replace("USDT", "-PERP");

// Use cached API with Binance as default exchange
export async function fetchAllTickers(): Promise<Ticker[]> {
  return cachedApi.fetchTickers('binance');
}

export async function fetchKlines(
  pair: string,
  interval: string,
  limit: number = 100
): Promise<Candle[]> {
  return cachedApi.fetchKlines(pair, interval, limit, 'binance');
}

export async function fetchOrderBook(
  pair: string, 
  limit: number = 20
): Promise<{ bids: OrderBookLevel[], asks: OrderBookLevel[] }> {
  return cachedApi.fetchOrderBook(pair, limit, 'binance');
}

export function subscribeTicker(
  pair: string,
  callback: (ticker: Ticker) => void
): () => void {
  return exchangeManager.subscribeTicker(pair, callback, 'binance');
}

export function subscribeKlines(
  pair: string,
  interval: string,
  callback: (candle: Candle) => void
): () => void {
  return exchangeManager.subscribeKlines(pair, interval, callback, 'binance');
}

export function subscribeOrderBook(
  pair: string,
  callback: (data: { bids: OrderBookLevel[], asks: OrderBookLevel[] }) => void
): () => void {
  return exchangeManager.subscribeOrderBook(pair, callback, 'binance');
}
