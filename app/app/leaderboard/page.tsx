'use client'
import AppShell from '@/components/layout/AppShell'
import { Trophy, Medal, Search } from 'lucide-react'
import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useTrade } from '@/contexts/TradeContext'

// Keep some mock data for other users since we have no backend
const MOCK_LEADERBOARD = [
  { rank: 1, address: '8X4g...9B1a', volume: 15420000, pnl: 452000, pnlPct: 145.2 },
  { rank: 2, address: '2mNf...3K9p', volume: 12100000, pnl: 320500, pnlPct: 89.4 },
  { rank: 3, address: '9vBq...7R4e', volume: 8950000, pnl: 215000, pnlPct: 65.8 },
  { rank: 4, address: '4cJr...1T8x', volume: 6200000, pnl: 180200, pnlPct: 42.1 },
  { rank: 5, address: '7kWz...5M2n', volume: 5100000, pnl: 145000, pnlPct: 38.5 },
  { rank: 6, address: '3yHp...8L6v', volume: 4800000, pnl: 120000, pnlPct: 29.2 },
  { rank: 7, address: '5tDc...9F3q', volume: 4200000, pnl: 95000, pnlPct: 24.8 },
  { rank: 8, address: '1xSb...4G7m', volume: 3900000, pnl: 88000, pnlPct: 21.4 },
  { rank: 9, address: '6rVn...2J5c', volume: 3100000, pnl: 75000, pnlPct: 18.9 },
  { rank: 10, address: '8pLw...6H1k', volume: 2800000, pnl: 62000, pnlPct: 15.2 },
]

export default function LeaderboardPage() {
  const [search, setSearch] = useState('')
  const { publicKey } = useWallet()
  const { portfolio, trades } = useTrade()
  
  const totalVolume = trades.reduce((acc, t) => acc + (t.size * t.price), 0)
  
  let leaderboard = [...MOCK_LEADERBOARD]
  
  // Insert current user if they have volume
  if (publicKey && totalVolume > 0) {
    const address = publicKey.toBase58()
    const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`
    
    // Find rank
    let rank = 11
    for (let i = 0; i < leaderboard.length; i++) {
      if (portfolio.totalPnl > leaderboard[i].pnl) {
        rank = i + 1
        break
      }
    }
    
    const userEntry = {
      rank,
      address: shortAddress + ' (You)',
      volume: totalVolume,
      pnl: portfolio.totalPnl,
      pnlPct: portfolio.totalPnlPct
    }
    
    leaderboard.splice(rank - 1, 0, userEntry)
    // Re-adjust ranks below
    for (let i = rank; i < leaderboard.length; i++) {
      leaderboard[i].rank = i + 1
    }
    
    // Keep top 10 or 11 if user is in it
    leaderboard = leaderboard.slice(0, Math.max(10, rank))
  }

  const filtered = leaderboard.filter(l => 
    l.address.toLowerCase().includes(search.toLowerCase())
  )

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  const getRankIcon = (rank: number) => {
    switch(rank) {
      case 1: return <Medal className="text-[#FFD700]" size={20} />
      case 2: return <Medal className="text-[#C0C0C0]" size={20} />
      case 3: return <Medal className="text-[#CD7F32]" size={20} />
      default: return <span className="font-data text-data-lg text-on-surface-variant w-5 text-center">{rank}</span>
    }
  }

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-ui text-headline-md text-on-surface flex items-center gap-2">
              <Trophy size={24} className="text-primary" />
              Trader Leaderboard
            </h1>
            <p className="font-ui text-body-sm text-on-surface-variant mt-0.5">
              Top traders by PnL across all markets
            </p>
          </div>
          
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Search address…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-surface border border-outline-variant pl-9 pr-4 py-2 text-body-sm font-ui text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary w-full md:w-64 transition-colors"
            />
          </div>
        </div>

        <div className="bg-surface border border-outline-variant">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant/40">
                <th className="text-label-caps font-ui text-on-surface-variant px-6 py-4 font-normal w-16">Rank</th>
                <th className="text-label-caps font-ui text-on-surface-variant px-6 py-4 font-normal">Trader</th>
                <th className="text-label-caps font-ui text-on-surface-variant px-6 py-4 font-normal text-right">Volume</th>
                <th className="text-label-caps font-ui text-on-surface-variant px-6 py-4 font-normal text-right">PnL</th>
                <th className="text-label-caps font-ui text-on-surface-variant px-6 py-4 font-normal text-right">ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {filtered.map((l) => {
                const isPos = l.pnl >= 0
                const isUser = l.address.includes('(You)')
                return (
                  <tr key={l.address} className={`${isUser ? 'bg-primary-container/10' : 'hover:bg-surface-container'} transition-colors`}>
                    <td className="px-6 py-4">
                      <div className="flex justify-center w-5">
                        {getRankIcon(l.rank)}
                      </div>
                    </td>
                    <td className={`px-6 py-4 font-data text-data-lg ${isUser ? 'text-primary font-bold' : 'text-on-surface'}`}>
                      {l.address}
                    </td>
                    <td className="px-6 py-4 font-data text-data-md text-on-surface text-right">
                      ${fmt(l.volume)}
                    </td>
                    <td className={`px-6 py-4 font-data text-data-md text-right ${isPos ? 'text-long' : 'text-short'}`}>
                      {isPos ? '+' : ''}${fmt(l.pnl)}
                    </td>
                    <td className={`px-6 py-4 text-right`}>
                      <span className={`text-label-caps font-ui px-2 py-1 ${isPos ? 'bg-long/10 text-long' : 'bg-short/10 text-short'}`}>
                        {isPos ? '+' : ''}{l.pnlPct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          
          {filtered.length === 0 && (
            <div className="py-12 text-center font-ui text-body-sm text-on-surface-variant">
              No traders found matching "{search}"
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
