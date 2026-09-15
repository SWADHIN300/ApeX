import { NextResponse } from "next/server";
import { getPool, ensureSchema, isDatabaseConfigured } from "@/lib/server/db";
import { isSupportedTimeframe, SUPPORTED_TIMEFRAMES } from "@/lib/timeframes";

/**
 * OHLCV candles for ApeX's *own* market, aggregated by the indexer service
 * from the on-chain program's OrderFilled events.
 *
 * Returns an empty array rather than an error when the database isn't
 * configured or no fills have been indexed yet, so the chart can fall back to
 * a reference feed instead of breaking.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pair = searchParams.get("pair");
  const timeframe = searchParams.get("timeframe") || "15m";
  const limitParam = Number.parseInt(searchParams.get("limit") || "500", 10);
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 1000)
    : 500;

  if (!pair) {
    return NextResponse.json({ error: "pair is required", candles: [] }, { status: 400 });
  }

  if (!isSupportedTimeframe(timeframe)) {
    return NextResponse.json(
      {
        error: `Unsupported timeframe. Supported: ${SUPPORTED_TIMEFRAMES.join(", ")}`,
        candles: [],
      },
      { status: 400 },
    );
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ candles: [], source: "unconfigured" });
  }

  try {
    await ensureSchema();
    const pool = getPool();

    // Newest `limit` buckets, returned oldest-first for charting libraries.
    const result = await pool.query(
      `
        SELECT
          EXTRACT(EPOCH FROM bucket_start)::bigint AS time,
          open::float  AS open,
          high::float  AS high,
          low::float   AS low,
          close::float AS close,
          volume::float AS volume
        FROM (
          SELECT *
          FROM candles
          WHERE pair = $1 AND timeframe = $2
          ORDER BY bucket_start DESC
          LIMIT $3
        ) recent
        ORDER BY bucket_start ASC
      `,
      [pair, timeframe, limit],
    );

    return NextResponse.json({
      candles: result.rows.map((row) => ({
        time: Number(row.time),
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
      })),
      source: "apex",
    });
  } catch (err) {
    console.error("Failed to fetch candles:", err);
    return NextResponse.json(
      { error: (err as Error).message, candles: [] },
      { status: 500 },
    );
  }
}
