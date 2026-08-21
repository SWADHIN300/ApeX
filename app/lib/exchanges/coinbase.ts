import { ExchangeAdapter, Ticker, Candle, OrderBookData } from './types';

const COINBASE_REST_URL = "https://api.exchange.coinbase.com";
const COINBASE_WS_URL = "wss://ws-feed.exchange.coinbase.com";

const formatVolume = (vol: number) => {
  if (vol >= 1e9) return (vol / 1e9).toFixed(2) + "B";
  if (vol >= 1e6) return (vol / 1e6).toFixed(2) + "M";
  if (vol >= 1e3) return (vol / 1e3).toFixed(2) + "K";
  return vol.toFixed(2);
};

export class CoinbaseAdapter implements ExchangeAdapter {
  name = 'coinbase';

  normalizeSymbol(symbol: string): string {
    // Convert BTC-PERP to BTC-USD
    return symbol.replace("-PERP", "-USD");
  }

  denormalizeSymbol(symbol: string): string {
    // Convert BTC-USD to BTC-PERP
    return symbol.replace("-USD", "-PERP");
  }

  async fetchTickers(): Promise<Ticker[]> {
    try {
      const res = await fetch(`${COINBASE_REST_URL}/products`);
      const products = await res.json();
      
      if (!Array.isArray(products)) return [];

      // Filter for USD pairs
      const usdProducts = products.filter((p: any) => p.id.endsWith('-USD') && p.status === 'online');

      const tickers = await Promise.all(
        usdProducts.slice(0, 50).map(async (p: any) => {
          try {
            const tickerRes = await fetch(`${COINBASE_REST_URL}/products/${p.id}/ticker`);
            const ticker = await tickerRes.json();
            
            const statsRes = await fetch(`${COINBASE_REST_URL}/products/${p.id}/stats`);
            const stats = await statsRes.json();

            const price = parseFloat(ticker.price || stats.last || 0);
            const open = parseFloat(stats.open || price);
            const change24h = open !== 0 ? ((price - open) / open) * 100 : 0;

            return {
              symbol: this.denormalizeSymbol(p.id),
              price,
              change24h,
              volume24h: formatVolume(parseFloat(stats.volume || 0)),
              high24h: parseFloat(stats.high || price),
              low24h: parseFloat(stats.low || price),
            };
          } catch (err) {
            console.error(`Coinbase: Error fetching ticker for ${p.id}:`, err);
            return null;
          }
        })
      );

      return tickers.filter((t): t is Ticker => t !== null);
    } catch (error) {
      console.error("Coinbase: Failed to fetch tickers:", error);
      return [];
    }
  }

  async fetchKlines(pair: string, interval: string, limit: number = 100): Promise<Candle[]> {
    const symbol = this.normalizeSymbol(pair);
    if (!symbol) return [];

    // Map our intervals to Coinbase granularity (in seconds)
    const granularityMap: Record<string, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400,
    };

    const granularity = granularityMap[interval] || 900;
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - (granularity * limit);

