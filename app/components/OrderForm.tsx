"use client";

import { useState, useEffect } from "react";
import { ExternalLink, Loader2, CheckCircle2, XCircle, FlaskConical } from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { useMarket } from "@/contexts/MarketContext";
import { useTrade } from "@/contexts/TradeContext";
import { useNetwork } from "@/contexts/WalletProvider";
import { usePaperTrading } from "@/contexts/PaperTradingContext";
import { getMarketBaseMint, openProtocolPosition, placeProtocolOrder } from "@/lib/apexProtocol";
import { MAX_LEVERAGE, TxStatus } from "@/lib/constants";

type Side = "Long" | "Short";
type OrderType = "Market" | "Limit" | "Stop";

const LEVERAGE_PRESETS = [1, 2, 5, 10];

export default function OrderForm() {
  const { connection } = useConnection();
  const { connected, publicKey, sendTransaction } = useWallet();
  const { network } = useNetwork();
  const { market } = useMarket();
  const marketSymbol = market?.symbol;
  const { portfolio, placeOrder } = useTrade();
  const { isPaperTrading, paperPortfolio, placePaperOrder } = usePaperTrading();

  // In paper mode, use the virtual portfolio
  const activePortfolio = isPaperTrading ? paperPortfolio : portfolio;

  const [side, setSide] = useState<Side>("Long");
  const [orderType, setOrderType] = useState<OrderType>("Market");
  const [sizeInput, setSizeInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [leverage, setLeverage] = useState(5);
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [orderError, setOrderError] = useState("");
  const [orderSignature, setOrderSignature] = useState("");
  const [walletCollateralBalance, setWalletCollateralBalance] = useState(0);
  const [isLoadingWalletCollateral, setIsLoadingWalletCollateral] = useState(false);
  const directDevnetMarketOrder =
    !isPaperTrading && network === "devnet" && orderType === "Market";

  const orderTypes: OrderType[] = ["Market", "Limit", "Stop"];

  useEffect(() => {
    const handleSelectPrice = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      if (customEvent.detail) {
        setOrderType("Limit");
        setPriceInput(customEvent.detail.toFixed(2));
      }
    };
    window.addEventListener("apex:select-price", handleSelectPrice);
    return () => window.removeEventListener("apex:select-price", handleSelectPrice);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!directDevnetMarketOrder || !connected || !publicKey || !marketSymbol) {
      return;
    }

    const loadBalance = async () => {
      setIsLoadingWalletCollateral(true);
      try {
        const mint = getMarketBaseMint(marketSymbol, network);
        const tokenAccount = await getAssociatedTokenAddress(mint, publicKey);
        const accountInfo = await connection.getAccountInfo(tokenAccount);
        if (!accountInfo) {
          if (!cancelled) setWalletCollateralBalance(0);
          return;
        }
        const balance = await connection.getTokenAccountBalance(tokenAccount);
        if (!cancelled) {
          setWalletCollateralBalance(Number(balance.value.uiAmountString ?? 0));
        }
      } catch {
        if (!cancelled) setWalletCollateralBalance(0);
      } finally {
        if (!cancelled) setIsLoadingWalletCollateral(false);
      }
    };

    void loadBalance();
    return () => {
      cancelled = true;
    };
  }, [connection, connected, directDevnetMarketOrder, marketSymbol, network, orderSignature, publicKey]);

  const sizeUsdc = parseFloat(sizeInput.replace(/,/g, "")) || 0;
  const effectivePrice =
    orderType === "Market"
      ? (market?.price || 0)
      : (parseFloat(priceInput.replace(/,/g, "")) || market?.price || 0);
  const price = effectivePrice;
  
  const marginReq = sizeUsdc / leverage;
  const fee = sizeUsdc * 0.0004; // 0.04%
  const availableCollateral = directDevnetMarketOrder
    ? walletCollateralBalance
    : activePortfolio.availableMargin;
  const isCollateralLoading = directDevnetMarketOrder && isLoadingWalletCollateral;
  const availableLabel = directDevnetMarketOrder ? "Wallet collateral" : "Available margin";
  const liqPrice =
    side === "Long"
      ? price * (1 - 1 / leverage + 0.005)
      : price * (1 + 1 / leverage - 0.005);

  const initiateOrder = () => {
    if (sizeUsdc <= 0 || !market) return;

    // Paper trading mode: instant simulated fill, no wallet needed
    if (isPaperTrading) {
      placePaperOrder(market.symbol, side, sizeUsdc, leverage, price);
      setTxStatus("confirmed");
      setOrderError("");
      setOrderSignature("");
      setSizeInput("");
      setTimeout(() => {
        setTxStatus((prev) => prev === "confirmed" ? "idle" : prev);
      }, 3000);
      return;
    }

    if (!connected || !publicKey) {
      setOrderError("Connect your Solana wallet before placing an on-chain order.");
      return;
    }

    setTxStatus("confirming");
    setOrderError("");
    setOrderSignature("");
  };

  const confirmOrder = async () => {
    if (!connected || !publicKey || !market) return;
    
    setTxStatus("signing");
    setOrderError("");

    try {
      const signature = directDevnetMarketOrder
        ? await openProtocolPosition({
            connection,
            publicKey,
            sendTransaction,
            pair: market.symbol,
            side,
            collateral: marginReq,
            leverage,
            referencePrice: price,
            network,
          })
        : await placeProtocolOrder({
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
    txStatus === "confirming" ||
    txStatus === "signing" ||
    txStatus === "submitted" ||
    (!isPaperTrading && (!connected || !publicKey)) ||
    effectivePrice <= 0 ||
    sizeUsdc <= 0 ||
    marginReq > availableCollateral;
  const explorerCluster = network === "devnet" ? "?cluster=devnet" : "";

  return (
    <section className="order-entry-panel col-span-12 lg:col-span-3 xl:col-span-2 min-h-0 min-w-0 b-thin lg:border-l-0 flex flex-col bg-bg-surface overflow-hidden relative">
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
                <span className="text-text-muted">Collateral</span>
                <span className="text-text-main">
                  {marginReq.toFixed(2)} USDC {directDevnetMarketOrder ? "from wallet" : "required"}
                </span>
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

      <div className="order-entry-fields">
      {/* Long / Short toggle */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-text-main">Order entry</h2>
          <p className="mt-0.5 text-[10px] font-mono text-text-muted">{market?.symbol ?? "Perpetual market"}</p>
        </div>
        <span className="text-[9px] font-mono uppercase tracking-wider text-text-muted">
          {isPaperTrading ? "Simulated" : "Wallet"}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-1 border border-t-border bg-bg-l1 p-1">
        <button
          type="button"
          aria-pressed={side === "Long"}
          onClick={() => setSide("Long")}
          className={`min-h-10 px-2 text-xs font-semibold tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary ${
            side === "Long"
              ? "bg-long/15 text-long"
              : "text-text-dim hover:text-text-main hover:bg-bg-l2"
          }`}
        >
          Buy / Long
        </button>
        <button
          type="button"
          aria-pressed={side === "Short"}
          onClick={() => setSide("Short")}
          className={`min-h-10 px-2 text-xs font-semibold tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary ${
            side === "Short"
              ? "bg-short/15 text-short"
              : "text-text-dim hover:text-text-main hover:bg-bg-l2"
          }`}
        >
          Sell / Short
        </button>
      </div>

      {/* Order type tabs */}
      <div className="mb-4 flex gap-1 border-b border-t-border px-1">
        {orderTypes.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={orderType === t}
            onClick={() => setOrderType(t)}
            className={`min-h-9 border-b-2 px-2 text-[10px] font-mono font-semibold uppercase tracking-wider transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
              orderType === t
                ? "border-primary text-text-main"
                : "border-transparent text-text-muted hover:text-text-main"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {directDevnetMarketOrder && (
        <p className="-mt-2 mb-3 text-[10px] leading-relaxed text-text-muted">
          Market positions use collateral in your wallet. Limit and stop orders use deposited protocol margin.
        </p>
      )}

      {/* Price input (for Limit and Stop orders) */}
      {orderType !== "Market" && (
        <div className="mb-4">
          <div className="flex justify-between gap-3 mb-1">
            <span className="t-label-caps text-text-muted shrink-0">
              {orderType === "Limit" ? "Limit Price" : "Trigger Price"}
            </span>
            <span className="t-label-caps text-text-muted truncate">
              Mark: ${market?.price ? market.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "---"}
            </span>
          </div>
          <div className="relative">
            <input
              type="text"
              aria-label={orderType === "Limit" ? "Limit price in USDC" : "Trigger price in USDC"}
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder={market?.price ? market.price.toFixed(2) : "0.00"}
              className="w-full bg-bg-l2 border border-t-border focus:border-primary focus:ring-1 focus:ring-primary p-3 t-data-md text-text-main outline-none rounded-md transition-all font-mono"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 t-data-sm text-text-muted">
              USDC
            </span>
          </div>
        </div>
      )}

      {/* Size input */}
      <div className="mb-4">
        <div className="flex justify-between gap-3 mb-1">
          <span className="t-label-caps text-text-muted shrink-0">Size</span>
          <span className="t-label-caps text-text-muted truncate">
            {availableLabel}: {isCollateralLoading ? "Loading…" : availableCollateral.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
          </span>
        </div>
        <div className="relative">
          <input
            type="text"
            aria-label="Order size in USDC"
            value={sizeInput}
            onChange={(e) => setSizeInput(e.target.value)}
            placeholder="0.00"
            className="w-full bg-bg-l2 border border-t-border focus:border-primary focus:ring-1 focus:ring-primary p-3 t-data-md text-text-main outline-none transition-all"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 t-data-sm text-text-muted">
            USDC
          </span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1">
           {/* Percentage quick selects */}
           {[25, 50, 75, 100].map(pct => (
             <button
               key={pct}
               type="button"
               aria-label={`Set order size to ${pct}% of ${directDevnetMarketOrder ? "wallet collateral" : "available margin"}`}
               onClick={() => setSizeInput(((availableCollateral * leverage * pct) / 100).toFixed(2))}
               className="border border-t-border-soft bg-bg-l1 py-1.5 text-[10px] font-mono text-text-muted transition-colors hover:border-primary/50 hover:text-text-main focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
             >
               {pct}%
             </button>
           ))}
        </div>
      </div>

      {/* Leverage slider */}
      <div className="mb-5 border-t border-t-border pt-3">
        <div className="flex justify-between mb-2">
          <span className="t-label-caps text-text-muted">Leverage</span>
          <span className="t-data-sm text-primary">{leverage.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          aria-label="Leverage"
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
              type="button"
              aria-pressed={leverage === lev}
              onClick={() => setLeverage(lev)}
              className={`flex-1 py-1.5 t-data-sm transition-all rounded-sm ${
                leverage === lev
                  ? "bg-primary/15 border border-primary/40 text-primary font-semibold"
                  : "bg-bg-l2 border border-t-border-soft text-text-muted hover:bg-bg-l3"
              }`}
            >
              {lev}x
            </button>
          ))}
        </div>
      </div>

      {/* Summary box */}
      <div className="mb-4 border-y border-t-border bg-bg-l1 px-3 py-2.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">Order summary</span>
          <span className="text-[10px] font-mono text-text-dim">{leverage}x</span>
        </div>
        <div className="space-y-2">
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
            {txStatus === "confirmed" &&
              (isPaperTrading
                ? "Paper Order Filled (Simulated)"
                : directDevnetMarketOrder
                  ? "Devnet Position Opened"
                  : "Order Confirmed!")}
            {txStatus === "failed" && (orderError || "Transaction Failed")}
          </span>
          {isPaperTrading && txStatus === "confirmed" && (
            <FlaskConical size={14} className="shrink-0 opacity-70" />
          )}
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
      </div>

      {/* Action button */}
      <div className="order-entry-actions">
      <button
        onClick={initiateOrder}
        disabled={isOrderDisabled}
        className={`w-full min-h-12 py-3 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:brightness-110 active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed ${
          side === "Long" ? "bg-long" : "bg-short"
        }`}
      >
        {isPaperTrading
          ? `Paper ${side}`
          : connected
            ? `${side === "Long" ? "Buy / Long" : "Sell / Short"}`
            : "Connect Wallet to Place Order"}
      </button>

      {/* Paper mode badge */}
      {isPaperTrading && (
        <div className="mt-3 flex items-center justify-center gap-2 t-body-sm text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-md p-2">
          <FlaskConical size={14} />
          <span>Paper Trading — no real funds used</span>
        </div>
      )}

      {/* Insufficient Margin Warning */}
      {((isPaperTrading && sizeUsdc > 0) || (connected && sizeUsdc > 0)) && marginReq > availableCollateral && (
        <div className="mt-3 text-center t-body-sm text-short bg-short/10 border border-short/40 rounded-md p-2">
          {directDevnetMarketOrder ? (
            <>
              Insufficient wallet collateral. Get Devnet collateral in <a href="/swap" className="underline font-bold">Swap</a> or switch to a limit order after depositing it in <a href="/accounts" className="underline font-bold">Accounts</a>.
            </>
          ) : (
            <>Insufficient margin. Please deposit USDC in the <a href="/accounts" className="underline font-bold">Accounts</a> tab.</>
          )}
        </div>
      )}
      </div>
    </section>
  );
}



