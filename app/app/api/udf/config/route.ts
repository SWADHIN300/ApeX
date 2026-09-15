import { NextResponse } from "next/server";
import { UDF_RESOLUTIONS } from "@/lib/udf";

/**
 * UDF `/config` — tells TradingView's Advanced Charts what this datafeed can do.
 *
 * Part of the Universal Data Feed contract, so the charting library can be
 * pointed at `/api/udf` and render ApeX's own on-chain candles.
 */
export async function GET() {
  return NextResponse.json({
    supported_resolutions: UDF_RESOLUTIONS,
    supports_group_request: false,
    supports_marks: false,
    supports_search: true,
    supports_timescale_marks: false,
    // ApeX serves candles only; there is no separate tick stream to poll.
    supports_time: true,
    exchanges: [{ value: "APEX", name: "ApeX", desc: "ApeX Protocol (on-chain)" }],
    symbols_types: [{ name: "crypto", value: "crypto" }],
  });
}
