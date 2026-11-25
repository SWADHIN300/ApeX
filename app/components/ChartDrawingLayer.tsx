"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent as ReactFormEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { IChartApi, ISeriesApi, SeriesType, Time } from "lightweight-charts";
import type { DrawingTool } from "./ChartPanel";

type DrawKind = Exclude<DrawingTool, "crosshair" | "cursor" | "eraser">;
type ChartPoint = { time: Time; price: number };
type Annotation = {
  id: number;
  tool: DrawKind;
  points: ChartPoint[];
  text?: string;
  emoji?: string;
};
type DraftAnnotation = Omit<Annotation, "id"> & { pointerId: number };
type PendingText = { point: ChartPoint; x: number; y: number; value: string; tool: "text" | "label" | "callout" };

interface Props<TSeries extends SeriesType> {
  chart: IChartApi | null;
  series: ISeriesApi<TSeries> | null;
  tool: DrawingTool;
  drawingsVisible: boolean;
  drawingsLocked: boolean;
  clearKey: number;
  undoKey: number;
  magnetEnabled: boolean;
  emojiChoice: string;
  onDrawingComplete: () => void;
  onToolCancel: () => void;
  timeframe: string;
}

const fibonacciLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const patternPointCounts: Partial<Record<DrawingTool, number>> = {
  xabcd: 5,
  headShoulders: 5,
  trianglePattern: 3,
  elliottWave: 6,
};
const patternLabels: Partial<Record<DrawingTool, string[]>> = {
  xabcd: ["X", "A", "B", "C", "D"],
  headShoulders: ["LS", "N", "H", "N", "RS"],
  trianglePattern: ["A", "B", "C"],
  elliottWave: ["1", "2", "3", "4", "5", "A"],
};

function timeSeconds(time: Time): number {
  if (typeof time === "number") return Number(time);
  if (typeof time === "string") return Math.floor(Date.parse(`${time}T00:00:00Z`) / 1000);
  return Math.floor(Date.UTC(time.year, time.month - 1, time.day) / 1000);
}

