"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";

const BASE_PRICE = 65432.1;

export default function TopBar() {
  const [price, setPrice] = useState(BASE_PRICE);
  const [flashClass, setFlashClass] = useState("");
  const prevRef = useRef(BASE_PRICE);
  const flashKey = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      const delta = (Math.random() - 0.5) * 10;
      const next = +(prevRef.current + delta).toFixed(2);
      prevRef.current = next;
      setPrice(next);
      flashKey.current += 1;
      setFlashClass(delta >= 0 ? "flash-up" : "flash-down");
      setTimeout(() => setFlashClass(""), 300);
    }, 2500);
    return () => clearInterval(id);
  }, []);

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2 });

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-bg-l1 bb-thin flex items-center justify-between px-4">
      {/* Left: Wordmark + Nav */}
      <div className="flex items-center gap-6">
        <Link href="/" className="t-headline-md font-bold text-text-main select-none">
          SOL-DEX
        </Link>
        <nav className="hidden md:flex items-center gap-4">
          <Link
            href="/trade"
            className="t-label-caps text-primary border-b-2 border-primary pb-1"
          >
            Trade
          </Link>
          {["Portfolio", "Stats", "Leaderboard"].map((tab) => (
            <Link
              key={tab}
              href="#"
              className="t-label-caps text-text-muted hover:text-text-main"
            >
              {tab}
            </Link>
          ))}
        </nav>
      </div>

      {/* Center: Market Stats */}
      <div className="hidden md:flex items-center gap-4 bl-thin pl-4">
        <div className="flex flex-col">
          <span className="t-label-caps text-text-muted">BTC-PERP</span>
          <span key={flashKey.current} className={`t-data-md text-text-price ${flashClass}`}>
            ${fmt(price)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="t-label-caps text-text-muted">24h Change</span>
          <span className="t-data-md text-text-price">+2.4%</span>
        </div>
        <div className="flex flex-col hidden lg:flex">
          <span className="t-label-caps text-text-muted">Funding Rate</span>
          <span className="t-data-md text-text-main">0.0100%</span>
        </div>
        <div className="flex flex-col hidden lg:flex">
          <span className="t-label-caps text-text-muted">Open Interest</span>
          <span className="t-data-md text-text-main">$120M</span>
        </div>
      </div>

      {/* Right: Toggle + Icons + Connect */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <span className="material-symbols-outlined p-2 hover:bg-bg-l4 cursor-pointer text-text-muted">
          notifications
        </span>
        <span className="material-symbols-outlined p-2 hover:bg-bg-l4 cursor-pointer text-text-muted">
          settings
        </span>
        <button className="bg-primary-ctr text-white px-4 py-1.5 t-label-caps hover:opacity-90 active:scale-[0.97]">
          Connect Wallet
        </button>
      </div>
    </header>
  );
}
