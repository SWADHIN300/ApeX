import { Candle } from '../exchanges/types';

export interface PatternDetection {
  type: string;
  name: string;
  index: number;
  time: number;
  bullish: boolean;
  confidence: number; // 0-1
  description: string;
}

// Helper functions
function isBullish(candle: Candle): boolean {
  return candle.close > candle.open;
}

function isBearish(candle: Candle): boolean {
  return candle.close < candle.open;
}

function bodySize(candle: Candle): number {
  return Math.abs(candle.close - candle.open);
}

function upperWick(candle: Candle): number {
  return candle.high - Math.max(candle.open, candle.close);
}

function lowerWick(candle: Candle): number {
  return Math.min(candle.open, candle.close) - candle.low;
}

function candleRange(candle: Candle): number {
  return candle.high - candle.low;
}

function isSmallBody(candle: Candle): boolean {
  const body = bodySize(candle);
  const range = candleRange(candle);
  return body < range * 0.3;
}

function isLongBody(candle: Candle): boolean {
  const body = bodySize(candle);
  const range = candleRange(candle);
  return body > range * 0.7;
}

// Pattern Detection Functions

// Doji
export function detectDoji(candles: Candle[]): PatternDetection[] {
  const patterns: PatternDetection[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const body = bodySize(candle);
    const range = candleRange(candle);
    
    if (body < range * 0.1 && range > 0) {
      patterns.push({
        type: 'doji',
        name: 'Doji',
        index: i,
        time: candle.time,
        bullish: false, // Neutral
        confidence: 0.8,
        description: 'Indecision in the market, potential reversal'
      });
    }
  }
  
  return patterns;
}

// Hammer / Hanging Man
export function detectHammer(candles: Candle[]): PatternDetection[] {
  const patterns: PatternDetection[] = [];
  
  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i];
    const body = bodySize(candle);
    const lower = lowerWick(candle);
    const upper = upperWick(candle);
    const range = candleRange(candle);
    
    // Long lower wick, small body, small upper wick
    if (lower > body * 2 && upper < body && range > 0) {
      const inDowntrend = i >= 5 && candles[i - 1].close < candles[i - 5].close;
      
      patterns.push({
        type: 'hammer',
        name: inDowntrend ? 'Hammer' : 'Hanging Man',
        index: i,
        time: candle.time,
        bullish: inDowntrend,
        confidence: 0.75,
        description: inDowntrend 
          ? 'Bullish reversal signal at bottom of downtrend'
          : 'Bearish signal at top of uptrend'
      });
    }
  }
  
  return patterns;
}

// Shooting Star / Inverted Hammer
export function detectShootingStar(candles: Candle[]): PatternDetection[] {
  const patterns: PatternDetection[] = [];
  
  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i];
    const body = bodySize(candle);
    const lower = lowerWick(candle);
    const upper = upperWick(candle);
    const range = candleRange(candle);
    
    // Long upper wick, small body, small lower wick
    if (upper > body * 2 && lower < body && range > 0) {
      const inUptrend = i >= 5 && candles[i - 1].close > candles[i - 5].close;
      
      patterns.push({
        type: 'shootingStar',
        name: inUptrend ? 'Shooting Star' : 'Inverted Hammer',
        index: i,
        time: candle.time,
        bullish: !inUptrend,
        confidence: 0.75,
        description: inUptrend 
          ? 'Bearish reversal signal at top of uptrend'
          : 'Bullish signal at bottom of downtrend'
      });
    }
  }
  
  return patterns;
}

// Engulfing Pattern
export function detectEngulfing(candles: Candle[]): PatternDetection[] {
  const patterns: PatternDetection[] = [];
  
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    
    // Bullish Engulfing
    if (isBearish(prev) && isBullish(curr) &&
        curr.open < prev.close && curr.close > prev.open &&
        bodySize(curr) > bodySize(prev)) {
      patterns.push({
        type: 'engulfing',
        name: 'Bullish Engulfing',
        index: i,
        time: curr.time,
        bullish: true,
        confidence: 0.85,
        description: 'Strong bullish reversal pattern'
      });
    }
    
    // Bearish Engulfing
    if (isBullish(prev) && isBearish(curr) &&
        curr.open > prev.close && curr.close < prev.open &&
        bodySize(curr) > bodySize(prev)) {
      patterns.push({
        type: 'engulfing',
        name: 'Bearish Engulfing',
        index: i,
        time: curr.time,
        bullish: false,
        confidence: 0.85,
        description: 'Strong bearish reversal pattern'
      });
    }
  }
  
  return patterns;
}

// Morning Star / Evening Star
export function detectStar(candles: Candle[]): PatternDetection[] {
  const patterns: PatternDetection[] = [];
  
  for (let i = 2; i < candles.length; i++) {
    const first = candles[i - 2];
    const second = candles[i - 1];
    const third = candles[i];
    
    // Morning Star (Bullish)
    if (isBearish(first) && isSmallBody(second) && isBullish(third) &&
        isLongBody(first) && isLongBody(third) &&
        third.close > (first.open + first.close) / 2) {
      patterns.push({
        type: 'star',
        name: 'Morning Star',
        index: i,
        time: third.time,
        bullish: true,
        confidence: 0.9,
        description: 'Strong bullish reversal pattern (three candles)'
      });
    }
    
    // Evening Star (Bearish)
    if (isBullish(first) && isSmallBody(second) && isBearish(third) &&
        isLongBody(first) && isLongBody(third) &&
        third.close < (first.open + first.close) / 2) {
      patterns.push({
        type: 'star',
        name: 'Evening Star',
        index: i,
        time: third.time,
        bullish: false,
        confidence: 0.9,
        description: 'Strong bearish reversal pattern (three candles)'
      });
    }
  }
  
  return patterns;
}

// Three White Soldiers / Three Black Crows
export function detectThreeSoldiers(candles: Candle[]): PatternDetection[] {
  const patterns: PatternDetection[] = [];
  
  for (let i = 2; i < candles.length; i++) {
    const first = candles[i - 2];
    const second = candles[i - 1];
    const third = candles[i];
    
    // Three White Soldiers (Bullish)
    if (isBullish(first) && isBullish(second) && isBullish(third) &&
        isLongBody(first) && isLongBody(second) && isLongBody(third) &&
        second.close > first.close && third.close > second.close &&
        second.open > first.open && second.open < first.close &&
        third.open > second.open && third.open < second.close) {
      patterns.push({
        type: 'threeSoldiers',
        name: 'Three White Soldiers',
        index: i,
        time: third.time,
        bullish: true,
        confidence: 0.9,
        description: 'Strong bullish continuation pattern'
      });
    }
    
    // Three Black Crows (Bearish)
    if (isBearish(first) && isBearish(second) && isBearish(third) &&
        isLongBody(first) && isLongBody(second) && isLongBody(third) &&
        second.close < first.close && third.close < second.close &&
        second.open < first.open && second.open > first.close &&
        third.open < second.open && third.open > second.close) {
      patterns.push({
        type: 'threeCrows',
        name: 'Three Black Crows',
        index: i,
        time: third.time,
        bullish: false,
        confidence: 0.9,
        description: 'Strong bearish continuation pattern'
      });
    }
  }
  
  return patterns;
}

// Detect all patterns
export function detectAllPatterns(candles: Candle[]): PatternDetection[] {
  return [
    ...detectDoji(candles),
    ...detectHammer(candles),
    ...detectShootingStar(candles),
    ...detectEngulfing(candles),
    ...detectStar(candles),
    ...detectThreeSoldiers(candles),
  ].sort((a, b) => a.index - b.index);
}