function timeframeSeconds(timeframe: string): number {
  const match = timeframe.match(/^(\d+)([mhdw])$/i);
  if (!match) return 60;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const secondsPerUnit: Record<string, number> = { m: 60, h: 3600, d: 86400, w: 604800 };
  return amount * (secondsPerUnit[unit] ?? 60);
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export default function ChartDrawingLayer<TSeries extends SeriesType>({
  chart,
  series,
  tool,
  drawingsVisible,
  drawingsLocked,
  clearKey,
  undoKey,
  magnetEnabled,
  emojiChoice,
  onDrawingComplete,
  onToolCancel,
  timeframe,
}: Props<TSeries>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const nextIdRef = useRef(1);
  const patternClickRef = useRef<ChartPoint | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [draft, setDraft] = useState<DraftAnnotation | null>(null);
  const [patternPoints, setPatternPoints] = useState<ChartPoint[]>([]);
  const [patternPreview, setPatternPreview] = useState<ChartPoint | null>(null);
  const [pendingText, setPendingText] = useState<PendingText | null>(null);
  const [viewRevision, setViewRevision] = useState(0);
  const previousClearKey = useRef(clearKey);
  const previousUndoKey = useRef(undoKey);

  useEffect(() => {
    if (clearKey === previousClearKey.current) return;
    previousClearKey.current = clearKey;
    setAnnotations([]);
    setDraft(null);
    setPatternPoints([]);
    setPendingText(null);
  }, [clearKey]);

  useEffect(() => {
    if (undoKey === previousUndoKey.current) return;
    previousUndoKey.current = undoKey;
    setAnnotations((items) => items.slice(0, -1));
    setDraft(null);
  }, [undoKey]);

  useEffect(() => {
    setDraft(null);
    setPatternPoints([]);
    setPatternPreview(null);
    setPendingText(null);
    patternClickRef.current = null;
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

  const toXY = useCallback((point: ChartPoint) => {
    if (!chart || !series) return null;
    const x = chart.timeScale().timeToCoordinate(point.time);
    const y = series.priceToCoordinate(point.price);
    return x === null || y === null ? null : { x: Number(x), y: Number(y) };
  }, [chart, series]);

  const readPoint = useCallback((event: ReactPointerEvent<SVGSVGElement>): ChartPoint | null => {
    if (!chart || !series || !svgRef.current) return null;
    const bounds = svgRef.current.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const plotWidth = chart.timeScale().width();
    const plotHeight = bounds.height - chart.timeScale().height();
    if (x < 0 || x > plotWidth || y < 0 || y > plotHeight) return null;
    const time = chart.timeScale().coordinateToTime(x);
    const chartPrice = series.coordinateToPrice(y);
    if (time === null || chartPrice === null || !Number.isFinite(chartPrice)) return null;
    let price = Number(chartPrice);

    if (magnetEnabled) {
      const logical = chart.timeScale().coordinateToLogical(x);
      const source = (series as unknown as { data?: () => Array<{ time: Time; open?: number; high?: number; low?: number; close?: number; value?: number }> }).data?.() ?? [];
      const nearestBar = logical === null ? undefined : source[Math.round(Number(logical))];
      const prices = nearestBar ? [nearestBar.open, nearestBar.high, nearestBar.low, nearestBar.close, nearestBar.value].filter((value): value is number => typeof value === "number" && Number.isFinite(value)) : [];
      if (prices.length > 0) price = prices.reduce((nearest, candidate) => Math.abs(candidate - price) < Math.abs(nearest - price) ? candidate : nearest);
    }
    return { time, price: Number(price) };
  }, [chart, magnetEnabled, series]);

  const complete = (annotation: Omit<Annotation, "id">) => {
    setAnnotations((items) => [...items, { ...annotation, id: nextIdRef.current++ }]);
    onDrawingComplete();
  };

  const eraseNearest = (point: ChartPoint) => {
    const cursor = toXY(point);
    if (!cursor) return;
    setAnnotations((items) => {
      let nearestIndex = -1;
      let nearestDistance = 20;
      items.forEach((item, index) => {
        const coords = item.points.map(toXY).filter((value): value is { x: number; y: number } => value !== null);
        for (let i = 0; i < coords.length; i += 1) {
          const d = Math.hypot(coords[i].x - cursor.x, coords[i].y - cursor.y);
          if (d < nearestDistance) { nearestDistance = d; nearestIndex = index; }
          if (i > 0) {
            const lineD = distanceToSegment(cursor.x, cursor.y, coords[i - 1].x, coords[i - 1].y, coords[i].x, coords[i].y);
            if (lineD < nearestDistance) { nearestDistance = lineD; nearestIndex = index; }
          }
        }
      });
      return nearestIndex < 0 ? items : items.filter((_, index) => index !== nearestIndex);
    });
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drawingsLocked || tool === "crosshair" || tool === "cursor") return;
    const point = readPoint(event);
    if (!point) return;

    if (tool === "eraser") { event.preventDefault(); eraseNearest(point); onDrawingComplete(); return; }
    if (tool === "dot") { event.preventDefault(); complete({ tool, points: [point] }); return; }
    if (tool === "emoji" || tool === "icon") { event.preventDefault(); complete({ tool, points: [point], emoji: emojiChoice }); return; }
    if (tool === "text" || tool === "label" || tool === "callout") {
      event.preventDefault();
      setPendingText({ point, x: event.clientX, y: event.clientY, value: "", tool });
      return;
    }
    if (tool === "hline") { event.preventDefault(); complete({ tool, points: [point] }); return; }
    if (patternPointCounts[tool]) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      patternClickRef.current = point;
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraft({ tool: tool as DrawKind, points: [point, point], pointerId: event.pointerId });
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const point = readPoint(event);
    if (!point) return;
    if (patternClickRef.current || patternPoints.length > 0) { setPatternPreview(point); return; }
    if (!draft || draft.pointerId !== event.pointerId) return;
    setDraft((current) => {
      if (!current) return null;
      if (current.tool === "freehand" || current.tool === "brush") {
        const previous = current.points[current.points.length - 1];
        const previousXY = toXY(previous);
        const nextXY = toXY(point);
        if (previousXY && nextXY && Math.hypot(previousXY.x - nextXY.x, previousXY.y - nextXY.y) < 3) return current;
        return { ...current, points: [...current.points, point] };
      }
      return { ...current, points: [current.points[0], point] };
    });
  };

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (patternClickRef.current && patternPointCounts[tool]) {
      const point = readPoint(event) ?? patternClickRef.current;
      patternClickRef.current = null;
      const next = [...patternPoints, point];
      const needed = patternPointCounts[tool] ?? 3;
      if (next.length >= needed) {
        complete({ tool: tool as DrawKind, points: next.slice(0, needed) });
        setPatternPoints([]);
        setPatternPreview(null);
      } else {
        setPatternPoints(next);
      }
      return;
    }
    if (!draft || draft.pointerId !== event.pointerId) return;
    const point = readPoint(event) ?? draft.points[draft.points.length - 1];
    const start = draft.points[0];
    const startXY = toXY(start);
    const endXY = toXY(point);
    const distance = startXY && endXY ? Math.hypot(endXY.x - startXY.x, endXY.y - startXY.y) : 0;
    if (draft.tool === "zoom") {
      const from = timeSeconds(start.time) <= timeSeconds(point.time) ? start.time : point.time;
      const to = timeSeconds(start.time) <= timeSeconds(point.time) ? point.time : start.time;
      if (timeSeconds(to) > timeSeconds(from)) {
        chart?.timeScale().setVisibleRange({ from, to });
        onDrawingComplete();
      }
    } else if (distance >= 4 || draft.tool === "freehand" || draft.tool === "brush") {
      complete({ tool: draft.tool, points: draft.tool === "freehand" || draft.tool === "brush" ? [...draft.points.slice(0, -1), point] : [start, point] });
    }
    setDraft(null);
  };

  const handlePointerCancel = () => {
    setDraft(null);
    patternClickRef.current = null;
    setPatternPreview(null);
  };

  const savePendingText = (event: ReactFormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pendingText || !pendingText.value.trim()) { setPendingText(null); return; }
    complete({ tool: pendingText.tool, points: [pendingText.point], text: pendingText.value.trim() });
    setPendingText(null);
  };

  const drawingActive = tool !== "crosshair" && tool !== "cursor";
  const visibleAnnotations = drawingsVisible ? [...annotations, ...(draft ? [{ ...draft, id: -1 }] : [])] : [];
  const plotWidth = chart?.timeScale().width() ?? 0;

  const renderAnnotation = (annotation: Annotation) => {
    const points = annotation.points.map(toXY);
    if (points.some((point) => point === null)) return null;
    const coords = points as { x: number; y: number }[];
    const preview = annotation.id === -1;
    const stroke = preview ? "#a8c3ff" : "#4b83ff";
    const dash = preview ? "5 4" : undefined;
    const first = coords[0];
    const second = coords[coords.length - 1] ?? first;
    const line = (x1: number, y1: number, x2: number, y2: number, key?: string | number) => <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth="2" strokeDasharray={dash} vectorEffect="non-scaling-stroke" />;

    if (annotation.tool === "dot") return <circle key={annotation.id} cx={first.x} cy={first.y} r="5" fill={stroke} stroke="#e6edff" strokeWidth="1" />;
    if (annotation.tool === "hline") return line(0, first.y, plotWidth, first.y, annotation.id);
    if (annotation.tool === "trendline" || annotation.tool === "arrow") {
      return <g key={annotation.id}>{line(first.x, first.y, second.x, second.y)}{annotation.tool === "arrow" && <path d={`M ${second.x - 9} ${second.y - 5} L ${second.x} ${second.y} L ${second.x - 5} ${second.y + 9}`} fill="none" stroke={stroke} strokeWidth="2" />}</g>;
    }
    if (annotation.tool === "ray") {
      const dx = second.x - first.x;
      if (dx === 0) return line(first.x, first.y, second.x, second.y, annotation.id);
      const m = (second.y - first.y) / dx;
      const endX = plotWidth;
      return line(first.x, first.y, endX, first.y + m * (endX - first.x), annotation.id);
    }
    if (annotation.tool === "triangleShape") {
      const left = Math.min(first.x, second.x);
      const right = Math.max(first.x, second.x);
      const top = Math.min(first.y, second.y);
      const bottom = Math.max(first.y, second.y);
      return <polygon key={annotation.id} points={`${(left + right) / 2},${top} ${right},${bottom} ${left},${bottom}`} fill="rgba(75,131,255,0.10)" stroke={stroke} strokeWidth="2" strokeDasharray={dash} vectorEffect="non-scaling-stroke"/>;
    }
    if (annotation.tool === "rectangle" || annotation.tool === "area" || annotation.tool === "zoom" || annotation.tool === "longPosition" || annotation.tool === "shortPosition") {
      const x = Math.min(first.x, second.x);
      const y = Math.min(first.y, second.y);
      const width = Math.max(1, Math.abs(second.x - first.x));
      const height = Math.max(1, Math.abs(second.y - first.y));
      if (annotation.tool === "longPosition" || annotation.tool === "shortPosition") {
        const entryPrice = annotation.points[0].price;
        const stopPrice = annotation.points[1].price;
        const risk = Math.abs(entryPrice - stopPrice);
        const targetPrice = annotation.tool === "longPosition" ? entryPrice + risk : entryPrice - risk;
        const entryY = series?.priceToCoordinate(entryPrice) ?? first.y;
        const stopY = series?.priceToCoordinate(stopPrice) ?? second.y;
        const targetY = series?.priceToCoordinate(targetPrice) ?? first.y;
        const profitTop = Math.min(entryY, targetY);
        const riskTop = Math.min(entryY, stopY);
        const positive = annotation.tool === "longPosition";
        return <g key={annotation.id}><rect x={x} y={profitTop} width={width} height={Math.max(1, Math.abs(targetY - entryY))} fill="rgba(29,158,117,0.20)" stroke="#1d9e75" strokeWidth="1"/><rect x={x} y={riskTop} width={width} height={Math.max(1, Math.abs(stopY - entryY))} fill="rgba(240,68,94,0.18)" stroke="#f0445e" strokeWidth="1"/>{line(x, entryY, x + width, entryY)}<text x={x + 4} y={positive ? profitTop + 12 : riskTop + 12} fill="#d7e3ff" fontSize="10">{positive ? "LONG PLAN" : "SHORT PLAN"} · 1:1 R/R</text></g>;
      }
      return <rect key={annotation.id} x={x} y={y} width={width} height={height} fill={annotation.tool === "area" ? "rgba(75,131,255,0.20)" : annotation.tool === "zoom" ? "rgba(180,190,210,0.12)" : "rgba(75,131,255,0.10)"} stroke={stroke} strokeWidth="2" strokeDasharray={dash} vectorEffect="non-scaling-stroke" />;
    }
    if (annotation.tool === "ellipse") return <ellipse key={annotation.id} cx={(first.x + second.x) / 2} cy={(first.y + second.y) / 2} rx={Math.max(1, Math.abs(second.x - first.x) / 2)} ry={Math.max(1, Math.abs(second.y - first.y) / 2)} fill="rgba(75,131,255,0.10)" stroke={stroke} strokeWidth="2" />;
    if (annotation.tool === "channel") {
      const dx = second.x - first.x;
      const dy = second.y - first.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      const ox = (-dy / len) * 18;
      const oy = (dx / len) * 18;
      return <g key={annotation.id}>{line(first.x, first.y, second.x, second.y)}{line(first.x + ox, first.y + oy, second.x + ox, second.y + oy)}{line(first.x - ox, first.y - oy, second.x - ox, second.y - oy)}<polygon points={`${first.x + ox},${first.y + oy} ${second.x + ox},${second.y + oy} ${second.x - ox},${second.y - oy} ${first.x - ox},${first.y - oy}`} fill="rgba(75,131,255,0.08)" stroke="none" /></g>;
    }
    if (annotation.tool === "fibonacci") {
      return <g key={annotation.id}>{fibonacciLevels.map((level) => { const price = annotation.points[0].price + (annotation.points[1].price - annotation.points[0].price) * level; const y = series?.priceToCoordinate(price); if (y === null || y === undefined) return null; const left = Math.min(first.x, second.x); const right = Math.max(first.x, second.x); return <g key={level}>{line(left, Number(y), right, Number(y), level)}<text x={right + 4} y={Number(y) - 3} fill="#b7c9f5" fontSize="10">{(level * 100).toFixed(1)}%</text></g>; })}</g>;
    }
    if (annotation.tool === "gannFan") {
      const dx = Math.max(1, second.x - first.x);
      const slope = (second.y - first.y) / dx;
      return <g key={annotation.id}>{[0.25, 0.5, 1, 2, 4].map((ratio) => line(first.x, first.y, plotWidth, first.y + slope * ratio * (plotWidth - first.x), ratio))}</g>;
    }
    if (["xabcd", "headShoulders", "trianglePattern", "elliottWave"].includes(annotation.tool)) {
      const d = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
      const labels = patternLabels[annotation.tool] ?? [];
      return <g key={annotation.id}><path d={d} fill="none" stroke={stroke} strokeWidth="2" strokeDasharray={dash} vectorEffect="non-scaling-stroke"/>{coords.map((point, index) => <g key={index}><circle cx={point.x} cy={point.y} r="3.5" fill={stroke}/><text x={point.x + 5} y={point.y - 5} fill="#d8e2ff" fontSize="10">{labels[index] ?? index + 1}</text></g>)}</g>;
    }
    if (annotation.tool === "freehand" || annotation.tool === "brush") {
      const d = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
      return <path key={annotation.id} d={d} fill="none" stroke={stroke} strokeWidth="2" strokeDasharray={dash} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>;
    }
    if (annotation.tool === "measure") {
      const a = annotation.points[0]; const b = annotation.points[1] ?? a;
      const delta = b.price - a.price;
      const pct = a.price ? (delta / a.price) * 100 : 0;
      const seconds = Math.abs(timeSeconds(b.time) - timeSeconds(a.time));
      const bars = Math.round(seconds / timeframeSeconds(timeframe));
      const timeLabel = seconds >= 3600 ? `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m` : `${Math.max(1, Math.floor(seconds / 60))}m`;
      const label = `${delta >= 0 ? "+" : ""}${delta.toFixed(2)} (${pct.toFixed(2)}%) · ${bars} bars · ${timeLabel}`;
      return <g key={annotation.id}>{line(first.x, first.y, second.x, second.y)}<rect x={(first.x + second.x) / 2 - 90} y={(first.y + second.y) / 2 - 20} width="180" height="20" rx="3" fill="#111827" stroke="#4b83ff"/><text x={(first.x + second.x) / 2 - 84} y={(first.y + second.y) / 2 - 6} fill="#e5ecff" fontSize="10">{label}</text></g>;
    }
    if (["text", "label", "callout"].includes(annotation.tool)) {
      const label = annotation.text ?? "Note";
      const width = Math.max(55, label.length * 7 + 16);
      return <g key={annotation.id}><rect x={first.x} y={first.y - 24} width={width} height="26" rx={annotation.tool === "callout" ? 8 : 2} fill="#10151f" stroke={stroke}/>{annotation.tool === "callout" && <path d={`M ${first.x + 10} ${first.y + 2} l 8 8 l 8 -8`} fill="#10151f" stroke={stroke}/>}<text x={first.x + 8} y={first.y - 7} fill="#e5ecff" fontSize="12">{label}</text></g>;
    }
    if (annotation.tool === "emoji" || annotation.tool === "icon") return <text key={annotation.id} x={first.x - 10} y={first.y + 10} fontSize="22">{annotation.emoji ?? "📍"}</text>;
    return null;
  };

  return (
    <>
      <svg
        ref={svgRef}
        className="chart-drawing-layer"
        aria-hidden="true"
        data-view-revision={viewRevision}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        style={{ pointerEvents: drawingActive && !drawingsLocked ? "all" : "none", touchAction: "none", cursor: tool === "eraser" ? "crosshair" : drawingActive ? "crosshair" : undefined }}
      >
        {visibleAnnotations.map(renderAnnotation)}
        {patternPoints.length > 0 && patternPreview && (() => { const coords = [...patternPoints, patternPreview].map(toXY).filter((point): point is { x: number; y: number } => point !== null); const d = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" "); return <path d={d} fill="none" stroke="#a8c3ff" strokeDasharray="5 4" strokeWidth="2"/>; })()}
      </svg>
      {pendingText && (
        <form className="chart-note-editor absolute z-40 flex gap-1 border border-white/20 bg-[#101218] p-1 shadow-xl" style={{ left: Math.min(pendingText.x - (svgRef.current?.getBoundingClientRect().left ?? 0), Math.max(8, (svgRef.current?.clientWidth ?? 300) - 230)), top: Math.min(pendingText.y - (svgRef.current?.getBoundingClientRect().top ?? 0), Math.max(8, (svgRef.current?.clientHeight ?? 160) - 44)) }} onSubmit={savePendingText}>
          <input autoFocus value={pendingText.value} onChange={(event) => setPendingText((current) => current ? { ...current, value: event.target.value } : null)} aria-label={`${pendingText.tool} text`} placeholder={pendingText.tool === "label" ? "Label" : "Add note"} className="h-8 w-40 bg-[#090b10] px-2 text-xs text-white outline-none" />
          <button type="submit" className="px-2 text-xs text-primary">Add</button>
          <button type="button" aria-label="Cancel note" onClick={() => setPendingText(null)} className="px-1 text-xs text-white/60">×</button>
        </form>
      )}
      {patternPoints.length > 0 && (
        <div className="absolute bottom-2 left-2 z-30 border border-white/15 bg-[#101218]/95 px-2 py-1 text-[10px] text-white/80">
          {patternLabels[tool]?.[patternPoints.length] ?? `${patternPoints.length}`} / {patternPointCounts[tool]} points · click chart, Esc to cancel
          <button type="button" className="ml-2 text-primary" onClick={onToolCancel}>Cancel</button>
        </div>
      )}
    </>
  );
}
