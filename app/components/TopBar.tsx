"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import { useMarket } from "@/contexts/MarketContext";
import { useNetwork } from "@/contexts/WalletProvider";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import MarketSearchModal from "./MarketSearchModal";
import AuthActions from "./AuthActions";
import {
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  TrendingUp,
  TrendingDown,
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
  const [priceDir, setPriceDir] = useState<"up" | "down" | null>(null);
  const prevRef = useRef(market?.price || 0);
  const [flashKey, setFlashKey] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const { network, setNetwork } = useNetwork();
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { label: "Trade",       href: "/trade"       },
    { label: "Portfolio",   href: "/portfolio"   },
    { label: "Stats",       href: "/stats"       },
    { label: "Leaderboard", href: "/leaderboard" },
  ];

  useEffect(() => { setMounted(true); }, []);

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
      const dir = delta >= 0 ? "up" : "down";
      setPriceDir(dir);
      setFlashClass(dir === "up" ? "flash-up" : "flash-down");
      setTimeout(() => { setFlashClass(""); setPriceDir(null); }, 500);
    }, 2500);
    return () => clearInterval(id);
  }, [market?.price]);

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2 });

  const filteredMarkets = markets.filter((m) =>
    m.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isPositive = (market?.change24h ?? 0) >= 0;

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 h-14 bb-thin grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center"
        style={{
          background: "linear-gradient(180deg, var(--bg-l1) 0%, var(--bg-surface) 100%)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex h-14 w-16 shrink-0 flex-col items-center justify-center gap-0.5 select-none br-thin group"
          style={{ transition: "background 0.2s" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(124,111,255,0.08)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <Image
            src="/logo.png"
            alt="ApeX Logo"
            width={24}
            height={24}
            className="rounded-sm"
            style={{ filter: "drop-shadow(0 0 6px rgba(124,111,255,0.5))" }}
          />
          <span
            className="font-black text-text-main leading-none tracking-widest"
            style={{
              fontSize: "8px",
              background: "var(--gradient-primary)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            APEX
          </span>
        </Link>

        {/* Center: toggle + search + nav + market stats */}
        <div className="flex h-14 min-w-0 items-center gap-4 px-4">
          {/* Sidebar toggle */}
          <button
            onClick={onToggleSideNav}
            className="w-8 h-8 flex shrink-0 items-center justify-center text-text-dim
              hover:text-text-muted cursor-pointer transition-all duration-200"
            style={{ borderRadius: "4px" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(124,111,255,0.1)";
              (e.currentTarget as HTMLElement).style.color = "var(--primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "";
            }}
            aria-label={isSideNavOpen ? "Close sidebar" : "Open sidebar"}
            type="button"
          >
            {isSideNavOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>

          {/* Search button */}
          <button
            onClick={() => setShowSearchModal(true)}
            className="flex items-center gap-2 h-8 px-3 shrink-0 text-text-dim
              hover:text-text-muted cursor-pointer transition-all duration-200"
            style={{
              borderRadius: "4px",
              border: "0.5px solid var(--border)",
              background: "var(--bg-l2)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--primary)";
              (e.currentTarget as HTMLElement).style.color = "var(--text-main)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 8px var(--primary-glow)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLElement).style.color = "";
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
            aria-label="Search markets"
            type="button"
          >
            <Search size={13} />
            <span className="t-label-caps hidden lg:block" style={{ fontSize: "10px" }}>
              Search markets
            </span>
            <kbd
              className="hidden xl:block text-[9px] px-1 py-0.5 ml-1"
              style={{
                borderRadius: "2px",
                border: "0.5px solid var(--border-soft)",
                color: "var(--text-dim)",
                background: "var(--bg-l3)",
                fontFamily: "var(--font-mono)",
              }}
            >
              ⌘K
            </kbd>
          </button>

          {/* Primary nav */}
          <nav className="hidden md:flex shrink-0 items-center gap-1" aria-label="Primary">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative px-3 py-1.5 t-label-caps transition-all duration-200 no-underline
                    focus-visible:outline-none rounded-sm
                    ${isActive
                      ? "text-primary nav-active-underline"
                      : "text-text-muted hover:text-text-main"
                    }`}
                  style={isActive ? {
                    background: "rgba(124,111,255,0.08)",
                    borderRadius: "4px",
                  } : undefined}
                  onMouseEnter={!isActive ? (e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(124,111,255,0.05)";
                    (e.currentTarget as HTMLElement).style.borderRadius = "4px";
                  } : undefined}
                  onMouseLeave={!isActive ? (e) => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  } : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Market stats (xl+) */}
          <div className="hidden xl:flex min-w-0 flex-1 items-center gap-5 bl-thin pl-5">
            {/* Inline search */}
            <div className="relative flex w-44 shrink-0 items-center">
              <Search size={13} className="absolute left-3 text-text-dim pointer-events-none" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setIsSearchOpen(true); }}
                onFocus={() => setIsSearchOpen(true)}
                onBlur={() => setTimeout(() => setIsSearchOpen(false), 200)}
                className="w-full pl-8 pr-3 py-1.5 t-body-sm text-text-main transition-all"
                style={{
                  background: "var(--bg-l2)",
                  border: "0.5px solid var(--border)",
                  borderRadius: "4px",
                  outline: "none",
                }}
              />
              {isSearchOpen && searchQuery && (
                <div
                  className="absolute top-full left-0 mt-1.5 w-full z-50 shadow-2xl overflow-hidden"
                  style={{
                    background: "var(--bg-l1)",
                    border: "0.5px solid var(--border-soft)",
                    borderRadius: "6px",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px var(--border)",
                  }}
                >
                  {filteredMarkets.length > 0 ? (
                    filteredMarkets.map((m) => (
                      <div
                        key={m.symbol}
                        className="px-3 py-2 cursor-pointer t-data-sm text-text-main flex
                          justify-between transition-colors"
                        style={{ transition: "background 0.15s" }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = "var(--bg-l3)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                        }}
                        onMouseDown={() => {
                          setMarket(m);
                          setSearchQuery("");
                          setIsSearchOpen(false);
                        }}
                      >
                        <span className="font-medium">{m.symbol}</span>
                        <span style={{ color: m.change24h >= 0 ? "var(--long)" : "var(--short)" }}>
                          {m.change24h > 0 ? "+" : ""}{m.change24h.toFixed(2)}%
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2 t-body-sm text-text-dim">No markets found</div>
                  )}
                </div>
              )}
            </div>

            {/* Price */}
            <div className="flex min-w-28 flex-col gap-0.5">
              <span className="t-label-caps text-text-dim">{market?.symbol || "Market"}</span>
              <span
                key={flashKey}
                className={`t-data-md ${flashClass}`}
                style={{
                  color: priceDir === "up"
                    ? "var(--long)"
                    : priceDir === "down"
                      ? "var(--short)"
                      : "var(--text-price)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                ${fmt(price)}
              </span>
            </div>

            {/* 24h Change */}
            <div className="flex min-w-20 flex-col gap-0.5">
              <span className="t-label-caps text-text-dim">24h Change</span>
              <span
                className="t-data-md flex items-center gap-1"
                style={{ color: isPositive ? "var(--long)" : "var(--short)" }}
              >
                {isPositive
                  ? <TrendingUp size={12} />
                  : <TrendingDown size={12} />}
                {isPositive ? "+" : ""}
                {market?.change24h.toFixed(2)}%
              </span>
            </div>

            {/* 24h High */}
            <div className="flex min-w-24 flex-col gap-0.5">
              <span className="t-label-caps text-text-dim">24h High</span>
              <span className="t-data-md text-text-main" style={{ fontVariantNumeric: "tabular-nums" }}>
                {fmt(market?.high24h || 0)}
              </span>
            </div>

            {/* 24h Volume */}
            <div className="flex min-w-24 flex-col gap-0.5">
              <span className="t-label-caps text-text-dim">24h Vol</span>
              <span className="t-data-md text-text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                {market?.volume24h}
              </span>
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex h-14 items-center justify-end gap-1 px-3 bl-thin">
          <ThemeToggle />
          <Link
            href="/notifications"
            className="w-8 h-8 flex items-center justify-center text-text-dim
              hover:text-text-muted no-underline transition-all duration-200"
            style={{ borderRadius: "4px" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(124,111,255,0.1)";
              (e.currentTarget as HTMLElement).style.color = "var(--primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "";
            }}
            aria-label="Notifications"
          >
            <Bell size={16} />
          </Link>
          <Link
            href="/settings"
            className="w-8 h-8 flex items-center justify-center text-text-dim
              hover:text-text-muted no-underline transition-all duration-200"
            style={{ borderRadius: "4px" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(124,111,255,0.1)";
              (e.currentTarget as HTMLElement).style.color = "var(--primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "";
            }}
            aria-label="Settings"
          >
            <Settings size={16} />
          </Link>
          <AuthActions />
          <div className="hidden sm:flex items-center gap-2 ml-2">
            {mounted && (
              <>
                <button
                  onClick={() => setNetwork(network === "devnet" ? "mainnet-beta" : "devnet")}
                  className="h-8 px-3 flex items-center justify-center t-label-caps text-text-muted
                    transition-all duration-200 capitalize"
                  style={{
                    fontSize: "10px",
                    border: "0.5px solid var(--border)",
                    borderRadius: "4px",
                    background: "var(--bg-l2)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--primary)";
                    (e.currentTarget as HTMLElement).style.color = "var(--primary)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                    (e.currentTarget as HTMLElement).style.color = "";
                  }}
                >
                  {network.replace("-beta", "")}
                </button>
                <WalletMultiButton
                  style={{
                    height: "32px",
                    fontSize: "10px",
                    background: "var(--gradient-primary)",
                    borderRadius: "4px",
                    fontFamily: "var(--font-sans)",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    padding: "0 14px",
                    letterSpacing: "0.08em",
                    boxShadow: "0 2px 12px var(--primary-glow)",
                  }}
                />
              </>
            )}
          </div>
        </div>
      </header>

      {showSearchModal && (
        <MarketSearchModal onClose={() => setShowSearchModal(false)} />
      )}
    </>
  );
}
