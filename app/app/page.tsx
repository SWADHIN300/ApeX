"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Wallet,
  LineChart,
  ShieldCheck,
  Gavel,
  Zap,
  BookOpen,
  GitBranch,
} from "lucide-react";
import { useMarket } from "@/contexts/MarketContext";
import { useOracle } from "@/hooks/useOracle";

const fmtPrice = (p: number | null | undefined) =>
  p ? p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";

const FEATURES: {
  icon: React.ReactNode;
  title: string;
  description: string;
}[] = [
  {
    icon: <BookOpen size={18} />,
    title: "On-chain order book",
    description:
      "Bids and asks live in a program-owned account, matched by a permissionless keeper — not an off-chain server.",
  },
  {
    icon: <ShieldCheck size={18} />,
    title: "Pyth-verified pricing",
    description:
      "Every open, close, and liquidation reads a Pyth price account on-chain with staleness and confidence checks enforced in the program.",
  },
  {
    icon: <Gavel size={18} />,
    title: "Liquidation auctions",
    description:
      "Underwater positions are settled by open, on-chain bidding instead of a flat fee paid to whichever keeper lands first — less value lost to latency races.",
  },
  {
    icon: <Zap size={18} />,
    title: "Autonomous keeper",
    description:
      "Order matching, funding settlement, and liquidation auctions are all driven by a permissionless keeper bot anyone can run.",
  },
];

export default function LandingPage() {
  const { market } = useMarket();
  const oracle = useOracle();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const oracleLive = mounted && oracle?.isOracleValid && oracle.oraclePrice;
  const displayPrice = oracleLive ? oracle!.oraclePrice : market?.price;

  return (
    <div className="min-h-screen bg-bg-base text-text-main">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-t-border bg-bg-base/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="ApeX" width={24} height={24} className="rounded-sm" />
            <span className="t-label-caps text-text-main font-bold tracking-wider">APEX</span>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#features" className="t-body-sm text-text-dim hover:text-text-main transition-colors">
              Features
            </a>
            <a href="#protocol" className="t-body-sm text-text-dim hover:text-text-main transition-colors">
              Protocol
            </a>
            <a
              href="https://github.com/SWADHIN300/ApeX"
              target="_blank"
              rel="noreferrer"
              className="t-body-sm text-text-dim hover:text-text-main transition-colors inline-flex items-center gap-1"
            >
              <GitBranch size={13} /> GitHub
            </a>
          </nav>
          <Link
            href="/trade"
            className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 t-label-caps font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Launch App <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-t-border">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-t-border bg-bg-l1 px-3 py-1 t-label-caps text-text-dim">
            <span className="relative flex h-1.5 w-1.5">
              <span
                className={`absolute inline-flex h-full w-full rounded-full ${
                  oracleLive ? "bg-long animate-ping" : "bg-text-dim"
                } opacity-75`}
              />
              <span
                className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                  oracleLive ? "bg-long" : "bg-text-dim"
                }`}
              />
            </span>
            {oracleLive ? "Live on Solana Devnet" : "Connecting to oracle…"}
          </div>

          <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            On-chain perpetuals,{" "}
            <span className="text-primary">settled by auction</span>, not by
            whoever's fastest.
          </h1>

          <p className="mt-5 max-w-xl t-body-md text-text-dim">
            ApeX is a perpetual futures protocol on Solana with a fully
            on-chain order book, Pyth-verified pricing, and liquidation
            auctions that return excess value to liquidated traders instead of
            handing it to the fastest keeper.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/trade"
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-5 py-2.5 t-label-caps font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Wallet size={14} /> Launch App
            </Link>
            <a
              href="#protocol"
              className="inline-flex items-center gap-2 rounded-sm border border-t-border px-5 py-2.5 t-label-caps text-text-main hover:bg-bg-l1 transition-colors"
            >
              <LineChart size={14} /> How it works
            </a>
          </div>

          {/* Live price card */}
          <div className="mt-12 inline-flex flex-col gap-1 rounded-sm border border-t-border bg-bg-l1 px-5 py-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="t-label-caps text-text-dim">
                {market?.symbol ?? "BTC-PERP"}
              </span>
              <span
                className={`px-1.5 py-0.5 text-[9px] font-mono font-medium uppercase tracking-wider rounded border ${
                  oracleLive
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-bg-l2 text-text-dim border-t-border"
                }`}
              >
                {oracleLive ? "on-chain oracle" : "reference feed"}
              </span>
            </div>
            <span className="t-data-lg font-mono text-3xl text-text-price">
              ${fmtPrice(displayPrice)}
            </span>
            {oracle?.oracleAddress && (
              <span className="t-body-sm text-text-dim font-mono truncate max-w-[280px]">
                oracle: {oracle.oracleAddress.slice(0, 4)}…{oracle.oracleAddress.slice(-4)}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="t-label-caps text-primary">Why ApeX</h2>
        <p className="mt-2 max-w-lg text-2xl font-semibold tracking-tight">
          Built on-chain, from the order book to the liquidation engine.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-sm border border-t-border bg-bg-l1 p-5 transition-colors hover:border-primary/40"
            >
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-sm bg-primary/10 text-primary">
                {feature.icon}
              </div>
              <h3 className="mt-4 t-body-md font-semibold text-text-main">
                {feature.title}
              </h3>
              <p className="mt-1.5 t-body-sm text-text-dim">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Protocol explainer */}
      <section id="protocol" className="border-t border-t-border bg-bg-l1/40">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="t-label-caps text-primary">How it works</h2>
          <p className="mt-2 max-w-lg text-2xl font-semibold tracking-tight">
            Two data sources, used honestly.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-sm border border-t-border bg-bg-base p-5">
              <span className="t-label-caps text-text-dim">Charting</span>
              <p className="mt-2 t-body-sm text-text-main">
                Candles are streamed live from Binance, Coinbase, or Kraken so
                you get deep historical context and volume — this is reference
                market data, clearly labeled as such in the terminal.
              </p>
            </div>
            <div className="rounded-sm border border-t-border bg-bg-base p-5">
              <span className="t-label-caps text-text-dim">Settlement</span>
              <p className="mt-2 t-body-sm text-text-main">
                Every trade, liquidation, and funding payment reads a Pyth
                price account on-chain in the Anchor program itself — the
                terminal's on-chain order book tab shows exactly what the
                protocol sees, not the exchange feed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">
          Trade perpetuals on Solana, on-chain end to end.
        </h2>
        <Link
          href="/trade"
          className="mt-6 inline-flex items-center gap-2 rounded-sm bg-primary px-6 py-3 t-label-caps font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Launch App <ArrowRight size={14} />
        </Link>
        <p className="mt-4 t-body-sm text-text-dim">
          Running on Solana Devnet. Not audited — do not deposit mainnet assets.
        </p>
      </section>

      <footer className="border-t border-t-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 t-body-sm text-text-dim">
          <span>© {new Date().getFullYear()} ApeX Protocol</span>
          <a
            href="https://github.com/SWADHIN300/ApeX"
            target="_blank"
            rel="noreferrer"
            className="hover:text-text-main transition-colors"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
