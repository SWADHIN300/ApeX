import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool, isDatabaseConfigured } from "@/lib/server/db";
import {
  clearPaperSessionCookie,
  createPaperChallenge,
  readPaperSession,
  setPaperSessionCookie,
  validateWalletAddress,
  verifyWalletSignature,
} from "@/lib/server/paperAuth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = readPaperSession(request);
  return NextResponse.json(
    { walletAddress: session?.walletAddress ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Server storage is not configured. Set DATABASE_URL to enable wallet-linked paper accounts." },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const walletAddress = validateWalletAddress(body.walletAddress);
    if (!walletAddress) {
      return NextResponse.json({ error: "A valid Solana wallet address is required." }, { status: 400 });
    }

    await ensureSchema();
    const pool = getPool();

    if (body.action === "challenge") {
      const challenge = createPaperChallenge(walletAddress);
      await pool.query(
        `INSERT INTO paper_auth_challenges (wallet_address, nonce, message, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (wallet_address) DO UPDATE
         SET nonce = EXCLUDED.nonce, message = EXCLUDED.message, expires_at = EXCLUDED.expires_at`,
        [walletAddress, challenge.nonce, challenge.message, challenge.expiresAt],
      );
      return NextResponse.json(
        { nonce: challenge.nonce, message: challenge.message },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (body.action === "verify") {
      if (typeof body.nonce !== "string" || typeof body.signature !== "string") {
        return NextResponse.json({ error: "A challenge nonce and wallet signature are required." }, { status: 400 });
      }

      const challengeResult = await pool.query<{ message: string }>(
        `DELETE FROM paper_auth_challenges
         WHERE wallet_address = $1 AND nonce = $2 AND expires_at > NOW()
         RETURNING message`,
        [walletAddress, body.nonce],
      );
      const message = challengeResult.rows[0]?.message;
      if (!message || !verifyWalletSignature(walletAddress, message, body.signature)) {
        return NextResponse.json({ error: "Wallet signature is invalid or the sign-in request expired. Try again." }, { status: 401 });
      }

      const response = NextResponse.json(
        { walletAddress },
        { headers: { "Cache-Control": "no-store" } },
      );
      setPaperSessionCookie(response, walletAddress);
      return response;
    }

    return NextResponse.json({ error: "Unsupported session action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create paper trading session.";
    console.error("Paper trading session error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearPaperSessionCookie(response);
  return response;
}
