"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type Tab = "Positions" | "Open Orders" | "History" | "Trade Logs";

interface Position {
  pair: string;
  side: string;
  leverage: string;
  size: string;
  entryPrice: string;
  markPrice: string;
  liqPrice: string;
  pnl: string;
  pnlPct: string;
  positive: boolean;
}

const positions: Position[] = [
  {
    pair: "BTC-PERP",
    side: "Long",
    leverage: "10x",
    size: "0.500 BTC",
    entryPrice: "$64,000.00",
    markPrice: "$65,432.10",
    liqPrice: "$57,600.00",
    pnl: "+$716.05",
    pnlPct: "(+12.50%)",
    positive: true,
  },
];

const tabs: Tab[] = ["Positions", "Open Orders", "History", "Trade Logs"];

export default function PositionPanel({
  isOpen = true,
  onToggle,
}: {
  isOpen?: boolean;
  onToggle?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("Positions");

  return (
    <section
      className={`col-span-12 min-h-0 min-w-0 b-thin border-t-0 bg-bg-l1 overflow-hidden transition-[height] duration-300 ${
        isOpen ? "h-64" : "h-11"
      }`}
    >
      {/* Tab row */}
      <div className="h-11 bb-thin flex items-center justify-between gap-3 px-4">
        <div className="flex h-full min-w-0 items-center gap-6 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`t-label-caps h-full shrink-0 px-2 transition-colors ${
                activeTab === tab
                  ? "text-text-main border-b-2 border-primary"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              {tab}
              {tab === "Positions" && ` (${positions.length})`}
              {tab === "Open Orders" && " (0)"}
            </button>
          ))}
        </div>
        <button
          onClick={onToggle}
          className="h-8 w-8 flex shrink-0 items-center justify-center b-thin bg-bg-l1 text-text-muted hover:bg-bg-l4 hover:text-text-main"
          aria-label={isOpen ? "Hide positions panel" : "Show positions panel"}
          title={isOpen ? "Hide positions panel" : "Show positions panel"}
          type="button"
        >
          {isOpen ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
        </button>
      </div>

      {/* Table */}
      <div
        className={`overflow-x-auto no-scrollbar transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <table className="w-full min-w-[760px] text-left">
          <thead className="bg-bg-l2 bb-thin">
            <tr>
              {[
                "Position",
                "Size",
                "Entry Price",
                "Mark Price",
                "Liq. Price",
                "PnL (ROI%)",
              ].map((col) => (
                <th
                  key={col}
                  className="px-4 py-2 t-label-caps text-text-muted"
                >
                  {col}
                </th>
              ))}
              <th className="px-4 py-2 t-label-caps text-text-muted text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos, i) => (
              <tr key={i} className="hover:bg-bg-l2 transition-colors bb-thin">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-long" />
                    <span className="t-data-md text-text-main">{pos.pair}</span>
                    <span
                      className="t-label-caps px-1 text-long"
                      style={{ background: "rgba(29,158,117,0.1)" }}
                    >
                      {pos.side} {pos.leverage}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 t-data-md text-text-main">
                  {pos.size}
                </td>
                <td className="px-4 py-3 t-data-md text-text-muted">
                  {pos.entryPrice}
                </td>
                <td className="px-4 py-3 t-data-md text-text-muted">
                  {pos.markPrice}
                </td>
                <td className="px-4 py-3 t-data-md text-text-error">
                  {pos.liqPrice}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="t-data-md text-long">{pos.pnl}</span>
                    <span className="t-data-sm text-long">{pos.pnlPct}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="px-3 py-1 bg-bg-l3 border border-t-border-soft t-label-caps text-text-muted hover:bg-bg-l4">
                      TP/SL
                    </button>
                    <button className="px-3 py-1 bg-bg-l3 border border-t-border-soft t-label-caps text-text-muted hover:bg-text-error/20 hover:text-text-error transition-all">
                      Close
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
