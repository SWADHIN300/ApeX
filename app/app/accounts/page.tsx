'use client'
import AppShell from '@/components/layout/AppShell'
import { Copy, ExternalLink, ShieldCheck } from 'lucide-react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { useEffect, useState } from 'react'
import { useNetwork } from '@/contexts/WalletProvider'
import { useTrade } from '@/contexts/TradeContext'
import {
  creditConfirmedDeposit,
  fetchLedgerBalance,
  type LedgerBalance,
} from '@/lib/ledgerClient'
import {
  hasTreasuryWallet,
  hasUsdcMint,
  sendSolDeposit,
  sendUsdcDeposit,
  treasuryWalletAddress,
} from '@/lib/payments'

type DepositAsset = 'SOL' | 'USDC'

export default function AccountsPage() {
  const { publicKey, connected, sendTransaction } = useWallet()
  const { connection } = useConnection()
  const { network } = useNetwork()
  const { refreshLedgerBalance } = useTrade()
  const [solBalance, setSolBalance] = useState<number>(0)
  const [ledgerBalance, setLedgerBalance] = useState<LedgerBalance | null>(null)
  const [depositAsset, setDepositAsset] = useState<DepositAsset>('SOL')
  const [depositAmount, setDepositAmount] = useState('')
  const [isDepositing, setIsDepositing] = useState(false)
  const [depositError, setDepositError] = useState('')
  const [depositSignature, setDepositSignature] = useState('')
  const [balanceError, setBalanceError] = useState('')

  useEffect(() => {
    if (publicKey) {
      setBalanceError('')
      connection.getBalance(publicKey)
        .then((bal) => {
          setSolBalance(bal / 1e9)
        })
        .catch(() => {
          setSolBalance(0)
          setBalanceError('Unable to load SOL balance from the current RPC endpoint.')
        })
    } else {
      setSolBalance(0)
      setBalanceError('')
    }
  }, [publicKey, connection])

  useEffect(() => {
    if (!publicKey) {
      setLedgerBalance(null)
      return
    }

    fetchLedgerBalance({ wallet: publicKey.toBase58(), network })
      .then(setLedgerBalance)
      .catch(() => setLedgerBalance(null))
  }, [network, publicKey])

  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58())
      alert('Address copied to clipboard')
    }
  }

  const address = publicKey ? publicKey.toBase58() : 'Not connected'
  const shortAddress = publicKey ? `${address.slice(0, 6)}...${address.slice(-4)}` : '---'
  const explorerCluster = network === 'devnet' ? '?cluster=devnet' : ''
  const treasuryReady = hasTreasuryWallet()
  const usdcReady = hasUsdcMint()
  const canDeposit =
    connected &&
    publicKey &&
    treasuryReady &&
    !isDepositing &&
    Number(depositAmount) > 0 &&
    (depositAsset === 'SOL' || usdcReady)

  const handleDeposit = async () => {
    if (!publicKey || !canDeposit) return

    setIsDepositing(true)
    setDepositError('')
    setDepositSignature('')

    try {
      const amount = Number(depositAmount)
      const signature =
        depositAsset === 'SOL'
          ? await sendSolDeposit({
              amountSol: amount,
              connection,
              publicKey,
              sendTransaction,
            })
          : await sendUsdcDeposit({
              amountUsdc: amount,
              connection,
              publicKey,
              sendTransaction,
            })

      const credited = await creditConfirmedDeposit({
        signature,
        wallet: publicKey.toBase58(),
        asset: depositAsset,
        network,
      })

      setDepositSignature(signature)
      setLedgerBalance(credited.balance)
      await refreshLedgerBalance()
      setDepositAmount('')
    } catch (error) {
      setDepositError(
        error instanceof Error ? error.message : 'Deposit transaction failed.',
      )
    } finally {
      setIsDepositing(false)
    }
  }

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
                href={`https://explorer.solana.com/address/${address}${explorerCluster}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 font-ui text-label-caps text-on-surface-variant hover:text-on-surface transition-colors"
              >
                View on Explorer <ExternalLink size={12} />
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
                {balanceError && (
                  <p className="mt-2 font-ui text-body-sm text-short">{balanceError}</p>
                )}
              </div>
            </div>

            <div className="bg-surface-container border border-outline-variant p-4">
              <span className="text-label-caps font-ui text-on-surface-variant">Credited USDC</span>
              <div className="mt-2">
                <span className="font-data text-data-lg text-on-surface">
                  {(ledgerBalance?.balances.USDC ?? 0).toFixed(2)} USDC
                </span>
              </div>
            </div>

            <div className="bg-surface-container border border-outline-variant p-4">
              <span className="text-label-caps font-ui text-on-surface-variant">Credited SOL</span>
              <div className="mt-2">
                <span className="font-data text-data-lg text-on-surface">
                  {(ledgerBalance?.balances.SOL ?? 0).toFixed(4)} SOL
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-outline-variant">
          <div className="px-6 py-4 border-b border-outline-variant">
            <h3 className="font-ui text-headline-md text-on-surface">Deposit Funds</h3>
            <p className="font-ui text-body-sm text-on-surface-variant mt-1">
              Send a real on-chain transaction from your connected wallet to the configured treasury.
            </p>
          </div>
          <div className="p-6 space-y-5">
            {!treasuryReady && (
              <div className="border border-short/40 bg-short/10 p-4 font-ui text-body-sm text-short">
                Set NEXT_PUBLIC_APEX_TREASURY_WALLET before enabling real deposits.
              </div>
            )}

            {treasuryReady && (
              <div className="bg-surface-container border border-outline-variant p-4">
                <span className="text-label-caps font-ui text-on-surface-variant">Treasury Wallet</span>
                <div className="mt-2 font-data text-data-md text-on-surface break-all">
                  {treasuryWalletAddress}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-[12rem_1fr] gap-4">
              <div>
                <label className="text-label-caps font-ui text-on-surface-variant block mb-2">
                  Asset
                </label>
                <select
                  value={depositAsset}
                  onChange={(e) => setDepositAsset(e.target.value as DepositAsset)}
                  className="w-full bg-bg-l2 border border-t-border p-3 font-ui text-body-sm text-text-main focus:border-primary outline-none"
                >
                  <option value="SOL" className="bg-bg-l2 text-text-main">SOL</option>
                  <option value="USDC" className="bg-bg-l2 text-text-main">USDC</option>
                </select>
              </div>
              <div>
                <label className="text-label-caps font-ui text-on-surface-variant block mb-2">
                  Amount
                </label>
                <input
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="w-full bg-bg-l2 border border-t-border p-3 font-ui text-body-sm text-text-main focus:border-primary outline-none"
                />
              </div>
            </div>

            {depositAsset === 'USDC' && !usdcReady && (
              <div className="border border-outline-variant bg-surface-container p-4 font-ui text-body-sm text-on-surface-variant">
                Set NEXT_PUBLIC_APEX_USDC_MINT to enable USDC deposits for the selected Solana network.
              </div>
            )}

            {depositError && (
              <div className="border border-short/40 bg-short/10 p-4 font-ui text-body-sm text-short">
                {depositError}
              </div>
            )}

            {depositSignature && (
              <a
                href={`https://explorer.solana.com/tx/${depositSignature}${explorerCluster}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 font-ui text-body-sm text-long hover:underline"
              >
                Deposit confirmed <ExternalLink size={14} />
              </a>
            )}

            {ledgerBalance && ledgerBalance.deposits.length > 0 && (
              <div className="border border-outline-variant">
                <div className="px-4 py-3 border-b border-outline-variant text-label-caps font-ui text-on-surface-variant">
                  Credited Deposits
                </div>
                <div className="divide-y divide-outline-variant">
                  {ledgerBalance.deposits.slice(0, 5).map((deposit) => (
                    <div
                      key={deposit.signature}
                      className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 px-4 py-3 font-ui text-body-sm text-on-surface"
                    >
                      <span className="font-data text-data-sm truncate">
                        {deposit.signature}
                      </span>
                      <span>
                        {deposit.amount.toFixed(deposit.asset === 'SOL' ? 4 : 2)} {deposit.asset}
                      </span>
                      <span className="text-on-surface-variant">
                        {new Date(deposit.creditedAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleDeposit}
              disabled={!canDeposit}
              className="w-full md:w-auto px-6 py-3 bg-zinc-950 border border-zinc-700 text-zinc-50 font-ui text-label-caps uppercase hover:bg-zinc-900 hover:border-zinc-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDepositing ? 'Confirming...' : `Deposit ${depositAsset}`}
            </button>
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
