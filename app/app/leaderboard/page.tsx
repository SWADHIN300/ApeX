'use client'
import AppShell from '@/components/layout/AppShell'
import { MOCK_LEADERBOARD } from '@/lib/mock-data'
import { Trophy, Medal } from 'lucide-react'

const BADGE_COLORS: Record<string, string> = {
  Diamond: 'bg-primary/20 text-primary',
  Platinum: 'bg-on-surface-variant/20 text-on-surface-variant',
  Gold: 'bg-[#FFB83280]/20 text-[#FFB832]',
  Silver: 'bg-[#94A3B880]/20 text-[#94A3B8]',
  Bronze: 'bg-[#CD7F3280]/20 text-[#CD7F32]',
}

const RANK_STYLES: Record<number, string> = {
  1: 'text-[#FFB832]',
  2: 'text-[#C0C0C0]',
  3: 'text-[#CD7F32]',
}

export default function LeaderboardPage() {
  const top3 = MOCK_LEADERBOARD.slice(0, 3)
  const rest  = MOCK_LEADERBOARD.slice(3)

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Trophy size={20} className="text-[#FFB832]" />
          <div>
            <h1 className="font-ui text-headline-md text-on-surface">Leadership Board</h1>
            <p className="font-ui text-body-sm text-on-surface-variant mt-0.5">Top traders ranked by PnL this month</p>
          </div>
        </div>

        {/* Podium top 3 */}
        <div className="grid grid-cols-3 gap-4">
          {/* 2nd place */}
          <div className="flex flex-col items-center justify-end">
            <div className="bg-surface border border-outline-variant p-4 w-full text-center">
              <div className="text-2xl mb-1">🥈</div>
              <div className="font-data text-data-sm text-on-surface-variant truncate">{top3[1].address}</div>
              <div className="font-data text-data-lg text-long mt-1">
                +${top3[1].pnl.toLocaleString()}
              </div>
              <div className={`inline-block text-label-caps font-ui px-2 py-0.5 mt-2 ${BADGE_COLORS[top3[1].badge]}`}>
                {top3[1].badge}
              </div>
            </div>
          </div>

          {/* 1st place */}
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-[#FFB832]/10 border-2 border-[#FFB832] flex items-center justify-center mb-2">
              <Trophy size={20} className="text-[#FFB832]" />
            </div>
            <div className="bg-surface border border-[#FFB832]/40 p-4 w-full text-center">
              <div className="font-data text-data-sm text-on-surface-variant truncate">{top3[0].address}</div>
              <div className="font-data text-data-lg text-long mt-1">
                +${top3[0].pnl.toLocaleString()}
              </div>
              <div className="font-data text-data-sm text-on-surface-variant mt-0.5">
                {top3[0].winRate}% win rate · {top3[0].trades.toLocaleString()} trades
              </div>
              <div className={`inline-block text-label-caps font-ui px-2 py-0.5 mt-2 ${BADGE_COLORS[top3[0].badge]}`}>
                {top3[0].badge}
              </div>
            </div>
          </div>

          {/* 3rd place */}
          <div className="flex flex-col items-center justify-end">
            <div className="bg-surface border border-outline-variant p-4 w-full text-center">
              <div className="text-2xl mb-1">🥉</div>
              <div className="font-data text-data-sm text-on-surface-variant truncate">{top3[2].address}</div>
              <div className="font-data text-data-lg text-long mt-1">
                +${top3[2].pnl.toLocaleString()}
              </div>
              <div className={`inline-block text-label-caps font-ui px-2 py-0.5 mt-2 ${BADGE_COLORS[top3[2].badge]}`}>
                {top3[2].badge}
              </div>
            </div>
          </div>
        </div>

        {/* Full table */}
        <div className="bg-surface border border-outline-variant">
          <div className="px-4 py-3 border-b border-outline-variant">
            <h2 className="text-label-caps font-ui text-on-surface-variant">Full Rankings</h2>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant/30">
                {['Rank', 'Trader', 'Volume', 'PnL', 'Win Rate', 'Trades', 'Tier'].map((h) => (
                  <th key={h} className="text-label-caps font-ui text-on-surface-variant px-4 py-2.5 font-normal whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {MOCK_LEADERBOARD.map((row) => (
                <tr key={row.rank} className="hover:bg-surface-container transition-colors">
                  <td className={`px-4 py-3 font-data text-data-md font-bold ${RANK_STYLES[row.rank] ?? 'text-on-surface-variant'}`}>
                    #{row.rank}
                  </td>
                  <td className="px-4 py-3 font-data text-data-sm text-on-surface">{row.address}</td>
                  <td className="px-4 py-3 font-data text-data-md text-on-surface">${row.volume}</td>
                  <td className="px-4 py-3 font-data text-data-md text-long">+${row.pnl.toLocaleString()}</td>
                  <td className="px-4 py-3 font-data text-data-md text-on-surface">{row.winRate}%</td>
                  <td className="px-4 py-3 font-data text-data-md text-on-surface">{row.trades.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-label-caps font-ui px-2 py-0.5 ${BADGE_COLORS[row.badge]}`}>
                      {row.badge}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}
