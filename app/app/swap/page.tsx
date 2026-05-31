"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, ExternalLink, RefreshCw } from "lucide-react";
import { VersionedTransaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import AppShell from "@/components/layout/AppShell";
import { useNetwork } from "@/contexts/WalletProvider";
import {
  fromAtomicAmount,
  getSwapTokens,
  toAtomicAmount,
  type SwapToken,
} from "@/lib/swapTokens";

type QuoteResponse = {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold?: string;
  priceImpactPct?: string;
  routePlan?: { swapInfo?: { label?: string }; percent?: number }[];
};

type SwapResponse = {
  swapTransaction: string;
  lastValidBlockHeight?: number;
};

export default function SwapPage() {
  const { network } = useNetwork();
  const { connection } = useConnection();
  const { publicKey, connected, sendTransaction } = useWallet();
  const tokens = useMemo(() => getSwapTokens(network), [network]);
  const [inputToken, setInputToken] = useState<SwapToken | null>(null);
  const [outputToken, setOutputToken] = useState<SwapToken | null>(null);
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(50);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");
  const [isQuoting, setIsQuoting] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);

  useEffect(() => {
    setInputToken(tokens[0] ?? null);
    setOutputToken(tokens[1] ?? tokens[0] ?? null);
    setQuote(null);
    setSignature("");
    setError("");
  }, [tokens]);

  const explorerCluster = network === "devnet" ? "?cluster=devnet" : "";
  const atomicAmount =
    inputToken && amount ? toAtomicAmount(amount, inputToken.decimals) : "0";
  const outputAmount =
    quote && outputToken
      ? fromAtomicAmount(quote.outAmount, outputToken.decimals)
      : "0";
  const minReceived =
    quote?.otherAmountThreshold && outputToken
      ? fromAtomicAmount(quote.otherAmountThreshold, outputToken.decimals)
      : "0";
  const routeLabel =
    quote?.routePlan
      ?.map((route) => route.swapInfo?.label)
      .filter(Boolean)
      .join(" + ") || "Best available route";
  const canQuote =
    inputToken &&
    outputToken &&
    inputToken.mint !== outputToken.mint &&
    Number(atomicAmount) > 0;
  const canSwap = connected && publicKey && quote && !isSwapping;

  const getQuote = async () => {
    if (!canQuote || !inputToken || !outputToken) return;

    setIsQuoting(true);
    setError("");
    setSignature("");

    try {
      const params = new URLSearchParams({
        network,
        inputMint: inputToken.mint,
        outputMint: outputToken.mint,
        amount: atomicAmount,
        slippageBps: String(slippageBps),
      });
      const response = await fetch(`/api/swap/quote?${params.toString()}`);
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Unable to get quote.");
      }

      setQuote(body as QuoteResponse);
    } catch (err) {
      setQuote(null);
      setError(err instanceof Error ? err.message : "Unable to get quote.");
    } finally {
      setIsQuoting(false);
    }
  };

  const executeSwap = async () => {
    if (!quote || !publicKey) return;

    setIsSwapping(true);
    setError("");
    setSignature("");

    try {
      const response = await fetch("/api/swap/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network,
          quoteResponse: quote,
          userPublicKey: publicKey.toBase58(),
        }),
      });
      const body = (await response.json()) as SwapResponse & { error?: string };

      if (!response.ok || !body.swapTransaction) {
        throw new Error(body.error ?? "Unable to build swap transaction.");
      }

      const transaction = VersionedTransaction.deserialize(
        Buffer.from(body.swapTransaction, "base64"),
      );
      const txSignature = await sendTransaction(transaction, connection, {
        skipPreflight: false,
      });

      await connection.confirmTransaction(txSignature, "confirmed");
      setSignature(txSignature);
      setQuote(null);
      setAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Swap failed.");
    } finally {
      setIsSwapping(false);
    }
  };

  const flipTokens = () => {
    setInputToken(outputToken);
    setOutputToken(inputToken);
    setQuote(null);
    setSignature("");
  };

  return (
    <AppShell>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="font-ui text-headline-md text-on-surface">Swap</h1>
          <p className="font-ui text-body-sm text-on-surface-variant mt-0.5">
            Swap Solana tokens with your connected wallet on {network.replace("-beta", "")}.
          </p>
        </div>

        <div className="bg-surface border border-outline-variant">
          <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
            <div>
              <h2 className="font-ui text-headline-md text-on-surface">
                Token Swap
              </h2>
              <p className="font-ui text-body-sm text-on-surface-variant mt-1">
                Quotes are routed through the configured swap provider.
              </p>
            </div>
            <span className="t-label-caps text-on-surface-variant">
              {network}
            </span>
          </div>

          <div className="p-6 space-y-5">
            {network === "devnet" && tokens.length < 2 && (
              <div className="border border-outline-variant bg-surface-container p-4 font-ui text-body-sm text-on-surface-variant">
                Configure NEXT_PUBLIC_APEX_DEVNET_USDC_MINT and JUPITER_DEVNET_SWAP_API_URL to enable devnet swaps.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-[1fr_9rem] gap-4">
              <div>
                <label className="text-label-caps font-ui text-on-surface-variant block mb-2">
                  You Pay
                </label>
                <input
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setQuote(null);
                  }}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="w-full bg-bg-l2 border border-t-border p-3 font-ui text-body-sm text-text-main focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="text-label-caps font-ui text-on-surface-variant block mb-2">
                  Asset
                </label>
                <select
                  value={inputToken?.mint ?? ""}
                  onChange={(event) => {
                    setInputToken(
                      tokens.find((token) => token.mint === event.target.value) ??
                        null,
                    );
                    setQuote(null);
                  }}
                  className="w-full bg-bg-l2 border border-t-border p-3 font-ui text-body-sm text-text-main focus:border-primary outline-none"
                >
                  {tokens.map((token) => (
                    <option
                      key={token.mint}
                      value={token.mint}
                      className="bg-bg-l2 text-text-main"
                    >
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={flipTokens}
                className="h-10 w-10 flex items-center justify-center border border-outline-variant bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-colors"
                type="button"
                aria-label="Flip swap tokens"
                title="Flip swap tokens"
              >
                <ArrowDownUp size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_9rem] gap-4">
              <div>
                <label className="text-label-caps font-ui text-on-surface-variant block mb-2">
                  You Receive
                </label>
                <div className="w-full bg-bg-l2 border border-t-border p-3 font-ui text-body-sm text-text-main min-h-[50px]">
                  {Number(outputAmount) > 0 ? outputAmount : "Quote required"}
                </div>
              </div>
              <div>
                <label className="text-label-caps font-ui text-on-surface-variant block mb-2">
                  Asset
                </label>
                <select
                  value={outputToken?.mint ?? ""}
                  onChange={(event) => {
                    setOutputToken(
                      tokens.find((token) => token.mint === event.target.value) ??
                        null,
                    );
                    setQuote(null);
                  }}
                  className="w-full bg-bg-l2 border border-t-border p-3 font-ui text-body-sm text-text-main focus:border-primary outline-none"
                >
                  {tokens.map((token) => (
                    <option
                      key={token.mint}
                      value={token.mint}
                      className="bg-bg-l2 text-text-main"
                    >
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-label-caps font-ui text-on-surface-variant block mb-2">
                Slippage
              </label>
              <div className="flex gap-2">
                {[25, 50, 100].map((value) => (
                  <button
                    key={value}
                    onClick={() => {
                      setSlippageBps(value);
                      setQuote(null);
                    }}
                    className={`px-4 py-2 border font-ui text-label-caps transition-colors ${
                      slippageBps === value
                        ? "bg-primary-container border-primary text-on-primary-container"
                        : "border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-high"
                    }`}
                    type="button"
                  >
                    {(value / 100).toFixed(2)}%
                  </button>
                ))}
              </div>
            </div>

            {quote && (
              <div className="bg-surface-container border border-outline-variant p-4 space-y-2">
                <div className="flex justify-between font-ui text-body-sm">
                  <span className="text-on-surface-variant">Route</span>
                  <span className="text-on-surface">{routeLabel}</span>
                </div>
                <div className="flex justify-between font-ui text-body-sm">
                  <span className="text-on-surface-variant">Minimum received</span>
                  <span className="text-on-surface">
                    {minReceived} {outputToken?.symbol}
                  </span>
                </div>
                <div className="flex justify-between font-ui text-body-sm">
                  <span className="text-on-surface-variant">Price impact</span>
                  <span className="text-on-surface">
                    {quote.priceImpactPct
                      ? `${(Number(quote.priceImpactPct) * 100).toFixed(4)}%`
                      : "0.0000%"}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="border border-short/40 bg-short/10 p-4 font-ui text-body-sm text-short">
                {error}
              </div>
            )}

            {signature && (
              <a
                href={`https://explorer.solana.com/tx/${signature}${explorerCluster}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 font-ui text-body-sm text-long hover:underline"
              >
                Swap confirmed <ExternalLink size={14} />
              </a>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={getQuote}
                disabled={!canQuote || isQuoting}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-surface-container border border-outline-variant text-on-surface font-ui text-label-caps uppercase hover:bg-surface-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
              >
                <RefreshCw size={16} />
                {isQuoting ? "Quoting..." : "Get Quote"}
              </button>
              <button
                onClick={executeSwap}
                disabled={!canSwap}
                className="px-6 py-3 bg-zinc-950 border border-zinc-700 text-zinc-50 font-ui text-label-caps uppercase hover:bg-zinc-900 hover:border-zinc-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
              >
                {isSwapping ? "Swapping..." : connected ? "Swap" : "Connect Wallet"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
