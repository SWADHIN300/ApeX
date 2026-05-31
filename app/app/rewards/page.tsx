'use client'
import AppShell from '@/components/layout/AppShell'
import { Trophy, Gift, Zap, Copy, Clock, Target, ArrowRight } from 'lucide-react'
import { useState } from 'react'

export default function RewardsPage() {
  const [copiedRef, setCopiedRef] = useState(false)

  const handleClaim = () => {
    alert("Rewards claimed! (Simulated)");
  };

  const copyRef = () => {
    navigator.clipboard.writeText('https://apex.exchange/ref/0x123...abc')
    setCopiedRef(true)
    setTimeout(() => setCopiedRef(false), 2000)
    alert("Referral link copied!");
  }

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-ui text-headline-md text-on-surface">Rewards & Epochs</h1>
          <p className="font-ui text-body-sm text-on-surface-variant mt-0.5">
            Earn APX tokens by trading and providing liquidity
          </p>
        </div>

        {/* Hero split */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Claim Box */}
          <div className="md:col-span-1 bg-surface border border-outline-variant p-6 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Gift size={120} />
            </div>
            
            <div className="relative z-10">
              <span className="text-label-caps font-ui text-on-surface-variant flex items-center gap-1.5">
                <Trophy size={14} /> Pending Rewards
              </span>
              <div className="font-data text-display-lg text-primary mt-2">
                142.50 APX
              </div>
              <div className="font-data text-body-md text-on-surface-variant mt-1">
                ≈ $1,240.00
              </div>
            </div>

            <div className="relative z-10 mt-8 space-y-3">
              <div className="flex items-center gap-1.5 text-label-caps font-ui text-on-surface-variant">
                <Clock size={12} />
                Next epoch in 4h 12m
              </div>
              <button 
                onClick={handleClaim}
                className="w-full py-2.5 bg-primary-container text-on-primary-container text-label-caps font-ui hover:opacity-90 transition-opacity"
              >
                Claim All Rewards
              </button>
            </div>
          </div>

          {/* Current Epoch Stats */}
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-surface-container border border-outline-variant p-5 space-y-4">
              <span className="text-label-caps font-ui text-on-surface-variant">Trading Score</span>
              <div>
                <div className="font-data text-headline-md text-on-surface">8,402.5</div>
                <div className="text-body-sm font-ui text-on-surface-variant mt-1">
                  Rank: <span className="text-on-surface font-medium">#142</span>
                </div>
              </div>
              <div className="h-1.5 bg-outline-variant w-full overflow-hidden">
                <div className="h-full bg-primary w-[45%]" />
              </div>
              <div className="text-label-caps font-ui text-on-surface-variant text-right">
                1,598 to next tier
              </div>
            </div>

            <div className="bg-surface-container border border-outline-variant p-5 space-y-4 flex flex-col justify-between">
              <span className="text-label-caps font-ui text-on-surface-variant">Referral Link</span>
              <div>
                <div className="font-data text-body-md text-on-surface truncate pb-2">
                  apex.exchange/ref/0x123...abc
                </div>
                <div className="flex">
                  <button 
                    onClick={copyRef}
                    className="flex-1 py-2 bg-surface-high border border-outline-variant text-label-caps font-ui text-on-surface hover:text-primary transition-colors flex items-center justify-center gap-2"
                  >
                    <Copy size={14} />
                    {copiedRef ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>
              <div className="text-body-sm font-ui text-on-surface-variant">
                Earn 15% of your referrals' trading fees.
              </div>
            </div>
          </div>
        </div>

        {/* Quests / Objectives */}
        <div className="bg-surface border border-outline-variant">
          <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center">
            <h3 className="font-ui text-headline-md text-on-surface flex items-center gap-2">
              <Target size={18} className="text-primary" />
              Daily Quests
            </h3>
            <span className="text-label-caps font-ui text-primary bg-primary/10 px-2 py-1">
              Resets in 4h 12m
            </span>
          </div>
          
          <div className="divide-y divide-outline-variant/40">
            {[
              { title: 'First Trade of the Day', reward: '+10 APX', progress: 1, total: 1, done: true },
              { title: 'Trade $10,000 Volume', reward: '+50 APX', progress: 4250, total: 10000, done: false },
              { title: 'Provide Liquidity', reward: '+25 APX', progress: 0, total: 1, done: false },
            ].map((q, i) => (
              <div key={i} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-ui text-body-md ${q.done ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>
                      {q.title}
                    </h4>
                    {q.done && <Zap size={14} className="text-primary" />}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-surface-container overflow-hidden max-w-[200px]">
                      <div 
                        className={`h-full ${q.done ? 'bg-outline-variant' : 'bg-primary'}`} 
                        style={{ width: `${(q.progress / q.total) * 100}%` }}
                      />
                    </div>
                    <span className="font-data text-label-caps text-on-surface-variant">
                      {q.progress >= 1000 ? `${(q.progress/1000).toFixed(1)}k` : q.progress} / {q.total >= 1000 ? `${(q.total/1000).toFixed(1)}k` : q.total}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className={`font-data text-data-md ${q.done ? 'text-on-surface-variant' : 'text-primary'}`}>
                    {q.reward}
                  </span>
                  <button 
                    disabled={q.done}
                    className="w-8 h-8 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:border-primary disabled:opacity-30 transition-all"
                  >
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
