import { NextResponse } from "next/server";
import { getPool, ensureSchema, isDatabaseConfigured } from "@/lib/server/db";

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ trades: [] });
  }

  const { searchParams } = new URL(request.url);
  const userAddress = searchParams.get("address");
  const pair = searchParams.get("pair");
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  try {
    await ensureSchema();
    const pool = getPool();

    let query = `
      SELECT 
        id, 
        user_address as "userAddress", 
        pair, 
        side, 
        size::float, 
        price::float, 
        fee::float, 
        pnl::float, 
        status, 
        tx_signature as "txSignature", 
        EXTRACT(EPOCH FROM timestamp)::int as time
      FROM trades
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (userAddress) {
      params.push(userAddress);
      conditions.push(`user_address = $${params.length}`);
    }

    if (pair) {
      params.push(pair);
      conditions.push(`pair = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);
    return NextResponse.json({ trades: result.rows });
  } catch (err: any) {
    console.error("Failed to fetch trades from postgres:", err);
    return NextResponse.json({ error: err.message, trades: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { message: "Database not configured; trade stored locally." },
      { status: 200 }
    );
  }

  try {
    await ensureSchema();
    const pool = getPool();
    const body = await request.json();

    const {
      id,
      userAddress,
      pair,
      side,
      size,
      price,
      fee = 0,
      pnl = 0,
      status = "Closed",
      txSignature = null,
      timestamp = new Date().toISOString(),
    } = body;

    if (!id || !userAddress || !pair || !side || size === undefined || price === undefined) {
      return NextResponse.json({ error: "Missing required trade fields" }, { status: 400 });
    }

    await pool.query(
      `
        INSERT INTO trades (id, user_address, pair, side, size, price, fee, pnl, status, tx_signature, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          pnl = EXCLUDED.pnl,
          fee = EXCLUDED.fee,
          status = EXCLUDED.status,
          tx_signature = EXCLUDED.tx_signature
      `,
      [id, userAddress, pair, side, size, price, fee, pnl, status, txSignature, timestamp]
    );

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("Failed to save trade to postgres:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
