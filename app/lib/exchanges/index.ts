import { BinanceAdapter } from './binance';
import { CoinbaseAdapter } from './coinbase';
import { KrakenAdapter } from './kraken';
import { ExchangeAdapter, ExchangeName, Ticker, Candle, OrderBookData } from './types';

export * from './types';

class ExchangeManager {
  private exchanges: Map<ExchangeName, ExchangeAdapter> = new Map();
  private activeExchange: ExchangeName = 'binance';

  constructor() {
    this.exchanges.set('binance', new BinanceAdapter());
    this.exchanges.set('coinbase', new CoinbaseAdapter());
    this.exchanges.set('kraken', new KrakenAdapter());
  }

  setActiveExchange(exchange: ExchangeName) {
    if (this.exchanges.has(exchange)) {
      this.activeExchange = exchange;
    }
  }

  getActiveExchange(): ExchangeName {
    return this.activeExchange;
  }

  getAdapter(exchange?: ExchangeName): ExchangeAdapter {
    const ex = exchange || this.activeExchange;
    const adapter = this.exchanges.get(ex);
    if (!adapter) {
      throw new Error(`Exchange ${ex} not found`);
    }
    return adapter;
  }

  async fetchTickers(exchange?: ExchangeName): Promise<Ticker[]> {
    return this.getAdapter(exchange).fetchTickers();
  }

  async fetchKlines(symbol: string, interval: string, limit?: number, exchange?: ExchangeName): Promise<Candle[]> {
    return this.getAdapter(exchange).fetchKlines(symbol, interval, limit);
  }

  async fetchOrderBook(symbol: string, limit?: number, exchange?: ExchangeName): Promise<OrderBookData> {
    return this.getAdapter(exchange).fetchOrderBook(symbol, limit);
  }

  subscribeTicker(symbol: string, callback: (ticker: Ticker) => void, exchange?: ExchangeName): () => void {
    return this.getAdapter(exchange).subscribeTicker(symbol, callback);
  }

  subscribeKlines(symbol: string, interval: string, callback: (candle: Candle) => void, exchange?: ExchangeName): () => void {
    return this.getAdapter(exchange).subscribeKlines(symbol, interval, callback);
  }

  subscribeOrderBook(symbol: string, callback: (data: OrderBookData) => void, exchange?: ExchangeName): () => void {
    return this.getAdapter(exchange).subscribeOrderBook(symbol, callback);
  }

  // Aggregate data from all exchanges
  async fetchAggregatedTickers(): Promise<Map<string, Ticker[]>> {
    const results = new Map<string, Ticker[]>();
    
    const allTickers = await Promise.all([
      this.fetchTickers('binance'),
      this.fetchTickers('coinbase'),
      this.fetchTickers('kraken'),
    ]);

    // Group by symbol
    allTickers.forEach((tickers, idx) => {
      const exchangeName: ExchangeName = ['binance', 'coinbase', 'kraken'][idx] as ExchangeName;
      tickers.forEach(ticker => {
        if (!results.has(ticker.symbol)) {
          results.set(ticker.symbol, []);
        }
        results.get(ticker.symbol)!.push({ ...ticker, exchange: exchangeName } as any);
      });
    });

    return results;
  }

  // Get weighted average price from multiple exchanges
  async fetchWeightedPrice(symbol: string): Promise<number | null> {
    const tickers = await Promise.all([
      this.fetchTickers('binance').then(t => t.find(x => x.symbol === symbol)),
      this.fetchTickers('coinbase').then(t => t.find(x => x.symbol === symbol)),
      this.fetchTickers('kraken').then(t => t.find(x => x.symbol === symbol)),
    ]);

    const validTickers = tickers.filter((t): t is Ticker => t !== null && t !== undefined);
    if (validTickers.length === 0) return null;

    // Simple average (could be weighted by volume in production)
    const sum = validTickers.reduce((acc, t) => acc + t.price, 0);
    return sum / validTickers.length;
  }
}

// Singleton instance
export const exchangeManager = new ExchangeManager();

// Export adapters
export { BinanceAdapter } from './binance';
export { CoinbaseAdapter } from './coinbase';
export { KrakenAdapter } from './kraken';
