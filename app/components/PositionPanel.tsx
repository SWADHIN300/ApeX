"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { usePositions } from "@/hooks/usePositions";
import { useTrade } from "@/contexts/TradeContext";
import { useMarket } from "@/contexts/MarketContext";

type Tab = "Positions" | "Open Orders" | "History" | "Trade Logs";

const tabs: Tab[] = ["Positions", "Open Orders", "History", "Trade Logs"];

export default function PositionPanel({
  isOpen = true,
  onToggle,
}: {
  isOpen?: boolean;
  onToggle?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("Positions");
  const positions = usePositions();
  const { trades, closePosition } = useTrade();
  const { market } = useMarket();

  const handleClose = (id: string) => {
    // We assume current market price if closing active pair, else wait, to be perfectly accurate we'd fetch the exact price of the pair being closed.
    // Since this is a demo, if the position is the active market, use market.price, else use position's markPrice.
    const pos = positions.find((p) => p.id === id);
    if (!pos) return;
    
    const closePrice = (pos.pair === market?.symbol && market?.price) ? market.price : pos.markPrice;
    closePosition(id, closePrice);
  };

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
              {tab === "History" && ` (${trades.length})`}
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

      {/* Content */}
      <div
        className={`overflow-x-auto overflow-y-auto h-[calc(100%-44px)] no-scrollbar transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {activeTab === "Positions" && (
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-bg-l2 bb-thin sticky top-0 z-10">
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
              {positions.map((pos) => (
                <tr key={pos.id} className="hover:bg-bg-l2 transition-colors bb-thin">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${pos.side === 'Long' ? 'bg-long' : 'bg-short'}`} />
                      <span className="t-data-md text-text-main">{pos.pair}</span>
                      <span
                        className={`t-label-caps px-1 ${pos.side === 'Long' ? 'text-long' : 'text-short'}`}
                        style={{ background: pos.side === 'Long' ? "rgba(29,158,117,0.1)" : "rgba(216,90,48,0.1)" }}
                      >
                        {pos.side} {pos.leverage}x
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 t-data-md text-text-main">
                    {pos.size.toFixed(4)}
                  </td>
                  <td className="px-4 py-3 t-data-md text-text-muted">
                    ${pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 t-data-md text-text-muted">
                    ${pos.markPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 t-data-md text-text-error">
                    ${pos.liqPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className={`t-data-md ${pos.pnl >= 0 ? 'text-long' : 'text-short'}`}>
                        {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                      </span>
                      <span className={`t-data-sm ${pos.pnl >= 0 ? 'text-long' : 'text-short'}`}>
                        ({pos.roi >= 0 ? '+' : ''}{pos.roi.toFixed(2)}%)
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="px-3 py-1 bg-bg-l3 border border-t-border-soft t-label-caps text-text-muted hover:bg-bg-l4">
                        TP/SL
                      </button>
                      <button 
                        onClick={() => handleClose(pos.id)}
                        className="px-3 py-1 bg-bg-l3 border border-t-border-soft t-label-caps text-text-muted hover:bg-text-error/20 hover:text-text-error transition-all"
                      >
                        Close
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {positions.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 t-body-sm text-text-muted">
                    No open positions
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === "History" && (
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-bg-l2 bb-thin sticky top-0 z-10">
              <tr>
                {["Time", "Pair", "Side", "Size", "Price", "Fee", "PnL"].map((col) => (
                  <th key={col} className="px-4 py-2 t-label-caps text-text-muted">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id + t.time} className="hover:bg-bg-l2 transition-colors bb-thin">
                  <td className="px-4 py-2 t-data-sm text-text-muted">
                    {new Date(t.time * 1000).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 t-data-sm text-text-main">{t.pair}</td>
                  <td className={`px-4 py-2 t-data-sm ${t.side === 'Long' ? 'text-long' : 'text-short'}`}>
                    {t.side}
                  </td>
                  <td className="px-4 py-2 t-data-sm text-text-main">{t.size.toFixed(4)}</td>
                  <td className="px-4 py-2 t-data-sm text-text-muted">${t.price.toFixed(2)}</td>
                  <td className="px-4 py-2 t-data-sm text-text-muted">${t.fee.toFixed(2)}</td>
                  <td className={`px-4 py-2 t-data-sm ${t.pnl >= 0 ? 'text-long' : 'text-short'}`}>
                    {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                  </td>
                </tr>
              ))}
              {trades.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 t-body-sm text-text-muted">
                    No trade history
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === "Open Orders" && (
          <div className="flex items-center justify-center h-full min-h-[160px]">
            <span className="t-body-sm text-text-muted">No open orders</span>
          </div>
        )}

        {activeTab === "Trade Logs" && (
          <div className="flex items-center justify-center h-full min-h-[160px]">
            <span className="t-body-sm text-text-muted">No trade logs available</span>
          </div>
        )}
      </div>
    </section>
  );
}
