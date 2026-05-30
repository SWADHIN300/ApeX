'use client'
import AppShell from '@/components/layout/AppShell'
import { MOCK_STATS, MOCK_MONTHLY_PNL } from '@/lib/mock-data'
import { TrendingUp, TrendingDown, Target, Zap, Shield, Award } from 'lucide-react'

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'text-on-surface',
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-surface border border-outline-variant p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-on-surface-variant" />
        <span className="text-label-caps font-ui text-on-surface-variant">{label}</span>
      </div>
      <span className={`font-data text-data-lg ${color}`}>{value}</span>
      {sub && <span className="font-data text-data-sm text-on-surface-variant">{sub}</span>}
    </div>
  )
}

export default function StatsPage() {
  const s = MOCK_STATS
  const maxAbs = Math.max(...MOCK_MONTHLY_PNL.map((d) => Math.abs(d.pnl)))

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-ui text-headline-md text-on-surface">Analytics & Stats</h1>
          <p className="font-ui text-body-sm text-on-surface-variant mt-0.5">Your trading performance breakdown</p>
        </div>

        {/* Win rate hero */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1 bg-surface border border-outline-variant p-6 flex flex-col items-center justify-center gap-2">
            {/* Radial win rate */}
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--outline-variant)" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="40"
                  fill="none"
                  stroke="var(--long)"
                  strokeWidth="8"
                  strokeDasharray={`${(s.winRate / 100) * 251.2} 251.2`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-data text-data-lg text-long">{s.winRate}%</span>
                <span className="text-label-caps font-ui text-on-surface-variant">Win Rate</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 grid grid-cols-2 gap-4">
            <MetricCard icon={TrendingUp}   label="Total Volume"    value={`$${s.totalVolume}`} />
            <MetricCard icon={Zap}          label="Total Trades"    value={s.totalTrades} />
            <MetricCard icon={TrendingUp}   label="Avg Win"         value={`+$${s.avgWin}`}    color="text-long" />
            <MetricCard icon={TrendingDown} label="Avg Loss"        value={`$${s.avgLoss}`}     color="text-short" />
          </div>
        </div>

        {/* Advanced stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard icon={Award}  label="Profit Factor"  value={s.profitFactor.toFixed(2)} color="text-long" />
          <MetricCard icon={Shield} label="Max Drawdown"   value={`${s.maxDrawdown}%`}       color="text-short" />
          <MetricCard icon={Target} label="Sharpe Ratio"   value={s.sharpeRatio.toFixed(2)}  color="text-on-surface" />
          <MetricCard icon={Zap}    label="Avg Hold Time"  value={s.avgHoldTime} />
          <MetricCard icon={TrendingUp}   label="Best Trade"  value={`+$${s.bestTrade.toLocaleString()}`} color="text-long" />
          <MetricCard icon={TrendingDown} label="Worst Trade" value={`-$${Math.abs(s.worstTrade)}`}      color="text-short" />
          <MetricCard icon={Shield} label="Fees Paid"      value={`$${s.totalFeesPaid}`} />
          <MetricCard icon={Target} label="Total Trades"   value={s.totalTrades} />
        </div>

        {/* Monthly PnL bar chart */}
        <div className="bg-surface border border-outline-variant p-5">
          <h2 className="text-label-caps font-ui text-on-surface-variant mb-5">Monthly PnL</h2>
          <div className="flex items-end gap-3 h-36">
            {MOCK_MONTHLY_PNL.map((d) => {
              const frac = Math.abs(d.pnl) / maxAbs
              const isPos = d.pnl >= 0
              return (
                <div key={d.month} className="flex flex-col items-center gap-1 flex-1">
                  <span className={`font-data text-data-sm ${isPos ? 'text-long' : 'text-short'}`}>
                    {isPos ? '+' : '-'}${Math.abs(d.pnl)}
                  </span>
                  <div className="w-full flex flex-col justify-end" style={{ height: '80px' }}>
                    <div
                      className={`w-full transition-all ${isPos ? 'bg-long/70' : 'bg-short/70'}`}
                      style={{ height: `${frac * 80}px` }}
                    />
                  </div>
                  <span className="text-label-caps font-ui text-on-surface-variant">{d.month}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
