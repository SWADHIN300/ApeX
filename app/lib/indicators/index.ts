import { Candle } from '../exchanges/types';

export interface IndicatorValue {
  time: number;
  value: number;
}

export interface MACDValue {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

export interface BollingerBandsValue {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

export interface StochasticValue {
  time: number;
  k: number;
  d: number;
}

export interface FibonacciLevel {
  level: number;
  price: number;
  label: string;
}

// Simple Moving Average
export function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j];
    }
    result.push(sum / period);
  }
  return result;
}

// Exponential Moving Average
export function calculateEMA(data: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  
  // Start with SMA for first value
  let sum = 0;
  for (let i = 0; i < period && i < data.length; i++) {
    sum += data[i];
  }
  const firstEMA = sum / Math.min(period, data.length);
  
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push(firstEMA);
    } else {
      const ema = (data[i] - result[i - 1]) * multiplier + result[i - 1];
      result.push(ema);
    }
  }
  
  return result;
}

// Relative Strength Index
export function calculateRSI(candles: Candle[], period: number = 14): IndicatorValue[] {
  if (candles.length < period + 1) return [];
  
  const changes: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    changes.push(candles[i].close - candles[i - 1].close);
  }
  
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? -c : 0);
  
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  const result: IndicatorValue[] = [];
  
  for (let i = period; i < candles.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period;
    
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    result.push({
      time: candles[i].time,
      value: rsi
    });
  }
  
  return result;
}

// MACD (Moving Average Convergence Divergence)
export function calculateMACD(
  candles: Candle[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDValue[] {
  if (candles.length < slowPeriod + signalPeriod) return [];
  
  const closes = candles.map(c => c.close);
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);
  
  const macdLine = fastEMA.map((fast, i) => fast - slowEMA[i]);
  const signalLine = calculateEMA(macdLine, signalPeriod);
  
  const result: MACDValue[] = [];
  
  for (let i = slowPeriod + signalPeriod; i < candles.length; i++) {
    result.push({
      time: candles[i].time,
      macd: macdLine[i],
      signal: signalLine[i],
      histogram: macdLine[i] - signalLine[i]
    });
  }
  
  return result;
}

// Bollinger Bands
export function calculateBollingerBands(
  candles: Candle[],
  period: number = 20,
  stdDev: number = 2
): BollingerBandsValue[] {
  if (candles.length < period) return [];
  
  const closes = candles.map(c => c.close);
  const sma = calculateSMA(closes, period);
  
  const result: BollingerBandsValue[] = [];
  
  for (let i = period - 1; i < candles.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = sma[i];
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const sd = Math.sqrt(variance);
    
    result.push({
      time: candles[i].time,
      upper: mean + (stdDev * sd),
      middle: mean,
      lower: mean - (stdDev * sd)
    });
  }
  
  return result;
}

// Stochastic Oscillator
export function calculateStochastic(
  candles: Candle[],
  kPeriod: number = 14,
  dPeriod: number = 3
): StochasticValue[] {
  if (candles.length < kPeriod + dPeriod) return [];
  
  const kValues: number[] = [];
  
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const slice = candles.slice(i - kPeriod + 1, i + 1);
    const high = Math.max(...slice.map(c => c.high));
    const low = Math.min(...slice.map(c => c.low));
    const close = candles[i].close;
    
    const k = high === low ? 50 : ((close - low) / (high - low)) * 100;
    kValues.push(k);
  }
  
  const dValues = calculateSMA(kValues, dPeriod);
  
  const result: StochasticValue[] = [];
  
  for (let i = dPeriod - 1; i < kValues.length; i++) {
    result.push({
      time: candles[i + kPeriod - 1].time,
      k: kValues[i],
      d: dValues[i]
    });
  }
  
  return result;
}

// Fibonacci Retracement Levels
export function calculateFibonacci(high: number, low: number, isUptrend: boolean = true): FibonacciLevel[] {
  const diff = high - low;
  const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  
  return levels.map(level => ({
    level,
    price: isUptrend ? high - (diff * level) : low + (diff * level),
    label: `${(level * 100).toFixed(1)}%`
  }));
}

// Average True Range (ATR) - useful for volatility
export function calculateATR(candles: Candle[], period: number = 14): IndicatorValue[] {
  if (candles.length < period + 1) return [];
  
  const trueRanges: number[] = [];
  
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    
    trueRanges.push(tr);
  }
  
  const result: IndicatorValue[] = [];
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  result.push({
    time: candles[period].time,
    value: atr
  });
  
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
    result.push({
      time: candles[i + 1].time,
      value: atr
    });
  }
  
  return result;
}

// Volume Weighted Average Price (VWAP)
export function calculateVWAP(candles: Candle[]): IndicatorValue[] {
  const result: IndicatorValue[] = [];
  let cumulativeTPV = 0; // Typical Price * Volume
  let cumulativeVolume = 0;
  
  for (const candle of candles) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    cumulativeTPV += typicalPrice * candle.volume;
    cumulativeVolume += candle.volume;
    
    result.push({
      time: candle.time,
      value: cumulativeVolume === 0 ? typicalPrice : cumulativeTPV / cumulativeVolume
    });
  }
  
  return result;
}

// On Balance Volume (OBV)
export function calculateOBV(candles: Candle[]): IndicatorValue[] {
  const result: IndicatorValue[] = [];
  let obv = 0;
  
  for (let i = 0; i < candles.length; i++) {
    if (i > 0) {
      if (candles[i].close > candles[i - 1].close) {
        obv += candles[i].volume;
      } else if (candles[i].close < candles[i - 1].close) {
        obv -= candles[i].volume;
      }
    }
    
    result.push({
      time: candles[i].time,
      value: obv
    });
  }
  
  return result;
}
