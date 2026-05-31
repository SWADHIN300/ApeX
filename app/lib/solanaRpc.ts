import { clusterApiUrl } from "@solana/web3.js";
import type { LedgerNetwork } from "./ledgerClient";

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
