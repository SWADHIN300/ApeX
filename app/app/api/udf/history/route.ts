import { NextResponse } from "next/server";
import { getPool, ensureSchema, isDatabaseConfigured } from "@/lib/server/db";
import { resolutionToTimeframe } from "@/lib/udf";

/**
 * UDF `/history` — OHLCV bars for TradingView's Advanced Charts.
 *
 * Responds with the column-oriented shape the Universal Data Feed expects:
 *   { s: "ok", t: [...], o: [...], h: [...], l: [...], c: [...], v: [...] }
 * and `{ s: "no_data" }` when a range holds no bars, which is how the library
 * knows to stop paging backwards.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawSymbol = searchParams.get("symbol") || "";
  const resolution = searchParams.get("resolution") || "15";
  const from = Number.parseInt(searchParams.get("from") || "0", 10);
  const to = Number.parseInt(searchParams.get("to") || "0", 10);

  const symbol = rawSymbol.includes(":") ? rawSymbol.split(":")[1] : rawSymbol;

  if (!symbol) {
    return NextResponse.json({ s: "error", errmsg: "symbol is required" }, { status: 400 });
  }

  const timeframe = resolutionToTimeframe(resolution);
  if (!timeframe) {
    return NextResponse.json({ s: "error", errmsg: `unsupported resolution ${resolution}` });
  }

  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= 0) {
    return NextResponse.json({ s: "error", errmsg: "from/to are required" }, { status: 400 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ s: "no_data" });
  }

  try {
    await ensureSchema();
    const pool = getPool();

    const result = await pool.query(
      `
        SELECT
          EXTRACT(EPOCH FROM bucket_start)::bigint AS time,
          open::float  AS open,
          high::float  AS high,
          low::float   AS low,
          close::float AS close,
          volume::float AS volume
        FROM candles
        WHERE pair = $1
          AND timeframe = $2
          AND bucket_start >= to_timestamp($3)
          AND bucket_start <= to_timestamp($4)
        ORDER BY bucket_start ASC
      `,
      [symbol, timeframe, Math.max(from, 0), to],
    );

    if (result.rows.length === 0) {
      // Report the oldest bar we do have so the library can jump straight there
      // instead of paging through empty ranges.
      const earliest = await pool.query(
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
      t: result.rows.map((r) => Number(r.time)),
      o: result.rows.map((r) => r.open),
      h: result.rows.map((r) => r.high),
      l: result.rows.map((r) => r.low),
      c: result.rows.map((r) => r.close),
      v: result.rows.map((r) => r.volume),
    });
  } catch (err) {
    console.error("UDF history query failed:", err);
    return NextResponse.json({ s: "error", errmsg: (err as Error).message }, { status: 500 });
  }
}
