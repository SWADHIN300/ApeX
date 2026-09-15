"use client";

import { useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import AppShell from "@/components/layout/AppShell";
import {
  getSpotMarketConfig,
  useSpotMarket,
  type SpotMarketConfigEntry,
} from "@/hooks/useSpotMarket";
import {
  depositSpot,
  placeSpotOrder,
  withdrawSpot,
  type SpotSide,
} from "@/lib/spotProtocol";

const fmt = (n: number, dp = 4) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: dp });

export default function SpotPage() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const markets = useMemo(() => getSpotMarketConfig(), []);
  const [selected, setSelected] = useState<SpotMarketConfigEntry | null>(markets[0] ?? null);

  const spot = useSpotMarket(selected);

  const [side, setSide] = useState<SpotSide>("Buy");
  const [price, setPrice] = useState("");
  const [size, setSize] = useState("");
  const [depositBase, setDepositBase] = useState("");
  const [depositQuote, setDepositQuote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const walletReady = Boolean(publicKey && sendTransaction);

  const estimatedCost = useMemo(() => {
    const p = Number.parseFloat(price);
    const s = Number.parseFloat(size);
    if (!Number.isFinite(p) || !Number.isFinite(s) || p <= 0 || s <= 0) return null;
    return p * s;
  }, [price, size]);

  async function run(label: string, action: () => Promise<string>) {
    if (!walletReady) {
      setMessage({ kind: "err", text: "Connect a wallet first." });
      return;
    }
    setBusy(label);
    setMessage(null);
    try {
      const signature = await action();
      setMessage({
        kind: "ok",
        text: `${label} confirmed · ${signature.slice(0, 8)}…`,
      });
      spot.refresh();
    } catch (err) {
      setMessage({ kind: "err", text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const onPlaceOrder = () =>
    run("Order", () => {
      if (!selected) throw new Error("No spot market selected.");
      const p = Number.parseFloat(price);
      const s = Number.parseFloat(size);
      if (!Number.isFinite(p) || p <= 0) throw new Error("Enter a valid price.");
      if (!Number.isFinite(s) || s <= 0) throw new Error("Enter a valid size.");

      return placeSpotOrder({
        connection,
        publicKey: publicKey!,
        sendTransaction: sendTransaction!,
        baseMint: new PublicKey(selected.baseMint),
        quoteMint: new PublicKey(selected.quoteMint),
        side,
        price: p,
        size: s,
      });
    });

  const onDeposit = () =>
    run("Deposit", () => {
      if (!selected) throw new Error("No spot market selected.");
      return depositSpot({
        connection,
        publicKey: publicKey!,
        sendTransaction: sendTransaction!,
        baseMint: new PublicKey(selected.baseMint),
        quoteMint: new PublicKey(selected.quoteMint),
        baseAmount: Number.parseFloat(depositBase) || 0,
        quoteAmount: Number.parseFloat(depositQuote) || 0,
      });
    });

  const onWithdraw = () =>
    run("Withdraw", () => {
      if (!selected) throw new Error("No spot market selected.");
      return withdrawSpot({
        connection,
        publicKey: publicKey!,
        sendTransaction: sendTransaction!,
        baseMint: new PublicKey(selected.baseMint),
        quoteMint: new PublicKey(selected.quoteMint),
        baseAmount: Number.parseFloat(depositBase) || 0,
        quoteAmount: Number.parseFloat(depositQuote) || 0,
      });
    });

  if (markets.length === 0) {
    return (
      <AppShell>
        <div className="p-6 max-w-2xl">
          <h1 className="t-label-caps text-text-main mb-3">Spot</h1>
          <div className="b-thin bg-bg-surface p-5 rounded-sm">
            <p className="t-body-md text-text-main mb-3">No spot markets configured.</p>
            <p className="t-body-sm text-text-dim mb-4">
              Spot markets are on-chain order books keyed by their token pair. Set{" "}
              <span className="font-mono text-text-main">NEXT_PUBLIC_APEX_SPOT_MARKETS</span> to a
              JSON array to list them here:
            </p>
            <pre className="bg-bg-l1 p-3 rounded-sm text-[10px] font-mono text-text-muted overflow-x-auto">
{`[{"label":"SOL/USDC",
  "baseSymbol":"SOL","quoteSymbol":"USDC",
  "baseMint":"So11111111111111111111111111111111111111112",
  "quoteMint":"4zMMC9srt5Ri5X14GVnYj7wAVTJGN1YjBe5HL4s3bQDa"}]`}
            </pre>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-4 lg:p-6 space-y-4">
        {/* Market selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="t-label-caps text-text-main">Spot</h1>
          <div className="flex items-center gap-1">
            {markets.map((m) => (
              <button
                key={m.label}
                onClick={() => setSelected(m)}
                className={`px-2.5 py-1 rounded-sm t-label-caps transition-colors ${
                  selected?.label === m.label
                    ? "bg-bg-l4 text-text-main"
                    : "text-text-dim hover:text-text-main hover:bg-bg-l2"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider rounded border bg-long/10 text-long border-long/30">
            on-chain order book
          </span>
        </div>

        {spot.notInitialized && (
          <div className="b-thin bg-bg-surface p-4 rounded-sm">
            <p className="t-body-sm text-text-main">
              This market has not been created on chain yet. Its PDA is derived from the token
              pair, so it must be initialized once via{" "}
              <span className="font-mono">initialize_spot_market</span> before trading.
            </p>
          </div>
        )}

        {spot.error && (
          <div className="b-thin bg-bg-surface p-3 rounded-sm">
            <p className="t-body-sm text-short">{spot.error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Order book */}
          <section className="b-thin bg-bg-surface rounded-sm overflow-hidden">
            <div className="h-9 bb-thin flex items-center px-3">
              <span className="t-label-caps text-text-main">Order Book</span>
            </div>
            <div className="grid grid-cols-2 px-3 py-1.5 t-label-caps text-text-dim bg-bg-l2">
              <span>Price</span>
              <span className="text-right">Size</span>
            </div>
            <div className="flex flex-col-reverse">
              {spot.asks.slice(0, 8).map((a, i) => (
                <div key={`a${i}`} className="grid grid-cols-2 px-3 h-5 items-center t-data-sm">
                  <span className="text-short">{fmt(a.price, 2)}</span>
                  <span className="text-right">{fmt(a.size)}</span>
                </div>
              ))}
            </div>
            <div className="py-1.5 px-3 border-y border-t-border-soft bg-bg-l2">
              <span className="t-label-caps text-text-muted">
                {spot.asks.length === 0 && spot.bids.length === 0
                  ? "No resting orders"
                  : `Spread ${
                      spot.asks[0] && spot.bids[0]
                        ? fmt(spot.asks[0].price - spot.bids[0].price, 2)
                        : "--"
                    }`}
              </span>
            </div>
            <div>
              {spot.bids.slice(0, 8).map((b, i) => (
                <div key={`b${i}`} className="grid grid-cols-2 px-3 h-5 items-center t-data-sm">
                  <span className="text-long">{fmt(b.price, 2)}</span>
                  <span className="text-right">{fmt(b.size)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Order entry */}
          <section className="b-thin bg-bg-surface rounded-sm p-4 space-y-3">
            <div className="grid grid-cols-2 gap-1">
              {(["Buy", "Sell"] as SpotSide[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className={`py-1.5 rounded-sm t-label-caps transition-colors ${
                    side === s
                      ? s === "Buy"
                        ? "bg-long/20 text-long"
                        : "bg-short/20 text-short"
                      : "bg-bg-l2 text-text-dim hover:text-text-main"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <label className="block">
              <span className="t-label-caps text-text-dim">
                Price ({selected?.quoteSymbol ?? "quote"})
              </span>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="mt-1 w-full bg-bg-l1 b-thin rounded-sm px-2 py-1.5 font-mono text-sm text-text-main outline-none focus:border-primary"
              />
            </label>

            <label className="block">
              <span className="t-label-caps text-text-dim">
                Size ({selected?.baseSymbol ?? "base"})
              </span>
              <input
                value={size}
                onChange={(e) => setSize(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="mt-1 w-full bg-bg-l1 b-thin rounded-sm px-2 py-1.5 font-mono text-sm text-text-main outline-none focus:border-primary"
              />
            </label>

            <div className="flex items-center justify-between t-body-sm text-text-dim">
              <span>{side === "Buy" ? "Quote reserved" : "Base reserved"}</span>
              <span className="font-mono text-text-main">
                {estimatedCost === null
                  ? "--"
                  : side === "Buy"
                    ? `${fmt(estimatedCost, 2)} ${selected?.quoteSymbol ?? ""}`
                    : `${fmt(Number.parseFloat(size) || 0)} ${selected?.baseSymbol ?? ""}`}
              </span>
            </div>

            <button
              onClick={onPlaceOrder}
              disabled={busy !== null || spot.notInitialized || !walletReady}
              className={`w-full py-2 rounded-sm t-label-caps font-semibold transition-opacity disabled:opacity-40 ${
                side === "Buy" ? "bg-long text-black" : "bg-short text-black"
              }`}
            >
              {busy === "Order" ? "Submitting…" : `${side} ${selected?.baseSymbol ?? ""}`}
            </button>

            {!walletReady && (
              <p className="t-body-sm text-text-dim">Connect a wallet to trade.</p>
            )}
          </section>

          {/* Balances + transfers */}
          <section className="b-thin bg-bg-surface rounded-sm p-4 space-y-3">
            <span className="t-label-caps text-text-main">Market Balance</span>

            <div className="space-y-1.5 t-body-sm">
              {[
                { label: `${selected?.baseSymbol ?? "Base"} free`, value: spot.balances.baseFree },
                { label: `${selected?.baseSymbol ?? "Base"} locked`, value: spot.balances.baseLocked },
                { label: `${selected?.quoteSymbol ?? "Quote"} free`, value: spot.balances.quoteFree },
                { label: `${selected?.quoteSymbol ?? "Quote"} locked`, value: spot.balances.quoteLocked },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-text-dim">{row.label}</span>
                  <span className="font-mono text-text-main">{fmt(row.value)}</span>
                </div>
              ))}
            </div>

            <p className="text-[10px] font-mono text-text-dim leading-snug">
              Locked balance is reserved by resting orders and cannot be withdrawn until they
              fill or are cancelled.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="t-label-caps text-text-dim">{selected?.baseSymbol ?? "Base"}</span>
                <input
                  value={depositBase}
                  onChange={(e) => setDepositBase(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="mt-1 w-full bg-bg-l1 b-thin rounded-sm px-2 py-1.5 font-mono text-xs text-text-main outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="t-label-caps text-text-dim">{selected?.quoteSymbol ?? "Quote"}</span>
                <input
                  value={depositQuote}
                  onChange={(e) => setDepositQuote(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="mt-1 w-full bg-bg-l1 b-thin rounded-sm px-2 py-1.5 font-mono text-xs text-text-main outline-none focus:border-primary"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onDeposit}
                disabled={busy !== null || spot.notInitialized || !walletReady}
                className="py-1.5 rounded-sm t-label-caps bg-bg-l3 text-text-main hover:bg-bg-l4 transition-colors disabled:opacity-40"
              >
                {busy === "Deposit" ? "…" : "Deposit"}
              </button>
              <button
                onClick={onWithdraw}
                disabled={busy !== null || spot.notInitialized || !walletReady}
                className="py-1.5 rounded-sm t-label-caps bg-bg-l3 text-text-main hover:bg-bg-l4 transition-colors disabled:opacity-40"
              >
                {busy === "Withdraw" ? "…" : "Withdraw"}
              </button>
            </div>
          </section>
        </div>

        {message && (
          <div className="b-thin bg-bg-surface p-3 rounded-sm">
            <p className={`t-body-sm ${message.kind === "ok" ? "text-long" : "text-short"}`}>
              {message.text}
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
