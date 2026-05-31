'use client'
import AppShell from '@/components/layout/AppShell'
import { useTrade } from '@/contexts/TradeContext'
import { BarChart, Activity, TrendingUp, Users, DollarSign, Clock } from 'lucide-react'

export default function StatsPage() {
  const { trades } = useTrade()

  const totalVolume = trades.reduce((acc, t) => acc + (t.size * t.price), 0)
  const totalFees = trades.reduce((acc, t) => acc + t.fee, 0)
  const tradesCount = trades.length

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <AppShell>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="font-ui text-headline-md text-on-surface">Platform Statistics</h1>
          <p className="font-ui text-body-sm text-on-surface-variant mt-0.5">
            Your trading activity overview
          </p>
        </div>

        {/* Big numbers */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface border border-outline-variant p-5">
            <div className="flex items-center gap-2 text-on-surface-variant mb-2">
              <BarChart size={16} />
              <span className="text-label-caps font-ui">Your Total Volume</span>
            </div>
            <span className="font-data text-display-lg text-on-surface">${fmt(totalVolume)}</span>
          </div>

          <div className="bg-surface border border-outline-variant p-5">
            <div className="flex items-center gap-2 text-on-surface-variant mb-2">
              <Activity size={16} />
              <span className="text-label-caps font-ui">Total Trades</span>
            </div>
            <span className="font-data text-display-lg text-on-surface">{tradesCount}</span>
          </div>

          <div className="bg-surface border border-outline-variant p-5">
            <div className="flex items-center gap-2 text-on-surface-variant mb-2">
              <DollarSign size={16} />
              <span className="text-label-caps font-ui">Fees Paid</span>
            </div>
            <span className="font-data text-display-lg text-on-surface">${fmt(totalFees)}</span>
          </div>
          
          <div className="bg-surface border border-outline-variant p-5">
            <div className="flex items-center gap-2 text-on-surface-variant mb-2">
              <Clock size={16} />
              <span className="text-label-caps font-ui">Active Since</span>
            </div>
            <span className="font-data text-headline-md text-on-surface mt-2 block">
              {trades.length > 0 ? new Date(trades[trades.length - 1].time * 1000).toLocaleDateString() : 'Today'}
            </span>
          </div>
        </div>

        {/* Charts placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
          <div className="bg-surface border border-outline-variant">
            <div className="px-6 py-4 border-b border-outline-variant">
              <h3 className="font-ui text-headline-md text-on-surface">Volume History</h3>
            </div>
            <div className="p-6 h-64 flex items-center justify-center flex-col gap-2 border-t border-outline-variant/30">
              <BarChart size={32} className="text-outline-variant" />
              <span className="text-body-sm font-ui text-on-surface-variant">Chart generation in progress...</span>
            </div>
          </div>

          <div className="bg-surface border border-outline-variant">
            <div className="px-6 py-4 border-b border-outline-variant">
              <h3 className="font-ui text-headline-md text-on-surface">PnL Distribution</h3>
            </div>
            <div className="p-6 h-64 flex items-center justify-center flex-col gap-2 border-t border-outline-variant/30">
              <TrendingUp size={32} className="text-outline-variant" />
              <span className="text-body-sm font-ui text-on-surface-variant">Gathering trade data...</span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