    try {
      const res = await fetch(
        `${COINBASE_REST_URL}/products/${symbol}/candles?granularity=${granularity}&start=${startTime}&end=${endTime}`
      );
      const data = await res.json();

      if (!Array.isArray(data)) return [];

      // Coinbase returns [time, low, high, open, close, volume]
      return data
        .map((d: any) => ({
          time: d[0],
          open: d[3],
          high: d[2],
          low: d[1],
          close: d[4],
          volume: d[5],
        }))
        .sort((a, b) => a.time - b.time);
    } catch (error) {
      console.error(`Coinbase: Failed to fetch klines for ${pair}:`, error);
      return [];
    }
  }

  async fetchOrderBook(pair: string, limit: number = 20): Promise<OrderBookData> {
    const symbol = this.normalizeSymbol(pair);
    if (!symbol) return { bids: [], asks: [] };

    try {
      const level = limit > 50 ? 3 : 2;
      const res = await fetch(`${COINBASE_REST_URL}/products/${symbol}/book?level=${level}`);
      const data = await res.json();
      
      return {
        bids: (data.bids || []).slice(0, limit).map((b: any) => ({ 
          price: parseFloat(b[0]), 
          size: parseFloat(b[1]) 
        })),
        asks: (data.asks || []).slice(0, limit).map((a: any) => ({ 
          price: parseFloat(a[0]), 
          size: parseFloat(a[1]) 
        })),
      };
    } catch(err) {
      console.error("Coinbase: Error fetching orderbook", err);
      return { bids: [], asks: [] };
    }
  }

  subscribeTicker(pair: string, callback: (ticker: Ticker) => void): () => void {
    const symbol = this.normalizeSymbol(pair);
    if (!symbol) return () => {};

    const ws = new WebSocket(COINBASE_WS_URL);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'subscribe',
        product_ids: [symbol],
        channels: ['ticker']
      }));
    };

    let lastStats = { high24h: 0, low24h: 0, volume24h: '0', change24h: 0 };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'ticker') {
        const price = parseFloat(data.price);
        const open24h = parseFloat(data.open_24h || price);
        const change24h = open24h !== 0 ? ((price - open24h) / open24h) * 100 : 0;

        lastStats = {
          high24h: parseFloat(data.high_24h || lastStats.high24h),
          low24h: parseFloat(data.low_24h || lastStats.low24h),
          volume24h: formatVolume(parseFloat(data.volume_24h || 0)),
          change24h
        };

        callback({
          symbol: pair,
          price,
          ...lastStats
        });
      }
    };

    return () => ws.close();
  }

  subscribeKlines(pair: string, interval: string, callback: (candle: Candle) => void): () => void {
    const symbol = this.normalizeSymbol(pair);
    if (!symbol) return () => {};

    const ws = new WebSocket(COINBASE_WS_URL);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'subscribe',
        product_ids: [symbol],
        channels: ['matches']
      }));
    };

    // Coinbase doesn't have direct kline WebSocket, we'd need to build candles from trades
    // For now, return a no-op
    console.warn('Coinbase: Real-time klines not fully implemented, using trade aggregation');

    return () => ws.close();
  }

  subscribeOrderBook(pair: string, callback: (data: OrderBookData) => void): () => void {
    const symbol = this.normalizeSymbol(pair);
    if (!symbol) return () => {};

    const ws = new WebSocket(COINBASE_WS_URL);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'subscribe',
        product_ids: [symbol],
        channels: ['level2']
      }));
    };

    let orderbook = { bids: [] as any[], asks: [] as any[] };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'snapshot') {
        orderbook = {
          bids: data.bids.map((b: any) => ({ price: parseFloat(b[0]), size: parseFloat(b[1]) })),
          asks: data.asks.map((a: any) => ({ price: parseFloat(a[0]), size: parseFloat(a[1]) }))
        };
        callback(orderbook);
      } else if (data.type === 'l2update') {
        // Update orderbook with changes
        data.changes.forEach(([side, price, size]: any) => {
          const priceNum = parseFloat(price);
          const sizeNum = parseFloat(size);
          const book = side === 'buy' ? orderbook.bids : orderbook.asks;
          
          if (sizeNum === 0) {
            const idx = book.findIndex(l => l.price === priceNum);
            if (idx !== -1) book.splice(idx, 1);
          } else {
            const idx = book.findIndex(l => l.price === priceNum);
            if (idx !== -1) {
              book[idx].size = sizeNum;
            } else {
              book.push({ price: priceNum, size: sizeNum });
            }
          }
        });
        
        // Sort
        orderbook.bids.sort((a, b) => b.price - a.price);
        orderbook.asks.sort((a, b) => a.price - b.price);
        
        callback(orderbook);
      }
    };

    return () => ws.close();
  }
}
