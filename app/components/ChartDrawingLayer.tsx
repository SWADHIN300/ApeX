"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { IChartApi, ISeriesApi, SeriesType, Time } from "lightweight-charts";
import type { DrawingTool } from "./ChartPanel";

type SupportedDrawingTool = Extract<DrawingTool, "trendline" | "hline" | "rectangle" | "fibonacci">;
type ChartPoint = { time: Time; price: number };
type Annotation = { id: number; tool: SupportedDrawingTool; start: ChartPoint; end: ChartPoint };
type DraftAnnotation = Omit<Annotation, "id"> & { pointerId: number };

interface Props<TSeries extends SeriesType> {
  chart: IChartApi | null;
  series: ISeriesApi<TSeries> | null;
  tool: DrawingTool;
  drawingsVisible: boolean;
  drawingsLocked: boolean;
  clearKey: number;
  undoKey: number;
}

const fibonacciLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

export default function ChartDrawingLayer<TSeries extends SeriesType>({
  chart,
  series,
  tool,
  drawingsVisible,
  drawingsLocked,
  clearKey,
  undoKey,
}: Props<TSeries>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const nextIdRef = useRef(1);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [draft, setDraft] = useState<DraftAnnotation | null>(null);
  const [viewRevision, setViewRevision] = useState(0);
  const previousClearKey = useRef(clearKey);
  const previousUndoKey = useRef(undoKey);

  useEffect(() => {
    if (clearKey === previousClearKey.current) return;
    previousClearKey.current = clearKey;
    setAnnotations([]);
    setDraft(null);
  }, [clearKey]);

  useEffect(() => {
    if (undoKey === previousUndoKey.current) return;
    previousUndoKey.current = undoKey;
    setAnnotations((items) => items.slice(0, -1));
    setDraft(null);
  }, [undoKey]);

  useEffect(() => {
    setDraft(null);
  }, [tool, drawingsLocked]);

  useEffect(() => {
    if (!chart) return;
    let frame = 0;
    const refresh = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setViewRevision((revision) => revision + 1));
    };
    chart.timeScale().subscribeVisibleTimeRangeChange(refresh);
    chart.subscribeCrosshairMove(refresh);
    const observer = svgRef.current ? new ResizeObserver(refresh) : null;
    if (svgRef.current) observer?.observe(svgRef.current);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      chart.timeScale().unsubscribeVisibleTimeRangeChange(refresh);
      chart.unsubscribeCrosshairMove(refresh);
    };
  }, [chart]);

  const readPoint = useCallback((event: ReactPointerEvent<SVGSVGElement>): ChartPoint | null => {
    if (!chart || !series || !svgRef.current) return null;
    const bounds = svgRef.current.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const plotWidth = chart.timeScale().width();
    const plotHeight = bounds.height - chart.timeScale().height();
    if (x < 0 || x > plotWidth || y < 0 || y > plotHeight) return null;
    const time = chart.timeScale().coordinateToTime(x);
    const price = series.coordinateToPrice(y);
    if (time === null || price === null || !Number.isFinite(price)) return null;
    return { time, price };
  }, [chart, series]);

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drawingsLocked || tool === "crosshair") return;
    const point = readPoint(event);
    if (!point) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "hline") {
      setAnnotations((items) => [...items, { id: nextIdRef.current++, tool, start: point, end: point }]);
      return;
    }
    setDraft({ tool, start: point, end: point, pointerId: event.pointerId });
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!draft || draft.pointerId !== event.pointerId) return;
    const point = readPoint(event);
    if (point) setDraft((current) => current ? { ...current, end: point } : null);
  };

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!draft || draft.pointerId !== event.pointerId) return;
    const point = readPoint(event) ?? draft.end;
    const startX = chart?.timeScale().timeToCoordinate(draft.start.time);
    const endX = chart?.timeScale().timeToCoordinate(point.time);
    const startY = series?.priceToCoordinate(draft.start.price);
    const endY = series?.priceToCoordinate(point.price);
    const distance = startX !== null && startX !== undefined && endX !== null && endX !== undefined && startY !== null && startY !== undefined && endY !== null && endY !== undefined
      ? Math.hypot(endX - startX, endY - startY)
      : 0;
    if (distance >= 4) {
      setAnnotations((items) => [...items, { id: nextIdRef.current++, tool: draft.tool, start: draft.start, end: point }]);
    }
    setDraft(null);
  };

  const renderedAnnotations = [...annotations, ...(draft ? [{ ...draft, id: -1 }] : [])];
  const toXY = (point: ChartPoint) => {
    if (!chart || !series) return null;
    const x = chart.timeScale().timeToCoordinate(point.time);
    const y = series.priceToCoordinate(point.price);
    return x === null || y === null ? null : { x: Number(x), y: Number(y) };
  };

  return (
    <svg
      ref={svgRef}
      className="chart-drawing-layer"
      aria-hidden="true"
      data-view-revision={viewRevision}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setDraft(null)}
      style={{ pointerEvents: tool !== "crosshair" && !drawingsLocked ? "all" : "none", touchAction: "none" }}
    >
      {drawingsVisible && renderedAnnotations.map((annotation) => {
        const first = toXY(annotation.start);
        const second = toXY(annotation.end);
        if (!first || !second) return null;
        const color = annotation.id === -1 ? "#8fb2ff" : "#4b83ff";
        if (annotation.tool === "hline") {
          const width = chart?.timeScale().width() ?? 0;
          return <line key={annotation.id} x1={0} y1={first.y} x2={width} y2={first.y} stroke={color} strokeWidth="2" strokeDasharray={annotation.id === -1 ? "5 4" : undefined} vectorEffect="non-scaling-stroke" />;
        }
        if (annotation.tool === "trendline") {
          return <line key={annotation.id} x1={first.x} y1={first.y} x2={second.x} y2={second.y} stroke={color} strokeWidth="2" strokeDasharray={annotation.id === -1 ? "5 4" : undefined} vectorEffect="non-scaling-stroke" />;
        }
        if (annotation.tool === "rectangle") {
          const x = Math.min(first.x, second.x);
          const y = Math.min(first.y, second.y);
          return <rect key={annotation.id} x={x} y={y} width={Math.max(1, Math.abs(second.x - first.x))} height={Math.max(1, Math.abs(second.y - first.y))} fill="rgba(75,131,255,0.12)" stroke={color} strokeWidth="2" strokeDasharray={annotation.id === -1 ? "5 4" : undefined} vectorEffect="non-scaling-stroke" />;
        }
        return (
          <g key={annotation.id}>
            {fibonacciLevels.map((level) => {
              const price = annotation.start.price + (annotation.end.price - annotation.start.price) * level;
              const y = series?.priceToCoordinate(price);
              if (y === null || y === undefined) return null;
              const left = Math.min(first.x, second.x);
              const right = Math.max(first.x, second.x);
              return (
                <g key={level}>
                  <line x1={left} y1={Number(y)} x2={right} y2={Number(y)} stroke={color} strokeWidth="1.5" strokeDasharray={annotation.id === -1 ? "5 4" : undefined} vectorEffect="non-scaling-stroke" />
                  <text x={right + 4} y={Number(y) - 3} fill="#b7c9f5" fontSize="10">{(level * 100).toFixed(1)}%</text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
