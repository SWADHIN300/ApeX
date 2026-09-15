import { NextResponse } from "next/server";
import { getPool, ensureSchema, isDatabaseConfigured } from "@/lib/server/db";

/**
 * Recent fills matched by the on-chain order book — the "time and sales" tape
 * for ApeX's own market.
 *
 * Read-only by design. The indexer service writes fills straight to Postgres
 * with its own credentials; exposing a public write endpoint here would let
 * anyone forge the protocol's trade history and chart data.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pair = searchParams.get("pair");
  const limitParam = Number.parseInt(searchParams.get("limit") || "50", 10);
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 500)
    : 50;

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ fills: [] });
  }

  try {
    await ensureSchema();
    const pool = getPool();

    const params: (string | number)[] = [];
    let query = `
      SELECT
        id,
        signature,
        pair,
        maker,
        taker,
        price::float AS price,
        size::float  AS size,
        EXTRACT(EPOCH FROM timestamp)::bigint AS time
      FROM fills
    `;

    if (pair) {
      params.push(pair);
      query += ` WHERE pair = $${params.length}`;
    }

    params.push(limit);
    query += ` ORDER BY timestamp DESC LIMIT $${params.length}`;

    const result = await pool.query(query, params);

    return NextResponse.json({
      fills: result.rows.map((row) => ({
        id: row.id,
        signature: row.signature,
        pair: row.pair,
        maker: row.maker,
        taker: row.taker,
        price: row.price,
        size: row.size,
        time: Number(row.time),
      })),
    });
  } catch (err) {
    console.error("Failed to fetch fills:", err);
    return NextResponse.json(
      { error: (err as Error).message, fills: [] },
      { status: 500 },
    );
  }
}
