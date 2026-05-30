"use client";

import CandlestickChart from "./CandlestickChart";

const timeframes = ["1m", "5m", "15m", "1h", "4h", "1d"];
const active = "15m";

export default function ChartPanel() {
  return (
    <section className="col-span-12 lg:col-span-7 b-thin flex flex-col bg-bg-surface">
      {/* Toolbar */}
      <div className="h-10 bb-thin flex items-center px-4 justify-between">
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
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
          <div className="h-4 w-px bg-t-border-soft mx-2" />
          <span className="material-symbols-outlined text-text-muted cursor-pointer hover:text-text-main">
            monitoring
          </span>
          <span className="material-symbols-outlined text-text-muted cursor-pointer hover:text-text-main">
            brush
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="t-label-caps text-text-muted">BTC/USDC</span>
          <span className="t-data-sm text-text-price">
            O: 65,300 H: 65,540 L: 65,220 C: 65,432
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
