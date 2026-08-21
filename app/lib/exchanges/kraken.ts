import { ExchangeAdapter, Ticker, Candle, OrderBookData } from './types';

const KRAKEN_REST_URL = "https://api.kraken.com/0/public";
const KRAKEN_WS_URL = "wss://ws.kraken.com";

const formatVolume = (vol: number) => {
  if (vol >= 1e9) return (vol / 1e9).toFixed(2) + "B";
  if (vol >= 1e6) return (vol / 1e6).toFixed(2) + "M";
  if (vol >= 1e3) return (vol / 1e3).toFixed(2) + "K";
  return vol.toFixed(2);
};

export class KrakenAdapter implements ExchangeAdapter {
  name = 'kraken';
  private symbolMap: Map<string, string> = new Map();

  normalizeSymbol(symbol: string): string {
    // Convert BTC-PERP to XXBTZUSD (Kraken format)
    const base = symbol.replace("-PERP", "");
    
    // Common Kraken symbol mappings
    const krakenMap: Record<string, string> = {
      'BTC': 'XXBTZUSD',
      'ETH': 'XETHZUSD',
      'SOL': 'SOLUSD',
      'ADA': 'ADAUSD',
      'DOT': 'DOTUSD',
      'AVAX': 'AVAXUSD',
      'MATIC': 'MATICUSD',
      'LINK': 'LINKUSD',
      'UNI': 'UNIUSD',
      'ATOM': 'ATOMUSD',
    };

    return krakenMap[base] || `${base}USD`;
  }

  denormalizeSymbol(symbol: string): string {
    // Convert XXBTZUSD back to BTC-PERP
    const reverseMap: Record<string, string> = {
      'XXBTZUSD': 'BTC-PERP',
      'XETHZUSD': 'ETH-PERP',
      'SOLUSD': 'SOL-PERP',
      'ADAUSD': 'ADA-PERP',
      'DOTUSD': 'DOT-PERP',
      'AVAXUSD': 'AVAX-PERP',
      'MATICUSD': 'MATIC-PERP',
      'LINKUSD': 'LINK-PERP',
      'UNIUSD': 'UNI-PERP',
      'ATOMUSD': 'ATOM-PERP',
    };

    if (reverseMap[symbol]) return reverseMap[symbol];
    
    // Generic conversion
    return symbol.replace(/^X/, '').replace(/Z?USD$/, '-PERP');
  }

  async fetchTickers(): Promise<Ticker[]> {
    try {
      const res = await fetch(`${KRAKEN_REST_URL}/Ticker`);
      const response = await res.json();
      
      if (response.error?.length > 0 || !response.result) {
        console.error("Kraken API error:", response.error);
        return [];
      }

      const tickers: Ticker[] = [];
      
      for (const [symbol, data] of Object.entries(response.result as Record<string, any>)) {
        if (!symbol.includes('USD')) continue;
        
        const price = parseFloat(data.c[0]);
        const open = parseFloat(data.o);
        const change24h = open !== 0 ? ((price - open) / open) * 100 : 0;

        tickers.push({
          symbol: this.denormalizeSymbol(symbol),
          price,
          change24h,
          volume24h: formatVolume(parseFloat(data.v[1])),
          high24h: parseFloat(data.h[1]),
          low24h: parseFloat(data.l[1]),
        });
      }

      return tickers;
    } catch (error) {
      console.error("Kraken: Failed to fetch tickers:", error);
      return [];
    }
  }

  async fetchKlines(pair: string, interval: string, limit: number = 100): Promise<Candle[]> {
    const symbol = this.normalizeSymbol(pair);
    if (!symbol) return [];

    // Map our intervals to Kraken intervals (in minutes)
    const intervalMap: Record<string, number> = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '1h': 60,
      '4h': 240,
      '1d': 1440,
    };

    const krakenInterval = intervalMap[interval] || 15;
    const since = Math.floor(Date.now() / 1000) - (krakenInterval * 60 * limit);

