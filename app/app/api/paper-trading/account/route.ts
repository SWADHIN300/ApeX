import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool, isDatabaseConfigured } from "@/lib/server/db";
import { readPaperSession } from "@/lib/server/paperAuth";

export const runtime = "nodejs";

type PaperAccount = {
  balance: number;
  positions: Record<string, unknown>[];
  trades: Record<string, unknown>[];
};

const INITIAL_BALANCE = 10_000;
const MAX_ACCOUNT_BYTES = 1_000_000;

function validateAccount(value: unknown): PaperAccount | null {
  if (!value || typeof value !== "object") return null;
  const account = value as Record<string, unknown>;
  const balance = account.balance;
  const positions = account.positions;
  const trades = account.trades;

  if (
    typeof balance !== "number" ||
    !Number.isFinite(balance) ||
    balance < 0 ||
    balance > 1_000_000_000 ||
    !Array.isArray(positions) ||
    positions.length > 100 ||
    !Array.isArray(trades) ||
    trades.length > 5_000
  ) {
    return null;
  }

  const validPosition = positions.every((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    return (
      typeof row.id === "string" && row.id.length <= 100 &&
      typeof row.pair === "string" && row.pair.length <= 40 &&
      (row.side === "Long" || row.side === "Short") &&
      typeof row.leverage === "number" && Number.isFinite(row.leverage) && row.leverage >= 1 && row.leverage <= 100 &&
      typeof row.size === "number" && Number.isFinite(row.size) && row.size > 0 &&
      [row.entryPrice, row.markPrice, row.liqPrice].every(
        (number) => typeof number === "number" && Number.isFinite(number) && number > 0,
      ) &&
      [row.pnl, row.roi].every((number) => typeof number === "number" && Number.isFinite(number))
    );
  });
  const validTrade = trades.every((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    return (
      typeof row.id === "string" && row.id.length <= 100 &&
      typeof row.time === "number" && Number.isFinite(row.time) &&
      typeof row.pair === "string" && row.pair.length <= 40 &&
      (row.side === "Long" || row.side === "Short") &&
      typeof row.size === "number" && Number.isFinite(row.size) && row.size > 0 &&
      typeof row.price === "number" && Number.isFinite(row.price) && row.price > 0 &&
      typeof row.fee === "number" && Number.isFinite(row.fee) && row.fee >= 0 &&
      typeof row.pnl === "number" && Number.isFinite(row.pnl) &&
      (row.status === "Open" || row.status === "Closed")
    );
  });

  if (!validPosition || !validTrade) return null;
  return { balance, positions, trades };
}

function getWallet(request: NextRequest) {
  return readPaperSession(request)?.walletAddress ?? null;
}

function unavailable() {
  return NextResponse.json(
    { error: "Server storage is not configured. Set DATABASE_URL to enable wallet-linked paper accounts." },
    { status: 503 },
  );
}

export async function GET(request: NextRequest) {
  const walletAddress = getWallet(request);
  if (!walletAddress) {
    return NextResponse.json({ error: "Connect and sign in with your wallet first." }, { status: 401 });
  }
  if (!isDatabaseConfigured()) return unavailable();

  try {
    await ensureSchema();
    const result = await getPool().query<{ account: PaperAccount }>(
      "SELECT account FROM paper_trading_accounts WHERE wallet_address = $1",
      [walletAddress],
    );
    return NextResponse.json(
      { account: result.rows[0]?.account ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Paper account load error:", error);
    return NextResponse.json({ error: "Unable to load the paper account." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const walletAddress = getWallet(request);
  if (!walletAddress) {
    return NextResponse.json({ error: "Connect and sign in with your wallet first." }, { status: 401 });
  }
  if (!isDatabaseConfigured()) return unavailable();

  try {
    await ensureSchema();
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_ACCOUNT_BYTES) {
      return NextResponse.json({ error: "Paper account data is too large." }, { status: 413 });
    }
    const body = rawBody ? JSON.parse(rawBody) as { account?: unknown } : {};
    const importedAccount = body.account === undefined ? null : validateAccount(body.account);
    if (body.account !== undefined && !importedAccount) {
      return NextResponse.json({ error: "Saved paper account data is invalid." }, { status: 400 });
    }
    const initialAccount = importedAccount ?? { balance: INITIAL_BALANCE, positions: [], trades: [] };
    const inserted = await getPool().query<{ account: PaperAccount }>(
      `INSERT INTO paper_trading_accounts (wallet_address, account)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (wallet_address) DO NOTHING
       RETURNING account`,
      [walletAddress, JSON.stringify(initialAccount)],
    );
    const result = inserted.rows[0]
      ? inserted
      : await getPool().query<{ account: PaperAccount }>(
        "SELECT account FROM paper_trading_accounts WHERE wallet_address = $1",
        [walletAddress],
      );
    return NextResponse.json(
      { account: result.rows[0].account },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Paper account claim error:", error);
    return NextResponse.json({ error: "Unable to start the paper account." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const walletAddress = getWallet(request);
  if (!walletAddress) {
    return NextResponse.json({ error: "Connect and sign in with your wallet first." }, { status: 401 });
  }
  if (!isDatabaseConfigured()) return unavailable();

  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_ACCOUNT_BYTES) {
      return NextResponse.json({ error: "Paper account data is too large." }, { status: 413 });
    }
    const account = validateAccount(JSON.parse(rawBody));
    if (!account) {
      return NextResponse.json({ error: "Paper account data is invalid." }, { status: 400 });
    }

    await ensureSchema();
    const result = await getPool().query(
      `UPDATE paper_trading_accounts
       SET account = $2::jsonb, updated_at = NOW()
       WHERE wallet_address = $1`,
      [walletAddress, JSON.stringify(account)],
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Claim a virtual practice balance before saving trades." }, { status: 404 });
    }
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Paper account save error:", error);
    return NextResponse.json({ error: "Unable to save the paper account." }, { status: 500 });
  }
}
