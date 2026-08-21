"use client";

import { useEffect, useRef, useState } from "react";
import CandlestickChart from "./CandlestickChart";
import EnhancedChart from "./EnhancedChart";
import AdvancedIndicators, { AdvancedIndicatorConfig } from "./AdvancedIndicators";
import AdvancedAnalyticsPanel from "./AdvancedAnalyticsPanel";
import { useMarket } from "@/contexts/MarketContext";
import { exchangeManager } from "@/lib/exchanges";
import {
  LineChart,
  Paintbrush,
  X,
  Crosshair,
  TrendingUp,
  Minus,
  Square,
  Check,
  TrendingDown,
  BarChart3,
  Settings,
  ChevronRight,
  Activity,
} from "lucide-react";

const timeframes = ["1m", "5m", "15m", "1h", "4h", "1d"];

export type Indicators = {
  sma20: boolean;
  sma50: boolean;
  volume: boolean;
};

export type DrawingTool = "crosshair" | "hline" | "trendline" | "rectangle";
export type ChartType = "candlestick" | "line" | "area";

export default function ChartPanel() {
  const { market } = useMarket();
  const [active, setActive] = useState("15m");
  const [showIndicators, setShowIndicators] = useState(false);
  const [showAdvancedIndicators, setShowAdvancedIndicators] = useState(false);
  const [showDrawing, setShowDrawing] = useState(false);
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
  const indicatorRef = useRef<HTMLDivElement>(null);
  const advancedIndicatorRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef<HTMLDivElement>(null);
  const exchangeRef = useRef<HTMLDivElement>(null);
  const chartTypeRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (indicatorRef.current && !indicatorRef.current.contains(e.target as Node)) {
        setShowIndicators(false);
      }
      if (advancedIndicatorRef.current && !advancedIndicatorRef.current.contains(e.target as Node)) {
        setShowAdvancedIndicators(false);
      }
      if (drawingRef.current && !drawingRef.current.contains(e.target as Node)) {
        setShowDrawing(false);
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

  const drawingTools: { id: DrawingTool; label: string; icon: React.ReactNode }[] = [
    { id: "crosshair", label: "Crosshair", icon: <Crosshair size={14} /> },
    { id: "trendline", label: "Trend Line", icon: <TrendingUp size={14} /> },
    { id: "hline", label: "Horizontal Line", icon: <Minus size={14} /> },
    { id: "rectangle", label: "Rectangle", icon: <Square size={14} /> },
  ];

  const chartTypes: { id: ChartType; label: string; icon: React.ReactNode }[] = [
    { id: "candlestick", label: "Candlestick", icon: <BarChart3 size={14} /> },
    { id: "line", label: "Line", icon: <TrendingUp size={14} /> },
    { id: "area", label: "Area", icon: <TrendingDown size={14} /> },
  ];

  const exchanges = [
    { id: "binance", label: "Binance" },
    { id: "coinbase", label: "Coinbase" },
    { id: "kraken", label: "Kraken" },
  ];

  return (
    <section className="col-span-12 lg:col-span-6 xl:col-span-7 min-h-[360px] lg:min-h-0 min-w-0 b-thin flex flex-col bg-bg-surface overflow-hidden relative">
      {/* Toolbar Overlay */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-2 z-20 pointer-events-none">
        <div className="flex items-center gap-2">
          {/* Timeframes */}
          <div className="flex shrink-0 gap-1 bg-bg-l1/90 backdrop-blur-sm border border-t-border rounded p-1 pointer-events-auto shadow-sm">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => setActive(tf)}
                className={`t-label-caps px-2.5 py-1.5 rounded transition-colors ${
                  tf === active
                    ? "bg-bg-l4 text-text-main"
                    : "text-text-dim hover:text-text-main hover:bg-bg-l2"
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-bg-l1/90 backdrop-blur-sm border border-t-border rounded p-1 pointer-events-auto shadow-sm">
            {/* Chart Type Button */}
            <div className="relative" ref={chartTypeRef}>
              <button
                onClick={() => {
                  setShowChartType((v) => !v);
                  setShowIndicators(false);
                  setShowDrawing(false);
                  setShowExchange(false);
                  setShowAdvancedIndicators(false);
                }}
                className={`h-8 w-8 rounded flex items-center justify-center transition-colors ${
                  showChartType
                    ? "text-primary bg-bg-l4"
                    : "text-text-muted hover:text-text-main hover:bg-bg-l2"
                }`}
                aria-label="Chart type"
                title="Chart type"
                type="button"
              >
                <BarChart3 size={16} />
              </button>

              {showChartType && (
                <div className="absolute top-full left-0 mt-1 w-44 bg-bg-l1/95 backdrop-blur-sm border border-t-border shadow-xl z-50 rounded">
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
                setShowDrawing(false);
              }}
              className={`h-8 w-8 rounded flex items-center justify-center transition-colors ${
                showIndicators
                  ? "text-primary bg-bg-l4"
                  : "text-text-muted hover:text-text-main hover:bg-bg-l2"
              }`}
              aria-label="Chart indicators"
              title="Chart indicators"
              type="button"
            >
              <LineChart size={16} />
            </button>

            {showIndicators && (
              <div className="absolute top-full left-0 mt-1 w-52 bg-bg-l1/95 backdrop-blur-sm border border-t-border shadow-xl z-50">
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

          {/* Drawing Tools Button */}
          <div className="relative" ref={drawingRef}>
            <button
              onClick={() => {
                setShowDrawing((v) => !v);
                setShowIndicators(false);
                setShowAdvancedIndicators(false);
                setShowExchange(false);
              }}
              className={`h-8 w-8 rounded flex items-center justify-center transition-colors ${
                showDrawing || drawingTool !== "crosshair"
                  ? "text-primary bg-bg-l4"
                  : "text-text-muted hover:text-text-main hover:bg-bg-l2"
              }`}
              aria-label="Drawing tools"
              title="Drawing tools"
              type="button"
            >
              <Paintbrush size={16} />
            </button>

            {showDrawing && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-bg-l1/95 backdrop-blur-sm border border-t-border shadow-xl z-50">
                <div className="flex items-center justify-between px-3 py-2 bb-thin">
                  <span className="t-label-caps text-text-muted">Drawing Tools</span>
                  <button
                    onClick={() => setShowDrawing(false)}
                    className="text-text-dim hover:text-text-main"
                  >
                    <X size={13} />
                  </button>
                </div>
                {drawingTools.map(({ id, label, icon }) => (
                  <button
                    key={id}
                    onClick={() => {
                      setDrawingTool(id);
                      setShowDrawing(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors ${
                      drawingTool === id
                        ? "bg-bg-l4 text-primary"
                        : "hover:bg-bg-l2 text-text-main"
                    }`}
                  >
                    <span className="shrink-0">{icon}</span>
                    <span className="t-body-sm flex-1 text-left">{label}</span>
                    {drawingTool === id && (
                      <Check size={12} className="text-primary" />
                    )}
                  </button>
                ))}
                {drawingTool !== "crosshair" && (
                  <div className="px-3 py-2 bt-thin">
                    <button
                      onClick={() => setDrawingTool("crosshair")}
                      className="w-full text-center t-label-caps text-text-muted hover:text-short transition-colors"
                    >
                      Clear Drawing Mode
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Advanced Indicators Button */}
          <div className="relative" ref={advancedIndicatorRef}>
            <button
              onClick={() => {
                setShowAdvancedIndicators((v) => !v);
                setShowIndicators(false);
                setShowDrawing(false);
                setShowExchange(false);
              }}
              className={`h-8 w-8 rounded flex items-center justify-center transition-colors ${
                showAdvancedIndicators
                  ? "text-primary bg-bg-l4"
                  : "text-text-muted hover:text-text-main hover:bg-bg-l2"
              }`}
              aria-label="Advanced indicators"
              title="Advanced indicators"
              type="button"
            >
              <Settings size={16} />
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
              className={`h-7 w-7 rounded-sm flex shrink-0 items-center justify-center transition-colors ${
                showAnalytics
                  ? "text-primary bg-bg-l4"
                  : "text-text-muted hover:text-text-main hover:bg-bg-l2"
              }`}
              aria-label="Advanced analytics"
              title="Advanced analytics"
              type="button"
            >
              <Activity size={15} />
            </button>
          </div>
          </div>
          
          {/* Exchange Selector */}
          <div className="relative pointer-events-auto" ref={exchangeRef}>
            <button
              onClick={() => {
                setShowExchange((v) => !v);
                setShowIndicators(false);
                setShowDrawing(false);
                setShowAdvancedIndicators(false);
              }}
              className="h-7 px-3 rounded-sm bg-bg-l1/80 backdrop-blur-sm border border-t-border hover:bg-bg-l2 transition-colors flex items-center gap-2"
            >
              <span className="t-label-caps text-text-main">{activeExchange}</span>
              <ChevronRight size={12} className={`text-text-dim transition-transform ${showExchange ? 'rotate-90' : ''}`} />
            </button>

            {showExchange && (
              <div className="absolute top-full left-0 mt-1 w-40 bg-bg-l1/95 backdrop-blur-sm border border-t-border shadow-xl z-50">
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
                      setActiveExchange(id as any);
                      exchangeManager.setActiveExchange(id as any);
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

        {/* Right side: OHLC info & Reference Feed Label */}
        <div className="flex items-center justify-end gap-3 pointer-events-auto bg-bg-l1/80 backdrop-blur-sm border border-t-border rounded-sm px-2 py-1 shadow-sm">
          <span className="t-label-caps text-text-muted whitespace-nowrap">
            {market?.symbol}
          </span>
          <span className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider rounded bg-primary/10 text-primary border border-primary/20">
            Reference Feed: {activeExchange.charAt(0).toUpperCase() + activeExchange.slice(1)}
          </span>
          <span className="hidden sm:block min-w-0 t-data-sm text-text-price">
            O: {market?.price ? (market.price - 100).toFixed(2) : "--"} H:{" "}
            {market?.high24h?.toFixed(2) ?? "--"} L:{" "}
            {market?.low24h?.toFixed(2) ?? "--"} C:{" "}
            {market?.price?.toFixed(2) ?? "--"}
          </span>
        </div>
      </div>

      {/* Drawing mode indicator bar */}
      {drawingTool !== "crosshair" && (
        <div className="absolute bottom-2 right-2 z-20 pointer-events-auto px-4 py-1.5 bg-primary/20 backdrop-blur-sm border border-primary/40 rounded-sm flex items-center justify-between gap-4 shadow-lg">
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

      {/* Chart area */}
      <div className="flex-grow relative bg-bg-base overflow-hidden" style={{ minHeight: 300 }}>
        {useEnhancedChart && (chartType !== 'candlestick' || Object.values(advancedIndicators).some(v => v === true && typeof v === 'boolean')) ? (
          <EnhancedChart
            timeframe={active}
            indicatorConfig={advancedIndicators}
            drawingTool={drawingTool}
            chartType={chartType}
            exchange={activeExchange}
          />
        ) : (
          <CandlestickChart
            timeframe={active}
            indicators={indicators}
            drawingTool={drawingTool}
          />
        )}
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
