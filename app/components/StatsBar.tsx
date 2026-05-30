"use client";

import { useEffect, useState } from "react";

const BASE_PRICE = 64_231.5;

export default function StatsBar() {
  const [price, setPrice] = useState(BASE_PRICE);

  useEffect(() => {
    const id = setInterval(() => {
      setPrice((p) => {
        const delta = (Math.random() - 0.5) * 5;
        return +(p + delta).toFixed(2);
      });
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2 });

  return (
    <div className="bg-surface-container-lowest border-b border-outline-variant px-gutter py-2 flex items-center justify-between overflow-x-auto whitespace-nowrap gap-8">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-headline-sm">BTC/USDC</span>
          <span className="text-value-md text-secondary">${fmt(price)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-label-sm text-on-surface-variant">24h Change</span>
          <span className="text-value-sm text-secondary">+2.4%</span>
        </div>
        <div className="flex flex-col">
          <span className="text-label-sm text-on-surface-variant">24h Volume</span>
          <span className="text-value-sm text-on-surface">$1.2B</span>
        </div>
        <div className="flex flex-col">
          <span className="text-label-sm text-on-surface-variant">Open Interest</span>
          <span className="text-value-sm text-on-surface">$450M</span>
        </div>
        <div className="flex flex-col">
          <span className="text-label-sm text-on-surface-variant">Funding Rate</span>
          <span className="text-value-sm text-secondary">0.01%</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-secondary" />
        <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">
          Mainnet-Beta
        </span>
      </div>
    </div>
  );
}
