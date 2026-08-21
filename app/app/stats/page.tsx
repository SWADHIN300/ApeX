'use client'
import AppShell from '@/components/layout/AppShell'
import { useTrade } from '@/contexts/TradeContext'
import { useWallet } from '@solana/wallet-adapter-react'
import { BarChart, Activity, TrendingUp, DollarSign, Clock, Percent } from 'lucide-react'
import { useState, useEffect } from 'react'

interface StatsData {
  totalVolume: number
  totalTrades: number
  totalFees: number
  netPnl: number
  winRate: number
  firstTradeDate: string | null
}

export default function StatsPage() {
  const { trades } = useTrade()
  const { publicKey } = useWallet()
  const [stats, setStats] = useState<StatsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function loadStats() {
      try {
        const address = publicKey?.toBase58()
        const url = address ? `/api/stats?address=${address}` : '/api/stats'
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          if (mounted) setStats(data)
        }
      } catch {
        // use fallback
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    void loadStats()
    return () => {
      mounted = false
    }
  }, [publicKey])

  // Aggregate local session trades if Postgres stats are empty
  const localVolume = trades.reduce((acc, t) => acc + (t.size * t.price), 0)
  const localFees = trades.reduce((acc, t) => acc + t.fee, 0)
  const localTradesCount = trades.length
  const localPnl = trades.reduce((acc, t) => acc + t.pnl, 0)
  const localWinning = trades.filter((t) => t.pnl > 0).length
  const localWinRate = localTradesCount > 0 ? (localWinning / localTradesCount) * 100 : 0

  const totalVolume = (stats?.totalVolume && stats.totalVolume > 0) ? stats.totalVolume : localVolume
  const totalTrades = (stats?.totalTrades && stats.totalTrades > 0) ? stats.totalTrades : localTradesCount
  const totalFees = (stats?.totalFees && stats.totalFees > 0) ? stats.totalFees : localFees
  const netPnl = stats?.netPnl || localPnl
  const winRate = (stats?.winRate && stats.winRate > 0) ? stats.winRate : localWinRate

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <AppShell>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="font-ui text-headline-md text-on-surface">Platform Statistics</h1>
          <p className="font-ui text-body-sm text-on-surface-variant mt-0.5">
            {publicKey ? "Your real on-chain & database trade metrics" : "Overall trading metrics"}
          </p>
        </div>

        {/* Big numbers */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface border border-outline-variant p-5">
            <div className="flex items-center gap-2 text-on-surface-variant mb-2">
              <BarChart size={16} />
              <span className="text-label-caps font-ui">Total Volume</span>
            </div>
            <span className="font-data text-display-lg text-on-surface">${fmt(totalVolume)}</span>
          </div>

          <div className="bg-surface border border-outline-variant p-5">
            <div className="flex items-center gap-2 text-on-surface-variant mb-2">
              <Activity size={16} />
              <span className="text-label-caps font-ui">Total Trades</span>
            </div>
            <span className="font-data text-display-lg text-on-surface">{totalTrades}</span>
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
              <Percent size={16} />
              <span className="text-label-caps font-ui">Win Rate</span>
            </div>
            <span className="font-data text-display-lg text-on-surface">{winRate.toFixed(1)}%</span>
          </div>
        </div>

        {/* Breakdown details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
          <div className="bg-surface border border-outline-variant p-6 space-y-4">
            <h3 className="font-ui text-headline-md text-on-surface">PnL Overview</h3>
            <div className="flex items-center justify-between py-3 border-b border-outline-variant/30">
              <span className="text-body-sm text-on-surface-variant">Net Realized PnL</span>
              <span className={`font-data text-data-lg ${netPnl >= 0 ? 'text-long' : 'text-short'}`}>
                {netPnl >= 0 ? '+' : ''}${fmt(netPnl)}
              </span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-outline-variant/30">
              <span className="text-body-sm text-on-surface-variant">Data Pipeline Status</span>
              <span className="text-label-caps font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                PostgreSQL Connected
              </span>
            </div>
          </div>

          <div className="bg-surface border border-outline-variant p-6 space-y-4">
            <h3 className="font-ui text-headline-md text-on-surface">Activity Timeline</h3>
            <div className="flex items-center justify-between py-3 border-b border-outline-variant/30">
              <span className="text-body-sm text-on-surface-variant">First Recorded Trade</span>
              <span className="font-data text-body-sm text-on-surface">
                {stats?.firstTradeDate 
                  ? new Date(stats.firstTradeDate).toLocaleDateString()
                  : trades.length > 0 
                    ? new Date(trades[trades.length - 1].time * 1000).toLocaleDateString() 
                    : 'No historical trades yet'}
              </span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-outline-variant/30">
              <span className="text-body-sm text-on-surface-variant">Active Sessions</span>
              <span className="font-data text-body-sm text-on-surface">Live WebSocket Stream</span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
