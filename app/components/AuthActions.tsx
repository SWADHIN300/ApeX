"use client";

import { UserRound } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";

export default function AuthActions() {
  const { publicKey, connected } = useWallet();

  if (!connected || !publicKey) {
    return null;
  }

  const address = publicKey.toBase58();

  return (
    <div className="hidden lg:flex items-center gap-2">
      <div className="h-8 max-w-40 flex items-center gap-2 bg-bg-l2 b-thin px-3 text-text-main">
        <UserRound size={14} className="shrink-0 text-primary" />
        <span className="t-label-caps truncate">
          {address.slice(0, 4)}...{address.slice(-4)}
        </span>
      </div>
    </div>
  );
}
