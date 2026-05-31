"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, ColorType, CandlestickSeries } from "lightweight-charts";
import { fetchKlines, subscribeKlines } from "@/lib/api";
import { useMarket } from "@/contexts/MarketContext";
import type { IChartApi, ISeriesApi } from "lightweight-charts";

export default function CandlestickChart({ timeframe = "15m" }: { timeframe?: string }) {
  const { market } = useMarket();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

    chartRef.current = chart;
    seriesRef.current = series;

    // Resize observer to keep chart sized correctly
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          chart.resize(width, height);
        }
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Load data whenever market or timeframe changes
  useEffect(() => {
    if (!market || !seriesRef.current || !chartRef.current) return;

    let mounted = true;
    let unsubscribeWs: (() => void) | undefined;

    const loadData = async () => {
      setIsLoading(true);

      const klines = await fetchKlines(market.symbol, timeframe, 200);
      if (!mounted || !seriesRef.current) return;

      // Deduplicate and sort ascending by time
      const unique = Array.from(
        new Map(klines.map((k) => [k.time, k])).values()
      ).sort((a, b) => a.time - b.time);

      if (unique.length > 0) {
        seriesRef.current.setData(unique);
        chartRef.current?.timeScale().fitContent();
      }

      setIsLoading(false);

      // Real-time updates via WebSocket
      unsubscribeWs = subscribeKlines(market.symbol, timeframe, (candle) => {
        if (!mounted || !seriesRef.current) return;
        seriesRef.current.update(candle);
      });
    };

    loadData();

    return () => {
      mounted = false;
      unsubscribeWs?.();
    };
  }, [market?.symbol, timeframe]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
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
