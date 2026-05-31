import type { SwapNetwork } from "@/lib/swapTokens";

const DEFAULT_JUPITER_SWAP_API = "https://api.jup.ag/swap/v1";

function getSwapApiBase(network: SwapNetwork) {
  if (network === "devnet") {
    return process.env.JUPITER_DEVNET_SWAP_API_URL ?? "";
  }

  return process.env.JUPITER_SWAP_API_URL ?? DEFAULT_JUPITER_SWAP_API;
}

function getHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (process.env.JUPITER_API_KEY) {
    headers["x-api-key"] = process.env.JUPITER_API_KEY;
  }

  return headers;
}

export function getNetworkSwapSupport(network: SwapNetwork) {
  const apiBase = getSwapApiBase(network);

  return {
    apiBase,
    supported: apiBase.length > 0,
    reason:
      network === "devnet" && !apiBase
        ? "Devnet swaps need JUPITER_DEVNET_SWAP_API_URL or another devnet swap provider. Jupiter public liquidity is mainnet-oriented."
        : "",
  };
}

export async function requestJupiterQuote({
  network,
  inputMint,
  outputMint,
  amount,
  slippageBps,
}: {
  network: SwapNetwork;
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps: number;
}) {
  const support = getNetworkSwapSupport(network);

  if (!support.supported) {
    throw new Error(support.reason || "Swap provider is not configured.");
  }

  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps: String(slippageBps),
    restrictIntermediateTokens: "true",
    instructionVersion: "V2",
  });
  const response = await fetch(`${support.apiBase}/quote?${params.toString()}`, {
    headers: getHeaders(),
    cache: "no-store",
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error ?? "Unable to get swap quote.");
  }

  return body;
}

export async function requestJupiterSwap({
  network,
  quoteResponse,
  userPublicKey,
}: {
  network: SwapNetwork;
  quoteResponse: unknown;
  userPublicKey: string;
}) {
  const support = getNetworkSwapSupport(network);

  if (!support.supported) {
    throw new Error(support.reason || "Swap provider is not configured.");
  }

  const response = await fetch(`${support.apiBase}/swap`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      quoteResponse,
      userPublicKey,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          maxLamports: 1_000_000,
          priorityLevel: "high",
        },
      },
    }),
    cache: "no-store",
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error ?? "Unable to build swap transaction.");
  }

  return body;
}
