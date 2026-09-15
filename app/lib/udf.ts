/**
 * Mapping between TradingView "resolutions" and ApeX candle timeframes.
 *
 * TradingView's Advanced Charts library (and its Universal Data Feed contract)
 * expresses intraday resolutions in minutes as bare strings — "1", "5", "60" —
 * and daily and above with a letter suffix, e.g. "1D".
 */

import { TIMEFRAME_SECONDS } from "./timeframes";

/** Resolutions advertised to the charting library, in UDF order. */
export const UDF_RESOLUTIONS = ["1", "5", "15", "60", "240", "1D"] as const;

const RESOLUTION_TO_TIMEFRAME: Record<string, string> = {
  "1": "1m",
  "5": "5m",
  "15": "15m",
  "60": "1h",
  "240": "4h",
  "1D": "1d",
  D: "1d",
  "1440": "1d",
};

/** Translates a UDF resolution into an ApeX timeframe, or null if unsupported. */
export function resolutionToTimeframe(resolution: string): string | null {
  const timeframe = RESOLUTION_TO_TIMEFRAME[resolution];
  return timeframe && TIMEFRAME_SECONDS[timeframe] ? timeframe : null;
}

/** Seconds per bar for a UDF resolution, used to bound history queries. */
export function resolutionSeconds(resolution: string): number | null {
  const timeframe = resolutionToTimeframe(resolution);
  return timeframe ? TIMEFRAME_SECONDS[timeframe] : null;
}
