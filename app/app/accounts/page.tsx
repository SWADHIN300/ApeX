'use client'
import AppShell from '@/components/layout/AppShell'
import { Copy, ExternalLink, ShieldCheck } from 'lucide-react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useEffect, useState } from 'react'
import { useMarket } from '@/contexts/MarketContext'
import { useNetwork } from '@/contexts/WalletProvider'
import { useTrade } from '@/contexts/TradeContext'
import {
  depositProtocolMargin,
  getMarketBaseMint,
  withdrawProtocolMargin,
} from '@/lib/apexProtocol'

type TransferMode = 'deposit' | 'withdraw'

export default function AccountsPage() {
  const { publicKey, connected, sendTransaction } = useWallet()
  const { connection } = useConnection()
  const { network } = useNetwork()
  const { market } = useMarket()
  const { portfolio, refreshLedgerBalance } = useTrade()
  const [solBalance, setSolBalance] = useState(0)
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<TransferMode>('deposit')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [txError, setTxError] = useState('')
  const [txSignature, setTxSignature] = useState('')
  const [balanceError, setBalanceError] = useState('')

  useEffect(() => {
    if (!publicKey) {
      setSolBalance(0)
      setBalanceError('')
      return
    }

    connection.getBalance(publicKey)
      .then((balance) => setSolBalance(balance / 1e9))
      .catch(() => {
        setSolBalance(0)
        setBalanceError('Unable to load SOL balance from the current RPC endpoint.')
      })
  }, [connection, publicKey])

  const copyAddress = () => {
    if (!publicKey) return
    navigator.clipboard.writeText(publicKey.toBase58())
    alert('Address copied to clipboard')
  }

  const submitTransfer = async () => {
    if (!publicKey || !market) return

    const parsedAmount = Number(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setTxError('Enter an amount greater than 0.')
      return
    }

    setIsSubmitting(true)
    setTxError('')
    setTxSignature('')

    try {
      const signature = mode === 'deposit'
        ? await depositProtocolMargin({
            connection,
            publicKey,
            sendTransaction,
            pair: market.symbol,
            amount: parsedAmount,
          })
        : await withdrawProtocolMargin({
            connection,
            publicKey,
            sendTransaction,
            pair: market.symbol,
            amount: parsedAmount,
          })

      setTxSignature(signature)
      setAmount('')
      await refreshLedgerBalance()
    } catch (error) {
      setTxError(error instanceof Error ? error.message : 'Transaction failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  let collateralMint = ''
  try {
    collateralMint = market ? getMarketBaseMint(market.symbol).toBase58() : ''
  } catch {}

  const address = publicKey ? publicKey.toBase58() : 'Not connected'
  const shortAddress = publicKey ? `${address.slice(0, 6)}...${address.slice(-4)}` : '---'
  const explorerCluster = network === 'devnet' ? '?cluster=devnet' : ''
  const canSubmit = connected && publicKey && market && !isSubmitting && Number(amount) > 0

  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="font-ui text-headline-md text-on-surface">Account Settings</h1>
          <p className="font-ui text-body-sm text-on-surface-variant mt-0.5">
            Wallet-owned protocol account
          </p>
        </div>

        <div className="bg-surface border border-outline-variant p-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary-container flex items-center justify-center">
                <ShieldCheck size={24} className="text-on-primary-container" />
              </div>
              <div>
                <h3 className="font-ui text-headline-md text-on-surface">Connected Wallet</h3>
                <p className="font-ui text-body-sm text-on-surface-variant flex items-center gap-2">
                  <span className={connected ? 'text-long' : 'text-short'}>●</span>
                  {connected ? `${network.replace('-beta', '')} connected` : 'Not connected'}
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
              <span className="text-label-caps font-ui text-on-surface-variant">Wallet SOL</span>
              <div className="mt-2">
                <span className="font-data text-data-lg text-on-surface">{solBalance.toFixed(4)} SOL</span>
                {balanceError && <p className="mt-2 font-ui text-body-sm text-short">{balanceError}</p>}
              </div>
            </div>

            <div className="bg-surface-container border border-outline-variant p-4">
              <span className="text-label-caps font-ui text-on-surface-variant">Available Margin</span>
              <div className="mt-2 font-data text-data-lg text-on-surface">
                {portfolio.availableMargin.toFixed(2)} USDC
              </div>
            </div>

            <div className="bg-surface-container border border-outline-variant p-4">
              <span className="text-label-caps font-ui text-on-surface-variant">Locked Margin</span>
              <div className="mt-2 font-data text-data-lg text-on-surface">
                {portfolio.usedMargin.toFixed(2)} USDC
              </div>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-outline-variant">
          <div className="px-6 py-4 border-b border-outline-variant">
            <h3 className="font-ui text-headline-md text-on-surface">Protocol Collateral</h3>
            <p className="font-ui text-body-sm text-on-surface-variant mt-1">
              Funds move between your wallet token account and the on-chain market vault.
            </p>
          </div>
          <div className="p-6 space-y-5">
            <div className="bg-surface-container border border-outline-variant p-4">
              <span className="text-label-caps font-ui text-on-surface-variant">Market</span>
              <div className="mt-2 font-data text-data-md text-on-surface break-all">
                {market?.symbol ?? 'No market selected'}
              </div>
              {collateralMint && (
                <div className="mt-2 font-data text-data-sm text-on-surface-variant break-all">
                  Collateral mint: {collateralMint}
                </div>
              )}
            </div>

            {!collateralMint && (
              <div className="border border-short/40 bg-short/10 p-4 font-ui text-body-sm text-short">
                Set NEXT_PUBLIC_APEX_MARKET_MINTS or NEXT_PUBLIC_APEX_BASE_MINT before deposits are enabled.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-[12rem_1fr] gap-4">
              <div>
                <label className="text-label-caps font-ui text-on-surface-variant block mb-2">
                  Action
                </label>
                <select
                  value={mode}
                  onChange={(event) => setMode(event.target.value as TransferMode)}
                  className="w-full bg-bg-l2 border border-t-border p-3 font-ui text-body-sm text-text-main focus:border-primary outline-none"
                >
                  <option value="deposit" className="bg-bg-l2 text-text-main">Deposit</option>
                  <option value="withdraw" className="bg-bg-l2 text-text-main">Withdraw</option>
                </select>
              </div>
              <div>
                <label className="text-label-caps font-ui text-on-surface-variant block mb-2">
                  Amount
                </label>
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="w-full bg-bg-l2 border border-t-border p-3 font-ui text-body-sm text-text-main focus:border-primary outline-none"
                />
              </div>
            </div>

            {txError && (
              <div className="border border-short/40 bg-short/10 p-4 font-ui text-body-sm text-short">
                {txError}
              </div>
            )}

            {txSignature && (
              <a
                href={`https://explorer.solana.com/tx/${txSignature}${explorerCluster}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 font-ui text-body-sm text-long hover:underline"
              >
                Transaction confirmed <ExternalLink size={14} />
              </a>
            )}

            <button
              onClick={submitTransfer}
              disabled={!canSubmit || !collateralMint}
              className="w-full md:w-auto px-6 py-3 bg-zinc-950 border border-zinc-700 text-zinc-50 font-ui text-label-caps uppercase hover:bg-zinc-900 hover:border-zinc-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Confirming...' : `${mode} collateral`}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
