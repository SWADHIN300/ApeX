'use client'
import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { MOCK_ACCOUNT, MOCK_ACCOUNT_BALANCES } from '@/lib/mock-data'
import {
  User,
  Copy,
  CheckCheck,
  Wallet,
  TrendingUp,
  Gift,
  Shield,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'

const TIER_COLORS: Record<string, string> = {
  Bronze:   'text-[#CD7F32] border-[#CD7F32]/40 bg-[#CD7F32]/10',
  Silver:   'text-[#C0C0C0] border-[#C0C0C0]/40 bg-[#C0C0C0]/10',
  Gold:     'text-[#FFB832] border-[#FFB832]/40 bg-[#FFB832]/10',
  Platinum: 'text-on-surface-variant border-outline-variant bg-surface-high',
  Diamond:  'text-primary border-primary/40 bg-primary/10',
}

export default function AccountsPage() {
  const acc = MOCK_ACCOUNT
  const [copied, setCopied] = useState(false)

  const copyAddress = () => {
    navigator.clipboard.writeText(acc.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tierColor   = TIER_COLORS[acc.tier] ?? TIER_COLORS.Gold
  const nextPct     = Math.min((parseFloat(acc.totalVolume.replace('M', '')) / parseFloat(acc.nextTierVolume.replace('M', ''))) * 100, 100)

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-ui text-headline-md text-on-surface">Account</h1>
          <p className="font-ui text-body-sm text-on-surface-variant mt-0.5">
            Manage your wallet, balances and preferences
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column */}
          <div className="space-y-4">
            {/* Profile card */}
            <div className="bg-surface border border-outline-variant p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center">
                  <User size={22} className="text-on-primary-container" />
                </div>
                <div>
                  <div className="font-ui text-body-md font-semibold text-on-surface">
                    {acc.username}
                  </div>
                  <div className="font-ui text-body-sm text-on-surface-variant">
                    Joined {acc.joinDate}
                  </div>
                </div>
              </div>

              {/* Tier badge */}
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 border text-label-caps font-ui mb-4 ${tierColor}`}>
                <Shield size={12} />
                {acc.tier} Tier
              </div>

              {/* Tier progress */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-label-caps font-ui text-on-surface-variant">Progress to {acc.nextTier}</span>
                  <span className="text-label-caps font-ui text-on-surface">${acc.totalVolume} / ${acc.nextTierVolume}</span>
                </div>
                <div className="h-1.5 bg-surface-high w-full">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${nextPct}%` }}
                  />
                </div>
                <div className="text-label-caps font-ui text-on-surface-variant">
                  {nextPct.toFixed(0)}% — {acc.feeDiscount}% fee discount active
                </div>
              </div>
            </div>

            {/* Wallet address */}
            <div className="bg-surface border border-outline-variant p-5">
              <div className="text-label-caps font-ui text-on-surface-variant mb-2">Connected Wallet</div>
              <div className="flex items-center gap-2 p-3 bg-surface-high border border-outline-variant">
                <Wallet size={14} className="text-on-surface-variant shrink-0" />
                <span className="font-data text-data-sm text-on-surface flex-1 truncate">
                  {acc.address}
                </span>
                <button
                  onClick={copyAddress}
                  className="text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
                  title="Copy address"
                >
                  {copied ? <CheckCheck size={14} className="text-long" /> : <Copy size={14} />}
                </button>
                <a
                  href={`https://solscan.io/account/${acc.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-on-surface-variant hover:text-primary transition-colors shrink-0"
                  title="View on Solscan"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>

            {/* Quick stats */}
            <div className="bg-surface border border-outline-variant p-5 grid grid-cols-2 gap-4">
              {[
                { icon: TrendingUp, label: 'Total Volume', value: `$${acc.totalVolume}` },
                { icon: TrendingUp, label: 'Total Trades', value: String(acc.totalTrades) },
                { icon: Gift,       label: 'Referrals',    value: String(acc.referrals) },
                { icon: Shield,     label: 'Fees Paid',    value: `$${acc.totalFeesPaid}` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label}>
                  <div className="flex items-center gap-1.5 text-label-caps font-ui text-on-surface-variant mb-1">
                    <Icon size={11} /> {label}
                  </div>
                  <div className="font-data text-data-md text-on-surface">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 space-y-4">
            {/* Balances */}
            <div className="bg-surface border border-outline-variant">
              <div className="px-5 py-3 border-b border-outline-variant flex items-center justify-between">
                <h2 className="text-label-caps font-ui text-on-surface-variant">Balances</h2>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 bg-long text-white text-label-caps font-ui hover:opacity-90 transition-opacity">
                    Deposit
                  </button>
                  <button className="px-3 py-1.5 border border-outline-variant text-label-caps font-ui text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-colors">
                    Withdraw
                  </button>
                </div>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container border-b border-outline-variant/30">
                    {['Asset', 'Available', 'In Orders', 'Total', 'USD Value'].map((h) => (
                      <th key={h} className="text-label-caps font-ui text-on-surface-variant px-5 py-2.5 font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {MOCK_ACCOUNT_BALANCES.map((b) => (
                    <tr key={b.asset} className="hover:bg-surface-container transition-colors">
                      <td className="px-5 py-3">
                        <span className="font-data text-data-md text-on-surface font-medium">{b.asset}</span>
                      </td>
                      <td className="px-5 py-3 font-data text-data-md text-on-surface">
                        {b.balance.toLocaleString(undefined, { minimumFractionDigits: 3 })}
                      </td>
                      <td className="px-5 py-3 font-data text-data-md text-on-surface-variant">
                        {b.inOrders.toFixed(3)}
                      </td>
                      <td className="px-5 py-3 font-data text-data-md text-on-surface">
                        {b.total.toLocaleString(undefined, { minimumFractionDigits: 3 })}
                      </td>
                      <td className="px-5 py-3 font-data text-data-md text-on-surface">
                        ${b.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Settings shortcuts */}
            <div className="bg-surface border border-outline-variant">
              <div className="px-5 py-3 border-b border-outline-variant">
                <h2 className="text-label-caps font-ui text-on-surface-variant">Preferences</h2>
              </div>
              {[
                { label: 'Notification Settings',    sub: 'Manage alerts and email preferences' },
                { label: 'API Keys',                 sub: 'Create and manage API access' },
                { label: 'Sub-Accounts',             sub: 'Manage trading sub-accounts' },
                { label: 'Referral Program',         sub: 'Share your referral link and earn' },
                { label: 'KYC Verification',         sub: 'Verify identity for higher limits' },
              ].map((item) => (
                <button
                  key={item.label}
                  className="flex items-center justify-between w-full px-5 py-3.5 hover:bg-surface-high transition-colors border-b border-outline-variant/20 last:border-0 group"
                >
                  <div className="text-left">
                    <div className="font-ui text-body-sm text-on-surface">{item.label}</div>
                    <div className="font-ui text-body-sm text-on-surface-variant text-[11px] mt-0.5">{item.sub}</div>
                  </div>
                  <ChevronRight size={14} className="text-on-surface-variant group-hover:text-on-surface transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
