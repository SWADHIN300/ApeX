import { NextResponse } from "next/server";
import { getPool, ensureSchema, isDatabaseConfigured } from "@/lib/server/db";

/** Read-only legacy trade history. Public writes were removed because submitted
 * client data was unauthenticated and could forge leaderboard statistics. */
export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ trades: [] });
  }

  const { searchParams } = new URL(request.url);
  const userAddress = searchParams.get("address");
  const pair = searchParams.get("pair");
  const parsedLimit = Number.parseInt(searchParams.get("limit") || "50", 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 50;

  try {
    await ensureSchema();
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (userAddress) {
      params.push(userAddress);
      conditions.push(`user_address = $${params.length}`);
    }
    if (pair) {
      params.push(pair);
      conditions.push(`pair = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit);
    const result = await getPool().query(
      `
        SELECT
          id,
          user_address AS "userAddress",
          pair,
          side,
          size::float,
          price::float,
          fee::float,
          pnl::float,
          status,
          tx_signature AS "txSignature",
          EXTRACT(EPOCH FROM timestamp)::int AS time
        FROM trades
        ${where}
        ORDER BY timestamp DESC
        LIMIT $${params.length}
      `,
      params,
    );

    return NextResponse.json({ trades: result.rows });
  } catch (error) {
    console.error("Failed to fetch trades from postgres:", error);
    return NextResponse.json({ error: "Unable to fetch trade history.", trades: [] }, { status: 500 });
  }
}
