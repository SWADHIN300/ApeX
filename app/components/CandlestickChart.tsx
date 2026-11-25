"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CrosshairMode,
  LineStyle,
} from "lightweight-charts";
import { subscribeKlines } from "@/lib/api";
import { exchangeManager } from "@/lib/exchanges";
import { useMarket } from "@/contexts/MarketContext";
import type { ExchangeName } from "@/lib/exchanges";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import type { Indicators, DrawingTool } from "./ChartPanel";
import type { Candle } from "@/lib/exchanges/types";
import ChartDrawingLayer from "./ChartDrawingLayer";

interface Props {
  timeframe?: string;
  indicators?: Indicators;
  drawingTool?: DrawingTool;
  magnetEnabled?: boolean;
  drawingsVisible?: boolean;
  drawingsLocked?: boolean;
  clearDrawingsKey?: number;
  undoDrawingsKey?: number;
  emojiChoice?: string;
  onDrawingComplete?: () => void;
  onToolCancel?: () => void;
  /** Market data source. `apex` renders the protocol's own indexed fills. */
  exchange?: ExchangeName;
  replayOffset?: number;
}

export default function CandlestickChart({
  timeframe = "15m",
  indicators = { sma20: true, sma50: true, volume: true },
  drawingTool = "crosshair",
  magnetEnabled = false,
  drawingsVisible = true,
  drawingsLocked = false,
  clearDrawingsKey = 0,
  undoDrawingsKey = 0,
  emojiChoice = "📍",
  onDrawingComplete = () => undefined,
  onToolCancel = () => undefined,
  exchange = "binance",
  replayOffset = 0,
}: Props) {
  const { market } = useMarket();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const sma20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const sma50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [drawingChart, setDrawingChart] = useState<IChartApi | null>(null);
  const [drawingSeries, setDrawingSeries] = useState<ISeriesApi<"Candlestick"> | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Store loaded close data for SMA recalculation on toggle
  const closedataRef = useRef<{ time: Time; value: number }[]>([]);
  const candleDataRef = useRef<Candle[]>([]);
  const replayOffsetRef = useRef(replayOffset);
  const indicatorsRef = useRef(indicators);
  useEffect(() => {
    replayOffsetRef.current = replayOffset;
  }, [replayOffset]);
  useEffect(() => {
    indicatorsRef.current = indicators;
  }, [indicators]);
  const rangeLow = market?.low24h ?? 0;
  const rangeHigh = market?.high24h ?? 0;
  const lastPrice = market?.price ?? 0;
  const rangePosition = rangeHigh > rangeLow
    ? Math.max(0, Math.min(100, ((lastPrice - rangeLow) / (rangeHigh - rangeLow)) * 100))
    : 50;
  const formatQuote = (value: number) => value > 0
    ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";

  // SMA helper
  const calculateSMA = useCallback(
    (data: { time: Time; value: number }[], period: number) => {
      const result: { time: Time; value: number }[] = [];
      for (let i = 0; i < data.length; i++) {
        if (i < period - 1) continue;
        let sum = 0;
        for (let j = 0; j < period; j++) sum += data[i - j].value;
        result.push({ time: data[i].time, value: sum / period });
      }
      return result;
    },
    []
  );

  // Create chart once on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#928f9e",
        fontFamily: "Geist, Inter, ui-sans-serif, system-ui, sans-serif",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "#24262c", style: LineStyle.Dotted },
        horzLines: { color: "#24262c", style: LineStyle.Dotted },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "#2a2a2c",
        rightOffset: 8,
        barSpacing: 7,
        minBarSpacing: 2,
        shiftVisibleRangeOnNewBar: true,
      },
      rightPriceScale: {
        borderColor: "#2a2a2c",
        minimumWidth: 72,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#aab2c080", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#353437" },
        horzLine: { color: "#aab2c080", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#353437" },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#1d9e75",
      downColor: "#f0445e",
      borderVisible: false,
      wickUpColor: "#1d9e75",
      wickDownColor: "#f0445e",
      borderUpColor: "#1d9e75",
      borderDownColor: "#f0445e",
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "#26a69a",
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    const sma20Series = chart.addSeries(LineSeries, {
      color: "rgba(41, 98, 255, 0.7)",
      lineWidth: 1,
      crosshairMarkerVisible: false,
    });

    const sma50Series = chart.addSeries(LineSeries, {
      color: "rgba(255, 109, 0, 0.7)",
      lineWidth: 1,
      crosshairMarkerVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    setDrawingChart(chart);
    setDrawingSeries(series);
    volumeSeriesRef.current = volumeSeries;
    sma20SeriesRef.current = sma20Series;
    sma50SeriesRef.current = sma50Series;

    // Resize observer
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) chart.resize(width, height);
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      setDrawingChart(null);
      setDrawingSeries(null);
      volumeSeriesRef.current = null;
      sma20SeriesRef.current = null;
      sma50SeriesRef.current = null;
    };
  }, []);

  const renderCandles = useCallback((candles: Candle[], offset: number) => {
    if (!seriesRef.current || !chartRef.current || candles.length === 0) return;
    const end = Math.max(1, candles.length - offset);
    const visible = candles.slice(0, end);
    const normalized = visible.map((candle) => ({ ...candle, time: candle.time as Time }));
    seriesRef.current.setData(normalized);
    volumeSeriesRef.current?.setData(
      indicatorsRef.current.volume
        ? visible.map((candle) => ({
            time: candle.time as Time,
            value: candle.volume,
            color: candle.close >= candle.open
              ? "rgba(29, 158, 117, 0.58)"
              : "rgba(240, 68, 94, 0.58)",
          }))
        : [],
    );
    const closes = visible.map((candle) => ({ time: candle.time as Time, value: candle.close }));
    closedataRef.current = closes;
    sma20SeriesRef.current?.setData(indicatorsRef.current.sma20 ? calculateSMA(closes, 20) : []);
    sma50SeriesRef.current?.setData(indicatorsRef.current.sma50 ? calculateSMA(closes, 50) : []);
    const right = visible.length;
    chartRef.current.timeScale().setVisibleLogicalRange({
      from: Math.max(0, right - 140),
      to: right + 8,
    });
  }, [calculateSMA]);

  // React to indicator toggles — show/hide series
  useEffect(() => {
    if (!sma20SeriesRef.current || !sma50SeriesRef.current || !volumeSeriesRef.current) return;

    const closeData = closedataRef.current;

    // SMA 20
    if (indicators.sma20 && closeData.length > 0) {
      sma20SeriesRef.current.setData(calculateSMA(closeData, 20));
    } else {
      sma20SeriesRef.current.setData([]);
    }
    // SMA 50
    if (indicators.sma50 && closeData.length > 0) {
      sma50SeriesRef.current.setData(calculateSMA(closeData, 50));
    } else {
      sma50SeriesRef.current.setData([]);
    }
    // Volume — hide by clearing data
    if (!indicators.volume) {
      volumeSeriesRef.current.setData([]);
    }
  }, [indicators, calculateSMA]);

  // React to drawing tool changes — update crosshair mode
  useEffect(() => {
    if (!chartRef.current) return;
    const mode =
      (drawingTool === "crosshair" || drawingTool === "cursor") && !magnetEnabled
        ? CrosshairMode.Normal
        : CrosshairMode.Magnet;
    chartRef.current.applyOptions({ crosshair: { mode } });
  }, [drawingTool, magnetEnabled]);

  // Load data whenever market or timeframe changes
  useEffect(() => {
    if (!market || !seriesRef.current || !chartRef.current) return;

    let mounted = true;
    let unsubscribeWs: (() => void) | undefined;
    const requestTimeout = setTimeout(() => {
      if (!mounted) return;
      setLoadError("Chart data request timed out. Choose another data source to retry.");
      setIsEmpty(true);
      setIsLoading(false);
    }, 3_000);

    const loadData = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        // Bypass IndexedDB here: a stalled cache open must never keep the chart
        // in its loading state when the exchange endpoint is reachable.
        const klines = await exchangeManager.fetchKlines(market.symbol, timeframe, 500, exchange);
        if (!mounted || !seriesRef.current) return;
        setLoadError(null);

        const unique = Array.from(
          new Map(klines.map((k) => [k.time, k])).values()
        )
          .sort((a, b) => a.time - b.time)
          ;

        candleDataRef.current = unique;

        // An empty ApeX series is expected until the protocol has fills the
        // indexer can aggregate — surface that instead of a blank chart.
        setIsEmpty(unique.length === 0);

        if (unique.length > 0) renderCandles(unique, replayOffsetRef.current);

        // Real-time updates from the selected source.
        unsubscribeWs = subscribeKlines(
          market.symbol,
          timeframe,
          (candle) => {
            if (!mounted || !seriesRef.current) return;
            const existingIndex = candleDataRef.current.findIndex((item) => item.time === candle.time);
            if (existingIndex >= 0) candleDataRef.current[existingIndex] = candle;
            else candleDataRef.current.push(candle);
            if (replayOffsetRef.current > 0) return;
            setIsEmpty(false);
            setLoadError(null);
            seriesRef.current.update({ ...candle, time: candle.time as Time });
            if (indicators.volume) {
              volumeSeriesRef.current?.update({
                time: candle.time as Time,
                value: candle.volume,
                color:
                  candle.close >= candle.open
                  ? "rgba(29, 158, 117, 0.58)"
                  : "rgba(240, 68, 94, 0.58)",
              });
            }
          },
          exchange,
        );
      } catch {
        if (!mounted) return;
        setLoadError("Chart data is unavailable. Choose another data source to retry.");
        setIsEmpty(true);
      } finally {
        clearTimeout(requestTimeout);
        if (mounted) setIsLoading(false);
      }
    };

    loadData();

    return () => {
      mounted = false;
      clearTimeout(requestTimeout);
      unsubscribeWs?.();
    };
  }, [market?.symbol, timeframe, exchange]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (candleDataRef.current.length > 0) renderCandles(candleDataRef.current, replayOffset);
  }, [replayOffset, renderCandles]);

  useEffect(() => {
    const saveChartImage = () => {
      const canvas = chartRef.current?.takeScreenshot(true, true);
      if (!canvas) return;
      const link = document.createElement("a");
      link.download = `apex-${market?.symbol ?? "chart"}-${timeframe}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    window.addEventListener("apex:chart-screenshot", saveChartImage);
    return () => window.removeEventListener("apex:chart-screenshot", saveChartImage);
  }, [market?.symbol, timeframe]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      {drawingChart && (
        <ChartDrawingLayer
          chart={drawingChart}
          series={drawingSeries}
          tool={drawingTool}
          drawingsVisible={drawingsVisible}
          drawingsLocked={drawingsLocked}
          clearKey={clearDrawingsKey}
          undoKey={undoDrawingsKey}
          magnetEnabled={magnetEnabled}
          emojiChoice={emojiChoice}
          onDrawingComplete={onDrawingComplete}
          onToolCancel={onToolCancel}
          timeframe={timeframe}
        />
      )}
      {isLoading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(13,13,15,0.6)",
          }}
        >
          <span className="t-label-caps text-text-muted">Loading Chart…</span>
        </div>
      )}
      {!isLoading && isEmpty && (
        <div className="chart-empty-state absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-bg-base/90 px-4 text-center">
          <div>
            <p role="status" className="text-sm font-semibold text-text-main">
              {loadError ? "Candles temporarily unavailable" : exchange === "apex" ? "No ApeX trades indexed yet" : "No candles returned by this source"}
            </p>
            <p className="mt-1 max-w-[360px] text-xs leading-relaxed text-text-muted">
              {loadError ?? (exchange === "apex"
                ? "ApeX candles appear after on-chain trades are indexed. Switch the chart source above for reference-market candles."
                : `The ${exchange} feed returned no candles. Choose another chart source above to retry.`)}
            </p>
          </div>
          <div className="w-full max-w-md border border-t-border bg-bg-surface p-4 text-left">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">24h market range</span>
              <span className="font-mono text-xs tabular-nums text-text-main">${formatQuote(lastPrice)}</span>
            </div>
            <div className="relative h-1.5 rounded-full bg-bg-l3" aria-label="Position within the 24 hour market range">
              {lastPrice > 0 && rangeHigh > rangeLow && (
                <>
                  <div className="absolute inset-y-0 left-0 rounded-full bg-long/50" style={{ width: `${rangePosition}%` }} />
                  <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg-surface bg-primary" style={{ left: `${rangePosition}%` }} />
                </>
              )}
            </div>
            <div className="mt-2 flex justify-between gap-3 font-mono text-[11px] tabular-nums text-text-muted">
              <span>Low ${formatQuote(rangeLow)}</span>
              <span>High ${formatQuote(rangeHigh)}</span>
            </div>
            {lastPrice <= 0 && <p className="mt-3 text-[11px] text-text-dim">Waiting for a live ticker quote.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
