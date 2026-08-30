import { useEffect, useRef } from "react";

/**
 * The stock universe as ~3,000 individual dots on a canvas — one dot per
 * simulated stock (each an inverse-CDF draw from the real CRSP lifetime-return
 * distribution), stacked into a dot-mountain on a log axis. Red dots lost
 * money, grey trailed T-bills, green beat them, and the gold, glowing sliver at
 * the far right are the ≥200× "superstocks" that carry the whole market.
 * Ringed dots are the reader's current hand-picked portfolio (the lottery).
 *
 * Canvas, not SVG: 3,000 circles re-rendered on every reseed would make SVG
 * crawl; one rAF-free canvas pass is instant. Colors are read from the theme
 * tokens at draw time and the canvas redraws on `data-theme` changes.
 */

const LOG_MIN = Math.log10(0.02); // matches the old histogram's visible span
const LOG_MAX = Math.log10(3000);
const COLS = 72; // dot-stack columns across the log axis
const SUPER = 200; // ≥ this lifetime multiple = "superstock" (the histogram's top edge)

type Refs = { m: number; label: string; cssVar: string }[];

export default function SuperstockDots({
  universe,
  picks,
  tbill,
  mean,
}: {
  universe: number[];
  /** Indices into `universe` of the reader's current hand-picked stocks. */
  picks: number[];
  tbill: number;
  mean: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => drawDots(canvas, universe, picks, tbill, mean);
    draw();
    // Redraw when the theme flips (colors are sampled from CSS custom props).
    const mo = new MutationObserver(draw);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, [universe, picks, tbill, mean]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "auto", display: "block", aspectRatio: "720 / 260" }}
      role="img"
      aria-label="Every simulated stock as a dot on a log return axis: most cluster near break-even or below, a glowing few on the far right are the superstocks. Ringed dots are your picks."
    />
  );
}

function cssColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
}

function drawDots(canvas: HTMLCanvasElement, universe: number[], picks: number[], tbill: number, mean: number) {
  const cssW = canvas.clientWidth || 720;
  const cssH = (cssW * 260) / 720;
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  const pad = { top: 18, right: 10, bottom: 32, left: 10 };
  const plotW = cssW - pad.left - pad.right;
  const plotH = cssH - pad.top - pad.bottom;
  const baseY = cssH - pad.bottom;

  const tOf = (m: number) => (Math.log10(Math.min(2999, Math.max(0.02, m))) - LOG_MIN) / (LOG_MAX - LOG_MIN);
  const xOf = (m: number) => pad.left + tOf(m) * plotW;

  // Bucket every stock into a column; remember each stock's slot for the rings.
  const colOf = (m: number) => Math.min(COLS - 1, Math.max(0, Math.floor(tOf(m) * COLS)));
  const counts = new Array(COLS).fill(0);
  const slot = new Array<number>(universe.length);
  const cols = new Array<number>(universe.length);
  for (let i = 0; i < universe.length; i++) {
    const c = colOf(universe[i]);
    cols[i] = c;
    slot[i] = counts[c]++;
  }
  const maxC = Math.max(...counts, 1);

  // Dot geometry: stacks wrap into `lanes` sub-columns so tall stacks stay round
  // dots instead of vanishing slivers.
  const colW = plotW / COLS;
  const lanes = Math.max(1, Math.ceil((maxC * 3.2) / plotH / (colW / 3.2) || 1));
  const rowsPerLane = Math.ceil(maxC / lanes);
  const r = Math.max(1.2, Math.min(colW / (2 * lanes) - 0.3, plotH / (2 * rowsPerLane) - 0.15, 3));

  const cLoss = cssColor("--color-error");
  const cTrail = cssColor("--color-muted");
  const cBeat = cssColor("--color-accent");
  const cGold = "#e3a72f"; // superstock gold — same in both themes, glow carries it
  const cText = cssColor("--color-text");
  const cSoft = cssColor("--color-text-soft");
  const cMutd = cssColor("--color-muted");
  const cWarn = cssColor("--color-warn");

  const dotXY = (i: number): [number, number] => {
    const lane = slot[i] % lanes;
    const row = Math.floor(slot[i] / lanes);
    const cx = pad.left + cols[i] * colW + colW / 2 + (lane - (lanes - 1) / 2) * 2 * r;
    const cy = baseY - r - row * 2 * r;
    return [cx, cy];
  };

  // Pass 1: every stock as a dot.
  for (let i = 0; i < universe.length; i++) {
    const m = universe[i];
    const [cx, cy] = dotXY(i);
    if (m >= SUPER) {
      ctx.shadowColor = cGold;
      ctx.shadowBlur = 7;
      ctx.fillStyle = cGold;
    } else {
      ctx.shadowBlur = 0;
      ctx.fillStyle = m < 1 ? cLoss : m <= tbill ? cTrail : cBeat;
    }
    ctx.globalAlpha = m >= SUPER ? 1 : 0.85;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  // Pass 2: reference lines (break-even, T-bills, market average).
  ctx.font = "600 10px system-ui, sans-serif";
  ctx.textAlign = "center";
  const refs: Refs = [
    { m: 1, label: "break-even", cssVar: cMutd },
    { m: tbill, label: "T-bills", cssVar: cWarn },
    { m: mean, label: "market avg", cssVar: cText },
  ];
  for (const ref of refs) {
    const x = xOf(ref.m);
    ctx.strokeStyle = ref.cssVar;
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, baseY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = ref.cssVar;
    ctx.fillText(ref.label, x, pad.top - 5);
  }

  // Pass 3: the reader's picks, ringed so they pop.
  ctx.strokeStyle = cText;
  ctx.lineWidth = 1.6;
  for (const i of picks) {
    const [cx, cy] = dotXY(i);
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2.2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Axis labels.
  ctx.fillStyle = cMutd;
  ctx.font = "10px system-ui, sans-serif";
  for (const m of [0.1, 1, 10, 100, 1000]) {
    ctx.fillText(m >= 1 ? `${m}×` : `${m}×`, xOf(m), baseY + 14);
  }
  ctx.fillStyle = cSoft;
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.fillText("Lifetime return (log scale) — every dot is a stock; gold dots are the ≥200× superstocks", cssW / 2, cssH - 4);
}
