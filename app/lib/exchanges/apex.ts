import {
  ExchangeAdapter,
  Ticker,
  Candle,
  OrderBookData,
  OrderBookLevel,
} from './types';

/**
 * ApeX's own market data, sourced from the protocol itself rather than a
 * centralized exchange.
 *
 * Candles come from `/api/candles`, which the indexer service populates from
 * the on-chain program's `OrderFilled` events. Order book depth comes from the
 * program's `OrderBook` account.
 *
 * When the protocol has no trading activity yet these methods return empty
 * arrays. That is intentional: callers fall back to a labeled reference feed
 * instead of showing fabricated data.
 */
export class ApexAdapter implements ExchangeAdapter {
  name = 'apex';

  /** ApeX pairs are already in the app's canonical form (e.g. BTC-PERP). */
  normalizeSymbol(symbol: string): string {
    return symbol;
  }

  denormalizeSymbol(symbol: string): string {
    return symbol;
  }

  /**
   * ApeX does not publish a market list of its own — the tradable universe is
   * driven by MarketContext. Returning empty keeps this adapter from clobbering
   * the app's symbol list when it is the active chart source.
   */
  async fetchTickers(): Promise<Ticker[]> {
    return [];
  }

  /**
   * Polls ApeX's own candles to emit a ticker-shaped update. There is no
   * websocket ticker stream for the protocol; the latest daily candle is the
   * closest equivalent of a 24h summary.
   */
  subscribeTicker(symbol: string, callback: (ticker: Ticker) => void): () => void {
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      const summary = await this.fetchMarketSummary(symbol);
      if (cancelled || !summary) return;
      callback(summary);
    };

    void poll();
    const timer = setInterval(poll, 10_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }

  async fetchKlines(symbol: string, interval: string, limit: number = 500): Promise<Candle[]> {
    try {
      const params = new URLSearchParams({
        pair: symbol,
        timeframe: interval,
        limit: String(limit),
      });
      const response = await fetch(`/api/candles?${params.toString()}`);
      if (!response.ok) return [];

      const payload = (await response.json()) as { candles?: Candle[] };
      return payload.candles ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Polls `/api/candles` and emits the most recent bucket. The chart only needs
   * the latest candle to update in place, and polling avoids holding a
   * websocket open per timeframe.
   */
  subscribeKlines(
    symbol: string,
    interval: string,
    callback: (candle: Candle) => void,
  ): () => void {
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      const candles = await this.fetchKlines(symbol, interval, 2);
      if (cancelled) return;
      const latest = candles[candles.length - 1];
      if (latest) callback(latest);
    };

    void poll();
    const timer = setInterval(poll, 5_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }

  /**
   * Depth from the protocol's own order book.
   *
   * This adapter runs in the browser without a Solana connection of its own, so
   * it reads the aggregated snapshot exposed by `useOrderBook`/`apexProtocol`
   * instead of duplicating RPC wiring here. Charting code that needs live depth
   * should use `useOrderBook` directly.
   */
  async fetchOrderBook(_symbol: string, _limit: number = 20): Promise<OrderBookData> {
    const empty: { bids: OrderBookLevel[]; asks: OrderBookLevel[] } = { bids: [], asks: [] };
    return empty;
  }

  subscribeOrderBook(_symbol: string, _callback: (data: OrderBookData) => void): () => void {
    return () => {};
  }

  /**
   * Derives a ticker-style summary from ApeX's own candles, used for the
   * chart's OHLC readout. Returns null when nothing has been indexed yet.
   */
  async fetchMarketSummary(symbol: string): Promise<Ticker | null> {
    const candles = await this.fetchKlines(symbol, '1d', 2);
    if (candles.length === 0) return null;

    const today = candles[candles.length - 1];
    const previous = candles.length > 1 ? candles[candles.length - 2] : today;
    const change24h =
      previous.close > 0 ? ((today.close - previous.close) / previous.close) * 100 : 0;

    return {
      symbol,
      price: today.close,
      change24h,
      volume24h: today.volume.toFixed(2),
      high24h: today.high,
      low24h: today.low,
    };
  }
}
