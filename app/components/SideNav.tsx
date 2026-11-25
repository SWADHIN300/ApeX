"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpDown,
  CandlestickChart,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FlaskConical,
  Gift,
  History,
  Repeat2,
  RotateCcw,
  Settings,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { usePaperTrading } from "@/contexts/PaperTradingContext";
import { useNetwork } from "@/contexts/WalletProvider";
import { useTrade } from "@/contexts/TradeContext";
import { useClientMounted } from "@/hooks/useLocalStorageState";

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
}

const mainItems: NavItem[] = [
  { icon: ArrowUpDown, label: "Trade",    href: "/trade"   },
  { icon: CandlestickChart, label: "Spot", href: "/spot"   },
  { icon: Repeat2,    label: "Swap",     href: "/swap"    },
  { icon: TrendingUp, label: "Markets",  href: "/markets" },
  { icon: History,    label: "History",  href: "/history" },
  { icon: Gift,       label: "Rewards",  href: "/rewards" },
  { icon: User,       label: "Account",  href: "/accounts"},
];

const bottomItems: NavItem[] = [
  { icon: Settings,   label: "Settings", href: "/settings" },
  { icon: CircleHelp, label: "Support",  href: "/settings" },
];

interface SideNavProps {
  isOpen: boolean;
  isExpanded: boolean;
  isMobile: boolean;
  onToggleExpand: () => void;
}

