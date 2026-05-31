import { NextResponse } from "next/server";
import { getLedgerBalance } from "@/lib/server/ledgerStore";
import type { LedgerNetwork } from "@/lib/ledgerClient";

export const runtime = "nodejs";

function isNetwork(value: string | null): value is LedgerNetwork {
  return value === "devnet" || value === "mainnet-beta";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");
  const network = searchParams.get("network");

  if (!wallet) {
    return NextResponse.json({ error: "Missing wallet." }, { status: 400 });
  }

  if (!isNetwork(network)) {
    return NextResponse.json({ error: "Invalid network." }, { status: 400 });
  }

  const balance = await getLedgerBalance({ wallet, network });

  return NextResponse.json(balance);
}
