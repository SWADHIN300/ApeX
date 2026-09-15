import { NextResponse } from "next/server";

/**
 * UDF `/time` — server time in seconds.
 *
 * The charting library uses this to align the right edge of the chart, so it
 * must be plain text rather than JSON.
 */
export async function GET() {
  return new NextResponse(String(Math.floor(Date.now() / 1000)), {
    headers: { "Content-Type": "text/plain" },
  });
}
