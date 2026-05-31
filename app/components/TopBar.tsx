"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import { useMarket } from "@/contexts/MarketContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { useNetwork } from "@/contexts/WalletProvider";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import MarketSearchModal from "./MarketSearchModal";
import {
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
} from "lucide-react";

export default function TopBar({
  isSideNavOpen = true,
  onToggleSideNav,
}: {
  isSideNavOpen?: boolean;
  onToggleSideNav?: () => void;
}) {
  const { market, setMarket, markets } = useMarket();
  const [price, setPrice] = useState(market?.price || 0);
  const [flashClass, setFlashClass] = useState("");
  const prevRef = useRef(market?.price || 0);
  const [flashKey, setFlashKey] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const { network, setNetwork } = useNetwork();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Ctrl+K / Cmd+K opens market search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowSearchModal((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!market) return;
    setPrice(market.price);
    prevRef.current = market.price;
  }, [market?.symbol, market?.price]);

  useEffect(() => {
    if (!market) return;
    const id = setInterval(() => {
      const delta = (Math.random() - 0.5) * (market.price * 0.001);
      const next = +(prevRef.current + delta).toFixed(2);
      prevRef.current = next;
      setPrice(next);
      setFlashKey((k) => k + 1);
      setFlashClass(delta >= 0 ? "flash-up" : "flash-down");
      setTimeout(() => setFlashClass(""), 300);
    }, 2500);
    return () => clearInterval(id);
  }, [market?.price]);

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2 });

  const filteredMarkets = markets.filter((m) =>
    m.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-bg-l1 bb-thin grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center">
      <Link
        href="/"
        className="flex h-14 w-16 shrink-0 flex-col items-center justify-center gap-0.5 select-none br-thin"
      >
        <Image
          src="/logo.png"
          alt="ApeX Logo"
          width={26}
          height={26}
          className="rounded-sm"
        />
        <span
          className="font-bold text-text-main leading-none tracking-widest"
          style={{ fontSize: "9px" }}
        >
          APEX
        </span>
      </Link>

      {/* Center: Nav + Search + Market Stats */}
      <div className="flex h-14 min-w-0 items-center gap-5 px-4">
        <button
          onClick={onToggleSideNav}
          className="w-[34px] h-[34px] flex shrink-0 items-center justify-center b-thin bg-bg-l1 text-text-muted hover:bg-bg-l4 hover:text-text-main cursor-pointer"
          aria-label={isSideNavOpen ? "Close sidebar" : "Open sidebar"}
          title={isSideNavOpen ? "Close sidebar" : "Open sidebar"}
          type="button"
        >
          {isSideNavOpen ? (
            <PanelLeftClose size={18} />
          ) : (
            <PanelLeftOpen size={18} />
          )}
        </button>
        {/* Dedicated Search Button */}
        <button
          onClick={() => setShowSearchModal(true)}
          className="flex items-center gap-2 h-[34px] px-3 shrink-0 b-thin bg-bg-l2 text-text-muted hover:bg-bg-l4 hover:text-text-main cursor-pointer transition-colors"
          aria-label="Search all markets"
          title="Search all markets (Ctrl+K)"
          type="button"
        >
          <Search size={14} />
          <span className="t-label-caps hidden lg:block" style={{ fontSize: "11px" }}>Search markets</span>
          <kbd className="hidden xl:block text-[9px] text-text-dim border border-t-border px-1 py-0.5 ml-1">⌘K</kbd>
        </button>
        <nav className="hidden md:flex shrink-0 items-center gap-4">
          <Link
            href="/trade"
            className="t-label-caps text-primary border-b-2 border-primary pb-1"
          >
            Trade
          </Link>
          {["Portfolio", "Stats", "Leaderboard"].map((tab) => (
            <Link
              key={tab}
              href={`/${tab.toLowerCase()}`}
              className="t-label-caps text-text-muted hover:text-text-main"
            >
              {tab}
            </Link>
          ))}
        </nav>

        <div className="hidden xl:flex min-w-0 flex-1 items-center justify-center gap-4 bl-thin pl-5 relative">
          <div className="relative flex w-48 shrink-0 items-center">
            <Search size={16} className="absolute left-3 text-text-muted" />
            <input
              type="text"
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              onBlur={() => setTimeout(() => setIsSearchOpen(false), 200)}
              className="w-full bg-bg-l2 border border-t-border pl-9 pr-3 py-1.5 t-body-sm text-text-main focus:border-primary outline-none transition-all"
            />
            {isSearchOpen && searchQuery && (
              <div className="absolute top-full left-0 mt-1 w-full bg-bg-surface border border-t-border shadow-lg z-50">
                {filteredMarkets.length > 0 ? (
                  filteredMarkets.map((m) => (
                    <div
                      key={m.symbol}
                      className="px-3 py-2 hover:bg-bg-l2 cursor-pointer t-data-sm text-text-main flex justify-between"
                      onMouseDown={() => {
                        setMarket(m);
                        setSearchQuery("");
                        setIsSearchOpen(false);
                      }}
                    >
                      <span>{m.symbol}</span>
                      <span className={m.change24h >= 0 ? "text-long" : "text-short"}>
                        {m.change24h > 0 ? "+" : ""}{m.change24h.toFixed(2)}%
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 t-body-sm text-text-muted">
                    No markets found
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex min-w-24 flex-col">
            <span className="t-label-caps text-text-muted">{market?.symbol || "Market"}</span>
            <span
              key={flashKey}
              className={`t-data-md text-text-price ${flashClass}`}
            >
              ${fmt(price)}
            </span>
          </div>
          <div className="flex min-w-20 flex-col">
            <span className="t-label-caps text-text-muted">24h Change</span>
            <span
              className={`t-data-md ${
                market?.change24h >= 0 ? "text-long" : "text-short"
              }`}
            >
              {market?.change24h > 0 ? "+" : ""}
              {market?.change24h.toFixed(2)}%
            </span>
          </div>
          <div className="flex min-w-24 flex-col">
            <span className="t-label-caps text-text-muted">24h High</span>
            <span className="t-data-md text-text-main">
              {fmt(market?.high24h || 0)}
            </span>
          </div>
          <div className="flex min-w-24 flex-col">
            <span className="t-label-caps text-text-muted">24h Vol</span>
            <span className="t-data-md text-text-main">
              {market?.volume24h}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Toggle + Icons + Connect */}
      <div className="flex h-14 items-center justify-end gap-2 px-3 bl-thin">
        <ThemeToggle />
        <Link
          href="/notifications"
          className="w-[34px] h-[34px] flex items-center justify-center hover:bg-bg-l4 cursor-pointer text-text-muted hover:text-text-main no-underline"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell size={17} />
        </Link>
        <Link
          href="/settings"
          className="w-[34px] h-[34px] flex items-center justify-center hover:bg-bg-l4 cursor-pointer text-text-muted hover:text-text-main no-underline"
          aria-label="Settings"
          title="Settings"
        >
          <Settings size={17} />
        </Link>
        <div className="hidden sm:flex items-center gap-2 ml-2">
          {mounted && (
            <>
              <button
                onClick={() => setNetwork(network === "devnet" ? "mainnet-beta" : "devnet")}
                className="h-8 px-3 flex items-center justify-center border border-t-border hover:bg-bg-l4 t-label-caps text-text-main transition-colors capitalize"
                style={{ fontSize: "11px" }}
              >
                {network.replace("-beta", "")}
              </button>
              <WalletMultiButton style={{ height: "32px", fontSize: "12px", background: "var(--primary-container)", borderRadius: "0px", fontFamily: "var(--font-sans)", textTransform: "uppercase", fontWeight: 700, padding: "0 16px" }} />
            </>
          )}
        </div>
      </div>
    </header>

    {/* Market Search Modal */}
      {showSearchModal && (
        <MarketSearchModal onClose={() => setShowSearchModal(false)} />
      )}
    </>
  );
}
