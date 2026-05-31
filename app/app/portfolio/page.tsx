'use client'
import AppShell from '@/components/layout/AppShell'
import { useTrade } from '@/contexts/TradeContext'
import { useMarket } from '@/contexts/MarketContext'
import { PieChart, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react'

export default function PortfolioPage() {
  const { portfolio, positions, trades } = useTrade()
  const { market } = useMarket() // just to subscribe to market updates in the background for PnL

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const isPos = portfolio.totalPnl >= 0

  return (
    <AppShell>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-ui text-headline-md text-on-surface">Portfolio overview</h1>
          <p className="font-ui text-body-sm text-on-surface-variant mt-0.5">
            Your performance and balances across all markets
          </p>
        </div>

        {/* Hero stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1 bg-surface border border-outline-variant p-5">
            <span className="text-label-caps font-ui text-on-surface-variant">Total Value</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-data text-display-lg text-on-surface">${fmt(portfolio.totalValue)}</span>
              <span className="text-label-caps font-ui text-on-surface-variant">USDC</span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className={`flex items-center gap-1 font-data text-data-md ${isPos ? 'text-long' : 'text-short'}`}>
                {isPos ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {isPos ? '+' : ''}${fmt(portfolio.totalPnl)}
              </span>
              <span className={`text-label-caps font-ui px-1.5 py-0.5 ${isPos ? 'bg-long/10 text-long' : 'bg-short/10 text-short'}`}>
                {isPos ? '+' : ''}{portfolio.totalPnlPct.toFixed(2)}% All time
              </span>
            </div>
          </div>
          <div className="md:col-span-2 grid grid-cols-2 gap-4">
            <div className="bg-surface border border-outline-variant p-5 flex flex-col justify-between">
              <span className="text-label-caps font-ui text-on-surface-variant">Available Margin</span>
              <span className="font-data text-headline-md text-on-surface">${fmt(portfolio.availableMargin)}</span>
            </div>
            <div className="bg-surface border border-outline-variant p-5 flex flex-col justify-between">
              <span className="text-label-caps font-ui text-on-surface-variant">Used Margin</span>
              <span className="font-data text-headline-md text-on-surface">${fmt(portfolio.usedMargin)}</span>
            </div>
            <div className="bg-surface border border-outline-variant p-5 flex flex-col justify-between">
              <span className="text-label-caps font-ui text-on-surface-variant">Unrealized PnL</span>
              <span className={`font-data text-headline-md ${portfolio.unrealizedPnl >= 0 ? 'text-long' : 'text-short'}`}>
                {portfolio.unrealizedPnl >= 0 ? '+' : ''}${fmt(portfolio.unrealizedPnl)}
              </span>
            </div>
            <div className="bg-surface border border-outline-variant p-5 flex flex-col justify-between">
              <span className="text-label-caps font-ui text-on-surface-variant">Open Positions</span>
              <span className="font-data text-headline-md text-on-surface">{positions.length}</span>
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
                <span className="font-data text-data-md text-on-surface">${fmt(portfolio.availableMargin)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-outline" />
                  <span className="font-ui text-body-sm text-on-surface">Used Margin</span>
                </div>
                <span className="font-data text-data-md text-on-surface">${fmt(portfolio.usedMargin)}</span>
              </div>
              {/* Progress bar */}
              <div className="h-2 w-full bg-outline-variant mt-4 flex overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all" 
                  style={{ width: `${(portfolio.availableMargin / (portfolio.availableMargin + portfolio.usedMargin || 1)) * 100}%` }} 
                />
                <div 
                  className="bg-outline h-full transition-all" 
                  style={{ width: `${(portfolio.usedMargin / (portfolio.availableMargin + portfolio.usedMargin || 1)) * 100}%` }} 
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
              {trades.slice(0, 5).map((t, i) => (
                <div key={t.id + i} className="p-3 flex items-center justify-between">
                  <div>
                    <span className="font-ui text-body-sm text-on-surface block">
                      {t.status} {t.side} {t.pair}
                    </span>
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
              {trades.length === 0 && (
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
