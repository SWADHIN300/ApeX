"use client";

import { useEffect, useRef, useState } from "react";
import CandlestickChart from "./CandlestickChart";
import EnhancedChart from "./EnhancedChart";
import TradingViewChart from "./TradingViewChart";
import AdvancedIndicators, { AdvancedIndicatorConfig } from "./AdvancedIndicators";
import AdvancedAnalyticsPanel from "./AdvancedAnalyticsPanel";
import { useMarket } from "@/contexts/MarketContext";
import { exchangeManager, type ExchangeName } from "@/lib/exchanges";
import {
  LineChart,
  X,
  Crosshair,
  TrendingUp,
  Minus,
  Check,
  TrendingDown,
  BarChart3,
  Settings,
  ChevronRight,
  Activity,
  BellRing,
  Camera,
  Maximize2,
  Minimize2,
  Play,
  Brush,
  TextCursorInput,
  Smile,
  Ruler,
  ZoomIn,
  Magnet,
  LockKeyhole,
  Eye,
  Trash2,
  Layers,
  Clock3,
  ListTree,
  LayoutGrid,
  GitBranch,
  Share2,
  Undo2,
  MousePointer2,
  Circle,
  Eraser,
  MoveUpRight,
  PanelTop,
  Network,
  Triangle,
  BriefcaseBusiness,
  Pencil,
  ArrowUpRight,
  RectangleHorizontal,
  Tag,
  MessageSquare,
  Shapes,
  AreaChart,
  ChartNoAxesCombined,
  Sparkles,
  Repeat2,
} from "lucide-react";

const timeframes = ["1m", "3m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"];

/** ApeX timeframe -> TradingView Advanced Charts resolution. */
const TIMEFRAME_TO_RESOLUTION: Record<string, string> = {
  "1m": "1",
  "3m": "3",
  "5m": "5",
  "15m": "15",
  "30m": "30",
  "1h": "60",
  "4h": "240",
  "1d": "1D",
  "1w": "1W",
};

export type Indicators = {
  sma20: boolean;
  sma50: boolean;
  volume: boolean;
};

export type DrawingTool =
  | "crosshair" | "cursor" | "dot" | "eraser"
  | "trendline" | "ray" | "hline" | "channel"
  | "rectangle" | "fibonacci" | "gannFan"
  | "xabcd" | "headShoulders" | "trianglePattern" | "elliottWave"
  | "longPosition" | "shortPosition"
  | "brush" | "freehand" | "area" | "arrow" | "ellipse" | "triangleShape"
  | "text" | "label" | "callout" | "emoji" | "icon"
  | "measure" | "zoom";
export type ChartType = "candlestick" | "line" | "area";

