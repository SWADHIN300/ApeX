"use client";

import { useState } from "react";
import { useMarket } from "@/contexts/MarketContext";
import { useTrade } from "@/contexts/TradeContext";

type Side = "Long" | "Short";
type OrderType = "Market" | "Limit" | "Stop";

const LEVERAGE_PRESETS = [1, 2, 5, 10];

export default function OrderForm() {
  const { market } = useMarket();
  const { portfolio, placeOrder } = useTrade();

  const [side, setSide] = useState<Side>("Long");
  const [orderType, setOrderType] = useState<OrderType>("Market");
  const [sizeInput, setSizeInput] = useState("");
  const [leverage, setLeverage] = useState(5);

  const orderTypes: OrderType[] = ["Market", "Limit", "Stop"];

  const sizeUsdc = parseFloat(sizeInput.replace(/,/g, "")) || 0;
  const price = market?.price || 0;
  
  const marginReq = sizeUsdc / leverage;
  const fee = sizeUsdc * 0.0004; // 0.04%
  const liqPrice =
    side === "Long"
      ? price * (1 - 1 / leverage + 0.005)
      : price * (1 + 1 / leverage - 0.005);

  const handlePlaceOrder = () => {
    if (sizeUsdc <= 0 || !market) return;
    placeOrder(market.symbol, side, sizeUsdc, leverage, price);
    setSizeInput(""); // Reset after placing order
  };

  return (
    <section className="col-span-12 lg:col-span-3 min-h-0 min-w-0 b-thin lg:border-l-0 flex flex-col bg-bg-surface p-4 overflow-y-auto no-scrollbar">
      {/* Long / Short toggle */}
      <div className="flex bg-bg-l1 p-0.5 gap-1 mb-6">
        <button
          onClick={() => setSide("Long")}
          className={`flex-1 py-2 t-label-caps transition-colors ${
            side === "Long"
              ? "bg-long text-white"
              : "text-text-dim hover:text-text-main"
          }`}
        >
          LONG
        </button>
        <button
          onClick={() => setSide("Short")}
          className={`flex-1 py-2 t-label-caps transition-colors ${
            side === "Short"
              ? "bg-short text-white"
              : "text-text-dim hover:text-text-main"
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
            className="w-full bg-bg-base border border-t-border focus:border-primary p-3 t-data-md text-text-main outline-none"
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
          max="20"
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
              className={`flex-1 py-1 t-data-sm transition-colors ${
                leverage === lev
                  ? "bg-primary-ctr border border-primary text-white"
                  : "bg-bg-l3 border border-t-border-soft text-text-muted hover:bg-bg-l4"
              }`}
            >
              {lev}x
            </button>
          ))}
        </div>
      </div>

      {/* Summary box */}
      <div className="bg-bg-l2 b-thin p-3 space-y-2 mb-6">
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

      {/* Action button */}
      <button
        onClick={handlePlaceOrder}
        disabled={sizeUsdc <= 0 || marginReq > portfolio.availableMargin}
        className={`w-full py-4 text-white t-headline-md uppercase hover:opacity-90 active:scale-[0.98] transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
          side === "Long" ? "bg-long" : "bg-short"
        }`}
      >
        Place {side} Order
      </button>
    </section>
  );
}
