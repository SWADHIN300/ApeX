import { NextResponse } from "next/server";
import { getPool, ensureSchema, isDatabaseConfigured } from "@/lib/server/db";

// Fallback seed data if no trades exist yet in DB
const SEED_LEADERBOARD = [
  { rank: 1, address: "8X4g...9B1a", volume: 15420000, pnl: 452000, pnlPct: 145.2, trades: 1420 },
  { rank: 2, address: "2mNf...3K9p", volume: 12100000, pnl: 320500, pnlPct: 89.4, trades: 980 },
  { rank: 3, address: "9vBq...7R4e", volume: 8950000, pnl: 215000, pnlPct: 65.8, trades: 740 },
  { rank: 4, address: "4cJr...1T8x", volume: 6200000, pnl: 180200, pnlPct: 42.1, trades: 512 },
  { rank: 5, address: "7kWz...5M2n", volume: 5100000, pnl: 145000, pnlPct: 38.5, trades: 430 },
  { rank: 6, address: "3yHp...8L6v", volume: 4800000, pnl: 120000, pnlPct: 29.2, trades: 380 },
  { rank: 7, address: "5tDc...9F3q", volume: 4200000, pnl: 95000, pnlPct: 24.8, trades: 310 },
  { rank: 8, address: "1xSb...4G7m", volume: 3900000, pnl: 88000, pnlPct: 21.4, trades: 290 },
  { rank: 9, address: "6rVn...2J5c", volume: 3100000, pnl: 75000, pnlPct: 18.9, trades: 210 },
  { rank: 10, address: "8pLw...6H1k", volume: 2800000, pnl: 62000, pnlPct: 15.2, trades: 180 },
];

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ leaderboard: SEED_LEADERBOARD });
  }

  try {
    await ensureSchema();
    const pool = getPool();

    // Query aggregated stats from real persisted trades
    const result = await pool.query(`
      SELECT 
        user_address as address,
        SUM(size * price)::float as volume,
        SUM(pnl)::float as pnl,
        COUNT(*)::int as trades,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100 as win_rate
      FROM trades
      GROUP BY user_address
      ORDER BY pnl DESC
      LIMIT 100
    `);

    if (result.rows.length === 0) {
      return NextResponse.json({ leaderboard: SEED_LEADERBOARD });
    }

    const leaderboard = result.rows.map((row, idx) => {
      const shortAddress =
        row.address.length > 10
          ? `${row.address.slice(0, 4)}...${row.address.slice(-4)}`
          : row.address;

      const pnl = row.pnl || 0;
      const volume = row.volume || 0;
      const pnlPct = volume > 0 ? (pnl / (volume * 0.1)) * 100 : 0;

      return {
        rank: idx + 1,
        address: shortAddress,
        fullAddress: row.address,
        volume: Math.round(volume),
        pnl: Math.round(pnl),
        pnlPct: parseFloat(pnlPct.toFixed(1)),
        trades: row.trades,
      };
    });

    return NextResponse.json({ leaderboard });
  } catch (err: any) {
    console.error("Failed to query leaderboard:", err);
    return NextResponse.json({ leaderboard: SEED_LEADERBOARD });
  }
}
