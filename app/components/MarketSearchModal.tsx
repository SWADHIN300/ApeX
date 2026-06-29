"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useMarket } from "@/contexts/MarketContext";
import { useRouter } from "next/navigation";
import { fetchKlines } from "@/lib/api";
import { createChart, ColorType, AreaSeries } from "lightweight-charts";
import type { Time } from "lightweight-charts";
import { X, Search, TrendingUp, TrendingDown, Star } from "lucide-react";
import type { Ticker } from "@/lib/types";

// ── Mini sparkline chart ──────────────────────────────────────────────────────
function MiniChart({ symbol, isUp }: { symbol: string; isUp: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(false);

  // Intersection Observer to only load charts when visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "50px" }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !visible) return;
    let mounted = true;

    const chart = createChart(container, {
      width: 80,
      height: 36,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "transparent" },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      timeScale: { visible: false },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: false },
      crosshair: { vertLine: { visible: false }, horzLine: { visible: false } },
      handleScroll: false,
      handleScale: false,
    });

    const color = isUp ? "#1d9e75" : "#d85a30";
    const series = chart.addSeries(AreaSeries, {
      lineColor: color,
      topColor: color + "40",
      bottomColor: color + "00",
      lineWidth: 1,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    });

    fetchKlines(symbol, "1h", 24).then((klines) => {
      if (!mounted) return;
      if (klines.length > 0) {
        series.setData(klines.map((k) => ({ time: k.time as Time, value: k.close })));
        setLoaded(true);
      }
    });

    return () => {
      mounted = false;
      chart.remove();
    };
  }, [symbol, isUp]);

  return (
    <div ref={containerRef} style={{ width: 80, height: 36, opacity: loaded ? 1 : 0.3, transition: "opacity 0.3s" }} />
  );
}

// ── Market Row ────────────────────────────────────────────────────────────────
function MarketRow({
  m,
  isFav,
  onSelect,
  onToggleFav,
}: {
  m: Ticker;
  isFav: boolean;
  onSelect: (m: Ticker) => void;
  onToggleFav: (sym: string) => void;
}) {
  const base = m.symbol.replace("-PERP", "");
  const isUp = m.change24h >= 0;

  return (
    <div
      onClick={() => onSelect(m)}
      className="flex items-center gap-4 px-5 py-3 hover:bg-bg-l2 cursor-pointer group transition-colors border-b border-t-border-soft"
    >
      {/* Star */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFav(m.symbol); }}
        className={`shrink-0 transition-colors ${isFav ? "text-yellow-400" : "text-text-dim group-hover:text-text-muted"}`}
      >
        <Star size={13} fill={isFav ? "currentColor" : "none"} />
      </button>

      {/* Symbol + base */}
      <div className="w-32 shrink-0">
        <div className="t-label-caps text-text-main">{base}</div>
        <div className="text-[10px] text-text-dim mt-0.5">PERP · USDT</div>
      </div>

      {/* Price */}
      <div className="flex-1 t-data-sm text-text-main font-mono">
        ${m.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
      </div>

      {/* 24h change */}
      <div className={`w-20 shrink-0 text-right t-data-sm font-mono ${isUp ? "text-long" : "text-short"}`}>
        <span className="flex items-center justify-end gap-1">
          {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {isUp ? "+" : ""}{m.change24h.toFixed(2)}%
        </span>
      </div>

      {/* Volume */}
      <div className="w-24 shrink-0 text-right t-data-sm text-text-muted font-mono hidden md:block">
        {m.volume24h}
      </div>

      {/* Sparkline */}
      <div className="shrink-0">
        <MiniChart symbol={m.symbol} isUp={isUp} />
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function MarketSearchModal({ onClose }: { onClose: () => void }) {
  const { markets, setMarket } = useMarket();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [tab, setTab] = useState<"all" | "favorites" | "gainers" | "losers">("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus input on open
  useEffect(() => {
    inputRef.current?.focus();
    const saved = localStorage.getItem("apex-favorites");
    if (saved) setFavorites(JSON.parse(saved));
    
    // Prevent scrolling behind modal
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // ESC to close and Focus Trap
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { 
      if (e.key === "Escape") onClose(); 
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0] as HTMLElement;
        const last = focusable[focusable.length - 1] as HTMLElement;
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const toggleFav = useCallback((sym: string) => {
    setFavorites((prev) => {
      const next = prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym];
      localStorage.setItem("apex-favorites", JSON.stringify(next));
      return next;
    });
  }, []);

  const handleSelect = useCallback((m: Ticker) => {
    setMarket(m);
    router.push("/trade");
    onClose();
  }, [setMarket, router, onClose]);

  // Filter + sort
  const filtered = markets
    .filter((m) => {
      const q = debouncedQuery.toLowerCase();
      const match = m.symbol.toLowerCase().includes(q) || m.symbol.replace("-PERP", "").toLowerCase().includes(q);
      if (!match) return false;
      if (tab === "favorites") return favorites.includes(m.symbol);
      if (tab === "gainers") return m.change24h > 0;
      if (tab === "losers") return m.change24h < 0;
      return true;
    })
    .sort((a, b) => {
      if (tab === "gainers") return b.change24h - a.change24h;
      if (tab === "losers") return a.change24h - b.change24h;
      // Default: sort by volume (desc) using a proxy since volume is a string
      return b.change24h - a.change24h;
    });

  const tabs = [
    { id: "all", label: "All Markets" },
    { id: "favorites", label: `⭐ Favorites (${favorites.length})` },
    { id: "gainers", label: "🚀 Gainers" },
    { id: "losers", label: "📉 Losers" },
  ] as const;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search Markets"
        className="fixed left-1/2 top-16 z-[1000] w-full max-w-3xl -translate-x-1/2 flex flex-col bg-bg-l1 border border-t-border shadow-2xl rounded-md"
        style={{ maxHeight: "calc(100vh - 80px)" }}
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3 bb-thin">
          <Search size={18} className="text-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search coins — BTC, ETH, SOL, PEPE..."
            className="flex-1 bg-transparent t-body-sm text-text-main placeholder:text-text-dim outline-none"
          />
          <span className="t-label-caps text-text-dim hidden sm:block shrink-0">ESC to close</span>
          <button onClick={onClose} className="text-text-muted hover:text-text-main ml-1 shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 bb-thin">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 t-label-caps transition-colors ${
                tab === t.id
                  ? "bg-bg-l4 text-text-main border border-t-border"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              {t.label}
            </button>
          ))}
          <span className="ml-auto t-label-caps text-text-dim">{filtered.length} markets</span>
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-4 px-5 py-2 bb-thin">
          <div className="w-4 shrink-0" />
          <div className="w-32 shrink-0 t-label-caps text-text-dim">Symbol</div>
          <div className="flex-1 t-label-caps text-text-dim">Price</div>
          <div className="w-20 shrink-0 text-right t-label-caps text-text-dim">24h %</div>
          <div className="w-24 shrink-0 text-right t-label-caps text-text-dim hidden md:block">Volume</div>
          <div className="w-20 shrink-0 text-right t-label-caps text-text-dim">Chart</div>
        </div>

        {/* Results — virtualized via overflow scroll */}
        <div className="overflow-y-auto flex-1" style={{ maxHeight: "60vh" }}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-muted">
              <Search size={32} className="mb-3 opacity-40" />
              <p className="t-body-sm">No markets found for "{query}"</p>
            </div>
          ) : (
            filtered.slice(0, 100).map((m) => (
              <MarketRow
                key={m.symbol}
                m={m}
                isFav={favorites.includes(m.symbol)}
                onSelect={handleSelect}
                onToggleFav={toggleFav}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
