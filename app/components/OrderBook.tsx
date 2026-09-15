"use client";

import { useState } from "react";
import { useOrderBook } from "@/hooks/useOrderBook";
import { useMarket } from "@/contexts/MarketContext";

const fmtPrice = (p: number) =>
  p.toLocaleString("en-US", { minimumFractionDigits: 2 });
const fmtSize = (s: number) => s.toFixed(3);
const fmtTotal = (t: number) =>
  t >= 1000 ? `${(t / 1000).toFixed(2)}k` : t.toFixed(0);

export default function OrderBook() {
  // Default to the protocol's own book; users can switch to the reference feed.
  const [preferOnChain, setPreferOnChain] = useState(true);
  const { bids, asks, source } = useOrderBook(preferOnChain);
  const { market } = useMarket();

  /* Compute cumulative totals + max for depth % */
  const askTotals: number[] = [];
  let acc = 0;
  // Asks from bottom (closest to spread) to top.
  // Wait, Binance gives asks in ascending price order. We want to show lowest ask at bottom.
  // So asks[0] (lowest) should be at the bottom of the list.
  // We'll reverse them when rendering.
  const sortedAsks = [...asks].sort((a, b) => a.price - b.price).slice(0, 15);
  for (let i = 0; i < sortedAsks.length; i++) {
    acc += sortedAsks[i].size * sortedAsks[i].price;
    askTotals[i] = acc;
  }
  
  const bidTotals: number[] = [];
  acc = 0;
  // Binance gives bids in descending order. Highest bid at top.
  const sortedBids = [...bids].sort((a, b) => b.price - a.price).slice(0, 15);
  for (let i = 0; i < sortedBids.length; i++) {
    acc += sortedBids[i].size * sortedBids[i].price;
    bidTotals[i] = acc;
  }
  
  const maxTotal = Math.max(
    ...askTotals.filter(Boolean),
    ...bidTotals.filter(Boolean),
    1
  );

  const spread =
    sortedAsks.length && sortedBids.length
      ? sortedAsks[0].price - sortedBids[0].price
      : 0;
  const spreadPct =
    sortedAsks.length ? (spread / sortedAsks[0].price) * 100 : 0;

  return (
    <section className="col-span-12 lg:col-span-3 xl:col-span-2 min-h-[360px] lg:min-h-0 min-w-0 b-thin lg:border-l-0 lg:border-r-0 flex flex-col bg-bg-surface overflow-hidden">
      {/* Header — the data source is always stated explicitly, so reference
          depth from a centralized exchange is never mistaken for ApeX liquidity. */}
      <div className="h-10 bb-thin flex items-center justify-between gap-2 px-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="t-label-caps text-text-main whitespace-nowrap">Order Book</span>
          <span
            title={
              source === "on-chain"
                ? "Live depth from the protocol's on-chain OrderBook account"
                : source === "reference"
                  ? "Reference depth from a centralized exchange — not tradable on ApeX"
                  : "Waiting for depth data"
            }
            className={`px-1.5 py-0.5 text-[9px] font-mono font-medium uppercase tracking-wider rounded border shrink-0 ${
              source === "on-chain"
                ? "bg-long/10 text-long border-long/30"
                : source === "reference"
                  ? "bg-bg-l3 text-text-muted border-t-border"
                  : "bg-bg-l2 text-text-dim border-t-border"
            }`}
          >
            {source === "on-chain"
              ? "on-chain"
              : source === "reference"
                ? "reference"
                : "loading"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setPreferOnChain((v) => !v)}
          title={
            preferOnChain
              ? "Currently preferring ApeX's on-chain book. Click to view the reference feed."
              : "Currently forcing the reference feed. Click to prefer ApeX's on-chain book."
          }
          className="t-label-caps text-text-dim hover:text-text-main transition-colors whitespace-nowrap"
        >
          {preferOnChain ? "View ref" : "View chain"}
        </button>
      </div>

      {/* Empty-state notice when the protocol book has no resting orders. */}
      {source === "reference" && preferOnChain && (
        <div className="px-3 py-1.5 bb-thin bg-bg-l2/60">
          <span className="text-[10px] font-mono text-text-muted leading-tight">
            ApeX book is empty — showing reference depth for context.
          </span>
        </div>
      )}

      <div className="flex-grow overflow-hidden flex flex-col" role="table" aria-label="Order Book">
        {/* Column header */}
        <div role="row" className="grid grid-cols-[minmax(4.5rem,1fr)_minmax(3rem,0.75fr)_minmax(3rem,0.75fr)] px-3 py-2 t-label-caps text-text-dim bg-bg-l2">
          <span role="columnheader">Price</span>
          <span role="columnheader" className="text-right">Size</span>
          <span role="columnheader" className="text-right">Total</span>
        </div>

        {/* Asks (reversed: lowest ask nearest spread) */}
        <div className="flex-grow overflow-hidden flex flex-col-reverse justify-end" role="rowgroup">
          {sortedAsks.map((a, i) => {
            const depth = (askTotals[i] / maxTotal) * 100;
            return (
              <div
                key={`a${i}`}
                role="row"
                aria-label={`Ask: $${fmtPrice(a.price)}, Size: ${fmtSize(a.size)}`}
                className="relative h-5 grid grid-cols-[minmax(4.5rem,1fr)_minmax(3rem,0.75fr)_minmax(3rem,0.75fr)] items-center px-3 t-data-sm hover:bg-bg-l3 cursor-pointer"
              >
                <div
                  className="absolute inset-0 depth-bar-ask"
                  style={{
                    width: `${Math.min(depth, 95)}%`,
                    transition: "width 0.3s ease",
                  }}
                  aria-hidden="true"
                />
                <span role="cell" className="text-short z-10">{fmtPrice(a.price)}</span>
                <span role="cell" className="text-right z-10">{fmtSize(a.size)}</span>
                <span role="cell" className="text-right z-10 text-text-muted">
                  {fmtTotal(askTotals[i])}
                </span>
              </div>
            );
          })}
        </div>

        {/* Spread */}
        <div className="py-2 px-3 border-y border-t-border-soft bg-bg-l2 flex items-center justify-between gap-2">
          <span className="t-data-md text-text-main whitespace-nowrap" aria-label={`Current price: $${market?.price ? fmtPrice(market.price) : "---"}`}>
            ${market?.price ? fmtPrice(market.price) : "---"}
          </span>
          <span className="t-label-caps text-text-muted whitespace-nowrap">
            Spread {spread.toFixed(2)} ({spreadPct.toFixed(2)}%)
          </span>
        </div>

        {/* Bids */}
        <div className="flex-grow overflow-hidden" role="rowgroup">
          {sortedBids.map((b, i) => {
            const depth = (bidTotals[i] / maxTotal) * 100;
            return (
              <div
                key={`b${i}`}
                role="row"
                aria-label={`Bid: $${fmtPrice(b.price)}, Size: ${fmtSize(b.size)}`}
                className="relative h-5 grid grid-cols-[minmax(4.5rem,1fr)_minmax(3rem,0.75fr)_minmax(3rem,0.75fr)] items-center px-3 t-data-sm hover:bg-bg-l3 cursor-pointer"
              >
                <div
                  className="absolute right-0 inset-y-0 depth-bar-bid"
                  style={{
                    width: `${Math.min(depth, 95)}%`,
                    transition: "width 0.3s ease",
                  }}
                  aria-hidden="true"
                />
                <span role="cell" className="text-long z-10">{fmtPrice(b.price)}</span>
                <span role="cell" className="text-right z-10">{fmtSize(b.size)}</span>
                <span role="cell" className="text-right z-10 text-text-muted">
                  {fmtTotal(bidTotals[i])}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
