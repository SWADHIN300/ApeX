import { NextResponse } from "next/server";
import { UDF_RESOLUTIONS } from "@/lib/udf";

/**
 * UDF `/symbols` — symbol metadata for TradingView's Advanced Charts.
 *
 * ApeX pairs are quoted in USD-pegged collateral with 6 decimals, so the
 * price scale is fixed at 1/100 (two visible decimals) which matches how the
 * rest of the terminal formats prices.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || "";

  if (!symbol) {
    return NextResponse.json({ s: "error", errmsg: "symbol is required" }, { status: 400 });
  }

  // Strip any "APEX:" exchange prefix the library may prepend.
  const ticker = symbol.includes(":") ? symbol.split(":")[1] : symbol;

  return NextResponse.json({
    name: ticker,
    ticker,
    description: `${ticker} · ApeX on-chain order book`,
    type: "crypto",
    exchange: "APEX",
    listed_exchange: "APEX",
    session: "24x7",
    timezone: "Etc/UTC",
    minmov: 1,
    pricescale: 100,
    has_intraday: true,
    has_daily: true,
    has_weekly_and_monthly: false,
    supported_resolutions: UDF_RESOLUTIONS,
    intraday_multipliers: ["1", "5", "15", "60", "240"],
    volume_precision: 4,
    data_status: "streaming",
    currency_code: "USD",
  });
}