    try {
      const res = await fetch(
        `${KRAKEN_REST_URL}/OHLC?pair=${symbol}&interval=${krakenInterval}&since=${since}`
      );
      const response = await res.json();

      if (response.error?.length > 0 || !response.result) {
        console.error("Kraken API error:", response.error);
        return [];
      }

      const data = Object.values(response.result)[0] as any[];
      if (!Array.isArray(data)) return [];

      return data.map((d: any) => ({
        time: d[0],
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[6]),
      }));
    } catch (error) {
      console.error(`Kraken: Failed to fetch klines for ${pair}:`, error);
      return [];
    }
  }

  async fetchOrderBook(pair: string, limit: number = 20): Promise<OrderBookData> {
    const symbol = this.normalizeSymbol(pair);
    if (!symbol) return { bids: [], asks: [] };

    try {
      const res = await fetch(`${KRAKEN_REST_URL}/Depth?pair=${symbol}&count=${limit}`);
      const response = await res.json();
      
      if (response.error?.length > 0 || !response.result) {
        console.error("Kraken API error:", response.error);
        return { bids: [], asks: [] };
      }

      const data = Object.values(response.result)[0] as any;
      
      return {
        bids: (data.bids || []).map((b: any) => ({ 
          price: parseFloat(b[0]), 
          size: parseFloat(b[1]) 
        })),
        asks: (data.asks || []).map((a: any) => ({ 
          price: parseFloat(a[0]), 
          size: parseFloat(a[1]) 
        })),
      };
    } catch(err) {
      console.error("Kraken: Error fetching orderbook", err);
      return { bids: [], asks: [] };
    }
  }

  subscribeTicker(pair: string, callback: (ticker: Ticker) => void): () => void {
    const symbol = this.normalizeSymbol(pair);
    if (!symbol) return () => {};

    const ws = new WebSocket(KRAKEN_WS_URL);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        event: 'subscribe',
        pair: [symbol],
        subscription: { name: 'ticker' }
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (Array.isArray(data) && data[2] === 'ticker') {
        const tickerData = data[1];
        const price = parseFloat(tickerData.c[0]);
        const open = parseFloat(tickerData.o[0]);
        const change24h = open !== 0 ? ((price - open) / open) * 100 : 0;

        callback({
          symbol: pair,
          price,
          change24h,
          volume24h: formatVolume(parseFloat(tickerData.v[1])),
          high24h: parseFloat(tickerData.h[1]),
          low24h: parseFloat(tickerData.l[1]),
        });
      }
    };

    return () => ws.close();
  }

  subscribeKlines(pair: string, interval: string, callback: (candle: Candle) => void): () => void {
    const symbol = this.normalizeSymbol(pair);
    if (!symbol) return () => {};

    // Map our intervals to Kraken intervals
    const intervalMap: Record<string, number> = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '1h': 60,
      '4h': 240,
      '1d': 1440,
    };

    const ws = new WebSocket(KRAKEN_WS_URL);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        event: 'subscribe',
        pair: [symbol],
        subscription: { 
          name: 'ohlc',
          interval: intervalMap[interval] || 15
        }
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (Array.isArray(data) && data[2] === 'ohlc') {
        const ohlcData = data[1];
        callback({
          time: parseFloat(ohlcData[1]),
          open: parseFloat(ohlcData[2]),
          high: parseFloat(ohlcData[3]),
          low: parseFloat(ohlcData[4]),
          close: parseFloat(ohlcData[5]),
          volume: parseFloat(ohlcData[7]),
        });
      }
    };

    return () => ws.close();
  }

  subscribeOrderBook(pair: string, callback: (data: OrderBookData) => void): () => void {
    const symbol = this.normalizeSymbol(pair);
    if (!symbol) return () => {};

    const ws = new WebSocket(KRAKEN_WS_URL);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        event: 'subscribe',
        pair: [symbol],
        subscription: { name: 'book', depth: 25 }
      }));
    };

    let orderbook = { bids: [] as any[], asks: [] as any[] };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (Array.isArray(data)) {
        const updates = data[1];
        
        // Snapshot
        if (updates.bs && updates.as) {
          orderbook = {
            bids: updates.bs.map((b: any) => ({ price: parseFloat(b[0]), size: parseFloat(b[1]) })),
            asks: updates.as.map((a: any) => ({ price: parseFloat(a[0]), size: parseFloat(a[1]) }))
          };
          callback(orderbook);
        }
        // Updates
        else if (updates.b || updates.a) {
          if (updates.b) {
            updates.b.forEach((bid: any) => {
              const price = parseFloat(bid[0]);
              const size = parseFloat(bid[1]);
              const idx = orderbook.bids.findIndex(b => b.price === price);
              if (size === 0 && idx !== -1) {
                orderbook.bids.splice(idx, 1);
              } else if (idx !== -1) {
                orderbook.bids[idx].size = size;
              } else {
                orderbook.bids.push({ price, size });
              }
            });
            orderbook.bids.sort((a, b) => b.price - a.price);
          }
          
          if (updates.a) {
            updates.a.forEach((ask: any) => {
              const price = parseFloat(ask[0]);
              const size = parseFloat(ask[1]);
              const idx = orderbook.asks.findIndex(a => a.price === price);
              if (size === 0 && idx !== -1) {
                orderbook.asks.splice(idx, 1);
              } else if (idx !== -1) {
                orderbook.asks[idx].size = size;
              } else {
                orderbook.asks.push({ price, size });
              }
            });
            orderbook.asks.sort((a, b) => a.price - b.price);
          }
          
          callback(orderbook);
        }
      }
    };

    return () => ws.close();
  }
}
