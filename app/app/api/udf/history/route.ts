import { NextResponse } from "next/server";
import { getPool, ensureSchema, isDatabaseConfigured } from "@/lib/server/db";
import { resolutionToTimeframe } from "@/lib/udf";

/**
 * UDF `/history` - bounded OHLCV history for TradingView's Advanced Charts.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawSymbol = searchParams.get("symbol") || "";
  const resolution = searchParams.get("resolution") || "15";
  const from = Number.parseInt(searchParams.get("from") || "0", 10);
  const to = Number.parseInt(searchParams.get("to") || "0", 10);
  const countBackParam = Number.parseInt(searchParams.get("countBack") || "2000", 10);
  const countBack = Number.isFinite(countBackParam)
    ? Math.min(Math.max(countBackParam, 1), 5000)
    : 2000;
  const symbol = rawSymbol.includes(":") ? rawSymbol.split(":").pop() || "" : rawSymbol;

  if (!symbol) {
    return NextResponse.json({ s: "error", errmsg: "symbol is required" }, { status: 400 });
  }

  const timeframe = resolutionToTimeframe(resolution);
  if (!timeframe) {
    return NextResponse.json(
      { s: "error", errmsg: `unsupported resolution ${resolution}` },
      { status: 400 },
    );
  }

  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to <= 0 || from > to) {
    return NextResponse.json({ s: "error", errmsg: "valid from/to seconds are required" }, { status: 400 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ s: "no_data" });
  }

  try {
    await ensureSchema();
    const result = await getPool().query(
      `
        SELECT
          EXTRACT(EPOCH FROM bucket_start)::bigint AS time,
          open::float AS open,
          high::float AS high,
          low::float AS low,
          close::float AS close,
          volume::float AS volume
        FROM (
          SELECT bucket_start, open, high, low, close, volume
          FROM candles
          WHERE pair = $1
            AND timeframe = $2
            AND bucket_start >= to_timestamp($3)
            AND bucket_start <= to_timestamp($4)
          ORDER BY bucket_start DESC
          LIMIT $5
        ) recent
        ORDER BY bucket_start ASC
      `,
      [symbol, timeframe, from, to, countBack],
    );

    if (result.rows.length === 0) {
      const earliest = await getPool().query(
        `SELECT EXTRACT(EPOCH FROM MIN(bucket_start))::bigint AS t
         FROM candles WHERE pair = $1 AND timeframe = $2`,
        [symbol, timeframe],
      );
      const nextTime = earliest.rows[0]?.t;
      return NextResponse.json(
        nextTime ? { s: "no_data", nextTime: Number(nextTime) } : { s: "no_data" },
      );
    }

    return NextResponse.json({
      s: "ok",
      t: result.rows.map((row) => Number(row.time)),
      o: result.rows.map((row) => row.open),
      h: result.rows.map((row) => row.high),
      l: result.rows.map((row) => row.low),
      c: result.rows.map((row) => row.close),
      v: result.rows.map((row) => row.volume),
    });
  } catch (error) {
    console.error("UDF history query failed:", error);
    return NextResponse.json({ s: "error", errmsg: "Unable to fetch candle history." }, { status: 500 });
  }
}
