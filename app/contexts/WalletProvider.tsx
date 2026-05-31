"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { getSolanaRpcEndpoint } from "@/lib/solanaRpc";

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
  const [network, setNetworkState] = useState<NetworkType>("devnet");

  useEffect(() => {
    const saved = localStorage.getItem("apex-network");
    if (saved === "devnet" || saved === "mainnet-beta") {
      setNetworkState(saved);
    }
  }, []);

  const setNetwork = (n: NetworkType) => {
    setNetworkState(n);
    localStorage.setItem("apex-network", n);
  };

  const endpoint = useMemo(() => getSolanaRpcEndpoint(network), [network]);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <NetworkContext.Provider value={{ network, setNetwork }}>
      <ConnectionProvider endpoint={endpoint}>
        <SolanaWalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>{children}</WalletModalProvider>
        </SolanaWalletProvider>
      </ConnectionProvider>
    </NetworkContext.Provider>
  );
}
