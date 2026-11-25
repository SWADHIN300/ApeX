'use client'
import AppShell from '@/components/layout/AppShell'
import { useTrade } from '@/contexts/TradeContext'
import { usePaperTrading } from '@/contexts/PaperTradingContext'
import { PieChart, Wallet, ArrowUpRight, ArrowDownRight, FlaskConical } from 'lucide-react'

export default function PortfolioPage() {
  const { portfolio, positions, trades } = useTrade()
  const { isPaperTrading, paperPortfolio, paperPositions, paperTrades, resetPaperAccount } = usePaperTrading()

  const activePortfolio = isPaperTrading ? paperPortfolio : portfolio
  const activePositions = isPaperTrading ? paperPositions : positions
  const activeTrades = isPaperTrading ? paperTrades : trades

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const isPos = activePortfolio.totalPnl >= 0

  return (
    <AppShell>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-ui text-headline-md text-on-surface">Portfolio overview</h1>
              {isPaperTrading && (
                <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-amber-400/15 border border-amber-400/30 text-amber-400 font-medium">
                  <FlaskConical size={12} /> PAPER TRADING
                </span>
              )}
            </div>
            <p className="font-ui text-body-sm text-on-surface-variant mt-0.5">
              {isPaperTrading
                ? "Simulated performance and virtual balances on Solana Devnet"
                : "Your performance and balances across all markets"}
            </p>
          </div>
          {isPaperTrading && (
            <button
              onClick={resetPaperAccount}
              className="px-3 py-1.5 border border-amber-400/40 text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 rounded text-label-caps font-ui transition-colors text-xs self-start sm:self-auto"
            >
              Reset Virtual Balance
            </button>
          )}
        </div>

        {/* Hero stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1 bg-surface border border-outline-variant p-5">
            <span className="text-label-caps font-ui text-on-surface-variant">
              {isPaperTrading ? "Virtual Total Value" : "Total Value"}
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-data text-display-lg text-on-surface">${fmt(activePortfolio.totalValue)}</span>
              <span className="text-label-caps font-ui text-on-surface-variant">USDC</span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className={`flex items-center gap-1 font-data text-data-md ${isPos ? 'text-long' : 'text-short'}`}>
                {isPos ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {isPos ? '+' : ''}${fmt(activePortfolio.totalPnl)}
              </span>
              <span className={`text-label-caps font-ui px-1.5 py-0.5 ${isPos ? 'bg-long/10 text-long' : 'bg-short/10 text-short'}`}>
                {isPos ? '+' : ''}{activePortfolio.totalPnlPct.toFixed(2)}% All time
              </span>
            </div>
          </div>
          <div className="md:col-span-2 grid grid-cols-2 gap-4">
            <div className="bg-surface border border-outline-variant p-5 flex flex-col justify-between">
              <span className="text-label-caps font-ui text-on-surface-variant">Available Margin</span>
              <span className="font-data text-headline-md text-on-surface">${fmt(activePortfolio.availableMargin)}</span>
            </div>
            <div className="bg-surface border border-outline-variant p-5 flex flex-col justify-between">
              <span className="text-label-caps font-ui text-on-surface-variant">Used Margin</span>
              <span className="font-data text-headline-md text-on-surface">${fmt(activePortfolio.usedMargin)}</span>
            </div>
            <div className="bg-surface border border-outline-variant p-5 flex flex-col justify-between">
              <span className="text-label-caps font-ui text-on-surface-variant">Unrealized PnL</span>
              <span className={`font-data text-headline-md ${activePortfolio.unrealizedPnl >= 0 ? 'text-long' : 'text-short'}`}>
                {activePortfolio.unrealizedPnl >= 0 ? '+' : ''}${fmt(activePortfolio.unrealizedPnl)}
              </span>
            </div>
            <div className="bg-surface border border-outline-variant p-5 flex flex-col justify-between">
              <span className="text-label-caps font-ui text-on-surface-variant">Open Positions</span>
              <span className="font-data text-headline-md text-on-surface">{activePositions.length}</span>
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
          <div className="space-y-4">
            <h2 className="font-ui text-headline-md text-on-surface flex items-center gap-2">
              <PieChart size={18} className="text-on-surface-variant" />
              Margin Breakdown
            </h2>
            <div className="bg-surface border border-outline-variant p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-primary" />
                  <span className="font-ui text-body-sm text-on-surface">Available Margin</span>
                </div>
                <span className="font-data text-data-md text-on-surface">${fmt(activePortfolio.availableMargin)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-outline" />
                  <span className="font-ui text-body-sm text-on-surface">Used Margin</span>
                </div>
                <span className="font-data text-data-md text-on-surface">${fmt(activePortfolio.usedMargin)}</span>
              </div>
              {/* Progress bar */}
              <div className="h-2 w-full bg-outline-variant mt-4 flex overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all" 
                  style={{ width: `${(activePortfolio.availableMargin / (activePortfolio.availableMargin + activePortfolio.usedMargin || 1)) * 100}%` }}
                />
                <div 
                  className="bg-outline h-full transition-all" 
                  style={{ width: `${(activePortfolio.usedMargin / (activePortfolio.availableMargin + activePortfolio.usedMargin || 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="font-ui text-headline-md text-on-surface flex items-center gap-2">
              <Wallet size={18} className="text-on-surface-variant" />
              Recent Activity
            </h2>
            <div className="bg-surface border border-outline-variant divide-y divide-outline-variant/40">
              {activeTrades.slice(0, 5).map((t, i) => (
                <div key={t.id + i} className="p-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-ui text-body-sm text-on-surface">
                        {t.status} {t.side} {t.pair}
                      </span>
                      {t.id.startsWith("paper-") && (
                        <span className="text-[9px] px-1 rounded font-mono text-amber-400 bg-amber-400/15 border border-amber-400/30">
                          SIM
                        </span>
                      )}
                    </div>
                    <span className="font-ui text-body-sm text-on-surface-variant">
                      {new Date(t.time * 1000).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`font-data text-data-md block ${t.pnl >= 0 ? 'text-long' : 'text-short'}`}>
                      {t.pnl >= 0 ? '+' : ''}${fmt(t.pnl)}
                    </span>
                  </div>
                </div>
              ))}
              {activeTrades.length === 0 && (
                <div className="p-8 text-center font-ui text-body-sm text-on-surface-variant">
                  No recent activity
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
