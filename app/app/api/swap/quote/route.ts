import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { requestJupiterQuote, requestRaydiumQuote, type SwapNetwork } from "@/lib/server/jupiter";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const network = searchParams.get("network") ?? "mainnet-beta";
  const inputMint = searchParams.get("inputMint");
  const outputMint = searchParams.get("outputMint");
  const amount = searchParams.get("amount");
  const rawSlippageBps = searchParams.get("slippageBps") ?? "50";
  const slippageBps = Number(rawSlippageBps);

  const validAmount = !!amount && /^\d{1,20}$/.test(amount) &&
    !/^0+$/.test(amount) &&
    (amount.length < 20 || amount <= "18446744073709551615");
  let validMints = false;
  try {
    validMints = !!inputMint && !!outputMint && new PublicKey(inputMint).toBase58() === inputMint &&
      new PublicKey(outputMint).toBase58() === outputMint;
  } catch {
    validMints = false;
  }

  if ((network !== "devnet" && network !== "mainnet-beta") || !validMints || !validAmount ||
      !/^\d+$/.test(rawSlippageBps) || !Number.isSafeInteger(slippageBps) || slippageBps < 1 || slippageBps > 5000) {
    return NextResponse.json(
      { error: "Invalid swap quote parameters." },
      { status: 400 },
    );
  }

  try {
    const args = {
      inputMint: inputMint!,
      outputMint: outputMint!,
      amount: amount!,
      slippageBps,
    };
    if (network === "devnet") {
      const providerQuote = await requestRaydiumQuote({ network: network as SwapNetwork, ...args });
      const data = providerQuote.data;
      return NextResponse.json({
        provider: "raydium",
        inputMint: data.inputMint,
        inAmount: data.inputAmount,
        outputMint: data.outputMint,
        outAmount: data.outputAmount,
        otherAmountThreshold: data.otherAmountThreshold,
        priceImpactPct: String(data.priceImpactPct ?? 0),
        routePlan: (data.routePlan ?? []).map((route: { poolId?: string }) => ({
          swapInfo: { label: route.poolId ?? "Raydium pool" },
        })),
        providerQuote,
      });
    }

    const quote = await requestJupiterQuote(args);

    return NextResponse.json({ ...quote, provider: "jupiter" });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to get quote.",
      },
      { status: 400 },
    );
  }
}
