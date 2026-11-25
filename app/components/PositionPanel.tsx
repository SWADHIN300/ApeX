"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, FlaskConical } from "lucide-react";
import { usePositions } from "@/hooks/usePositions";
import { useTrade } from "@/contexts/TradeContext";
import { usePaperTrading } from "@/contexts/PaperTradingContext";
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
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeError, setCloseError] = useState("");
  const positions = usePositions();
  const { trades, closePosition } = useTrade();
  const { isPaperTrading, paperPositions, paperTrades, closePaperPosition } = usePaperTrading();
  const { market } = useMarket();

  // In paper mode, show paper positions/trades; otherwise show real ones
  const activePositions = isPaperTrading ? paperPositions : positions;
  const activeTrades = isPaperTrading ? paperTrades : trades;

  const handleClose = async (id: string) => {
    const pos = activePositions.find((p) => p.id === id);
    if (!pos) return;

    const closePrice = pos.pair === market?.symbol && market?.price ? market.price : pos.markPrice;
    setClosingId(id);
    setCloseError("");
    try {
      if (isPaperTrading) {
        closePaperPosition(id, closePrice);
      } else {
        await closePosition(id, closePrice);
      }
    } catch (error) {
      setCloseError(error instanceof Error ? error.message : "Could not close position.");
    } finally {
      setClosingId(null);
    }
  };

  return (
    <section
      className={`col-span-12 min-h-0 min-w-0 b-thin border-t-0 bg-bg-surface overflow-hidden transition-[height] duration-300 ${
        isOpen ? "h-64" : "h-9"
      }`}
    >
      {/* Tab row */}
      <div className="h-9 bb-thin flex items-center justify-between gap-2 bg-bg-l1 px-2 sm:px-3">
        <div className="flex h-full min-w-0 items-center gap-0.5 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`h-full shrink-0 border-b-2 px-2.5 text-[10px] font-mono font-semibold uppercase tracking-wider transition-colors sm:px-3 ${
                activeTab === tab
                  ? "border-primary bg-bg-l2 text-text-main"
                  : "border-transparent text-text-muted hover:bg-bg-l2/70 hover:text-text-main"
              }`}
            >
              {tab}
              {tab === "Positions" && ` (${activePositions.length})`}
              {tab === "History" && ` (${activeTrades.length})`}
              {tab === "Open Orders" && " (0)"}
            </button>
          ))}
        </div>
        <button
          onClick={onToggle}
          className="flex h-7 w-7 shrink-0 items-center justify-center border border-t-border bg-bg-l1 text-text-muted transition-colors hover:bg-bg-l3 hover:text-text-main focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          aria-label={isOpen ? "Hide positions panel" : "Show positions panel"}
          title={isOpen ? "Hide positions panel" : "Show positions panel"}
          type="button"
        >
          {isOpen ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
        </button>
      </div>

      {/* Content */}
      <div
        className={`overflow-x-auto overflow-y-auto h-[calc(100%-36px)] no-scrollbar transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {closeError && <p role="alert" className="px-4 py-2 text-sm text-text-error">{closeError}</p>}
        {activeTab === "Positions" && (
          <table className="w-full min-w-[760px] bg-bg-surface text-left">
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
                    className="px-3 py-2 text-[9px] font-mono font-semibold uppercase tracking-wider text-text-muted"
                  >
                    {col}
                  </th>
                ))}
                <th className="px-3 py-2 text-right text-[9px] font-mono font-semibold uppercase tracking-wider text-text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {activePositions.map((pos) => (
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
                      {pos.id.startsWith("onchain-") && (
                        <span className="text-[9px] px-1 py-0.2 rounded font-mono font-medium text-[#1d9e75] bg-[#1d9e75]/15 border border-[#1d9e75]/30">
                          ON-CHAIN PDA
                        </span>
                      )}
                      {pos.id.startsWith("paper-") && (
                        <span className="text-[9px] px-1 py-0.2 rounded font-mono font-medium text-amber-400 bg-amber-400/15 border border-amber-400/30 flex items-center gap-0.5">
                          <FlaskConical size={8} /> PAPER
                        </span>
                      )}
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
                        onClick={() => void handleClose(pos.id)}
                        disabled={closingId !== null}
                        className="px-3 py-1 bg-bg-l3 border border-t-border-soft t-label-caps text-text-muted hover:bg-text-error/20 hover:text-text-error transition-all disabled:opacity-50"
                      >
                        {closingId === pos.id ? "Closing…" : "Close"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {activePositions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center">
                    <p className="text-xs font-medium text-text-main">No open positions</p>
                    <p className="mt-1 text-[10px] text-text-muted">Positions will appear here when you open a trade.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === "History" && (
          <table className="w-full min-w-[760px] bg-bg-surface text-left">
            <thead className="bg-bg-l2 bb-thin sticky top-0 z-10">
              <tr>
                {["Time", "Pair", "Side", "Size", "Price", "Fee", "PnL"].map((col) => (
                  <th key={col} className="px-3 py-2 text-[9px] font-mono font-semibold uppercase tracking-wider text-text-muted">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeTrades.map((t) => (
                <tr key={t.id + t.time} className="hover:bg-bg-l2 transition-colors bb-thin">
                  <td className="px-4 py-2 t-data-sm text-text-muted">
                    {new Date(t.time * 1000).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 t-data-sm text-text-main">{t.pair}</td>
                  <td className={`px-4 py-2 t-data-sm ${t.side === 'Long' ? 'text-long' : 'text-short'}`}>
                    {t.side}
                    {t.id.startsWith("paper-") && (
                      <span className="ml-1 text-[9px] px-1 rounded font-mono text-amber-400 bg-amber-400/15 border border-amber-400/30">SIM</span>
                    )}
                  </td>
                  <td className="px-4 py-2 t-data-sm text-text-main">{t.size.toFixed(4)}</td>
                  <td className="px-4 py-2 t-data-sm text-text-muted">${t.price.toFixed(2)}</td>
                  <td className="px-4 py-2 t-data-sm text-text-muted">${t.fee.toFixed(2)}</td>
                  <td className={`px-4 py-2 t-data-sm ${t.pnl >= 0 ? 'text-long' : 'text-short'}`}>
                    {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                  </td>
                </tr>
              ))}
              {activeTrades.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center">
                    <p className="text-xs font-medium text-text-main">No trade history</p>
                    <p className="mt-1 text-[10px] text-text-muted">Completed trades will appear here.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === "Open Orders" && (
          <div className="flex h-full min-h-[160px] items-center justify-center bg-bg-surface">
            <div className="text-center">
              <p className="text-xs font-medium text-text-main">No open orders</p>
              <p className="mt-1 text-[10px] text-text-muted">Resting orders will appear here.</p>
            </div>
          </div>
        )}

        {activeTab === "Trade Logs" && (
          <div className="flex h-full min-h-[160px] items-center justify-center bg-bg-surface">
            <div className="text-center">
              <p className="text-xs font-medium text-text-main">No trade logs</p>
              <p className="mt-1 text-[10px] text-text-muted">Trade activity will appear here.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
