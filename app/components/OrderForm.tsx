"use client";

import { useState } from "react";
import { ExternalLink, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useMarket } from "@/contexts/MarketContext";
import { useTrade } from "@/contexts/TradeContext";
import { useNetwork } from "@/contexts/WalletProvider";
import { placeProtocolOrder } from "@/lib/apexProtocol";
import { MAX_LEVERAGE, TxStatus } from "@/lib/constants";

type Side = "Long" | "Short";
type OrderType = "Market" | "Limit" | "Stop";

const LEVERAGE_PRESETS = [1, 2, 5, 10];

export default function OrderForm() {
  const { connection } = useConnection();
  const { connected, publicKey, sendTransaction } = useWallet();
  const { network } = useNetwork();
  const { market } = useMarket();
  const { portfolio, placeOrder } = useTrade();

  const [side, setSide] = useState<Side>("Long");
  const [orderType, setOrderType] = useState<OrderType>("Market");
  const [sizeInput, setSizeInput] = useState("");
  const [leverage, setLeverage] = useState(5);
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [orderError, setOrderError] = useState("");
  const [orderSignature, setOrderSignature] = useState("");

  const orderTypes: OrderType[] = ["Market", "Limit", "Stop"];

  const sizeUsdc = parseFloat(sizeInput.replace(/,/g, "")) || 0;
  const price = market?.price || 0;
  
  const marginReq = sizeUsdc / leverage;
  const fee = sizeUsdc * 0.0004; // 0.04%
  const liqPrice =
    side === "Long"
      ? price * (1 - 1 / leverage + 0.005)
      : price * (1 + 1 / leverage - 0.005);

  const initiateOrder = () => {
    if (!connected || !publicKey) {
      setOrderError("Connect your Solana wallet before placing an on-chain order.");
      return;
    }

    if (sizeUsdc <= 0 || !market) return;

    setTxStatus("confirming");
    setOrderError("");
    setOrderSignature("");
  };

  const confirmOrder = async () => {
    if (!connected || !publicKey || !market) return;
    
    setTxStatus("signing");
    setOrderError("");

    try {
      const signature = await placeProtocolOrder({
        connection,
        publicKey,
        sendTransaction,
        pair: market.symbol,
        side,
        price,
        sizeUsdc,
        leverage,
      });

      setTxStatus("submitted");
      setOrderSignature(signature);
      
      
      setTxStatus("confirmed");
      placeOrder(market.symbol, side, sizeUsdc, leverage, price);
      setSizeInput("");
      
      setTimeout(() => {
        setTxStatus((prev) => prev === "confirmed" ? "idle" : prev);
      }, 5000);
    } catch (error) {
      setTxStatus("failed");
      setOrderError(error instanceof Error ? error.message : "Could not place on-chain order.");
    }
  };

  const cancelOrder = () => {
    setTxStatus("idle");
  };

  const isOrderDisabled =
    txStatus !== "idle" ||
    !connected ||
    !publicKey ||
    sizeUsdc <= 0 ||
    marginReq > portfolio.availableMargin;
  const explorerCluster = network === "devnet" ? "?cluster=devnet" : "";

  return (
    <section className="col-span-12 lg:col-span-3 min-h-0 min-w-0 b-thin lg:border-l-0 flex flex-col bg-bg-surface p-4 overflow-y-auto no-scrollbar relative">
      {/* Confirmation Modal Overlay */}
      {txStatus === "confirming" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm rounded-md">
          <div className="bg-bg-l1 w-full border border-t-border shadow-2xl rounded-md p-4">
            <h3 className="t-headline-sm mb-4">Confirm Order</h3>
            <div className="space-y-2 mb-6">
              <div className="flex justify-between t-body-sm">
                <span className="text-text-muted">Market</span>
                <span className="text-text-main">{market?.symbol}</span>
              </div>
              <div className="flex justify-between t-body-sm">
                <span className="text-text-muted">Side</span>
                <span className={side === "Long" ? "text-long" : "text-short"}>{side} {leverage}x</span>
              </div>
              <div className="flex justify-between t-body-sm">
                <span className="text-text-muted">Size</span>
                <span className="text-text-main">{sizeUsdc.toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between t-body-sm">
                <span className="text-text-muted">Est. Fee</span>
                <span className="text-text-main">{fee.toFixed(2)} USDC</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={cancelOrder}
                className="flex-1 py-2 rounded-md bg-bg-l2 text-text-main t-label-caps hover:bg-bg-l3"
              >
                Cancel
              </button>
              <button
                onClick={confirmOrder}
                className={`flex-1 py-2 rounded-md text-white t-label-caps ${
                  side === "Long" ? "bg-long hover:bg-long/90" : "bg-short hover:bg-short/90"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Long / Short toggle */}
      <div className="flex bg-bg-l1 p-1 gap-1 mb-6 rounded-md">
        <button
          onClick={() => setSide("Long")}
          className={`flex-1 py-2 t-label-caps transition-all rounded-sm ${
            side === "Long"
              ? "gradient-long glow-long text-white shadow-md"
              : "text-text-dim hover:text-text-main hover:bg-bg-l2"
          }`}
        >
          LONG
        </button>
        <button
          onClick={() => setSide("Short")}
          className={`flex-1 py-2 t-label-caps transition-all rounded-sm ${
            side === "Short"
              ? "gradient-short glow-short text-white shadow-md"
              : "text-text-dim hover:text-text-main hover:bg-bg-l2"
          }`}
        >
          SHORT
        </button>
      </div>

      {/* Order type tabs */}
      <div className="flex gap-4 bb-thin mb-4">
        {orderTypes.map((t) => (
          <button
            key={t}
            onClick={() => setOrderType(t)}
            className={`t-label-caps pb-2 transition-colors ${
              orderType === t
                ? "text-text-main border-b-2 border-primary"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Size input */}
      <div className="mb-4">
        <div className="flex justify-between gap-3 mb-1">
          <span className="t-label-caps text-text-muted shrink-0">Size</span>
          <span className="t-label-caps text-text-muted truncate">
            Avail: {portfolio.availableMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
          </span>
        </div>
        <div className="relative">
          <input
            type="text"
            value={sizeInput}
            onChange={(e) => setSizeInput(e.target.value)}
            placeholder="0.00"
            className="w-full bg-bg-l2 border border-t-border focus:border-primary focus:ring-1 focus:ring-primary p-3 t-data-md text-text-main outline-none rounded-md transition-all"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 t-data-sm text-text-muted">
            USDC
          </span>
        </div>
        <div className="flex justify-between mt-2">
           {/* Percentage quick selects */}
           {[25, 50, 75, 100].map(pct => (
             <button
               key={pct}
               onClick={() => setSizeInput(((portfolio.availableMargin * leverage * pct) / 100).toFixed(2))}
               className="t-label-caps text-text-muted hover:text-text-main transition-colors"
             >
               {pct}%
             </button>
           ))}
        </div>
      </div>

      {/* Leverage slider */}
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <span className="t-label-caps text-text-muted">Leverage</span>
          <span className="t-data-sm text-primary">{leverage.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min="1"
          max={MAX_LEVERAGE}
          step="1"
          value={leverage}
          onChange={(e) => setLeverage(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-bg-l3 appearance-none cursor-pointer accent-primary"
        />
        {/* Preset chips */}
        <div className="flex justify-between mt-3 gap-1">
          {LEVERAGE_PRESETS.map((lev) => (
            <button
              key={lev}
              onClick={() => setLeverage(lev)}
              className={`flex-1 py-1.5 t-data-sm transition-all rounded-sm ${
                leverage === lev
                  ? "gradient-primary glow-primary border-transparent text-white"
                  : "bg-bg-l2 border border-t-border-soft text-text-muted hover:bg-bg-l3"
              }`}
            >
              {lev}x
            </button>
          ))}
        </div>
      </div>

      {/* Summary box */}
      <div className="bg-bg-l2 border border-t-border p-3 space-y-2 mb-6 rounded-md shadow-sm">
        <div className="flex justify-between t-data-sm">
          <span className="text-text-muted">Liq. Price</span>
          <span className="text-text-main">${liqPrice > 0 ? liqPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "---"}</span>
        </div>
        <div className="flex justify-between t-data-sm">
          <span className="text-text-muted">Fees (0.04%)</span>
          <span className="text-text-main">{fee > 0 ? fee.toFixed(2) : "0.00"} USDC</span>
        </div>
        <div className="flex justify-between t-data-sm">
          <span className="text-text-muted">Margin Req.</span>
          <span className="text-text-main">{marginReq > 0 ? marginReq.toFixed(2) : "0.00"} USDC</span>
        </div>
      </div>

      {/* Tx Lifecycle Status */}
      {txStatus !== "idle" && txStatus !== "confirming" && (
        <div className={`mb-3 p-3 flex items-center gap-2 t-body-sm rounded-md border ${
          txStatus === "failed" ? "bg-short/10 border-short/40 text-short" :
          txStatus === "confirmed" ? "bg-long/10 border-long/40 text-long" :
          "bg-primary/10 border-primary/40 text-primary"
        }`}>
          {txStatus === "signing" && <Loader2 size={16} className="animate-spin shrink-0" />}
          {txStatus === "submitted" && <Loader2 size={16} className="animate-spin shrink-0" />}
          {txStatus === "confirmed" && <CheckCircle2 size={16} className="shrink-0" />}
          {txStatus === "failed" && <XCircle size={16} className="shrink-0" />}
          
          <span className="flex-1">
            {txStatus === "signing" && "Awaiting Wallet Signature..."}
            {txStatus === "submitted" && "Transaction Submitted..."}
            {txStatus === "confirmed" && "Order Confirmed!"}
            {txStatus === "failed" && (orderError || "Transaction Failed")}
          </span>
        </div>
      )}

      {orderSignature && txStatus === "confirmed" && (
        <a
          href={`https://explorer.solana.com/tx/${orderSignature}${explorerCluster}`}
          target="_blank"
          rel="noreferrer"
          className="mb-3 flex items-center gap-2 t-body-sm text-long no-underline hover:underline"
        >
          View on Explorer <ExternalLink size={13} />
        </a>
      )}

      {/* Action button */}
      <button
        onClick={initiateOrder}
        disabled={isOrderDisabled}
        className={`w-full py-4 text-white t-headline-md uppercase hover:opacity-90 active:scale-[0.98] transition-all shadow-lg rounded-md disabled:opacity-50 disabled:cursor-not-allowed ${
          side === "Long" ? "gradient-long glow-long" : "gradient-short glow-short"
        }`}
      >
        {connected ? `Place ${side} Order` : "Connect Wallet to Place Order"}
      </button>
    </section>
  );
}



