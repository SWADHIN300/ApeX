import { NextResponse } from "next/server";
import { requestJupiterSwap } from "@/lib/server/jupiter";

export const runtime = "nodejs";

type SwapRequest = {
  quoteResponse?: unknown;
  userPublicKey?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as SwapRequest;

  if (!body.quoteResponse || !body.userPublicKey) {
    return NextResponse.json(
      { error: "Missing swap transaction parameters." },
      { status: 400 },
    );
  }

  try {
    const swap = await requestJupiterSwap({
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
