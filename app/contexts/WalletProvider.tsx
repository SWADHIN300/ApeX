"use client";

import React, { createContext, useContext, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { fetchWithRateLimitRetry, getSolanaRpcEndpoint } from "@/lib/solanaRpc";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";

import "@solana/wallet-adapter-react-ui/styles.css";

type NetworkType = "devnet" | "mainnet-beta";

interface NetworkContextState {
  network: NetworkType;
  setNetwork: (network: NetworkType) => void;
}

const NetworkContext = createContext<NetworkContextState>({
  network: "devnet",
  setNetwork: () => {},
});

export function useNetwork() {
  return useContext(NetworkContext);
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [network, setNetworkState] = useLocalStorageState<NetworkType>(
    "apex-network",
    "devnet",
    (saved) => saved === "mainnet-beta" ? "mainnet-beta" : "devnet",
    (value) => value
  );

  const setNetwork = (n: NetworkType) => {
    setNetworkState(n);
  };

  const endpoint = useMemo(() => getSolanaRpcEndpoint(network), [network]);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  const handleError = (error: Error) => {
    if (error.name === "WalletNotReadyError") {
      // Show an in-app error instead of navigating away
      alert("Wallet not installed! Please install a Solana wallet (e.g., Phantom or Solflare) to connect.");
    } else {
      console.error(error);
    }
  };

  return (
    <NetworkContext.Provider value={{ network, setNetwork }}>
      <ConnectionProvider
        endpoint={endpoint}
        config={{ fetch: fetchWithRateLimitRetry, disableRetryOnRateLimit: true }}
      >
        <SolanaWalletProvider wallets={wallets} autoConnect onError={handleError}>
          <WalletModalProvider>{children}</WalletModalProvider>
        </SolanaWalletProvider>
      </ConnectionProvider>
    </NetworkContext.Provider>
  );
}
