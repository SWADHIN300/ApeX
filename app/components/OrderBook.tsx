"use client";

import { useState } from "react";
import { useOrderBook } from "@/hooks/useOrderBook";
import { useMarket } from "@/contexts/MarketContext";
import type { ExchangeName } from "@/lib/exchanges";

const BOOK_SOURCES: { id: ExchangeName; label: string }[] = [
  { id: "apex", label: "ApeX" },
  { id: "binance", label: "Binance" },
  { id: "coinbase", label: "Coinbase" },
  { id: "kraken", label: "Kraken" },
];

const fmtPrice = (p: number) =>
  p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtSize = (s: number) => s.toFixed(3);
const fmtTotal = (t: number) => {
  if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(2)}M`;
  if (t >= 1_000) return `${(t / 1_000).toFixed(2)}k`;
  return t.toFixed(0);
};

interface OrderBookProps {
  onSelectPrice?: (price: number) => void;
}

export default function OrderBook({ onSelectPrice }: OrderBookProps = {}) {
  const [bookSource, setBookSource] = useState<ExchangeName>("binance");
  const { bids, asks, source } = useOrderBook(bookSource);
  const { market } = useMarket();
  const sourceLabel =
    source === "unavailable"
      ? "unavailable"
      : source === "apex"
        ? "on-chain"
        : source;

  const handleSelectPrice = (p: number) => {
    onSelectPrice?.(p);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("apex:select-price", { detail: p }));
    }
  };

  /* Compute cumulative totals + max for depth % */
  // Asks sorted ascending by price: asks[0] is lowest ask (closest to spread).
  const sortedAsks = [...asks].sort((a, b) => a.price - b.price).slice(0, 15);
  const askRows = sortedAsks.reduce<Array<(typeof sortedAsks)[number] & { total: number }>>(
    (rows, ask) => {
      const total = (rows.at(-1)?.total ?? 0) + ask.size * ask.price;
      rows.push({ ...ask, total });
      return rows;
    },
    []
  );

  // Bids sorted descending by price: bids[0] is highest bid (closest to spread).
  const sortedBids = [...bids].sort((a, b) => b.price - a.price).slice(0, 15);
  const bidRows = sortedBids.reduce<Array<(typeof sortedBids)[number] & { total: number }>>(
    (rows, bid) => {
      const total = (rows.at(-1)?.total ?? 0) + bid.size * bid.price;
      rows.push({ ...bid, total });
      return rows;
    },
    []
  );

  const maxTotal = Math.max(
    askRows[askRows.length - 1]?.total || 0,
    bidRows[bidRows.length - 1]?.total || 0,
    1
  );

  // For display: Asks go from highest at top down to lowest at bottom (nearest spread).
  const displayAsks = [...askRows].reverse();

  const spread =
    sortedAsks.length > 0 && sortedBids.length > 0
      ? sortedAsks[0].price - sortedBids[0].price
      : 0;
  const spreadPct =
    sortedAsks.length > 0 && sortedAsks[0].price > 0
      ? (spread / sortedAsks[0].price) * 100
      : 0;

  return (
    <section className="col-span-12 lg:col-span-2 min-h-[360px] lg:min-h-0 min-w-0 b-thin lg:border-l-0 lg:border-r-0 flex flex-col bg-bg-surface overflow-hidden">
      {/* Keep external exchange depth distinct from liquidity on ApeX. */}
      <div className="h-10 bb-thin flex items-center justify-between gap-2 px-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="t-label-caps text-text-main whitespace-nowrap">Order Book</span>
          <span
            title={
              source === "apex"
                ? "Live depth from the protocol's on-chain OrderBook account"
                : source !== "unavailable"
                  ? `External ${source} spot depth — not tradable on ApeX`
                : "Waiting for depth data"
            }
            className={`px-1.5 py-0.5 text-[9px] font-mono font-medium uppercase tracking-wider rounded border shrink-0 ${
              source === "apex"
                ? "bg-long/10 text-long border-long/30"
                : source !== "unavailable"
                  ? "bg-bg-l3 text-text-muted border-t-border"
                  : "bg-bg-l2 text-text-dim border-t-border"
            }`}
          >
            {sourceLabel}
          </span>
        </div>
        <select
          aria-label="Order book source"
          value={bookSource}
          onChange={(event) => setBookSource(event.target.value as ExchangeName)}
          className="max-w-24 bg-bg-l2 text-text-main border border-t-border rounded-sm px-1.5 py-1 text-[10px] font-mono outline-none focus:border-accent"
        >
          {BOOK_SOURCES.map(({ id, label }) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </div>

      <div className="flex-grow overflow-hidden flex flex-col" role="table" aria-label="Order Book">
        {/* Column header */}
        <div role="row" className="grid grid-cols-[minmax(4rem,1fr)_minmax(3rem,.75fr)_minmax(3rem,.75fr)] lg:grid-cols-[minmax(3.5rem,1fr)_minmax(2.75rem,.75fr)] xl:grid-cols-[minmax(4.5rem,1fr)_minmax(3rem,.75fr)_minmax(3rem,.75fr)] px-3 py-2 lg:px-2 xl:px-3 t-label-caps text-text-dim bg-bg-l2 shrink-0 lg:text-[10px]">
          <span role="columnheader">Price</span>
          <span role="columnheader" className="text-right">Size</span>
          <span role="columnheader" className="text-right lg:hidden xl:block">Total</span>
        </div>

        {/* Asks (highest at top, lowest at bottom touching spread) */}
        <div className="flex-1 overflow-hidden flex flex-col justify-end min-h-[100px]" role="rowgroup">
          {displayAsks.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[11px] font-mono text-text-dim">
              No asks
            </div>
          ) : (
            displayAsks.map((a, i) => {
              const depth = Math.min((a.total / maxTotal) * 100, 95);
              return (
                <div
                  key={`a-${a.price}-${i}`}
                  role="row"
                  onClick={() => handleSelectPrice(a.price)}
                  aria-label={`Ask: $${fmtPrice(a.price)}, Size: ${fmtSize(a.size)}`}
                  title="Click to copy / select price"
                  className="relative h-5 grid grid-cols-[minmax(4rem,1fr)_minmax(3rem,.75fr)_minmax(3rem,.75fr)] lg:grid-cols-[minmax(3.5rem,1fr)_minmax(2.75rem,.75fr)] xl:grid-cols-[minmax(4.5rem,1fr)_minmax(3rem,.75fr)_minmax(3rem,.75fr)] items-center px-3 lg:px-2 xl:px-3 t-data-sm lg:text-[10px] hover:bg-bg-l3 cursor-pointer select-none transition-colors"
                >
                  <div
                    className="absolute right-0 inset-y-0 depth-bar-ask pointer-events-none"
                    style={{
                      width: `${depth}%`,
                      transition: "width 0.3s ease",
                    }}
                    aria-hidden="true"
                  />
                  <span role="cell" className="text-short z-10 font-mono">{fmtPrice(a.price)}</span>
                  <span role="cell" className="text-right z-10 font-mono">{fmtSize(a.size)}</span>
                  <span role="cell" className="text-right z-10 font-mono text-text-muted lg:hidden xl:block">
                    {fmtTotal(a.total)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Spread & Current Price bar */}
        <div className="py-2 px-3 border-y border-t-border-soft bg-bg-l2 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="t-data-md text-text-main whitespace-nowrap font-mono"
              aria-label={`Current price: $${market?.price ? fmtPrice(market.price) : "---"}`}
            >
              ${market?.price ? fmtPrice(market.price) : "---"}
            </span>
            {market?.change24h !== undefined && (
              <span
                className={`text-[10px] font-mono font-medium ${
                  market.change24h >= 0 ? "text-long" : "text-short"
                }`}
              >
                {market.change24h >= 0 ? "▲" : "▼"}
              </span>
            )}
          </div>
          <span className="t-label-caps text-text-muted whitespace-nowrap font-mono text-[10px]">
            {sortedAsks.length > 0 && sortedBids.length > 0 && spread >= 0 ? (
              `Spread ${spread.toFixed(2)} (${spreadPct.toFixed(2)}%)`
            ) : (
              "Spread --"
            )}
          </span>
        </div>

        {/* Bids (highest at top nearest spread, lowest at bottom) */}
        <div className="flex-1 overflow-hidden flex flex-col justify-start min-h-[100px]" role="rowgroup">
          {bidRows.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[11px] font-mono text-text-dim">
              No bids
            </div>
          ) : (
            bidRows.map((b, i) => {
              const depth = Math.min((b.total / maxTotal) * 100, 95);
              return (
                <div
                  key={`b-${b.price}-${i}`}
                  role="row"
                  onClick={() => handleSelectPrice(b.price)}
                  aria-label={`Bid: $${fmtPrice(b.price)}, Size: ${fmtSize(b.size)}`}
                  title="Click to copy / select price"
                  className="relative h-5 grid grid-cols-[minmax(4rem,1fr)_minmax(3rem,.75fr)_minmax(3rem,.75fr)] lg:grid-cols-[minmax(3.5rem,1fr)_minmax(2.75rem,.75fr)] xl:grid-cols-[minmax(4.5rem,1fr)_minmax(3rem,.75fr)_minmax(3rem,.75fr)] items-center px-3 lg:px-2 xl:px-3 t-data-sm lg:text-[10px] hover:bg-bg-l3 cursor-pointer select-none transition-colors"
                >
                  <div
                    className="absolute right-0 inset-y-0 depth-bar-bid pointer-events-none"
                    style={{
                      width: `${depth}%`,
                      transition: "width 0.3s ease",
                    }}
                    aria-hidden="true"
                  />
                  <span role="cell" className="text-long z-10 font-mono">{fmtPrice(b.price)}</span>
                  <span role="cell" className="text-right z-10 font-mono">{fmtSize(b.size)}</span>
                  <span role="cell" className="text-right z-10 font-mono text-text-muted lg:hidden xl:block">
                    {fmtTotal(b.total)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
