"use client";

import CandlestickChart from "./CandlestickChart";
import { useMarket } from "@/contexts/MarketContext";
import { LineChart, Paintbrush } from "lucide-react";

const timeframes = ["1m", "5m", "15m", "1h", "4h", "1d"];
const active = "15m";

export default function ChartPanel() {
  const { market } = useMarket();

  return (
    <section className="col-span-12 lg:col-span-6 xl:col-span-7 min-h-[360px] lg:min-h-0 min-w-0 b-thin flex flex-col bg-bg-surface overflow-hidden">
      {/* Toolbar */}
      <div className="h-10 bb-thin grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 px-4 overflow-hidden">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex shrink-0 gap-1">
            {timeframes.map((tf) => (
              <button
                key={tf}
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
            {market.pair}
          </span>
          <span className="hidden sm:block min-w-0 truncate t-data-sm text-text-price">
            O: {market.basePrice - 100} H: {market.basePrice + 100} L:{" "}
            {market.basePrice - 200} C: {market.basePrice}
          </span>
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-grow relative bg-bg-base overflow-hidden">
        <CandlestickChart />
        {/* Dot grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-5"
          style={{
            backgroundImage:
              "radial-gradient(var(--border) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
      </div>
    </section>
  );
}
