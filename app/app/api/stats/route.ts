import { NextResponse } from "next/server";
import { getPool, ensureSchema, isDatabaseConfigured } from "@/lib/server/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userAddress = searchParams.get("address");

  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      totalVolume: 0,
      totalTrades: 0,
      totalFees: 0,
      netPnl: 0,
      winRate: 0,
      firstTradeDate: null,
    });
  }

  try {
    await ensureSchema();
    const pool = getPool();

    let query = `
      SELECT 
        COALESCE(SUM(size * price), 0)::float as total_volume,
        COUNT(*)::int as total_trades,
        COALESCE(SUM(fee), 0)::float as total_fees,
        COALESCE(SUM(pnl), 0)::float as net_pnl,
        COALESCE(
          (SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0)) * 100, 
          0
        )::float as win_rate,
        MIN(timestamp) as first_trade_date
      FROM trades
    `;
    const params: any[] = [];

    if (userAddress) {
      query += ` WHERE user_address = $1`;
      params.push(userAddress);
    }

    const result = await pool.query(query, params);
    const row = result.rows[0] || {};

    return NextResponse.json({
      totalVolume: row.total_volume || 0,
      totalTrades: row.total_trades || 0,
      totalFees: row.total_fees || 0,
      netPnl: row.net_pnl || 0,
      winRate: parseFloat((row.win_rate || 0).toFixed(1)),
      firstTradeDate: row.first_trade_date || null,
    });
  } catch (err: any) {
    console.error("Failed to query stats:", err);
    return NextResponse.json({
      totalVolume: 0,
      totalTrades: 0,
      totalFees: 0,
      netPnl: 0,
      winRate: 0,
      firstTradeDate: null,
    });
  }
}
