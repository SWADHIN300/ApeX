import { clusterApiUrl } from "@solana/web3.js";
type LedgerNetwork = "devnet" | "mainnet-beta";

export function getSolanaRpcEndpoint(network: LedgerNetwork) {
  if (network === "devnet") {
    return (
      process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL ||
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
      clusterApiUrl("devnet")
    );
  }

  return (
    process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    clusterApiUrl("mainnet-beta")
  );
}

export function getServerSolanaRpcEndpoint(network: LedgerNetwork) {
  if (network === "devnet") {
    return (
      process.env.SOLANA_DEVNET_RPC_URL ||
      process.env.SOLANA_RPC_URL ||
      getSolanaRpcEndpoint(network)
    );
  }

  return (
    process.env.SOLANA_MAINNET_RPC_URL ||
    process.env.SOLANA_RPC_URL ||
    getSolanaRpcEndpoint(network)
  );
}


/** Retry short RPC rate limits while honoring the endpoint's Retry-After header. */
export const fetchWithRateLimitRetry: typeof fetch = async (input, init) => {
  const maxRetries = 3;

  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(input, init);
    if (response.status !== 429 || attempt >= maxRetries) return response;

    const retryAfter = response.headers.get("retry-after");
    const retryAfterSeconds = retryAfter === null ? Number.NaN : Number(retryAfter);
    const retryAfterDate = retryAfter === null ? Number.NaN : Date.parse(retryAfter);
    const delayMs = Number.isFinite(retryAfterSeconds)
      ? Math.min(Math.max(retryAfterSeconds * 1000, 0), 10_000)
      : Number.isFinite(retryAfterDate)
        ? Math.min(Math.max(retryAfterDate - Date.now(), 0), 10_000)
        : Math.min(500 * 2 ** attempt, 4_000);

    await response.body?.cancel().catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
};
