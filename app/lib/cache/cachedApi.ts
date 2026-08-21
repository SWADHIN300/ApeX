import { exchangeManager, ExchangeName, Candle, Ticker, OrderBookData } from '../exchanges';
import { cache } from './indexedDB';

export class CachedApi {
  private requestQueue: Map<string, Promise<any>> = new Map();

  private getCacheKey(prefix: string, ...args: any[]): string {
    return `${prefix}:${args.join(':')}`;
  }

  // Deduplicate concurrent requests
  private async dedupeRequest<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (this.requestQueue.has(key)) {
      return this.requestQueue.get(key);
    }

    const promise = fetcher().finally(() => {
      this.requestQueue.delete(key);
    });

    this.requestQueue.set(key, promise);
    return promise;
  }

  async fetchKlines(
    symbol: string,
    interval: string,
    limit: number = 100,
    exchange?: ExchangeName,
    useCache: boolean = true
  ): Promise<Candle[]> {
    const cacheKey = this.getCacheKey('klines', exchange || 'default', symbol, interval, limit);

    if (useCache) {
      const cached = await cache.get<Candle[]>('candles', cacheKey);
      if (cached) return cached;
    }

    return this.dedupeRequest(cacheKey, async () => {
      const data = await exchangeManager.fetchKlines(symbol, interval, limit, exchange);
      if (data.length > 0) {
        // Cache for 1 minute
        await cache.set('candles', cacheKey, data, 60 * 1000);
      }
      return data;
    });
  }

  async fetchTickers(exchange?: ExchangeName, useCache: boolean = true): Promise<Ticker[]> {
    const cacheKey = this.getCacheKey('tickers', exchange || 'default');

    if (useCache) {
      const cached = await cache.get<Ticker[]>('tickers', cacheKey);
      if (cached) return cached;
    }

    return this.dedupeRequest(cacheKey, async () => {
      const data = await exchangeManager.fetchTickers(exchange);
      if (data.length > 0) {
        // Cache for 30 seconds
        await cache.set('tickers', cacheKey, data, 30 * 1000);
      }
      return data;
    });
  }

  async fetchOrderBook(
    symbol: string,
    limit: number = 20,
    exchange?: ExchangeName,
    useCache: boolean = false // Usually don't cache orderbook
  ): Promise<OrderBookData> {
    const cacheKey = this.getCacheKey('orderbook', exchange || 'default', symbol, limit);

    if (useCache) {
      const cached = await cache.get<OrderBookData>('orderbooks', cacheKey);
      if (cached) return cached;
    }

    return this.dedupeRequest(cacheKey, async () => {
      const data = await exchangeManager.fetchOrderBook(symbol, limit, exchange);
      if (useCache && data.bids.length > 0) {
        // Cache for 5 seconds
        await cache.set('orderbooks', cacheKey, data, 5 * 1000);
      }
      return data;
    });
  }

  subscribeTicker(symbol: string, callback: (ticker: Ticker) => void, exchange?: ExchangeName): () => void {
    return exchangeManager.subscribeTicker(symbol, callback, exchange);
  }

  subscribeKlines(
    symbol: string,
    interval: string,
    callback: (candle: Candle) => void,
    exchange?: ExchangeName
  ): () => void {
    return exchangeManager.subscribeKlines(symbol, interval, callback, exchange);
  }

  subscribeOrderBook(symbol: string, callback: (data: OrderBookData) => void, exchange?: ExchangeName): () => void {
    return exchangeManager.subscribeOrderBook(symbol, callback, exchange);
  }

  async clearCache(): Promise<void> {
    await cache.clear();
  }
}

export const cachedApi = new CachedApi();
