'use client'
import AppShell from '@/components/layout/AppShell'
import { Coins, Copy, ExternalLink, FlaskConical, RotateCcw, ShieldCheck } from 'lucide-react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useEffect, useState } from 'react'
import { useMarket } from '@/contexts/MarketContext'
import { useNetwork } from '@/contexts/WalletProvider'
import { useTrade } from '@/contexts/TradeContext'
import { usePaperTrading } from '@/contexts/PaperTradingContext'
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
  const {
    isPaperTrading,
    setPaperTrading,
    paperBalance,
    resetPaperAccount,
    paperAccountWallet,
    paperAccountLoading,
    paperAccountError,
  } = usePaperTrading()
  const [balanceState, setBalanceState] = useState<{
    address: string | null
    balance: number
    error: string
  }>({ address: null, balance: 0, error: '' })
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<TransferMode>('deposit')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAirdropping, setIsAirdropping] = useState(false)
  const [airdropMsg, setAirdropMsg] = useState('')
  const [txError, setTxError] = useState('')
  const [txSignature, setTxSignature] = useState('')
  const walletAddress = publicKey?.toBase58() ?? null

  const requestAirdrop = async () => {
    if (!publicKey) return
    setIsAirdropping(true)
    setAirdropMsg('')
    try {
      const sig = await connection.requestAirdrop(publicKey, 1e9)
      await connection.confirmTransaction(sig, 'confirmed')
      const bal = await connection.getBalance(publicKey)
      setBalanceState({ address: walletAddress, balance: bal / 1e9, error: '' })
      setAirdropMsg('Airdropped 1.0 SOL successfully!')
    } catch (err: unknown) {
      setAirdropMsg(err instanceof Error ? err.message : 'Airdrop rate-limited. Try faucet.solana.com')
    } finally {
      setIsAirdropping(false)
    }
  }

  useEffect(() => {
    if (!publicKey || !walletAddress) return
    let active = true

    connection.getBalance(publicKey)
      .then((balance) => {
        if (active) setBalanceState({ address: walletAddress, balance: balance / 1e9, error: '' })
      })
      .catch(() => {
        if (active) {
          setBalanceState({
            address: walletAddress,
            balance: 0,
            error: 'Unable to load SOL balance from the current RPC endpoint.',
          })
        }
      })
    return () => { active = false }
  }, [connection, publicKey, walletAddress])

  const solBalance = balanceState.address === walletAddress ? balanceState.balance : 0
  const balanceError = balanceState.address === walletAddress ? balanceState.error : ''

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

        {/* Paper Trading & Trading Mode Card */}
        {network === 'devnet' && (
          <div className="bg-surface border border-outline-variant p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 flex items-center justify-center rounded ${
                    isPaperTrading ? 'bg-amber-400/20 text-amber-400' : 'bg-primary/20 text-primary'
                  }`}
                >
                  <FlaskConical size={24} />
                </div>
                <div>
                  <h3 className="font-ui text-headline-md text-on-surface">Trading Mode (Devnet)</h3>
                  <p className="font-ui text-body-sm text-on-surface-variant">
                    {isPaperTrading
                      ? 'Paper Trading Active — Simulated orders with virtual balance'
                      : 'Live Devnet Wallet Active — Trading with real devnet wallet funds'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-surface-container p-1 border border-outline-variant rounded">
                <button
                  type="button"
                  onClick={() => void setPaperTrading(false)}
                  className={`px-3 py-1.5 font-ui text-label-caps rounded transition-all cursor-pointer ${
                    !isPaperTrading
                      ? 'bg-primary text-black font-semibold shadow'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Devnet Wallet
                </button>
                <button
                  type="button"
                  onClick={() => void setPaperTrading(true)}
                  disabled={paperAccountLoading}
                  className={`px-3 py-1.5 font-ui text-label-caps rounded flex items-center gap-1.5 transition-all cursor-pointer ${
                    isPaperTrading
                      ? 'bg-amber-400 text-black font-semibold shadow'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <FlaskConical size={14} />
                  {isPaperTrading ? 'Paper Trading Active' : 'Start with virtual funds'}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-ui text-body-sm text-on-surface-variant">
                Connect your wallet to save or restore your practice account. Starting paper trading claims $10,000 in virtual USDC; no tokens are deposited or transferred.
              </p>
              {paperAccountWallet && (
                <p className="font-ui text-label-caps text-amber-400">
                  Saved to wallet {paperAccountWallet.slice(0, 5)}…{paperAccountWallet.slice(-5)}
                </p>
              )}
              {paperAccountError && (
                <p className="font-ui text-body-sm text-red-400" role="status">
                  {paperAccountError}
                </p>
              )}
              {paperAccountLoading && (
                <p className="font-ui text-body-sm text-on-surface-variant" role="status">
                  Connecting to your saved paper account…
                </p>
              )}
            </div>

            {isPaperTrading ? (
              <div className="p-4 bg-amber-400/5 border border-amber-400/30 rounded space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-label-caps font-ui text-amber-400">
                      Paper Trading Mode (Devnet) — Virtual Balance
                    </div>
                    <div className="text-2xl font-mono font-bold text-amber-300 mt-1">
                      ${paperBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                    </div>
                    <p className="font-ui text-body-sm text-on-surface-variant mt-1">
                      Practice trading at live mark prices with zero financial risk. Reset anytime to start fresh.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resetPaperAccount}
                    className="px-4 py-2 flex items-center gap-2 font-ui text-label-caps text-amber-400 border border-amber-400/40 bg-amber-400/10 hover:bg-amber-400/20 transition-colors rounded cursor-pointer"
                    title="Reset virtual balance to $10,000.00 USDC"
                  >
                    <RotateCcw size={14} />
                    Reset Account
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-surface-container border border-outline-variant rounded space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-label-caps font-ui text-on-surface-variant">
                      Devnet Wallet Balance
                    </div>
                    <div className="text-2xl font-mono font-bold text-on-surface mt-1">
                      {solBalance.toFixed(4)} SOL
                    </div>
                    <p className="font-ui text-body-sm text-on-surface-variant mt-1">
                      Using funds from your connected Solana devnet wallet. Deposit collateral below to trade protocol margin.
                    </p>
                  </div>
                  {connected && (
                    <button
                      type="button"
                      onClick={requestAirdrop}
                      disabled={isAirdropping}
                      className="px-4 py-2 flex items-center gap-2 font-ui text-label-caps text-on-surface border border-outline-variant bg-surface-high hover:bg-surface transition-colors rounded cursor-pointer disabled:opacity-50"
                    >
                      <Coins size={14} />
                      {isAirdropping ? 'Requesting...' : 'Request 1 SOL Airdrop'}
                    </button>
                  )}
                </div>
                {airdropMsg && (
                  <p className="font-ui text-body-sm text-primary">{airdropMsg}</p>
                )}
              </div>
            )}
          </div>
        )}

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
