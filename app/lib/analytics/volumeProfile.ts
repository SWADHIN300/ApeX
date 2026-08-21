import { Candle } from '../exchanges/types';

export interface VolumeProfileLevel {
  price: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  percentage: number;
}

export interface VolumeProfileData {
  levels: VolumeProfileLevel[];
  poc: number; // Point of Control (highest volume price)
  vah: number; // Value Area High
  val: number; // Value Area Low
  totalVolume: number;
}

export function calculateVolumeProfile(
  candles: Candle[],
  numLevels: number = 50
): VolumeProfileData {
  if (candles.length === 0) {
    return { levels: [], poc: 0, vah: 0, val: 0, totalVolume: 0 };
  }

  // Find price range
  const prices = candles.flatMap(c => [c.high, c.low]);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceStep = (maxPrice - minPrice) / numLevels;

  // Initialize levels
  const levels: VolumeProfileLevel[] = [];
  for (let i = 0; i < numLevels; i++) {
    levels.push({
      price: minPrice + (i * priceStep) + (priceStep / 2),
      volume: 0,
      buyVolume: 0,
      sellVolume: 0,
      percentage: 0
    });
  }

  // Distribute volume across price levels
  let totalVolume = 0;
  for (const candle of candles) {
    const candleRange = candle.high - candle.low;
    if (candleRange === 0) continue;

    const volumePerPrice = candle.volume / candleRange;
    const isBullish = candle.close >= candle.open;

    for (let price = candle.low; price <= candle.high; price += priceStep / 10) {
      const levelIndex = Math.floor((price - minPrice) / priceStep);
      if (levelIndex >= 0 && levelIndex < numLevels) {
        const vol = volumePerPrice * (priceStep / 10);
        levels[levelIndex].volume += vol;
        
        if (isBullish) {
          levels[levelIndex].buyVolume += vol;
        } else {
          levels[levelIndex].sellVolume += vol;
        }
        
        totalVolume += vol;
      }
    }
  }

  // Calculate percentages
  levels.forEach(level => {
    level.percentage = totalVolume > 0 ? (level.volume / totalVolume) * 100 : 0;
  });

  // Find POC (Point of Control)
  const poc = levels.reduce((max, level) => 
    level.volume > max.volume ? level : max
  , levels[0]).price;

  // Calculate Value Area (70% of volume)
  const sortedByVolume = [...levels].sort((a, b) => b.volume - a.volume);
  let valueAreaVolume = 0;
  const targetVolume = totalVolume * 0.7;
  const valueAreaLevels: VolumeProfileLevel[] = [];

  for (const level of sortedByVolume) {
    if (valueAreaVolume >= targetVolume) break;
    valueAreaLevels.push(level);
    valueAreaVolume += level.volume;
  }

  const valueAreaPrices = valueAreaLevels.map(l => l.price).sort((a, b) => a - b);
  const vah = valueAreaPrices[valueAreaPrices.length - 1] || maxPrice;
  const val = valueAreaPrices[0] || minPrice;

  return {
    levels,
    poc,
    vah,
    val,
    totalVolume
  };
}

export interface OrderFlowData {
  time: number;
  price: number;
  buyVolume: number;
  sellVolume: number;
  delta: number; // buy - sell
  cumulativeDelta: number;
}

export function calculateOrderFlow(candles: Candle[]): OrderFlowData[] {
  const result: OrderFlowData[] = [];
  let cumulativeDelta = 0;

  for (const candle of candles) {
    const isBullish = candle.close >= candle.open;
    const buyVolume = isBullish ? candle.volume * 0.6 : candle.volume * 0.4;
    const sellVolume = candle.volume - buyVolume;
    const delta = buyVolume - sellVolume;
    cumulativeDelta += delta;

    result.push({
      time: candle.time,
      price: candle.close,
      buyVolume,
      sellVolume,
      delta,
      cumulativeDelta
    });
  }

  return result;
}

export interface LiquidationLevel {
  price: number;
  liquidationVolume: number;
  type: 'long' | 'short';
}

// Estimate liquidation clusters based on volume and price action
export function estimateLiquidationLevels(
  candles: Candle[],
  threshold: number = 1.5
): LiquidationLevel[] {
  const levels: LiquidationLevel[] = [];
  
  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i];
    const prevCandle = candles[i - 1];
    
    // Look for large volume wicks (potential liquidations)
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    const body = Math.abs(candle.close - candle.open);
    const avgVolume = candles.slice(Math.max(0, i - 20), i)
      .reduce((sum, c) => sum + c.volume, 0) / Math.min(20, i);

    // Long liquidations (price drops, high volume, long lower wick)
    if (lowerWick > body * 2 && candle.volume > avgVolume * threshold) {
      levels.push({
        price: candle.low,
        liquidationVolume: candle.volume,
        type: 'long'
      });
    }

    // Short liquidations (price rises, high volume, long upper wick)
    if (upperWick > body * 2 && candle.volume > avgVolume * threshold) {
      levels.push({
        price: candle.high,
        liquidationVolume: candle.volume,
        type: 'short'
      });
    }
  }

  return levels;
}

export interface MarketDepthLevel {
  price: number;
  bidSize: number;
  askSize: number;
  imbalance: number; // (bids - asks) / (bids + asks)
}

// This would need real orderbook data, but here's a structure
export function analyzeMarketDepth(
  bids: { price: number; size: number }[],
  asks: { price: number; size: number }[]
): MarketDepthLevel[] {
  const levels: MarketDepthLevel[] = [];
  const allPrices = new Set([...bids.map(b => b.price), ...asks.map(a => a.price)]);

  for (const price of Array.from(allPrices).sort((a, b) => b - a)) {
    const bidSize = bids.find(b => b.price === price)?.size || 0;
    const askSize = asks.find(a => a.price === price)?.size || 0;
    const total = bidSize + askSize;
    const imbalance = total > 0 ? (bidSize - askSize) / total : 0;

    levels.push({
      price,
      bidSize,
      askSize,
      imbalance
    });
  }

  return levels;
}
