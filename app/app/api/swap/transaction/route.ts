import { NextResponse } from "next/server";
import { requestJupiterSwap } from "@/lib/server/jupiter";
import type { SwapNetwork } from "@/lib/swapTokens";

export const runtime = "nodejs";

type SwapRequest = {
  network?: string;
  quoteResponse?: unknown;
  userPublicKey?: string;
};

function isNetwork(value: string | undefined): value is SwapNetwork {
  return value === "devnet" || value === "mainnet-beta";
}

export async function POST(request: Request) {
  const body = (await request.json()) as SwapRequest;

  if (!isNetwork(body.network)) {
    return NextResponse.json({ error: "Invalid network." }, { status: 400 });
  }

  if (!body.quoteResponse || !body.userPublicKey) {
    return NextResponse.json(
      { error: "Missing swap transaction parameters." },
      { status: 400 },
    );
  }

  try {
    const swap = await requestJupiterSwap({
      network: body.network,
      quoteResponse: body.quoteResponse,
      userPublicKey: body.userPublicKey,
    });

    return NextResponse.json(swap);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to build swap transaction.",
      },
      { status: 400 },
    );
  }
}
