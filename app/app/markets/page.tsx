'use client'
import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { MOCK_MARKETS } from '@/lib/mock-data'
import { Search, TrendingUp, TrendingDown, Star, ArrowUpDown } from 'lucide-react'
import { useRouter } from 'next/navigation'

type SortKey = 'pair' | 'price' | 'change24h' | 'volume24h' | 'openInterest' | 'fundingRate'

export default function MarketsPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('volume24h')
  const [sortAsc, setSortAsc] = useState(false)
  const [favorites, setFavorites] = useState<string[]>([])
  const [filter, setFilter] = useState<'all' | 'favorites' | 'gainers' | 'losers'>('all')

  const toggleFav = (pair: string) => {
    setFavorites((prev) =>
      prev.includes(pair) ? prev.filter((p) => p !== pair) : [...prev, pair]
    )
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(false) }
  }

  const filtered = MOCK_MARKETS
    .filter((m) => {
      if (filter === 'favorites') return favorites.includes(m.pair)
      if (filter === 'gainers') return m.change24h > 0
      if (filter === 'losers') return m.change24h < 0
      return true
    })
    .filter((m) => m.pair.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = typeof a[sortKey] === 'string'
        ? parseFloat((a[sortKey] as string).replace(/[^0-9.-]/g, ''))
        : (a[sortKey] as number)
      const bv = typeof b[sortKey] === 'string'
        ? parseFloat((b[sortKey] as string).replace(/[^0-9.-]/g, ''))
        : (b[sortKey] as number)
      return sortAsc ? av - bv : bv - av
    })

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <th
      className="text-label-caps font-ui text-on-surface-variant px-4 py-2.5 font-normal whitespace-nowrap cursor-pointer hover:text-on-surface transition-colors select-none"
      onClick={() => handleSort(k)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown size={10} className={sortKey === k ? 'text-primary' : 'opacity-30'} />
      </div>
    </th>
  )

  return (
    <AppShell>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div>
          <h1 className="font-ui text-headline-md text-on-surface">Markets</h1>
          <p className="font-ui text-body-sm text-on-surface-variant mt-0.5">
            All perpetual futures markets · Live prices
          </p>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Markets',   value: `${MOCK_MARKETS.length}` },
            { label: 'Top Gainer',      value: '+4.10% JTO-PERP', color: 'text-long' },
            { label: 'Top Loser',       value: '-2.30% INJ-PERP', color: 'text-short' },
            { label: 'Total Vol 24h',   value: '$4.91B' },
          ].map((t) => (
            <div key={t.label} className="bg-surface border border-outline-variant p-4">
              <span className="text-label-caps font-ui text-on-surface-variant block">{t.label}</span>
              <span className={`font-data text-data-lg mt-1 block ${t.color ?? 'text-on-surface'}`}>{t.value}</span>
            </div>
          ))}
        </div>

        {/* Filters + Search */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-1 bg-surface border border-outline-variant p-1">
            {(['all', 'favorites', 'gainers', 'losers'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
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
              placeholder="Search market…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-surface border border-outline-variant pl-9 pr-4 py-2 text-body-sm font-ui text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary w-56 transition-colors"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface border border-outline-variant">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant/40">
                <th className="text-label-caps font-ui text-on-surface-variant px-4 py-2.5 font-normal w-8" />
                <SortHeader label="Market"        k="pair"         />
                <SortHeader label="Price"         k="price"        />
                <SortHeader label="24h Change"    k="change24h"    />
                <SortHeader label="Volume 24h"    k="volume24h"    />
                <SortHeader label="Open Interest" k="openInterest" />
                <SortHeader label="Funding Rate"  k="fundingRate"  />
                <th className="text-label-caps font-ui text-on-surface-variant px-4 py-2.5 font-normal">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {filtered.map((m) => {
                const isPos = m.change24h >= 0
                const isFavd = favorites.includes(m.pair)
                return (
                  <tr key={m.pair} className="hover:bg-surface-container transition-colors group">
                    {/* Star */}
                    <td className="px-4 py-3 w-8">
                      <button
                        onClick={() => toggleFav(m.pair)}
                        className={`transition-colors ${isFavd ? 'text-[#FFB832]' : 'text-outline opacity-40 group-hover:opacity-100'}`}
                      >
                        <Star size={13} fill={isFavd ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                    {/* Pair */}
                    <td className="px-4 py-3">
                      <span className="font-data text-data-md text-on-surface font-medium">{m.pair}</span>
                    </td>
                    {/* Price */}
                    <td className="px-4 py-3 font-data text-data-md text-on-surface">
                      ${m.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    {/* 24h Change */}
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 font-data text-data-md ${isPos ? 'text-long' : 'text-short'}`}>
                        {isPos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {isPos ? '+' : ''}{m.change24h.toFixed(2)}%
                      </span>
                    </td>
                    {/* Volume */}
                    <td className="px-4 py-3 font-data text-data-md text-on-surface">${m.volume24h}</td>
                    {/* OI */}
                    <td className="px-4 py-3 font-data text-data-md text-on-surface">${m.openInterest}</td>
                    {/* Funding */}
                    <td className={`px-4 py-3 font-data text-data-md ${m.fundingRate >= 0 ? 'text-long' : 'text-short'}`}>
                      {m.fundingRate >= 0 ? '+' : ''}{(m.fundingRate).toFixed(4)}%
                    </td>
                    {/* Trade button */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => router.push('/')}
                        className="px-3 py-1 bg-primary-container text-on-primary-container text-label-caps font-ui hover:opacity-90 transition-opacity"
                      >
                        Trade
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center font-ui text-body-sm text-on-surface-variant">
              No markets match your filter.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
