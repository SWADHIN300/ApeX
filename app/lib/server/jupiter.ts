const DEFAULT_JUPITER_SWAP_API = "https://api.jup.ag/swap/v1";
const RAYDIUM_SWAP_APIS = {
  devnet: "https://transaction-v1-devnet.raydium.io",
  "mainnet-beta": "https://transaction-v1.raydium.io",
} as const;

export type SwapNetwork = keyof typeof RAYDIUM_SWAP_APIS;

function assertSwapNetwork(network: string): asserts network is SwapNetwork {
  if (network !== "devnet" && network !== "mainnet-beta") {
    throw new Error("Unsupported Solana network.");
  }
}

function getSwapApiBase() {
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

export function getNetworkSwapSupport() {
  const apiBase = getSwapApiBase();

  return {
    apiBase,
    supported: apiBase.length > 0,
    reason: "",
  };
}

export async function requestJupiterQuote({
  inputMint,
  outputMint,
  amount,
  slippageBps,
}: {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps: number;
}) {
  const support = getNetworkSwapSupport();

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

export async function requestRaydiumQuote({
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
  assertSwapNetwork(network);
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps: String(slippageBps),
    txVersion: "V0",
  });
  const response = await fetch(
    `${RAYDIUM_SWAP_APIS[network]}/compute/swap-base-in?${params.toString()}`,
    { cache: "no-store" },
  );
  const body = await response.json();
  if (!response.ok || body.success !== true || !body.data) {
    throw new Error(body.msg ?? "No Raydium route is available for this token pair on this network.");
  }
  return body;
}

export async function requestRaydiumSwap({
  network,
  quoteResponse,
  userPublicKey,
  inputMint,
  outputMint,
}: {
  network: SwapNetwork;
  quoteResponse: unknown;
  userPublicKey: string;
  inputMint: string;
  outputMint: string;
}) {
  assertSwapNetwork(network);
  const response = await fetch(`${RAYDIUM_SWAP_APIS[network]}/transaction/swap-base-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      computeUnitPriceMicroLamports: "50000",
      swapResponse: quoteResponse,
      txVersion: "V0",
      wallet: userPublicKey,
      wrapSol: inputMint === "So11111111111111111111111111111111111111112",
      unwrapSol: outputMint === "So11111111111111111111111111111111111111112",
    }),
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok || body.success !== true || !Array.isArray(body.data)) {
    throw new Error(body.msg ?? "Unable to build the Raydium swap transaction.");
  }
  return body;
}

export async function requestJupiterSwap({
  quoteResponse,
  userPublicKey,
}: {
  quoteResponse: unknown;
  userPublicKey: string;
}) {
  const support = getNetworkSwapSupport();

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