export default function ChartPanel() {
  const { market } = useMarket();
  const [active, setActive] = useState("5m");
  const [showIndicators, setShowIndicators] = useState(false);
  const [showAdvancedIndicators, setShowAdvancedIndicators] = useState(false);
  const [showExchange, setShowExchange] = useState(false);
  const [showChartType, setShowChartType] = useState(false);
  const [indicators, setIndicators] = useState<Indicators>({
    sma20: true,
    sma50: true,
    volume: true,
  });
  const [advancedIndicators, setAdvancedIndicators] = useState<AdvancedIndicatorConfig>({
    sma20: true,
    sma50: true,
    sma200: false,
    ema12: false,
    ema26: false,
    ema50: false,
    rsi: false,
    rsiPeriod: 14,
    macd: false,
    stochastic: false,
    bollingerBands: false,
    bbPeriod: 20,
    bbStdDev: 2,
    atr: false,
    atrPeriod: 14,
    volume: true,
    vwap: false,
    obv: false,
    fibonacci: false,
  });
  const [drawingTool, setDrawingTool] = useState<DrawingTool>("crosshair");
  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [activeExchange, setActiveExchange] = useState(exchangeManager.getActiveExchange());
  const [useEnhancedChart, setUseEnhancedChart] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [magnetEnabled, setMagnetEnabled] = useState(false);
  const [drawingsLocked, setDrawingsLocked] = useState(false);
  const [drawingsVisible, setDrawingsVisible] = useState(true);
  const [indicatorsVisible, setIndicatorsVisible] = useState(true);
  const [stayInDrawingMode, setStayInDrawingMode] = useState(true);
  const [showRemoveMenu, setShowRemoveMenu] = useState(false);
  const [emojiChoice, setEmojiChoice] = useState("📍");
  const [clearDrawingsKey, setClearDrawingsKey] = useState(0);
  const [undoDrawingsKey, setUndoDrawingsKey] = useState(0);
  const [showObjectsPanel, setShowObjectsPanel] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertPriceInput, setAlertPriceInput] = useState("");
  const [priceAlert, setPriceAlert] = useState<number | null>(null);
  const [priceAlertSymbol, setPriceAlertSymbol] = useState<string | null>(null);
  const [alertDirection, setAlertDirection] = useState<"up" | "down">("up");
  const [alertNotice, setAlertNotice] = useState("");
  const [isReplayOpen, setIsReplayOpen] = useState(false);
  const [replayOffset, setReplayOffset] = useState(0);
  const panelRef = useRef<HTMLElement>(null);
  // Advanced Charts is used when the licensed library is installed under
  // public/charting_library/. It reports back if it isn't, and we fall through
  // to the bundled lightweight-charts view.
  const [tradingViewAvailable, setTradingViewAvailable] = useState(true);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const advancedIndicatorRef = useRef<HTMLDivElement>(null);
  const exchangeRef = useRef<HTMLDivElement>(null);
  const chartTypeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncFullscreenState = () => setIsFullscreen(document.fullscreenElement === panelRef.current);
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  useEffect(() => {
    const cancelDrawing = (event: KeyboardEvent) => {
      if (event.key === "Escape" && drawingTool !== "crosshair") setDrawingTool("crosshair");
    };
    window.addEventListener("keydown", cancelDrawing);
    return () => window.removeEventListener("keydown", cancelDrawing);
  }, [drawingTool]);

  useEffect(() => {
    if (priceAlert === null || priceAlertSymbol !== market?.symbol || !market?.price || !Number.isFinite(market.price)) return;
    const crossed = priceAlert > 0 && (alertDirection === "up" ? market.price >= priceAlert : market.price <= priceAlert);
    if (crossed) {
      const timeoutId = window.setTimeout(() => {
        setAlertNotice(`Price reached $${priceAlert.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
        setPriceAlert(null);
        setPriceAlertSymbol(null);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [alertDirection, market?.price, market?.symbol, priceAlert, priceAlertSymbol]);

  const toggleFullscreen = async () => {
    if (!panelRef.current) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await panelRef.current.requestFullscreen();
    } catch {
      setAlertNotice("Fullscreen is unavailable in this browser.");
    }
  };

  const downloadChartImage = () => {
    window.dispatchEvent(new CustomEvent("apex:chart-screenshot"));
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (indicatorRef.current && !indicatorRef.current.contains(e.target as Node)) {
        setShowIndicators(false);
      }
      if (advancedIndicatorRef.current && !advancedIndicatorRef.current.contains(e.target as Node)) {
        setShowAdvancedIndicators(false);
      }
      if (exchangeRef.current && !exchangeRef.current.contains(e.target as Node)) {
        setShowExchange(false);
      }
      if (chartTypeRef.current && !chartTypeRef.current.contains(e.target as Node)) {
        setShowChartType(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleIndicator = (key: keyof Indicators) => {
    setIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const completeDrawing = () => {
    if (!stayInDrawingMode) setDrawingTool("crosshair");
  };

  const removeIndicators = () => {
    setIndicators({ sma20: false, sma50: false, volume: false });
    setAdvancedIndicators((current) => ({
      ...current,
      sma20: false, sma50: false, sma200: false, ema12: false, ema26: false, ema50: false,
      rsi: false, macd: false, stochastic: false, bollingerBands: false, atr: false,
      volume: false, vwap: false, obv: false, fibonacci: false,
    }));
    setTradingViewAvailable(false);
    setShowRemoveMenu(false);
  };

  const removeDrawings = () => {
    setClearDrawingsKey((key) => key + 1);
    setDrawingTool("crosshair");
    setShowRemoveMenu(false);
  };

  const removeAllChartObjects = () => {
    removeDrawings();
    removeIndicators();
  };

  const visibleIndicators = indicatorsVisible ? indicators : { sma20: false, sma50: false, volume: false };
  const visibleAdvancedIndicators = indicatorsVisible ? advancedIndicators : {
    ...advancedIndicators,
    sma20: false, sma50: false, sma200: false, ema12: false, ema26: false, ema50: false,
    rsi: false, macd: false, stochastic: false, bollingerBands: false, atr: false,
    volume: false, vwap: false, obv: false, fibonacci: false,
  };

  const drawingToolGroups: { id: string; tools: { id: DrawingTool | null; label: string; icon: React.ReactNode }[] }[] = [
    { id: "cursor", tools: [
      { id: "crosshair", label: "Crosshair", icon: <Crosshair size={17} /> },
      { id: "cursor", label: "Pointer cursor", icon: <MousePointer2 size={17} /> },
      { id: "dot", label: "Place dot", icon: <Circle size={17} /> },
      { id: "eraser", label: "Erase nearest drawing", icon: <Eraser size={17} /> },
    ] },
    { id: "lines", tools: [
      { id: "trendline", label: "Trend line", icon: <TrendingUp size={17} /> },
      { id: "ray", label: "Ray", icon: <MoveUpRight size={17} /> },
      { id: "hline", label: "Horizontal line", icon: <Minus size={17} /> },
      { id: "channel", label: "Parallel channel", icon: <PanelTop size={17} /> },
    ] },
    { id: "fibonacci", tools: [
      { id: "fibonacci", label: "Fib retracement", icon: <GitBranch size={17} /> },
      { id: "gannFan", label: "Gann fan", icon: <Network size={17} /> },
    ] },
    { id: "patterns", tools: [
      { id: "xabcd", label: "XABCD pattern", icon: <Share2 size={17} /> },
      { id: "headShoulders", label: "Head and shoulders", icon: <ChartNoAxesCombined size={17} /> },
      { id: "trianglePattern", label: "Triangle pattern", icon: <Triangle size={17} /> },
      { id: "elliottWave", label: "Elliott wave", icon: <TrendingUp size={17} /> },
    ] },
    { id: "positions", tools: [
      { id: "longPosition", label: "Long position planning overlay (does not place orders)", icon: <BriefcaseBusiness size={17} /> },
      { id: "shortPosition", label: "Short position planning overlay (does not place orders)", icon: <BriefcaseBusiness size={17} className="rotate-180" /> },
    ] },
    { id: "shapes", tools: [
      { id: "brush", label: "Brush", icon: <Brush size={17} /> },
      { id: "freehand", label: "Freehand path", icon: <Pencil size={17} /> },
      { id: "area", label: "Area shape", icon: <AreaChart size={17} /> },
      { id: "arrow", label: "Arrow", icon: <ArrowUpRight size={17} /> },
      { id: "rectangle", label: "Rectangle", icon: <RectangleHorizontal size={17} /> },
      { id: "ellipse", label: "Ellipse", icon: <Circle size={17} /> },
      { id: "triangleShape", label: "Triangle shape", icon: <Triangle size={17} /> },
    ] },
    { id: "notes", tools: [
      { id: "text", label: "Text note", icon: <TextCursorInput size={17} /> },
      { id: "label", label: "Label", icon: <Tag size={17} /> },
      { id: "callout", label: "Callout", icon: <MessageSquare size={17} /> },
      { id: "emoji", label: "Emoji", icon: <Smile size={17} /> },
      { id: "icon", label: "Icon stamp", icon: <Shapes size={17} /> },
    ] },
    { id: "measure", tools: [
      { id: null, label: "Unknown tool", icon: <Sparkles size={17} /> },
      { id: "measure", label: "Price, percent, bars, and time measure", icon: <Ruler size={17} /> },
      { id: "zoom", label: "Zoom selection", icon: <ZoomIn size={17} /> },
    ] },
  ];
  const drawingTools = drawingToolGroups.flatMap((group) => group.tools).filter(
    (tool): tool is { id: DrawingTool; label: string; icon: React.ReactNode } => tool.id !== null,
  );

  const chartTypes: { id: ChartType; label: string; icon: React.ReactNode }[] = [
    { id: "candlestick", label: "Candlestick", icon: <BarChart3 size={14} /> },
    { id: "line", label: "Line", icon: <TrendingUp size={14} /> },
    { id: "area", label: "Area", icon: <TrendingDown size={14} /> },
  ];

  const exchanges: { id: ExchangeName; label: string }[] = [
    { id: "apex", label: "ApeX (on-chain)" },
    { id: "binance", label: "Binance" },
    { id: "coinbase", label: "Coinbase" },
    { id: "kraken", label: "Kraken" },
  ];

  return (
    <section ref={panelRef} className={`chart-panel col-span-12 lg:col-span-7 xl:col-span-8 min-h-[360px] lg:min-h-0 min-w-0 b-thin flex flex-col bg-bg-surface overflow-hidden relative ${isFullscreen ? "chart-panel-fullscreen" : ""}`}>
      {/* Toolbar Overlay */}
      <div className="chart-toolbar absolute top-2 left-2 right-2 flex items-center justify-between gap-2 z-20 pointer-events-none">
        {/* Left Side: Unified Floating Toolbar */}
        <div className="chart-toolbar-group flex items-center gap-1.5 bg-bg-l1/90 backdrop-blur-md border border-t-border rounded-sm p-1 pointer-events-auto shadow-sm h-8">
          {/* Timeframes */}
          <div className="flex items-center gap-0.5">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => setActive(tf)}
                aria-pressed={tf === active}
                title={`${tf} timeframe`}
                className={`h-7 min-w-8 px-2 text-[11px] font-mono tracking-wider font-semibold rounded-sm inline-flex items-center justify-center transition-colors ${
                  tf === active
                    ? "bg-bg-l4 text-text-main font-bold shadow-xs"
                    : "text-text-dim hover:text-text-main hover:bg-bg-l2"
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Separator */}
          <div className="w-px h-4 bg-border/60 mx-0.5" />

          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowAlert((value) => !value); setAlertNotice(""); }}
              aria-label="Create price alert"
              title="Create price alert"
              className={`h-7 px-2 inline-flex items-center gap-1.5 rounded-sm text-[11px] font-medium transition-colors ${showAlert ? "bg-bg-l4 text-primary" : "text-text-muted hover:bg-bg-l2 hover:text-text-main"}`}
            >
              <BellRing size={14} /> <span className="chart-action-label hidden xl:inline">Alert</span>
            </button>
            {showAlert && (
              <form
                className="absolute left-0 top-full z-50 mt-1 w-56 border border-t-border bg-bg-l1 p-3 shadow-xl"
                onSubmit={(event) => {
                  event.preventDefault();
                  const nextAlert = Number(alertPriceInput);
                  if (nextAlert > 0 && Number.isFinite(nextAlert)) {
                    setAlertDirection(nextAlert >= (market?.price ?? 0) ? "up" : "down");
                    setPriceAlert(nextAlert);
                    setPriceAlertSymbol(market?.symbol ?? null);
                    setAlertNotice(`Alert set at $${nextAlert.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
                    setShowAlert(false);
                  }
                }}
              >
                <label htmlFor="chart-price-alert" className="mb-2 block text-xs font-semibold text-text-main">Alert when {market?.symbol?.replace(/-PERP$/i, "") ?? "market"} reaches</label>
                <div className="flex gap-2">
                  <input id="chart-price-alert" type="number" min="0" step="any" required value={alertPriceInput} onChange={(event) => setAlertPriceInput(event.target.value)} placeholder={market?.price ? market.price.toFixed(2) : "Price"} className="h-9 min-w-0 flex-1 border border-t-border bg-bg-base px-2 font-mono text-xs text-text-main" />
                  <button type="submit" className="h-9 bg-primary px-3 text-xs font-semibold text-primary-foreground">Set</button>
                </div>
                {priceAlert !== null && <p className="mt-2 text-[10px] text-text-muted">Active at ${priceAlert.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>}
              </form>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsReplayOpen((open) => {
              if (open) {
                setReplayOffset(0);
                return false;
              }
              setReplayOffset((offset) => offset || 1);
              return true;
            })}
            aria-pressed={isReplayOpen}
            title="Replay historical candles"
            className={`h-7 px-2 inline-flex items-center gap-1.5 rounded-sm text-[11px] font-medium transition-colors ${isReplayOpen ? "bg-bg-l4 text-primary" : "text-text-muted hover:bg-bg-l2 hover:text-text-main"}`}
          >
            <Play size={14} /> <span className="chart-action-label hidden xl:inline">Replay</span>
          </button>

          {isReplayOpen && (
            <div className="absolute left-2 top-11 z-40 flex w-[min(30rem,calc(100vw-1rem))] items-center gap-3 border border-t-border bg-bg-l1 px-3 py-2 shadow-xl">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-text-muted">Replay</span>
              <input type="range" min="0" max="499" value={replayOffset} aria-label="Replay position" onChange={(event) => { const offset = Number(event.target.value); setReplayOffset(offset); if (offset === 0) setIsReplayOpen(false); }} className="min-w-0 flex-1 accent-primary" />
              <span className="shrink-0 font-mono text-[10px] text-text-muted">{replayOffset ? `${replayOffset} bars back` : "Live"}</span>
              <button type="button" aria-label="Return to live chart" title="Return to live chart" className="shrink-0 text-text-muted hover:text-text-main" onClick={() => { setReplayOffset(0); setIsReplayOpen(false); }}><X size={14} /></button>
            </div>
          )}

          {/* Tool Icons */}
          <div className="flex items-center gap-0.5">
            {/* Chart Type Button */}
            <div className="relative" ref={chartTypeRef}>
              <button
                onClick={() => {
                  setShowChartType((v) => !v);
                  setShowIndicators(false);
                  setShowExchange(false);
                  setShowAdvancedIndicators(false);
                }}
                className={`h-6 w-6 rounded-sm inline-flex items-center justify-center transition-colors ${
                  showChartType
                    ? "text-primary bg-bg-l4"
                    : "text-text-muted hover:text-text-main hover:bg-bg-l2"
                }`}
                aria-label="Chart type"
                title="Chart type"
                type="button"
              >
                <BarChart3 size={14} />
              </button>

              {showChartType && (
                <div className="absolute top-full left-0 mt-1 w-44 bg-bg-l1/95 backdrop-blur-sm border border-t-border shadow-xl z-50 rounded-sm">
                  <div className="flex items-center justify-between px-3 py-2 bb-thin">
                    <span className="t-label-caps text-text-muted">Chart Type</span>
                    <button
                      onClick={() => setShowChartType(false)}
                      className="text-text-dim hover:text-text-main"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  {chartTypes.map(({ id, label, icon }) => (
                    <button
                      key={id}
                      onClick={() => {
                        setChartType(id);
                        setUseEnhancedChart(true);
                        setShowChartType(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors ${
                        chartType === id
                          ? "bg-bg-l4 text-primary"
                          : "hover:bg-bg-l2 text-text-main"
                      }`}
                    >
                      <span className="shrink-0">{icon}</span>
                      <span className="t-body-sm flex-1 text-left">{label}</span>
                      {chartType === id && <Check size={12} className="text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Indicators Button */}
            <div className="relative" ref={indicatorRef}>
              <button
                onClick={() => {
                  setShowIndicators((v) => !v);
                  setShowAdvancedIndicators(false);
                  setShowExchange(false);
                  setShowChartType(false);
                }}
                className={`h-6 w-6 rounded-sm inline-flex items-center justify-center transition-colors ${
                  showIndicators
                    ? "text-primary bg-bg-l4"
                    : "text-text-muted hover:text-text-main hover:bg-bg-l2"
                }`}
                aria-label="Chart indicators"
                title="Chart indicators"
                type="button"
              >
                <LineChart size={14} />
              </button>

              {showIndicators && (
                <div className="absolute top-full left-0 mt-1 w-52 bg-bg-l1/95 backdrop-blur-sm border border-t-border shadow-xl z-50 rounded-sm">
                  <div className="flex items-center justify-between px-3 py-2 bb-thin">
                    <span className="t-label-caps text-text-muted">Indicators</span>
                    <button
                      onClick={() => setShowIndicators(false)}
                      className="text-text-dim hover:text-text-main"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  {(
                    [
                      { key: "sma20", label: "SMA 20", color: "rgba(41,98,255,0.8)" },
                      { key: "sma50", label: "SMA 50", color: "rgba(255,109,0,0.8)" },
                      { key: "volume", label: "Volume", color: "rgba(29,158,117,0.8)" },
                    ] as const
                  ).map(({ key, label, color }) => (
                    <button
                      key={key}
                      onClick={() => toggleIndicator(key)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg-l2 transition-colors"
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0 border-2"
                        style={{
                          background: indicators[key] ? color : "transparent",
                          borderColor: color,
                        }}
                      />
                      <span className="t-body-sm text-text-main flex-1 text-left">{label}</span>
                      {indicators[key] && (
                        <Check size={12} className="text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Advanced Indicators Settings Button */}
            <div className="relative" ref={advancedIndicatorRef}>
              <button
                onClick={() => {
                  setShowAdvancedIndicators((v) => !v);
                  setShowIndicators(false);
                  setShowExchange(false);
                  setShowChartType(false);
                }}
                className={`h-6 w-6 rounded-sm inline-flex items-center justify-center transition-colors ${
                  showAdvancedIndicators
                    ? "text-primary bg-bg-l4"
                    : "text-text-muted hover:text-text-main hover:bg-bg-l2"
                }`}
                aria-label="Advanced indicators"
                title="Advanced indicators"
                type="button"
              >
                <Settings size={14} />
              </button>

              {showAdvancedIndicators && (
                <div className="absolute top-full left-0 mt-1 z-50">
                  <AdvancedIndicators
                    config={advancedIndicators}
                    onChange={(newConfig) => {
                      setAdvancedIndicators(newConfig);
                      setUseEnhancedChart(true);
                    }}
                  />
                </div>
              )}
            </div>

            {/* Analytics Button */}
            <div className="relative">
              <button
                onClick={() => setShowAnalytics((v) => !v)}
                className={`h-6 w-6 rounded-sm inline-flex items-center justify-center transition-colors ${
                  showAnalytics
                    ? "text-primary bg-bg-l4"
                    : "text-text-muted hover:text-text-main hover:bg-bg-l2"
                }`}
                aria-label="Advanced analytics"
                title="Advanced analytics"
                type="button"
              >
                <Activity size={14} />
              </button>
            </div>

            <button type="button" onClick={downloadChartImage} aria-label="Download chart image" title="Download chart image" className="h-7 w-7 rounded-sm inline-flex items-center justify-center text-text-muted hover:bg-bg-l2 hover:text-text-main">
              <Camera size={14} />
            </button>
          </div>

          {/* Separator */}
          <div className="w-px h-4 bg-border/60 mx-0.5" />

          {/* Exchange Selector Button */}
          <div className="relative" ref={exchangeRef}>
            <button
              onClick={() => {
                setShowExchange((v) => !v);
                setShowIndicators(false);
                setShowAdvancedIndicators(false);
                setShowChartType(false);
              }}
              className="h-6 px-2 rounded-sm hover:bg-bg-l2 transition-colors inline-flex items-center gap-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-text-main"
            >
              <span>{activeExchange}</span>
              <ChevronRight
                size={11}
                className={`text-text-dim transition-transform duration-150 ${
                  showExchange ? "rotate-90" : ""
                }`}
              />
            </button>

            {showExchange && (
              <div className="absolute top-full left-0 mt-1 w-40 bg-bg-l1/95 backdrop-blur-sm border border-t-border shadow-xl z-50 rounded-sm">
                <div className="flex items-center justify-between px-3 py-2 bb-thin">
                  <span className="t-label-caps text-text-muted">Exchange</span>
                  <button
                    onClick={() => setShowExchange(false)}
                    className="text-text-dim hover:text-text-main"
                  >
                    <X size={13} />
                  </button>
                </div>
                {exchanges.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => {
                      setActiveExchange(id);
                      exchangeManager.setActiveExchange(id);
                      setShowExchange(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors ${
                      activeExchange === id
                        ? "bg-bg-l4 text-primary"
                        : "hover:bg-bg-l2 text-text-main"
                    }`}
                  >
                    <span className="t-body-sm">{label}</span>
                    {activeExchange === id && <Check size={12} className="text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <span className="chart-toolbar-cue" aria-hidden="true"><ChevronRight size={14} /></span>

        {/* Right Side: Symbol, Reference Feed Label, and OHLC Box */}
        <div className="chart-ohlc-box h-8 px-1 bg-bg-l1/90 backdrop-blur-md border border-t-border rounded-sm flex items-center gap-2 text-xs shadow-sm max-w-full min-w-0 pointer-events-auto">
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            aria-label={isFullscreen ? "Exit full screen" : "Enter full screen chart"}
            aria-pressed={isFullscreen}
            title={isFullscreen ? "Exit full screen (Esc)" : "Expand chart to full screen"}
            className={`chart-fullscreen-button h-7 shrink-0 px-2 inline-flex items-center justify-center gap-1.5 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isFullscreen ? "bg-primary/15 text-primary" : "text-text-main hover:bg-bg-l2"}`}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            <span className="hidden sm:inline">{isFullscreen ? "Exit" : "Full screen"}</span>
          </button>
          <span className="h-4 w-px shrink-0 bg-border/70" />
          <span className="t-label-caps text-text-muted whitespace-nowrap truncate">
            {market?.symbol}
          </span>
          <span className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono font-medium uppercase tracking-wider rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
            {activeExchange}
          </span>
          <span className="hidden lg:block min-w-0 font-mono text-[10px] text-text-price truncate">
            O: {market?.price ? (market.price - 100).toFixed(2) : "--"} H:{" "}
            {market?.high24h?.toFixed(2) ?? "--"} L:{" "}
            {market?.low24h?.toFixed(2) ?? "--"} C:{" "}
            {market?.price?.toFixed(2) ?? "--"}
          </span>
        </div>
      </div>

      {isFullscreen && (
        <aside aria-label="Chart drawing tools" className="chart-drawing-rail absolute bottom-2 left-0 top-11 z-20 flex w-12 flex-col items-center gap-1 overflow-y-auto border-r border-t-border bg-[#0b0d12] py-1.5">
          {drawingToolGroups.map((group) => (
            <div key={group.id} className="chart-tool-group flex w-full flex-col items-center gap-1 border-b border-white/10 px-1 pb-1.5 last:border-b-0">
              {group.tools.map(({ id, label, icon }) => (
                <button
                  key={`${group.id}-${label}`}
                  type="button"
                  aria-label={label}
                  aria-pressed={id !== null ? drawingTool === id : undefined}
                  aria-disabled={id === null}
                  title={label}
                  disabled={id === null}
                  onClick={() => {
                    if (!id) return;
                    setDrawingTool(id);
                    setTradingViewAvailable(false);
                  }}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${id !== null && drawingTool === id ? "bg-white/15 text-white" : "text-[#a9acb5] hover:bg-white/10 hover:text-white"} disabled:cursor-not-allowed disabled:opacity-35`}
                >
                  {icon}
                </button>
              ))}
            </div>
          ))}
          <div className="flex w-full flex-col items-center gap-1 border-b border-white/10 px-1 pb-1.5">
            <button type="button" aria-label="Magnet snapping" aria-pressed={magnetEnabled} title="Magnet snapping" onClick={() => { setMagnetEnabled((value) => !value); setTradingViewAvailable(false); }} className={`flex h-9 w-9 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${magnetEnabled ? "bg-white/15 text-white" : "text-[#a9acb5] hover:bg-white/10 hover:text-white"}`}><Magnet size={17} /></button>
            <button type="button" aria-label={stayInDrawingMode ? "Stay in drawing mode: on" : "Stay in drawing mode: off"} aria-pressed={stayInDrawingMode} title="Stay in drawing mode" onClick={() => setStayInDrawingMode((value) => !value)} className={`flex h-9 w-9 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${stayInDrawingMode ? "bg-white/15 text-white" : "text-[#a9acb5] hover:bg-white/10 hover:text-white"}`}><Repeat2 size={17} /></button>
            <button type="button" aria-label={drawingsLocked ? "Unlock drawings" : "Lock drawings"} aria-pressed={drawingsLocked} title={drawingsLocked ? "Unlock drawings" : "Lock drawings"} onClick={() => setDrawingsLocked((value) => !value)} className={`flex h-9 w-9 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${drawingsLocked ? "bg-white/15 text-white" : "text-[#a9acb5] hover:bg-white/10 hover:text-white"}`}><LockKeyhole size={17} /></button>
            <button type="button" aria-label={drawingsVisible ? "Hide drawings" : "Show drawings"} aria-pressed={!drawingsVisible} title={drawingsVisible ? "Hide drawings" : "Show drawings"} onClick={() => setDrawingsVisible((value) => !value)} className={`flex h-9 w-9 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${drawingsVisible ? "text-[#a9acb5] hover:bg-white/10 hover:text-white" : "bg-white/15 text-white"}`}><Eye size={17} /></button>
            <button type="button" aria-label={indicatorsVisible ? "Hide indicators" : "Show indicators"} aria-pressed={!indicatorsVisible} title={indicatorsVisible ? "Hide indicators" : "Show indicators"} onClick={() => { setIndicatorsVisible((value) => !value); setTradingViewAvailable(false); }} className={`flex h-9 w-9 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${indicatorsVisible ? "text-[#a9acb5] hover:bg-white/10 hover:text-white" : "bg-white/15 text-white"}`}><ChartNoAxesCombined size={17} /></button>
          </div>
          <button type="button" aria-label="Undo last drawing" title="Undo last drawing" onClick={() => setUndoDrawingsKey((key) => key + 1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[#a9acb5] hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Undo2 size={17} /></button>
          <button type="button" aria-label="Remove drawings or indicators" aria-expanded={showRemoveMenu} title="Remove drawings, indicators, or both" onClick={() => setShowRemoveMenu((value) => !value)} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${showRemoveMenu ? "bg-white/15 text-white" : "text-[#a9acb5] hover:bg-white/10 hover:text-white"}`}><Trash2 size={17} /></button>
        </aside>
      )}

      {isFullscreen && showRemoveMenu && (
        <div role="group" aria-label="Remove chart items" className="chart-remove-menu absolute bottom-2 left-14 z-40 w-48 border border-white/15 bg-[#101218] p-1 shadow-xl">
          <button type="button" onClick={removeDrawings} className="w-full px-3 py-2 text-left text-xs text-white/80 hover:bg-white/10">Remove drawings</button>
          <button type="button" onClick={removeIndicators} className="w-full px-3 py-2 text-left text-xs text-white/80 hover:bg-white/10">Remove indicators</button>
          <button type="button" onClick={removeAllChartObjects} className="w-full px-3 py-2 text-left text-xs text-white/80 hover:bg-white/10">Remove drawings and indicators</button>
        </div>
      )}

      {isFullscreen && (
        <aside aria-label="Chart panels" className="chart-utility-rail absolute bottom-2 right-0 top-11 z-20 flex w-12 flex-col items-center gap-1 border-l border-t-border bg-[#0b0d12] py-1.5">
          <button type="button" aria-label="Drawing controls" aria-pressed={showObjectsPanel} title="Drawing controls" onClick={() => setShowObjectsPanel((value) => !value)} className={`flex h-9 w-9 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${showObjectsPanel ? "bg-white/15 text-white" : "text-[#a9acb5] hover:bg-white/10 hover:text-white"}`}><ListTree size={17} /></button>
          <button type="button" aria-label="Price alerts" aria-pressed={showAlert} title="Price alerts" onClick={() => { setShowAlert((value) => !value); setAlertNotice(""); }} className={`flex h-9 w-9 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${showAlert ? "bg-white/15 text-white" : "text-[#a9acb5] hover:bg-white/10 hover:text-white"}`}><Clock3 size={17} /></button>
          <button type="button" aria-label="Indicators" aria-pressed={showAdvancedIndicators} title="Indicators" onClick={() => setShowAdvancedIndicators((value) => !value)} className={`flex h-9 w-9 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${showAdvancedIndicators ? "bg-white/15 text-white" : "text-[#a9acb5] hover:bg-white/10 hover:text-white"}`}><Layers size={17} /></button>
          <button type="button" aria-label="Chart analytics" aria-pressed={showAnalytics} title="Chart analytics" onClick={() => setShowAnalytics((value) => !value)} className={`flex h-9 w-9 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${showAnalytics ? "bg-white/15 text-white" : "text-[#a9acb5] hover:bg-white/10 hover:text-white"}`}><LayoutGrid size={17} /></button>
        </aside>
      )}

      {isFullscreen && showObjectsPanel && (
        <section className="chart-objects-panel absolute right-14 top-12 z-30 w-64 border border-white/10 bg-[#101218] p-3 text-[#d6d7db] shadow-2xl" aria-label="Drawing controls">
          <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
            <h2 className="text-xs font-semibold">Drawing controls</h2>
            <button type="button" onClick={() => setShowObjectsPanel(false)} aria-label="Close object tree" className="text-[#a9acb5] hover:text-white"><X size={14} /></button>
          </div>
          <p className="text-[10px] uppercase tracking-wider text-[#8c909b]">Active drawing tool</p>
          <p className="mt-1 text-xs">{drawingTools.find((tool) => tool.id === drawingTool)?.label ?? "Crosshair"}</p>
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-xs">
            <span className="text-[#a9acb5]">Snapping</span>
            <button type="button" aria-pressed={magnetEnabled} onClick={() => { setMagnetEnabled((value) => !value); setTradingViewAvailable(false); }} className="text-primary">{magnetEnabled ? "On" : "Off"}</button>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-[#a9acb5]">Drawings</span>
            <button type="button" aria-pressed={drawingsVisible} onClick={() => setDrawingsVisible((value) => !value)} className="text-primary">{drawingsVisible ? "Visible" : "Hidden"}</button>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-[#a9acb5]">Indicators</span>
            <button type="button" aria-pressed={indicatorsVisible} onClick={() => { setIndicatorsVisible((value) => !value); setTradingViewAvailable(false); }} className="text-primary">{indicatorsVisible ? "Visible" : "Hidden"}</button>
          </div>
          <label className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-xs">
            <span className="text-[#a9acb5]">Stamp icon</span>
            <select value={emojiChoice} onChange={(event) => setEmojiChoice(event.target.value)} className="bg-[#090b10] px-1 py-0.5 text-sm text-white">
              {["📍", "⭐", "🚀", "🔥", "✅", "⚠️", "💡", "❤️"].map((emoji) => <option key={emoji} value={emoji}>{emoji}</option>)}
            </select>
          </label>
        </section>
      )}

      {/* Drawing mode indicator bar */}
      {drawingTool !== "crosshair" && (
        <div className="chart-drawing-mode-indicator absolute bottom-2 right-2 z-20 pointer-events-auto px-4 py-1.5 bg-primary/20 backdrop-blur-sm border border-primary/40 rounded-sm flex items-center justify-between gap-4 shadow-lg">
          <span className="t-label-caps text-primary flex items-center gap-2">
            {drawingTools.find((d) => d.id === drawingTool)?.icon}
            {drawingTools.find((d) => d.id === drawingTool)?.label} mode
          </span>
          <button
            onClick={() => setDrawingTool("crosshair")}
            className="t-label-caps text-text-muted hover:text-short transition-colors"
          >
            ESC to cancel
          </button>
        </div>
      )}

      {alertNotice && (
        <div role="status" className="absolute bottom-3 left-3 z-30 border border-primary/40 bg-bg-l1/95 px-3 py-2 text-xs text-text-main shadow-lg">
          <span>{alertNotice}</span>
          <button type="button" aria-label="Dismiss chart alert" className="ml-3 text-text-muted hover:text-text-main" onClick={() => setAlertNotice("")}><X size={12} className="inline" /></button>
        </div>
      )}

      {/* Chart area */}
      <div className="chart-canvas-area flex-grow relative bg-bg-base overflow-hidden" style={{ minHeight: 300 }}>
        {/* Advanced Charts renders ApeX's own candles via /api/udf when the
            licensed library is present; otherwise it stays out of the way. */}
        {tradingViewAvailable && activeExchange === "apex" && market?.symbol && (
          <TradingViewChart
            symbol={market.symbol}
            resolution={TIMEFRAME_TO_RESOLUTION[active] ?? "15"}
            onUnavailable={() => setTradingViewAvailable(false)}
          />
        )}

        {!(tradingViewAvailable && activeExchange === "apex") &&
          (useEnhancedChart &&
          (chartType !== 'candlestick' || Object.values(advancedIndicators).some(v => v === true && typeof v === 'boolean')) ? (
            <EnhancedChart
              timeframe={active}
              replayOffset={replayOffset}
              indicatorConfig={visibleAdvancedIndicators}
              drawingTool={drawingTool}
              magnetEnabled={magnetEnabled}
              drawingsVisible={drawingsVisible}
              drawingsLocked={drawingsLocked}
              clearDrawingsKey={clearDrawingsKey}
              undoDrawingsKey={undoDrawingsKey}
              emojiChoice={emojiChoice}
              onDrawingComplete={completeDrawing}
              onToolCancel={() => setDrawingTool("crosshair")}
              chartType={chartType}
              exchange={activeExchange}
            />
          ) : (
            <CandlestickChart
              timeframe={active}
              indicators={visibleIndicators}
              drawingTool={drawingTool}
              magnetEnabled={magnetEnabled}
              drawingsVisible={drawingsVisible}
              drawingsLocked={drawingsLocked}
              clearDrawingsKey={clearDrawingsKey}
              undoDrawingsKey={undoDrawingsKey}
              emojiChoice={emojiChoice}
              onDrawingComplete={completeDrawing}
              onToolCancel={() => setDrawingTool("crosshair")}
              exchange={activeExchange}
              replayOffset={replayOffset}
            />
          ))}
      </div>

      {/* Advanced Analytics Panel */}
      <AdvancedAnalyticsPanel
        timeframe={active}
        exchange={activeExchange}
        isOpen={showAnalytics}
        onClose={() => setShowAnalytics(false)}
      />
    </section>
  );
}
