'use client'
import AppShell from '@/components/layout/AppShell'
import {
  MOCK_PORTFOLIO,
  MOCK_PORTFOLIO_POSITIONS,
  MOCK_PORTFOLIO_HISTORY,
} from '@/lib/mock-data'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  BarChart2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'

function StatCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string
  value: string
  sub?: string
  positive?: boolean
}) {
  return (
    <div className="bg-surface border border-outline-variant p-4 flex flex-col gap-1">
      <span className="text-label-caps font-ui text-on-surface-variant">{label}</span>
      <span className={`font-data text-data-lg ${positive === true ? 'text-long' : positive === false ? 'text-short' : 'text-on-surface'}`}>
        {value}
      </span>
      {sub && <span className="font-data text-data-sm text-on-surface-variant">{sub}</span>}
    </div>
  )
}

export default function PortfolioPage() {
  const p = MOCK_PORTFOLIO

  // Mini sparkline from history (SVG)
  const maxVal = Math.max(...MOCK_PORTFOLIO_HISTORY.map((d) => d.value))
  const minVal = Math.min(...MOCK_PORTFOLIO_HISTORY.map((d) => d.value))
  const W = 240
  const H = 60
  const pts = MOCK_PORTFOLIO_HISTORY.map((d, i) => {
    const x = (i / (MOCK_PORTFOLIO_HISTORY.length - 1)) * W
    const y = H - ((d.value - minVal) / (maxVal - minVal)) * H
    return `${x},${y}`
  }).join(' ')

  return (
    <AppShell>
      <div className="p-6 space-y-6 min-h-full">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-ui text-headline-md text-on-surface">Portfolio</h1>
            <p className="font-ui text-body-sm text-on-surface-variant mt-0.5">
              Your trading positions and performance overview
            </p>
          </div>
          <button className="bg-long text-white px-4 py-2 text-label-caps font-ui hover:opacity-90 transition-opacity">
            + Deposit
          </button>
        </div>

        {/* Hero value */}
        <div className="bg-surface border border-outline-variant p-6 flex items-center justify-between">
          <div>
            <span className="text-label-caps font-ui text-on-surface-variant">Total Portfolio Value</span>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="font-data text-display-lg text-on-surface">
                ${p.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className={`flex items-center gap-1 font-data text-data-md ${p.totalPnl >= 0 ? 'text-long' : 'text-short'}`}>
                {p.totalPnl >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {p.totalPnl >= 0 ? '+' : ''}${p.totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                &nbsp;({p.totalPnlPct >= 0 ? '+' : ''}{p.totalPnlPct.toFixed(2)}%)
              </span>
            </div>
          </div>
          {/* Sparkline */}
          <svg width={W} height={H} className="opacity-70">
            <polyline
              points={pts}
              fill="none"
              stroke="var(--long)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Available Margin" value={`$${p.availableMargin.toLocaleString()}`} />
          <StatCard label="Used Margin"       value={`$${p.usedMargin.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
          <StatCard label="Unrealized PnL"    value={`+$${p.unrealizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} positive={true} />
          <StatCard label="Daily PnL"         value={`+$${p.dailyPnl.toFixed(2)}`} positive={true} />
          <StatCard label="Weekly PnL"        value={`+$${p.weeklyPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} positive={true} />
          <StatCard label="Monthly PnL"       value={`+$${p.monthlyPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} positive={true} />
        </div>

        {/* Positions table */}
        <div className="bg-surface border border-outline-variant">
          <div className="px-4 py-3 border-b border-outline-variant">
            <h2 className="font-ui text-label-caps text-on-surface-variant">Open Positions</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container border-b border-outline-variant/30">
                  {['Pair', 'Side', 'Size', 'Entry Price', 'Mark Price', 'Liq. Price', 'PnL (ROI%)', 'Actions'].map((h) => (
                    <th key={h} className="text-label-caps font-ui text-on-surface-variant px-4 py-2.5 font-normal whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {MOCK_PORTFOLIO_POSITIONS.map((pos, i) => (
                  <tr key={i} className="hover:bg-surface-container transition-colors group">
                    <td className="px-4 py-3 font-data text-data-md text-on-surface">{pos.pair}</td>
                    <td className="px-4 py-3">
                      <span className={`text-label-caps font-ui px-2 py-0.5 ${pos.side === 'Long' ? 'bg-long/10 text-long' : 'bg-short/10 text-short'}`}>
                        {pos.side} {pos.leverage}x
                      </span>
                    </td>
                    <td className="px-4 py-3 font-data text-data-md text-on-surface">{pos.size}</td>
                    <td className="px-4 py-3 font-data text-data-md text-on-surface-variant">
                      ${pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 font-data text-data-md text-on-surface">
                      ${pos.markPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 font-data text-data-md text-error">
                      ${pos.liqPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-baseline gap-1.5">
                        <span className={`font-data text-data-md ${pos.pnl >= 0 ? 'text-long' : 'text-short'}`}>
                          {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                        </span>
                        <span className={`font-data text-data-sm ${pos.roi >= 0 ? 'text-long' : 'text-short'}`}>
                          ({pos.roi >= 0 ? '+' : ''}{pos.roi.toFixed(2)}%)
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="px-2 py-1 bg-surface-high border border-outline-variant text-label-caps font-ui hover:bg-surface-highest text-on-surface transition-colors">
                          TP/SL
                        </button>
                        <button className="px-2 py-1 border border-outline-variant text-label-caps font-ui hover:border-error hover:text-error text-on-surface transition-colors">
                          Close
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
