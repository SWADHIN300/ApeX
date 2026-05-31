"use client";

import { useState } from "react";
import CandlestickChart from "./CandlestickChart";
import { useMarket } from "@/contexts/MarketContext";
import { LineChart, Paintbrush } from "lucide-react";

const timeframes = ["1m", "5m", "15m", "1h", "4h", "1d"];

export default function ChartPanel() {
  const { market } = useMarket();
  const [active, setActive] = useState("15m");

  return (
    <section className="col-span-12 lg:col-span-6 xl:col-span-7 min-h-[360px] lg:min-h-0 min-w-0 b-thin flex flex-col bg-bg-surface overflow-hidden">
      {/* Toolbar */}
      <div className="h-10 bb-thin grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 px-4 overflow-hidden">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex shrink-0 gap-1">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => setActive(tf)}
                className={`t-label-caps px-2 py-1 ${
                  tf === active
                    ? "text-text-main bg-bg-l4 border-b-2 border-primary"
                    : "text-text-dim hover:text-text-main"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
          <div className="h-4 w-px shrink-0 bg-t-border-soft mx-1" />
          <button
            className="h-8 w-8 flex shrink-0 items-center justify-center text-text-muted hover:text-text-main"
            aria-label="Chart indicators"
            title="Chart indicators"
            type="button"
          >
            <LineChart size={17} />
          </button>
          <button
            className="h-8 w-8 flex shrink-0 items-center justify-center text-text-muted hover:text-text-main"
            aria-label="Drawing tools"
            title="Drawing tools"
            type="button"
          >
            <Paintbrush size={17} />
          </button>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2 overflow-hidden">
          <span className="t-label-caps text-text-muted whitespace-nowrap">
            {market?.symbol}
          </span>
          <span className="hidden sm:block min-w-0 truncate t-data-sm text-text-price">
            O: {market?.price - 100} H: {market?.high24h} L:{" "}
            {market?.low24h} C: {market?.price}
          </span>
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-grow relative bg-bg-base overflow-hidden" style={{ minHeight: 300 }}>
        <CandlestickChart timeframe={active} />
      </div>
    </section>
  );
}
