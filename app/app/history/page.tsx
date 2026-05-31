'use client'
import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { useTrade } from '@/contexts/TradeContext'
import { Search, Download, TrendingUp, TrendingDown } from 'lucide-react'

type FilterType = 'all' | 'wins' | 'losses'

export default function HistoryPage() {
  const { trades } = useTrade()
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState<FilterType>('all')
  const [page, setPage]       = useState(1)
  const PER_PAGE = 7

  const totalPnl   = trades.reduce((s, t) => s + t.pnl, 0)
  const wins       = trades.filter((t) => t.pnl >= 0).length
  const losses     = trades.filter((t) => t.pnl < 0).length
  const winRate    = trades.length ? ((wins / trades.length) * 100).toFixed(1) : "0.0"
  const totalFees  = trades.reduce((s, t) => s + t.fee, 0)

  const filtered = trades
    .filter((t) => {
      if (filter === 'wins')   return t.pnl >= 0
      if (filter === 'losses') return t.pnl < 0
      return true
    })
    .filter((t) =>
      t.pair.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase())
    )

  const totalPages = Math.ceil(filtered.length / PER_PAGE) || 1
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const exportCSV = () => {
    const headers = ['Tx ID', 'Time', 'Market', 'Side', 'Size', 'Avg Price', 'Fee', 'PnL', 'Status']
    const rows = trades.map(t => [
      t.id,
      new Date(t.time * 1000).toLocaleString(),
      t.pair,
      t.side,
      t.size.toFixed(4),
      t.price.toFixed(2),
      t.fee.toFixed(2),
      t.pnl.toFixed(2),
      t.status
    ])
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "apex_trade_history.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <AppShell>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-ui text-headline-md text-on-surface">Trade History</h1>
            <p className="font-ui text-body-sm text-on-surface-variant mt-0.5">
              {trades.length} closed trades · All time
            </p>
          </div>
          <button 
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 border border-outline-variant text-label-caps font-ui text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-colors"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total PnL',  value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`,  color: totalPnl >= 0 ? 'text-long' : 'text-short' },
            { label: 'Win Rate',   value: `${winRate}%`,                                           color: 'text-on-surface' },
            { label: 'Wins',       value: String(wins),                                            color: 'text-long' },
            { label: 'Losses',     value: String(losses),                                          color: 'text-short' },
            { label: 'Fees Paid',  value: `$${totalFees.toFixed(2)}`,                             color: 'text-on-surface-variant' },
          ].map((c) => (
            <div key={c.label} className="bg-surface border border-outline-variant p-4">
              <span className="text-label-caps font-ui text-on-surface-variant block">{c.label}</span>
              <span className={`font-data text-data-lg mt-1 block ${c.color}`}>{c.value}</span>
            </div>
          ))}
        </div>

        {/* Filters + search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
          <div className="flex items-center gap-1 bg-surface border border-outline-variant p-1">
            {(['all', 'wins', 'losses'] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); setPage(1) }}
                className={`text-label-caps font-ui px-3 py-1.5 transition-colors capitalize ${
                  filter === f
                    ? 'bg-primary-container text-on-primary-container'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Search by pair or ID…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="bg-surface border border-outline-variant pl-9 pr-4 py-2 text-body-sm font-ui text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary w-64 transition-colors"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface border border-outline-variant">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant/40">
                {['Tx ID', 'Time', 'Market', 'Side', 'Size', 'Avg Price', 'Fee', 'PnL', 'Status'].map((h) => (
                  <th key={h} className="text-label-caps font-ui text-on-surface-variant px-4 py-2.5 font-normal whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {paginated.map((t) => {
                const isPos = t.pnl >= 0
                return (
                  <tr key={t.id + t.time} className="hover:bg-surface-container transition-colors">
                    <td className="px-4 py-3 font-data text-data-sm text-on-surface-variant">{t.id}</td>
                    <td className="px-4 py-3 font-data text-data-sm text-on-surface-variant whitespace-nowrap">{new Date(t.time * 1000).toLocaleString()}</td>
                    <td className="px-4 py-3 font-data text-data-md text-on-surface">{t.pair}</td>
                    <td className="px-4 py-3">
                      <span className={`text-label-caps font-ui px-2 py-0.5 ${t.side === 'Long' ? 'bg-long/10 text-long' : 'bg-short/10 text-short'}`}>
                        {t.side}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-data text-data-sm text-on-surface">{t.size.toFixed(4)}</td>
                    <td className="px-4 py-3 font-data text-data-md text-on-surface">
                      ${t.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 font-data text-data-sm text-on-surface-variant">${t.fee.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 font-data text-data-md ${isPos ? 'text-long' : 'text-short'}`}>
                        {isPos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {isPos ? '+' : ''}${t.pnl.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-label-caps font-ui px-2 py-0.5 bg-surface-high text-on-surface-variant">
                        {t.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {paginated.length === 0 && (
            <div className="py-12 text-center font-ui text-body-sm text-on-surface-variant">
              No trades match your filter.
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant/40">
              <span className="text-label-caps font-ui text-on-surface-variant">
                Page {page} of {totalPages} · {filtered.length} results
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1 border border-outline-variant text-label-caps font-ui text-on-surface-variant hover:text-on-surface disabled:opacity-40 transition-colors"
                >
                  Prev
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1 border border-outline-variant text-label-caps font-ui text-on-surface-variant hover:text-on-surface disabled:opacity-40 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
