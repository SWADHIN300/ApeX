import { Candle, Ticker, OrderBookLevel } from "./types";

const BINANCE_REST_URL = "https://data-api.binance.vision/api/v3";
const BINANCE_WS_URL = "wss://data-stream.binance.vision:9443/ws";

// Utility functions to convert between ApeX pair and Binance symbol
export const getBinanceSymbol = (pair: string) => pair.replace("-PERP", "USDT");
export const getApexPair = (symbol: string) => symbol.replace("USDT", "-PERP");

const formatVolume = (vol: number) => {
  if (vol >= 1e9) return (vol / 1e9).toFixed(2) + "B";
  if (vol >= 1e6) return (vol / 1e6).toFixed(2) + "M";
  if (vol >= 1e3) return (vol / 1e3).toFixed(2) + "K";
  return vol.toFixed(2);
};

export async function fetchAllTickers(): Promise<Ticker[]> {
  try {
    const res = await fetch(`${BINANCE_REST_URL}/ticker/24hr`);
    const data = await res.json();
    
    if (!Array.isArray(data)) return [];

    const filtered = data.filter((d: any) => d.symbol.endsWith("USDT"));

    return filtered.map((d: any) => {
      const price = parseFloat(d.lastPrice);
      const change24h = parseFloat(d.priceChangePercent) || 0;
      // using quote volume (USDT)
      const volume24h = formatVolume(parseFloat(d.quoteVolume)); 
      
      return {
        symbol: getApexPair(d.symbol),
        price,
        change24h,
        volume24h,
        high24h: parseFloat(d.highPrice),
        low24h: parseFloat(d.lowPrice),
      };
    });
  } catch (error) {
    console.error("Failed to fetch tickers:", error);
    return [];
  }
}

export async function fetchKlines(
  pair: string,
  interval: string,
  limit: number = 100
): Promise<Candle[]> {
  const symbol = getBinanceSymbol(pair);
  if (!symbol) return [];

  try {
    const res = await fetch(
      `${BINANCE_REST_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    );
    const data = await res.json();

    if (!Array.isArray(data)) return [];

    return data.map((d: any) => ({
      time: Math.floor(d[0] / 1000), // convert to seconds
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]), // base asset volume
    }));
  } catch (error) {
    console.error(`Failed to fetch klines for ${pair}:`, error);
    return [];
  }
}

export async function fetchOrderBook(pair: string, limit: number = 20): Promise<{ bids: OrderBookLevel[], asks: OrderBookLevel[] }> {
    const symbol = getBinanceSymbol(pair);
    if (!symbol) return { bids: [], asks: [] };

    try {
        const res = await fetch(`${BINANCE_REST_URL}/depth?symbol=${symbol}&limit=${limit}`);
        const data = await res.json();
        
        return {
            bids: data.bids.map((b: any) => ({ price: parseFloat(b[0]), size: parseFloat(b[1]) })),
            asks: data.asks.map((a: any) => ({ price: parseFloat(a[0]), size: parseFloat(a[1]) })),
        };
    } catch(err) {
        console.error("Error fetching orderbook", err);
        return { bids: [], asks: [] };
    }
}

export function subscribeTicker(
  pair: string,
  callback: (ticker: Ticker) => void
): () => void {
  const symbol = getBinanceSymbol(pair);
  if (!symbol) return () => {};

  const ws = new WebSocket(`${BINANCE_WS_URL}/${symbol.toLowerCase()}@ticker`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const price = parseFloat(data.c);
    const prevClose = parseFloat(data.p); // wait, for 24h ticker it's better to calculate or use p? wait, data.p is price change. Let's just use data.P for price change %.
    const change24h = parseFloat(data.P);
    const volume24h = formatVolume(parseFloat(data.q));

    callback({
      symbol: pair,
      price,
      change24h,
      volume24h,
      high24h: parseFloat(data.h),
      low24h: parseFloat(data.l),
    });
  };

  return () => ws.close();
}

export function subscribeKlines(
  pair: string,
  interval: string,
  callback: (candle: Candle) => void
): () => void {
  const symbol = getBinanceSymbol(pair);
  if (!symbol) return () => {};

  const ws = new WebSocket(
    `${BINANCE_WS_URL}/${symbol.toLowerCase()}@kline_${interval}`
  );

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (!data.k) return;
    
    callback({
      time: Math.floor(data.k.t / 1000),
      open: parseFloat(data.k.o),
      high: parseFloat(data.k.h),
      low: parseFloat(data.k.l),
      close: parseFloat(data.k.c),
      volume: parseFloat(data.k.v),
    });
  };

  return () => ws.close();
}

export function subscribeOrderBook(
  pair: string,
  callback: (data: { bids: OrderBookLevel[], asks: OrderBookLevel[] }) => void
): () => void {
  const symbol = getBinanceSymbol(pair);
  if (!symbol) return () => {};

  const ws = new WebSocket(
    `${BINANCE_WS_URL}/${symbol.toLowerCase()}@depth20@100ms`
  );

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if(!data.bids || !data.asks) return;
    
    callback({
      bids: data.bids.map((b: any) => ({ price: parseFloat(b[0]), size: parseFloat(b[1]) })),
      asks: data.asks.map((a: any) => ({ price: parseFloat(a[0]), size: parseFloat(a[1]) }))
    });
  };

  return () => ws.close();
}
