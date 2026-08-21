"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  Time,
  CrosshairMode,
  LineStyle,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  HistogramSeries,
} from "lightweight-charts";
import { cachedApi } from "@/lib/cache/cachedApi";
import { useMarket } from "@/contexts/MarketContext";
import { DrawingTool } from "./ChartPanel";
import { AdvancedIndicatorConfig } from "./AdvancedIndicators";
import * as indicators from "@/lib/indicators";
import { detectAllPatterns, PatternDetection } from "@/lib/patterns/candlestickPatterns";
import { Candle } from "@/lib/exchanges/types";

interface Props {
  timeframe?: string;
  indicatorConfig?: AdvancedIndicatorConfig;
  drawingTool?: DrawingTool;
  chartType?: 'candlestick' | 'line' | 'area';
  exchange?: string;
}

export default function EnhancedChart({
  timeframe = "15m",
  indicatorConfig,
  drawingTool = "crosshair",
  chartType = 'candlestick',
  exchange = 'binance'
}: Props) {
  const { market } = useMarket();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<any>>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [patterns, setPatterns] = useState<PatternDetection[]>([]);
  const candleDataRef = useRef<any[]>([]);

  // Calculate indicator helper
  const calculateSMA = useCallback((data: { time: Time; value: number }[], period: number) => {
    const result: { time: Time; value: number }[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) continue;
      let sum = 0;
      for (let j = 0; j < period; j++) sum += data[i - j].value;
      result.push({ time: data[i].time, value: sum / period });
    }
    return result;
  }, []);

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
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#c8c4d580", width: 1, labelBackgroundColor: "#353437" },
        horzLine: { color: "#c8c4d580", width: 1, labelBackgroundColor: "#353437" },
      },
    });

    chartRef.current = chart;

    // Create initial candlestick series
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#1d9e75",
      downColor: "#d85a30",
      borderVisible: false,
      wickUpColor: "#1d9e75",
      wickDownColor: "#d85a30",
    });
    mainSeriesRef.current = series;

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
      mainSeriesRef.current = null;
      indicatorSeriesRef.current.clear();
    };
  }, []);

  // Update chart type
  useEffect(() => {
    if (!chartRef.current || !mainSeriesRef.current) return;

    // Remove old series
    chartRef.current.removeSeries(mainSeriesRef.current);

    // Create new series based on type
    if (chartType === 'candlestick') {
      const series = chartRef.current.addSeries(CandlestickSeries, {
        upColor: "#1d9e75",
        downColor: "#d85a30",
        borderVisible: false,
        wickUpColor: "#1d9e75",
        wickDownColor: "#d85a30",
      });
      mainSeriesRef.current = series;
    } else if (chartType === 'line') {
      const series = chartRef.current.addSeries(LineSeries, {
        color: "#2962FF",
        lineWidth: 2,
      });
      mainSeriesRef.current = series;
    } else if (chartType === 'area') {
      const series = chartRef.current.addSeries(AreaSeries, {
        lineColor: "#2962FF",
        topColor: "rgba(41, 98, 255, 0.4)",
        bottomColor: "rgba(41, 98, 255, 0.0)",
        lineWidth: 2,
      });
      mainSeriesRef.current = series;
    }

    // Re-apply data if available
    if (candleDataRef.current.length > 0) {
      const data = candleDataRef.current;
      if (chartType === 'candlestick') {
        mainSeriesRef.current?.setData(data);
      } else {
        // For line/area, use close prices
        const closeData = data.map((k: any) => ({ time: k.time, value: k.close }));
        mainSeriesRef.current?.setData(closeData);
      }
    }
  }, [chartType]);

  // Update drawing tool mode
  useEffect(() => {
    if (!chartRef.current) return;
    const mode = drawingTool === "crosshair" ? CrosshairMode.Normal : CrosshairMode.Magnet;
    chartRef.current.applyOptions({ crosshair: { mode } });
  }, [drawingTool]);

  // Load data and apply indicators
  useEffect(() => {
    if (!market || !chartRef.current || !mainSeriesRef.current) return;

    let mounted = true;
    let unsubscribeWs: (() => void) | undefined;

    const loadData = async () => {
      setIsLoading(true);

      const klines = await cachedApi.fetchKlines(market.symbol, timeframe, 500, exchange as any);
      if (!mounted || !mainSeriesRef.current) return;

      const unique = Array.from(
        new Map(klines.map((k) => [k.time, k])).values()
      )
        .sort((a, b) => a.time - b.time);

      const uniqueWithTime = unique.map((k) => ({ ...k, time: k.time as Time }));
      candleDataRef.current = uniqueWithTime;

      if (unique.length > 0) {
        // Set main series data
        if (chartType === 'candlestick') {
          mainSeriesRef.current.setData(uniqueWithTime);
        } else {
          // For line/area, use close prices
          const closeData = uniqueWithTime.map(k => ({ time: k.time, value: k.close }));
          mainSeriesRef.current.setData(closeData);
        }

        // Detect patterns
        const detectedPatterns = detectAllPatterns(unique);
        setPatterns(detectedPatterns);

        // Apply indicators
        applyIndicators(unique);

        chartRef.current?.timeScale().fitContent();
      }

      setIsLoading(false);

      // Real-time WebSocket updates
      unsubscribeWs = cachedApi.subscribeKlines(market.symbol, timeframe, (candle) => {
        if (!mounted || !mainSeriesRef.current) return;
        
        if (chartType === 'candlestick') {
          mainSeriesRef.current.update({ ...candle, time: candle.time as Time });
        } else {
          mainSeriesRef.current.update({ time: candle.time as Time, value: candle.close });
        }

        // Update candle data
        const lastIdx = candleDataRef.current.findIndex(c => c.time === candle.time);
        if (lastIdx !== -1) {
          candleDataRef.current[lastIdx] = candle;
        } else {
          candleDataRef.current.push(candle);
        }
      }, exchange as any);
    };

    loadData();

    return () => {
      mounted = false;
      unsubscribeWs?.();
    };
  }, [market?.symbol, timeframe, chartType, exchange]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply indicators when config changes
  useEffect(() => {
    if (candleDataRef.current.length > 0 && indicatorConfig) {
      applyIndicators(candleDataRef.current);
    }
  }, [indicatorConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyIndicators = useCallback((candles: Candle[]) => {
    if (!chartRef.current || !indicatorConfig) return;

    const chart = chartRef.current;
    const seriesMap = indicatorSeriesRef.current;

    // Clear old indicator series
    seriesMap.forEach(series => chart.removeSeries(series));
    seriesMap.clear();

    const closes = candles.map(c => ({ time: c.time as Time, value: c.close }));

    // Moving Averages
    if (indicatorConfig.sma20) {
      const sma20 = calculateSMA(closes, 20);
      const series = chart.addSeries(LineSeries, { color: "rgba(41,98,255,0.7)", lineWidth: 1 });
      series.setData(sma20);
      seriesMap.set('sma20', series);
    }

    if (indicatorConfig.sma50) {
      const sma50 = calculateSMA(closes, 50);
      const series = chart.addSeries(LineSeries, { color: "rgba(255,109,0,0.7)", lineWidth: 1 });
      series.setData(sma50);
      seriesMap.set('sma50', series);
    }

    if (indicatorConfig.sma200) {
      const sma200 = calculateSMA(closes, 200);
      const series = chart.addSeries(LineSeries, { color: "rgba(156,39,176,0.7)", lineWidth: 1 });
      series.setData(sma200);
      seriesMap.set('sma200', series);
    }

    if (indicatorConfig.ema12) {
      const ema12Data = indicators.calculateEMA(candles.map(c => c.close), 12);
      const ema12 = candles.map((c, i) => ({ time: c.time as Time, value: ema12Data[i] })).filter(d => !isNaN(d.value));
      const series = chart.addSeries(LineSeries, { color: "rgba(0,188,212,0.7)", lineWidth: 1 });
      series.setData(ema12);
      seriesMap.set('ema12', series);
    }

    if (indicatorConfig.ema26) {
      const ema26Data = indicators.calculateEMA(candles.map(c => c.close), 26);
      const ema26 = candles.map((c, i) => ({ time: c.time as Time, value: ema26Data[i] })).filter(d => !isNaN(d.value));
      const series = chart.addSeries(LineSeries, { color: "rgba(255,193,7,0.7)", lineWidth: 1 });
      series.setData(ema26);
      seriesMap.set('ema26', series);
    }

    if (indicatorConfig.ema50) {
      const ema50Data = indicators.calculateEMA(candles.map(c => c.close), 50);
      const ema50 = candles.map((c, i) => ({ time: c.time as Time, value: ema50Data[i] })).filter(d => !isNaN(d.value));
      const series = chart.addSeries(LineSeries, { color: "rgba(233,30,99,0.7)", lineWidth: 1 });
      series.setData(ema50);
      seriesMap.set('ema50', series);
    }

    // Bollinger Bands
    if (indicatorConfig.bollingerBands) {
      const bb = indicators.calculateBollingerBands(candles, indicatorConfig.bbPeriod, indicatorConfig.bbStdDev);
      const upperSeries = chart.addSeries(LineSeries, { 
        color: "rgba(76,175,80,0.6)", 
        lineWidth: 1,
        lineStyle: LineStyle.Dashed 
      });
      const middleSeries = chart.addSeries(LineSeries, { color: "rgba(76,175,80,0.8)", lineWidth: 1 });
      const lowerSeries = chart.addSeries(LineSeries, { 
        color: "rgba(76,175,80,0.6)", 
        lineWidth: 1,
        lineStyle: LineStyle.Dashed 
      });
      
      upperSeries.setData(bb.map(b => ({ time: b.time as Time, value: b.upper })));
      middleSeries.setData(bb.map(b => ({ time: b.time as Time, value: b.middle })));
      lowerSeries.setData(bb.map(b => ({ time: b.time as Time, value: b.lower })));
      
      seriesMap.set('bb_upper', upperSeries);
      seriesMap.set('bb_middle', middleSeries);
      seriesMap.set('bb_lower', lowerSeries);
    }

    // VWAP
    if (indicatorConfig.vwap) {
      const vwap = indicators.calculateVWAP(candles);
      const series = chart.addSeries(LineSeries, { color: "rgba(255,235,59,0.8)", lineWidth: 2 });
      series.setData(vwap.map(v => ({ time: v.time as Time, value: v.value })));
      seriesMap.set('vwap', series);
    }

    // Volume
    if (indicatorConfig.volume) {
      const volumeData = candles.map((k) => ({
        time: k.time as Time,
        value: k.volume,
        color: k.close >= k.open ? "rgba(29,158,117,0.5)" : "rgba(216,90,48,0.5)",
      }));
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: "#26a69a",
        priceFormat: { type: "volume" },
        priceScaleId: "",
      });
      volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      volumeSeries.setData(volumeData);
      seriesMap.set('volume', volumeSeries);
    }
  }, [calculateSMA, indicatorConfig]);

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

      {/* Pattern markers */}
      {patterns.length > 0 && (
        <div className="absolute top-16 right-4 z-20 max-w-xs bg-bg-l1/90 backdrop-blur-sm border border-t-border rounded p-2 max-h-48 overflow-y-auto">
          <div className="t-label-caps text-text-muted mb-1">Detected Patterns</div>
          {patterns.slice(-5).map((pattern, idx) => (
            <div 
              key={idx}
              className={`t-body-xs py-1 px-2 rounded mb-1 ${
                pattern.bullish ? 'bg-long/20 text-long' : 'bg-short/20 text-short'
              }`}
            >
              <div className="font-medium">{pattern.name}</div>
              <div className="text-text-dim">{pattern.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