export default function SideNav({ isOpen, isExpanded, isMobile, onToggleExpand }: SideNavProps) {
  const pathname = usePathname();
  const mounted = useClientMounted();
  const { network } = useNetwork();
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const { portfolio } = useTrade();
  const {
    isPaperTrading,
    setPaperTrading,
    paperBalance,
    resetPaperAccount,
    paperAccountWallet,
    paperAccountLoading,
    paperAccountError,
  } = usePaperTrading();

  const [solBalanceState, setSolBalanceState] = useState<{
    walletAddress: string;
    balance: number;
  } | null>(null);
  const currentWalletAddress = publicKey?.toBase58() ?? null;
  const solBalance = currentWalletAddress && solBalanceState?.walletAddress === currentWalletAddress
    ? solBalanceState.balance
    : null;

  useEffect(() => {
    if (!publicKey || !connected) {
      return;
    }
    let active = true;
    connection.getBalance(publicKey)
      .then((bal) => {
        if (active) setSolBalanceState({ walletAddress: publicKey.toBase58(), balance: bal / 1e9 });
      })
      .catch(() => {
        if (active) setSolBalanceState(null);
      });
    return () => {
      active = false;
    };
  }, [connection, publicKey, connected]);

  const tooltipClass = `pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap
    border border-t-border bg-bg-l2 px-3 py-1.5 t-label-caps text-text-main shadow-xl
    opacity-0 transition-opacity duration-150 rounded-sm
    group-hover:opacity-100 group-focus-visible:opacity-100 ${isExpanded ? "hidden" : ""}`;

  return (
    <aside
      className={`apex-sidenav fixed left-0 top-14 z-40 h-[calc(100vh-56px)] flex flex-col bg-bg-surface br-thin transition-[transform,width] duration-300 ${isMobile ? "mobile-nav-visible" : ""} ${isOpen ? "nav-open" : ""} ${
        isOpen
          ? isExpanded
            ? "w-52 translate-x-0"
            : "w-16 translate-x-0"
          : "w-0 -translate-x-full"
      }`}
      style={{ background: "linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-base) 100%)" }}
    >
      {/* Main nav */}
      <div className="flex flex-col gap-1 p-2 mt-2 flex-1 overflow-y-auto overflow-x-hidden">
        {mainItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              className={`group relative flex h-10 w-full items-center gap-3.5 px-3 cursor-pointer
                transition-all duration-200 focus-visible:outline-none focus-visible:ring-1
                focus-visible:ring-primary no-underline
                ${isActive
                  ? "nav-item-active"
                  : "text-text-muted hover:text-text-main border-l-2 border-transparent"
                }`}
              style={!isActive ? {
                transition: "background 0.2s, color 0.2s",
              } : undefined}
              onMouseEnter={!isActive ? (e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "linear-gradient(90deg, rgba(124,111,255,0.08) 0%, transparent 100%)";
              } : undefined}
              onMouseLeave={!isActive ? (e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              } : undefined}
            >
              <Icon
                size={17}
                className="shrink-0"
                style={isActive ? {
                  filter: "drop-shadow(0 0 5px var(--primary))",
                  color: "var(--primary)",
                } : undefined}
              />
              <span
                className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                  isExpanded
                    ? "w-auto opacity-100"
                    : "w-0 overflow-hidden opacity-0"
                }`}
                style={{ letterSpacing: "-0.01em" }}
              >
                {item.label}
              </span>
              <span className={tooltipClass}>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Account / Paper Trading Section */}
      {mounted && network === "devnet" && (
        <div className="px-2 pb-2">
          {isExpanded ? (
            <div
              className="p-2 rounded border transition-all duration-200"
              style={{
                background: isPaperTrading
                  ? "linear-gradient(180deg, rgba(251, 191, 36, 0.08) 0%, rgba(251, 191, 36, 0.02) 100%)"
                  : "linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)",
                borderColor: isPaperTrading ? "rgba(251, 191, 36, 0.3)" : "var(--border)",
              }}
            >
              {/* Mode Switcher */}
              <div className="flex items-center gap-1 p-0.5 rounded bg-bg-l2 border border-border/60 mb-2">
                <button
                  type="button"
                  onClick={() => void setPaperTrading(false)}
                  className={`flex-1 py-1 text-center t-label-caps transition-all rounded-sm cursor-pointer ${
                    !isPaperTrading
                      ? "bg-primary/20 text-primary border border-primary/40 font-semibold"
                      : "text-text-muted hover:text-text-main"
                  }`}
                  style={{ fontSize: "9px" }}
                  title="Trade using your connected Solana Devnet wallet funds"
                >
                  Wallet
                </button>
                <button
                  type="button"
                  onClick={() => void setPaperTrading(true)}
                  disabled={paperAccountLoading}
                  className={`flex-1 py-1 flex items-center justify-center gap-1 t-label-caps transition-all rounded-sm cursor-pointer ${
                    isPaperTrading
                      ? "bg-amber-400/20 text-amber-400 border border-amber-400/40 font-semibold"
                      : "text-text-muted hover:text-text-main"
                  }`}
                  style={{ fontSize: "9px" }}
                  title="Start or restore a wallet-linked account with $10,000 virtual USDC"
                >
                  <FlaskConical size={10} />
                  Paper
                </button>
              </div>

              {paperAccountError && (
                <p className="mb-2 text-[10px] leading-tight text-red-400" role="status">
                  {paperAccountError}
                </p>
              )}

              {/* Mode Specific Info */}
              {isPaperTrading ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span
                      className="t-label-caps text-amber-400 font-medium flex items-center gap-1 truncate"
                      style={{ fontSize: "9px" }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                      Paper Trading (Devnet)
                    </span>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-muted font-medium">Virtual Balance</div>
                    <div className="font-mono text-xs font-semibold text-amber-300">
                      ${paperBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                    </div>
                  </div>
                  {paperAccountWallet && (
                    <div className="text-[9px] text-text-dim">
                      Saved to {paperAccountWallet.slice(0, 4)}…{paperAccountWallet.slice(-4)}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={resetPaperAccount}
                    className="w-full mt-1 py-1 px-2 flex items-center justify-center gap-1 rounded text-amber-400/90 hover:text-amber-300 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 transition-colors t-label-caps cursor-pointer"
                    style={{ fontSize: "9px" }}
                    title="Reset virtual balance to $10,000.00 USDC and clear paper trades"
                  >
                    <RotateCcw size={10} />
                    Reset Account
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span
                      className="t-label-caps text-text-muted flex items-center gap-1"
                      style={{ fontSize: "9px" }}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${connected ? "bg-long" : "bg-text-dim"}`} />
                      Devnet Wallet
                    </span>
                    {connected && publicKey && (
                      <span className="text-[9px] font-mono text-text-dim">
                        {`${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-3)}`}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] text-text-muted font-medium">Wallet Balance</div>
                    <div className="font-mono text-xs font-semibold text-text-main">
                      {connected ? `${solBalance !== null ? solBalance.toFixed(3) : "..."} SOL` : "Not connected"}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-text-muted pt-0.5">
                    <span>Margin:</span>
                    <span className="font-mono text-text-main">${portfolio.availableMargin.toFixed(2)} USDC</span>
                  </div>
                  <Link
                    href="/accounts"
                    className="w-full mt-1 py-1 px-2 flex items-center justify-center gap-1 rounded text-primary hover:text-primary-bright bg-primary/10 hover:bg-primary/20 border border-primary/30 transition-colors t-label-caps no-underline"
                    style={{ fontSize: "9px" }}
                  >
                    <Wallet size={10} />
                    Deposit / Margin
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="flex justify-center">
              {isPaperTrading ? (
                <button
                  type="button"
                  onClick={() => void setPaperTrading(false)}
                  className="group relative flex h-10 w-10 items-center justify-center rounded border border-amber-400/40 bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 transition-all cursor-pointer"
                  title="Paper Trading ON ($10k USDC) — click to switch to Wallet"
                  aria-label="Paper Trading Mode Active"
                >
                  <FlaskConical size={18} />
                  <span className={tooltipClass}>
                    Paper: ${paperBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDC
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void setPaperTrading(true)}
                  disabled={paperAccountLoading}
                  className="group relative flex h-10 w-10 items-center justify-center rounded border border-border bg-bg-l2 text-text-muted hover:text-text-main hover:border-border-bright transition-all cursor-pointer"
                  title="Devnet Wallet Mode — click for Paper Trading"
                  aria-label="Devnet Wallet Mode"
                >
                  <Wallet size={18} />
                  <span className={tooltipClass}>
                    {connected ? `SOL: ${solBalance !== null ? solBalance.toFixed(2) : "..."}` : "Devnet Wallet"}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bottom nav */}
      <div className="flex flex-col gap-1 p-2 bt-thin">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              className="group relative flex h-10 w-full items-center gap-3.5 px-3 text-text-muted
                hover:text-text-main cursor-pointer transition-all duration-200 border-l-2
                border-transparent no-underline focus-visible:outline-none focus-visible:ring-1
                focus-visible:ring-primary"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "linear-gradient(90deg, rgba(124,111,255,0.07) 0%, transparent 100%)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <Icon size={17} className="shrink-0" />
              <span
                className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                  isExpanded
                    ? "w-auto opacity-100"
                    : "w-0 overflow-hidden opacity-0"
                }`}
                style={{ letterSpacing: "-0.01em" }}
              >
                {item.label}
              </span>
              <span className={tooltipClass}>{item.label}</span>
            </Link>
          );
        })}

        {/* Expand / Collapse toggle */}
        <button
          onClick={onToggleExpand}
          className="group relative flex h-10 w-full items-center gap-3.5 px-3 text-text-dim
            hover:text-text-muted cursor-pointer transition-all duration-200 border-l-2
            border-transparent bt-thin mt-1 focus-visible:outline-none focus-visible:ring-1
            focus-visible:ring-primary"
          aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
          title={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              "linear-gradient(90deg, rgba(124,111,255,0.05) 0%, transparent 100%)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          {isExpanded ? (
            <ChevronLeft size={17} className="shrink-0" />
          ) : (
            <ChevronRight size={17} className="shrink-0" />
          )}
          <span
            className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${
              isExpanded
                ? "w-auto opacity-100"
                : "w-0 overflow-hidden opacity-0"
            }`}
            style={{ letterSpacing: "-0.01em" }}
          >
            Collapse
          </span>
          <span className={tooltipClass}>
            {isExpanded ? "Collapse" : "Expand"}
          </span>
        </button>
      </div>
    </aside>
  );
}
