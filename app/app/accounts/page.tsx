'use client'
import AppShell from '@/components/layout/AppShell'
import { Copy, ExternalLink, ShieldCheck } from 'lucide-react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { useEffect, useState } from 'react'
import { useNetwork } from '@/contexts/WalletProvider'

export default function AccountsPage() {
  const { publicKey, connected } = useWallet()
  const { connection } = useConnection()
  const { network } = useNetwork()
  const [solBalance, setSolBalance] = useState<number>(0)

  useEffect(() => {
    if (publicKey) {
      connection.getBalance(publicKey)
        .then((bal) => {
          setSolBalance(bal / 1e9)
        })
        .catch(err => {
          console.error("Failed to fetch balance:", err);
          setSolBalance(0);
        })
    } else {
      setSolBalance(0)
    }
  }, [publicKey, connection])

  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58())
      alert('Address copied to clipboard')
    }
  }

  const address = publicKey ? publicKey.toBase58() : 'Not connected'
  const shortAddress = publicKey ? `${address.slice(0, 6)}...${address.slice(-4)}` : '---'

  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="font-ui text-headline-md text-on-surface">Account Settings</h1>
          <p className="font-ui text-body-sm text-on-surface-variant mt-0.5">
            Manage your wallet and linked addresses
          </p>
        </div>

        {/* Wallet info */}
        <div className="bg-surface border border-outline-variant p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary-container flex items-center justify-center">
                <ShieldCheck size={24} className="text-on-primary-container" />
              </div>
              <div>
                <h3 className="font-ui text-headline-md text-on-surface">Connected Wallet</h3>
                <p className="font-ui text-body-sm text-on-surface-variant flex items-center gap-2">
                  <span className={connected ? "text-long" : "text-short"}>
                    ●
                  </span>
                  {connected ? <span className="capitalize">{network.replace('-beta', '')} connected</span> : "Not connected"}
                </p>
              </div>
            </div>
            {connected && (
              <a 
                href={`https://explorer.solana.com/address/${address}?cluster=${network}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 font-ui text-label-caps text-on-surface-variant hover:text-on-surface transition-colors"
              >
                View on Solscan <ExternalLink size={12} />
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surface-container border border-outline-variant p-4">
              <span className="text-label-caps font-ui text-on-surface-variant">Wallet Address</span>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-data text-data-lg text-on-surface">{shortAddress}</span>
                {connected && (
                  <button 
                    onClick={copyAddress}
                    className="p-1.5 hover:bg-surface-high text-on-surface-variant hover:text-on-surface transition-colors"
                  >
                    <Copy size={14} />
                  </button>
                )}
              </div>
            </div>
            
            <div className="bg-surface-container border border-outline-variant p-4">
              <span className="text-label-caps font-ui text-on-surface-variant">SOL Balance</span>
              <div className="mt-2">
                <span className="font-data text-data-lg text-on-surface">{solBalance.toFixed(4)} SOL</span>
              </div>
            </div>
          </div>
        </div>

        {/* Other settings placeholders */}
        <div className="bg-surface border border-outline-variant">
          <div className="px-6 py-4 border-b border-outline-variant">
            <h3 className="font-ui text-headline-md text-on-surface">Session Keys</h3>
            <p className="font-ui text-body-sm text-on-surface-variant mt-1">
              Active sessions that can trade on your behalf without wallet approvals.
            </p>
          </div>
          <div className="p-6 text-center font-ui text-body-sm text-on-surface-variant">
            No active session keys.
          </div>
        </div>
      </div>
    </AppShell>
  )
}
