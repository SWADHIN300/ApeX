"use client";

/* ── Static candle data — 22 candles trending upward ── */
const CANDLES = [
  { o: 64900, h: 64980, l: 64820, c: 64850 },
  { o: 64850, h: 64920, l: 64760, c: 64910 },
  { o: 64910, h: 64950, l: 64840, c: 64860 },
  { o: 64860, h: 64970, l: 64810, c: 64940 },
  { o: 64940, h: 65050, l: 64900, c: 65020 },
  { o: 65020, h: 65080, l: 64930, c: 64950 },
  { o: 64950, h: 65040, l: 64880, c: 65010 },
  { o: 65010, h: 65110, l: 64960, c: 65080 },
  { o: 65080, h: 65140, l: 64990, c: 65010 },
  { o: 65010, h: 65130, l: 64970, c: 65100 },
  { o: 65100, h: 65200, l: 65060, c: 65180 },
  { o: 65180, h: 65250, l: 65100, c: 65130 },
  { o: 65130, h: 65220, l: 65080, c: 65200 },
  { o: 65200, h: 65280, l: 65140, c: 65160 },
  { o: 65160, h: 65310, l: 65120, c: 65280 },
  { o: 65280, h: 65360, l: 65240, c: 65320 },
  { o: 65320, h: 65400, l: 65260, c: 65270 },
  { o: 65270, h: 65380, l: 65220, c: 65360 },
  { o: 65360, h: 65440, l: 65300, c: 65310 },
  { o: 65310, h: 65420, l: 65270, c: 65400 },
  { o: 65400, h: 65500, l: 65360, c: 65480 },
  { o: 65480, h: 65540, l: 65390, c: 65432 },
];

const MARK_PRICE = 65432.1;
const VIEW_W = 900;
const VIEW_H = 320;
const M = { top: 15, right: 58, bottom: 15, left: 10 };
const CW = VIEW_W - M.left - M.right;
const CH = VIEW_H - M.top - M.bottom;

const allHL = CANDLES.flatMap((c) => [c.h, c.l]);
const PMIN = Math.min(...allHL) - 60;
const PMAX = Math.max(...allHL) + 60;
const PRANGE = PMAX - PMIN;

const y = (price: number) => M.top + ((PMAX - price) / PRANGE) * CH;
const stride = CW / CANDLES.length;
const bodyW = stride * 0.6;
const xc = (i: number) => M.left + i * stride + stride / 2;

/* Grid levels every $200 */
const gridLevels: number[] = [];
for (let p = Math.ceil(PMIN / 200) * 200; p <= PMAX; p += 200) {
  gridLevels.push(p);
}

/* Area fill path under closing prices */
const areaPath = [
  `M ${xc(0)} ${y(CANDLES[0].c)}`,
  ...CANDLES.map((c, i) => `L ${xc(i)} ${y(c.c)}`),
  `L ${xc(CANDLES.length - 1)} ${M.top + CH}`,
  `L ${xc(0)} ${M.top + CH}`,
  "Z",
].join(" ");

/* Close line path */
const linePath = CANDLES.map(
  (c, i) => `${i === 0 ? "M" : "L"} ${xc(i)} ${y(c.c)}`
).join(" ");

export default function CandlestickChart() {
  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      className="w-full h-full block"
    >
      {/* Grid lines */}
      {gridLevels.map((p) => (
        <g key={p}>
          <line
            x1={M.left}
            y1={y(p)}
            x2={VIEW_W - M.right}
            y2={y(p)}
            style={{ stroke: "var(--border)", strokeWidth: 0.5 }}
          />
          <text
            x={VIEW_W - 4}
            y={y(p)}
            textAnchor="end"
            dominantBaseline="middle"
            style={{
              fill: "var(--text-dim)",
              fontSize: "9px",
              fontFamily: "JetBrains Mono",
            }}
          >
            {p.toLocaleString("en-US")}
          </text>
        </g>
      ))}

      {/* Area fill under close line */}
      <path d={areaPath} style={{ fill: "var(--long)", fillOpacity: 0.08 }} />

      {/* Close line */}
      <path
        d={linePath}
        style={{
          stroke: "var(--long)",
          strokeWidth: 1,
          strokeOpacity: 0.35,
          fill: "none",
        }}
      />

      {/* Candlesticks */}
      {CANDLES.map((c, i) => {
        const isUp = c.c >= c.o;
        const color = isUp ? "var(--long)" : "var(--short)";
        const top = Math.min(y(c.o), y(c.c));
        const h = Math.max(Math.abs(y(c.o) - y(c.c)), 1);

        return (
          <g key={i}>
            {/* Wick */}
            <line
              x1={xc(i)}
              y1={y(c.h)}
              x2={xc(i)}
              y2={y(c.l)}
              style={{ stroke: color, strokeWidth: 1 }}
            />
            {/* Body */}
            <rect
              x={xc(i) - bodyW / 2}
              y={top}
              width={bodyW}
              height={h}
              style={{ fill: color }}
            />
          </g>
        );
      })}

      {/* Mark price dashed line */}
      <line
        x1={M.left}
        y1={y(MARK_PRICE)}
        x2={VIEW_W - M.right}
        y2={y(MARK_PRICE)}
        style={{
          stroke: "var(--primary-container)",
          strokeWidth: 1,
          strokeDasharray: "8 4",
        }}
      />
      {/* Mark price badge */}
      <rect
        x={VIEW_W - M.right}
        y={y(MARK_PRICE) - 8}
        width={M.right - 2}
        height={16}
        style={{ fill: "var(--primary-container)" }}
      />
      <text
        x={VIEW_W - M.right + (M.right - 2) / 2}
        y={y(MARK_PRICE)}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          fill: "#ffffff",
          fontSize: "9px",
          fontFamily: "JetBrains Mono",
          fontWeight: 500,
        }}
      >
        {MARK_PRICE.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </text>
    </svg>
  );
}
