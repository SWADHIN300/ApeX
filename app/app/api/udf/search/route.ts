import { NextResponse } from "next/server";
import { getPool, ensureSchema, isDatabaseConfigured } from "@/lib/server/db";

/**
 * UDF `/search` — symbol lookup for the Advanced Charts symbol picker.
 *
 * Only pairs ApeX has actually indexed fills for are returned, so the picker
 * never offers a symbol that would chart as empty.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") || "").toUpperCase();
  const limitParam = Number.parseInt(searchParams.get("limit") || "30", 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 30;

  if (!isDatabaseConfigured()) {
    return NextResponse.json([]);
  }

  try {
    await ensureSchema();
    const pool = getPool();

    const result = await pool.query(
      `
        SELECT DISTINCT pair
        FROM candles
        WHERE ($1 = '' OR UPPER(pair) LIKE '%' || $1 || '%')
        ORDER BY pair ASC
        LIMIT $2
      `,
      [query, limit],
    );

    return NextResponse.json(
      result.rows.map((row) => ({
        symbol: row.pair,
        full_name: `APEX:${row.pair}`,
        description: `${row.pair} · ApeX on-chain order book`,
        exchange: "APEX",
        ticker: row.pair,
        type: "crypto",
      })),
    );
  } catch (err) {
    console.error("UDF search failed:", err);
    return NextResponse.json([]);
  }
}
