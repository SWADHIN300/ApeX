import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { requestJupiterSwap, requestRaydiumSwap, type SwapNetwork } from "@/lib/server/jupiter";

export const runtime = "nodejs";

type SwapRequest = {
  network?: string;
  provider?: string;
  quoteResponse?: unknown;
  userPublicKey?: string;
};

export async function POST(request: Request) {
  let body: SwapRequest | null;
  try {
    body = (await request.json()) as SwapRequest | null;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  let validUserPublicKey = false;
  try {
    validUserPublicKey = !!body && !!body.userPublicKey &&
      new PublicKey(body.userPublicKey).toBase58() === body.userPublicKey;
  } catch {
    validUserPublicKey = false;
  }
  if (!body || !body.quoteResponse || typeof body.quoteResponse !== "object" || !validUserPublicKey ||
      (body.network !== "devnet" && body.network !== "mainnet-beta") ||
      (body.network === "devnet" && body.provider !== "raydium") ||
      (body.network === "mainnet-beta" && body.provider !== "jupiter")) {
    return NextResponse.json(
      { error: "Missing swap transaction parameters." },
      { status: 400 },
    );
  }

  try {
    if (body.network === "devnet") {
      const quote = body.quoteResponse as {
        providerQuote?: { data?: { inputMint?: string; outputMint?: string } };
      };
      const inputMint = quote.providerQuote?.data?.inputMint;
      const outputMint = quote.providerQuote?.data?.outputMint;
      if (!quote.providerQuote || typeof quote.providerQuote !== "object" ||
          !inputMint || !outputMint) {
        return NextResponse.json({ error: "Invalid Raydium quote." }, { status: 400 });
      }
      const swap = await requestRaydiumSwap({
        network: body.network as SwapNetwork,
        quoteResponse: quote.providerQuote,
        userPublicKey: body.userPublicKey!,
        inputMint,
        outputMint,
      });
      const transactions = swap.data
        .map((item: { transaction?: string }) => item.transaction)
        .filter((transaction: unknown): transaction is string => typeof transaction === "string");
      if (transactions.length === 0) throw new Error("Raydium returned no swap transactions.");
      return NextResponse.json({ provider: "raydium", transactions });
    }

    const swap = await requestJupiterSwap({
      quoteResponse: body.quoteResponse,
      userPublicKey: body.userPublicKey!,
    });

    return NextResponse.json({
      provider: "jupiter",
      transactions: [swap.swapTransaction],
      lastValidBlockHeight: swap.lastValidBlockHeight,
    });
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
