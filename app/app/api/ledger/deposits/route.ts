import { NextResponse } from "next/server";
import { addDeposit, getLedgerBalance } from "@/lib/server/ledgerStore";
import { verifyDepositTransaction } from "@/lib/server/verifyDeposit";
import type { LedgerAsset, LedgerNetwork } from "@/lib/ledgerClient";

export const runtime = "nodejs";

type DepositRequest = {
  signature?: string;
  wallet?: string;
  asset?: string;
  network?: string;
};

function isAsset(value: string | undefined): value is LedgerAsset {
  return value === "SOL" || value === "USDC";
}

function isNetwork(value: string | undefined): value is LedgerNetwork {
  return value === "devnet" || value === "mainnet-beta";
}

export async function POST(request: Request) {
  const body = (await request.json()) as DepositRequest;

  if (!body.signature || !body.wallet) {
    return NextResponse.json(
      { error: "Missing signature or wallet." },
      { status: 400 },
    );
  }

  if (!isAsset(body.asset)) {
    return NextResponse.json({ error: "Invalid asset." }, { status: 400 });
  }

  if (!isNetwork(body.network)) {
    return NextResponse.json({ error: "Invalid network." }, { status: 400 });
  }

  try {
    const verified = await verifyDepositTransaction({
      signature: body.signature,
      wallet: body.wallet,
      asset: body.asset,
      network: body.network,
    });
    const deposit = await addDeposit({
      signature: body.signature,
      wallet: body.wallet,
      asset: body.asset,
      amount: verified.amount,
      network: body.network,
      creditedAt: new Date().toISOString(),
    });
    const balance = await getLedgerBalance({
      wallet: body.wallet,
      network: body.network,
    });

    return NextResponse.json({ deposit, balance });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to verify deposit.",
      },
      { status: 400 },
    );
  }
}
