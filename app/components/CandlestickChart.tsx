"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CrosshairMode,
} from "lightweight-charts";
import { fetchKlines, subscribeKlines } from "@/lib/api";
import { useMarket } from "@/contexts/MarketContext";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import type { Indicators, DrawingTool } from "./ChartPanel";

interface Props {
  timeframe?: string;
  indicators?: Indicators;
  drawingTool?: DrawingTool;
}

export default function CandlestickChart({
  timeframe = "15m",
  indicators = { sma20: true, sma50: true, volume: true },
  drawingTool = "crosshair",
}: Props) {
  const { market } = useMarket();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const sma20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const sma50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Store loaded close data for SMA recalculation on toggle
  const closedataRef = useRef<{ time: Time; value: number }[]>([]);

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
        fontFamily: "JetBrains Mono",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "#1e1e20", style: 1 },
        horzLines: { color: "#1e1e20", style: 1 },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "#2a2a2c",
        rightOffset: 5,
        barSpacing: 8,
        minBarSpacing: 3,
      },
      rightPriceScale: {
        borderColor: "#2a2a2c",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#c8c4d580", width: 1, labelBackgroundColor: "#353437" },
        horzLine: { color: "#c8c4d580", width: 1, labelBackgroundColor: "#353437" },
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#1d9e75",
      downColor: "#d85a30",
      borderVisible: false,
      wickUpColor: "#1d9e75",
      wickDownColor: "#d85a30",
      borderUpColor: "#1d9e75",
      borderDownColor: "#d85a30",
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
      volumeSeriesRef.current = null;
      sma20SeriesRef.current = null;
      sma50SeriesRef.current = null;
    };
  }, []);

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
      drawingTool === "crosshair" ? CrosshairMode.Normal : CrosshairMode.Magnet;
    chartRef.current.applyOptions({ crosshair: { mode } });
  }, [drawingTool]);

  // Load data whenever market or timeframe changes
  useEffect(() => {
    if (!market || !seriesRef.current || !chartRef.current) return;

    let mounted = true;
    let unsubscribeWs: (() => void) | undefined;

    const loadData = async () => {
      setIsLoading(true);

      const klines = await fetchKlines(market.symbol, timeframe, 200);
      if (!mounted || !seriesRef.current) return;

      const unique = Array.from(
        new Map(klines.map((k) => [k.time, k])).values()
      )
        .sort((a, b) => a.time - b.time)
        .map((k) => ({ ...k, time: k.time as Time }));

      if (unique.length > 0) {
        seriesRef.current.setData(unique);

        // Volume
        const volumeData = unique.map((k) => ({
          time: k.time,
          value: k.volume,
          color:
            k.close >= k.open
              ? "rgba(29, 158, 117, 0.5)"
              : "rgba(216, 90, 48, 0.5)",
        }));
        if (indicators.volume) {
          volumeSeriesRef.current?.setData(volumeData);
        }

        // SMAs
        const closeData = unique.map((k) => ({ time: k.time, value: k.close }));
        closedataRef.current = closeData;

        if (indicators.sma20) sma20SeriesRef.current?.setData(calculateSMA(closeData, 20));
        if (indicators.sma50) sma50SeriesRef.current?.setData(calculateSMA(closeData, 50));

        chartRef.current?.timeScale().fitContent();
      }

      setIsLoading(false);

      // Real-time WebSocket updates
      unsubscribeWs = subscribeKlines(market.symbol, timeframe, (candle) => {
        if (!mounted || !seriesRef.current) return;
        seriesRef.current.update({ ...candle, time: candle.time as Time });
        if (indicators.volume) {
          volumeSeriesRef.current?.update({
            time: candle.time as Time,
            value: candle.volume,
            color:
              candle.close >= candle.open
                ? "rgba(29, 158, 117, 0.5)"
                : "rgba(216, 90, 48, 0.5)",
          });
        }
      });
    };

    loadData();

    return () => {
      mounted = false;
      unsubscribeWs?.();
    };
  }, [market?.symbol, timeframe]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
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
    </div>
  );
}
