/**
 * Timeframe helpers shared by the candles API and the indexer.
 *
 * Candles are stored one row per (pair, timeframe, bucket_start), so both the
 * writer and the reader must agree exactly on bucket boundaries.
 */

/** Timeframes the terminal exposes, mapped to their length in seconds. */
export const TIMEFRAME_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 5 * 60,
  "15m": 15 * 60,
  "1h": 60 * 60,
  "4h": 4 * 60 * 60,
  "1d": 24 * 60 * 60,
};

export const SUPPORTED_TIMEFRAMES = Object.keys(TIMEFRAME_SECONDS);

export function isSupportedTimeframe(timeframe: string): boolean {
  return Object.prototype.hasOwnProperty.call(TIMEFRAME_SECONDS, timeframe);
}

/**
 * Floors a unix timestamp (seconds) to the start of its bucket for a given
 * timeframe. Buckets are aligned to the unix epoch, which keeps them stable
 * and timezone-independent.
 */
export function bucketStartSeconds(timestampSeconds: number, timeframe: string): number {
  const size = TIMEFRAME_SECONDS[timeframe];
  if (!size) {
    throw new Error(`Unsupported timeframe: ${timeframe}`);
  }
  return Math.floor(timestampSeconds / size) * size;
}
