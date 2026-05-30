'use client'
import AppShell from '@/components/layout/AppShell'
import {
  MOCK_REWARDS,
  MOCK_REWARD_HISTORY,
  MOCK_DAILY_QUESTS,
} from '@/lib/mock-data'
import { Gift, Flame, Users, TrendingUp, CheckCircle2, Circle, Clock, Copy } from 'lucide-react'
import { useState } from 'react'

export default function RewardsPage() {
  const r = MOCK_REWARDS
  const [copiedRef, setCopiedRef] = useState(false)

  const referralLink = `https://apex.trade/ref/apex_trader`

  const copyRef = () => {
    navigator.clipboard.writeText(referralLink)
    setCopiedRef(true)
    setTimeout(() => setCopiedRef(false), 2000)
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-ui text-headline-md text-on-surface">Rewards</h1>
          <p className="font-ui text-body-sm text-on-surface-variant mt-0.5">
            Earn rewards by trading, staking, and referring friends
          </p>
        </div>

        {/* Hero */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Total earned */}
          <div className="bg-surface border border-outline-variant p-6 relative overflow-hidden">
            <div className="absolute right-4 top-4 opacity-5">
              <Gift size={80} />
            </div>
            <span className="text-label-caps font-ui text-on-surface-variant">Total Rewards Earned</span>
            <div className="font-data text-display-lg text-on-surface mt-2">
              ${r.totalEarned.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="flex gap-4 mt-3">
              <div>
                <span className="text-label-caps font-ui text-on-surface-variant block">Trading</span>
                <span className="font-data text-data-md text-long">+${r.tradingRewards}</span>
              </div>
              <div>
                <span className="text-label-caps font-ui text-on-surface-variant block">Referral</span>
                <span className="font-data text-data-md text-primary">+${r.referralEarnings}</span>
              </div>
            </div>
          </div>

          {/* Pending + claim */}
          <div className="bg-surface border border-outline-variant p-6 flex flex-col justify-between">
            <div>
              <span className="text-label-caps font-ui text-on-surface-variant">Pending Rewards</span>
              <div className="font-data text-data-lg text-[#FFB832] mt-1">
                ${r.pendingRewards.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-label-caps font-ui text-on-surface-variant">
                <Clock size={12} />
                Next epoch in {r.nextEpochIn}
              </div>
            </div>
            <button className="w-full py-2.5 bg-primary-container text-on-primary-container text-label-caps font-ui hover:opacity-90 transition-opacity mt-4">
              Claim ${r.pendingRewards.toFixed(2)}
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Flame,      label: 'Daily Streak',    value: `${r.currentStreak} days`,    sub: `Best: ${r.maxStreak} days` },
            { icon: TrendingUp, label: 'Trading Rewards', value: `$${r.tradingRewards}`,       sub: 'All time' },
            { icon: Users,      label: 'Referral Rewards',value: `$${r.referralEarnings}`,     sub: 'All time' },
            { icon: Gift,       label: 'Current Tier',    value: r.tier,                       sub: '20% fee discount' },
          ].map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="bg-surface border border-outline-variant p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className="text-on-surface-variant" />
                <span className="text-label-caps font-ui text-on-surface-variant">{label}</span>
              </div>
              <div className="font-data text-data-lg text-on-surface">{value}</div>
              <div className="font-data text-data-sm text-on-surface-variant mt-0.5">{sub}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Daily quests */}
          <div className="bg-surface border border-outline-variant">
            <div className="px-5 py-3 border-b border-outline-variant flex items-center justify-between">
              <h2 className="text-label-caps font-ui text-on-surface-variant">Daily Quests</h2>
              <span className="text-label-caps font-ui text-on-surface-variant">
                Resets in 07:42:18
              </span>
            </div>
            <div className="divide-y divide-outline-variant/20">
              {MOCK_DAILY_QUESTS.map((q, i) => (
                <div key={i} className="px-5 py-4 flex items-center gap-4">
                  {q.done
                    ? <CheckCircle2 size={18} className="text-long shrink-0" />
                    : <Circle size={18} className="text-on-surface-variant shrink-0" />
                  }
                  <div className="flex-1">
                    <div className="font-ui text-body-sm text-on-surface">{q.task}</div>
                    {/* Progress bar */}
                    <div className="mt-1.5 h-1 bg-surface-high w-full">
                      <div
                        className={`h-full transition-all ${q.done ? 'bg-long' : 'bg-primary'}`}
                        style={{ width: `${(q.progress / q.target) * 100}%` }}
                      />
                    </div>
                    <div className="text-label-caps font-ui text-on-surface-variant mt-1">
                      {q.progress} / {q.target}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`font-data text-data-md ${q.done ? 'text-long' : 'text-[#FFB832]'}`}>
                      +{q.reward} USDC
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Referral + epoch history */}
          <div className="space-y-4">
            {/* Referral card */}
            <div className="bg-surface border border-outline-variant p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users size={14} className="text-on-surface-variant" />
                <h2 className="text-label-caps font-ui text-on-surface-variant">Referral Program</h2>
              </div>
              <p className="font-ui text-body-sm text-on-surface-variant mb-3">
                Earn 10% of your referees' trading fees, forever.
              </p>
              <div className="flex items-center gap-2 p-3 bg-surface-high border border-outline-variant">
                <span className="font-data text-data-sm text-on-surface flex-1 truncate">
                  {referralLink}
                </span>
                <button
                  onClick={copyRef}
                  className="text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
                >
                  {copiedRef
                    ? <span className="text-label-caps font-ui text-long">Copied!</span>
                    : <Copy size={14} />
                  }
                </button>
              </div>
            </div>

            {/* Epoch history */}
            <div className="bg-surface border border-outline-variant">
              <div className="px-5 py-3 border-b border-outline-variant">
                <h2 className="text-label-caps font-ui text-on-surface-variant">Epoch History</h2>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container border-b border-outline-variant/30">
                    {['Epoch', 'Period', 'Trading', 'Referral', 'Total', 'Status'].map((h) => (
                      <th key={h} className="text-label-caps font-ui text-on-surface-variant px-4 py-2 font-normal whitespace-nowrap text-[10px]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {MOCK_REWARD_HISTORY.map((ep) => (
                    <tr key={ep.epoch} className="hover:bg-surface-container transition-colors">
                      <td className="px-4 py-3 font-data text-data-sm text-on-surface">{ep.epoch}</td>
                      <td className="px-4 py-3 font-data text-data-sm text-on-surface-variant whitespace-nowrap">{ep.period}</td>
                      <td className="px-4 py-3 font-data text-data-sm text-long">+${ep.trading}</td>
                      <td className="px-4 py-3 font-data text-data-sm text-primary">+${ep.referral}</td>
                      <td className="px-4 py-3 font-data text-data-sm text-on-surface">+${ep.total}</td>
                      <td className="px-4 py-3">
                        <span className={`text-label-caps font-ui px-2 py-0.5 ${
                          ep.status === 'Claimable'
                            ? 'bg-[#FFB832]/10 text-[#FFB832]'
                            : 'bg-surface-high text-on-surface-variant'
                        }`}>
                          {ep.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
