"use client";

import { useEffect, useState, useCallback } from "react";

interface Level {
  price: number;
  size: number;
}

const INITIAL_ASKS: Level[] = [
  { price: 65462.0, size: 0.428 },
  { price: 65458.5, size: 0.785 },
  { price: 65455.0, size: 0.632 },
  { price: 65450.0, size: 1.026 },
  { price: 65445.5, size: 0.926 },
  { price: 65438.0, size: 0.157 },
];

const INITIAL_BIDS: Level[] = [
  { price: 65431.2, size: 0.841 },
  { price: 65425.0, size: 2.034 },
  { price: 65420.5, size: 0.575 },
  { price: 65415.0, size: 1.66 },
  { price: 65410.0, size: 4.211 },
  { price: 65402.5, size: 0.914 },
];

const fmtPrice = (p: number) =>
  p.toLocaleString("en-US", { minimumFractionDigits: 2 });
const fmtSize = (s: number) => s.toFixed(3);
const fmtTotal = (t: number) =>
  t >= 1000 ? `${(t / 1000).toFixed(2)}k` : t.toFixed(0);

export default function OrderBook() {
  const [asks, setAsks] = useState<Level[]>(INITIAL_ASKS);
  const [bids, setBids] = useState<Level[]>(INITIAL_BIDS);
  const [flashedRows, setFlashedRows] = useState<Set<string>>(new Set());

  const updateRows = useCallback(() => {
    const count = 2 + Math.floor(Math.random() * 2); // 2 or 3
    const flashed = new Set<string>();

    setAsks((prev) => {
      const next = prev.map((l) => ({ ...l }));
      for (let n = 0; n < Math.min(count, next.length); n++) {
        const idx = Math.floor(Math.random() * next.length);
        next[idx].size = 0.03 + Math.random() * 2.0;
        flashed.add(`a${idx}`);
      }
      return next;
    });

    setBids((prev) => {
      const next = prev.map((l) => ({ ...l }));
      for (let n = 0; n < Math.min(count, next.length); n++) {
        const idx = Math.floor(Math.random() * next.length);
        next[idx].size = 0.1 + Math.random() * 4.0;
        flashed.add(`b${idx}`);
      }
      return next;
    });

    setFlashedRows(flashed);
    setTimeout(() => setFlashedRows(new Set()), 350);
  }, []);

  useEffect(() => {
    const id = setInterval(updateRows, 1800);
    return () => clearInterval(id);
  }, [updateRows]);

  /* Compute cumulative totals + max for depth % */
  const askTotals: number[] = [];
  let acc = 0;
  for (let i = asks.length - 1; i >= 0; i--) {
    acc += asks[i].size * asks[i].price;
    askTotals[i] = acc;
  }
  const bidTotals: number[] = [];
  acc = 0;
  for (let i = 0; i < bids.length; i++) {
    acc += bids[i].size * bids[i].price;
    bidTotals[i] = acc;
  }
  const maxTotal = Math.max(
    ...askTotals.filter(Boolean),
    ...bidTotals.filter(Boolean),
    1
  );

  return (
    <section className="col-span-12 lg:col-span-3 xl:col-span-2 min-h-[360px] lg:min-h-0 min-w-0 b-thin lg:border-l-0 lg:border-r-0 flex flex-col bg-bg-surface overflow-hidden">
      {/* Header */}
      <div className="h-10 bb-thin flex items-center px-3">
        <span className="t-label-caps text-text-main">Order Book</span>
      </div>

      <div className="flex-grow overflow-hidden flex flex-col">
        {/* Column header */}
        <div className="grid grid-cols-[minmax(4.5rem,1fr)_minmax(3rem,0.75fr)_minmax(3rem,0.75fr)] px-3 py-2 t-label-caps text-text-dim bg-bg-l2">
          <span>Price</span>
          <span className="text-right">Size</span>
          <span className="text-right">Total</span>
        </div>

        {/* Asks (reversed: lowest ask nearest spread) */}
        <div className="flex-grow overflow-hidden flex flex-col-reverse">
          {asks.map((a, i) => {
            const depth = (askTotals[i] / maxTotal) * 100;
            const flashing = flashedRows.has(`a${i}`);
            return (
              <div
                key={`a${i}`}
                className={`relative h-5 grid grid-cols-[minmax(4.5rem,1fr)_minmax(3rem,0.75fr)_minmax(3rem,0.75fr)] items-center px-3 t-data-sm hover:bg-bg-l3 cursor-pointer ${
                  flashing ? "row-flash" : ""
                }`}
              >
                <div
                  className="absolute inset-0 depth-bar-ask"
                  style={{
                    width: `${Math.min(depth, 95)}%`,
                    transition: "width 0.3s ease",
                  }}
                />
                <span className="text-short z-10">{fmtPrice(a.price)}</span>
                <span className="text-right z-10">{fmtSize(a.size)}</span>
                <span className="text-right z-10 text-text-muted">
                  {fmtTotal(askTotals[i])}
                </span>
              </div>
            );
          })}
        </div>

        {/* Spread */}
        <div className="py-2 px-3 border-y border-t-border-soft bg-bg-l2 flex items-center justify-between gap-2">
          <span className="t-data-md text-text-main whitespace-nowrap">
            $65,432.10
          </span>
          <span className="t-label-caps text-text-muted whitespace-nowrap">
            Spread 5.90 (0.01%)
          </span>
        </div>

        {/* Bids */}
        <div className="flex-grow overflow-hidden">
          {bids.map((b, i) => {
            const depth = (bidTotals[i] / maxTotal) * 100;
            const flashing = flashedRows.has(`b${i}`);
            return (
              <div
                key={`b${i}`}
                className={`relative h-5 grid grid-cols-[minmax(4.5rem,1fr)_minmax(3rem,0.75fr)_minmax(3rem,0.75fr)] items-center px-3 t-data-sm hover:bg-bg-l3 cursor-pointer ${
                  flashing ? "row-flash" : ""
                }`}
              >
                <div
                  className="absolute right-0 inset-y-0 depth-bar-bid"
                  style={{
                    width: `${Math.min(depth, 95)}%`,
                    transition: "width 0.3s ease",
                  }}
                />
                <span className="text-long z-10">{fmtPrice(b.price)}</span>
                <span className="text-right z-10">{fmtSize(b.size)}</span>
                <span className="text-right z-10 text-text-muted">
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
