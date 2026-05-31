import { NextResponse } from "next/server";
import { requestJupiterQuote } from "@/lib/server/jupiter";
import type { SwapNetwork } from "@/lib/swapTokens";

export const runtime = "nodejs";

function isNetwork(value: string | null): value is SwapNetwork {
  return value === "devnet" || value === "mainnet-beta";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const network = searchParams.get("network");
  const inputMint = searchParams.get("inputMint");
  const outputMint = searchParams.get("outputMint");
  const amount = searchParams.get("amount");
  const slippageBps = Number(searchParams.get("slippageBps") ?? 50);

  if (!isNetwork(network)) {
    return NextResponse.json({ error: "Invalid network." }, { status: 400 });
  }

  if (!inputMint || !outputMint || !amount || Number(amount) <= 0) {
    return NextResponse.json(
      { error: "Missing swap quote parameters." },
      { status: 400 },
    );
  }

  try {
    const quote = await requestJupiterQuote({
      network,
      inputMint,
      outputMint,
      amount,
      slippageBps,
    });

    return NextResponse.json(quote);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to get quote.",
      },
      { status: 400 },
    );
  }
}
