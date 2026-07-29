import { useEffect, useMemo, useRef, useState } from "react";
import {
  type Asset,
  type PortfolioPoint,
  normalizeWeights,
  correlationMatrix,
  covarianceMatrix,
  cholesky,
  portfolioReturn,
  portfolioVol,
  weightedAverageVol,
  sharpe,
  randomPortfolios,
  minVariance,
  maxSharpe,
  efficientFrontier,
  simulateAssetPaths,
  rebalancedPortfolioPath,
  simulatePortfolioFan,
  simulateOutcomeStats,
  percentile,
} from "../lib/portfolio";
import { PRESET_ASSETS, DEFAULT_ASSET_IDS } from "../data/assets";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";

const STEPS_PER_YEAR = 52;
const CLOUD_SEED = 20260726;
const DIST_SEED = 424242;
const CLOUD_COUNT = 5000;
const MAX_ASSETS = 5;
const MIN_ASSETS = 2;
const FAN_RUNS = 12;
const OUTCOME_RUNS = 400;

const pct = (x: number, dp = 1) => `${(x * 100).toFixed(dp)}%`;

/** A "nice" round tick step (1/2/5 × 10ⁿ) covering `range` in ~`ticks` steps. */
function niceStep(range: number, ticks: number): number {
  const raw = range / Math.max(1, ticks);
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const norm = raw / mag;
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return step * mag;
}

/**
 * Asset color by position in the portfolio, not by asset identity. The palette
 * (defined in tools/portfolio.astro) is contrast-ordered, so a 2-3 asset mix
 * always uses the most distinct, easiest-to-tell-apart colors.
 */
const paletteColor = (i: number) => `var(--pl-c${(i % 8) + 1})`;

let customCounter = 0;

function makeAssetFromPreset(id: string): Asset {
  const p = PRESET_ASSETS.find((a) => a.id === id)!;
  return {
    id: p.id,
    name: p.name,
    mu: p.mu,
    sigma: p.sigma,
    marketCorr: p.marketCorr,
    color: p.color,
  };
}

type Scenario = {
  id: string;
  label: string;
  note: string;
  assetIds: string[];
  weights: number[];
  pairCorr?: number;
};

const SCENARIOS: Scenario[] = [
  {
    id: "perfect-pos",
    label: "ρ = +1",
    note: "Perfectly correlated assets move in lockstep. The frontier collapses to a straight line — mixing them buys you no risk reduction at all. This is the 'no free lunch' case.",
    assetIds: ["us-stocks", "intl-stocks"],
    weights: [50, 50],
    pairCorr: 0.99,
  },
  {
    id: "perfect-neg",
    label: "ρ = −1",
    note: "Perfect negative correlation is the free lunch made literal: the frontier kinks sharply left, and there's a blend that is almost completely risk-free. Real assets never quite reach this.",
    assetIds: ["us-stocks", "treasuries"],
    weights: [50, 50],
    pairCorr: -0.99,
  },
  {
    id: "sixty-forty",
    label: "Classic 60/40",
    note: "The classic balanced portfolio: 60% stocks, 40% bonds. Because their correlation is low, the mix sits well inside the two single-asset points — less risk than stocks alone, most of the return.",
    assetIds: ["us-stocks", "treasuries"],
    weights: [60, 40],
    pairCorr: -0.1,
  },
  {
    id: "diversifier",
    label: "Add a diversifier",
    note: "Gold has a weak link to the stock market, so adding a slice pushes the whole efficient frontier up-and-to-the-left — better return for the same risk — even though gold alone is mediocre.",
    assetIds: ["us-stocks", "treasuries", "gold"],
    weights: [50, 35, 15],
  },
];

// ---------------------------------------------------------------------------
// Efficient frontier panel (SVG)
// ---------------------------------------------------------------------------

function FrontierChart({
  cloud,
  frontier,
  assets,
  minVar,
  tangency,
  current,
  riskFree,
}: {
  cloud: PortfolioPoint[];
  frontier: { vol: number; mu: number }[];
  assets: Asset[];
  minVar: PortfolioPoint;
  tangency: PortfolioPoint;
  current: { mu: number; vol: number };
  riskFree: number;
}) {
  const width = 520;
  const height = 360;
  const pad = { top: 20, right: 20, bottom: 44, left: 56 };
  const clipId = "pl-frontier-clip";

  const vols = cloud.map((p) => p.vol).concat(assets.map((a) => a.sigma), current.vol);
  const rets = cloud.map((p) => p.mu).concat(assets.map((a) => a.mu), current.mu, riskFree);
  const maxVol = Math.max(...vols) * 1.1;
  const minRet = Math.min(...rets, 0);
  const maxRet = Math.max(...rets) * 1.08;

  const x = (v: number) => pad.left + (v / maxVol) * (width - pad.left - pad.right);
  const y = (r: number) =>
    height - pad.bottom - ((r - minRet) / (maxRet - minRet)) * (height - pad.top - pad.bottom);

  const tanSharpe = sharpe(tangency.mu, tangency.vol, riskFree);
  const cmlEndR = riskFree + tanSharpe * maxVol; // Capital Market Line at the right edge

  const frontierPath = frontier.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.vol)},${y(p.mu)}`).join(" ");

  const xTicks = 5;
  const yTicks = 5;

  return (
    <svg
      className="pl-frontier"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Efficient frontier with the capital market line, plotting portfolios by risk and expected return"
    >
      <defs>
        <clipPath id={clipId}>
          <rect
            x={pad.left}
            y={pad.top}
            width={width - pad.left - pad.right}
            height={height - pad.top - pad.bottom}
          />
        </clipPath>
      </defs>

      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const r = minRet + ((maxRet - minRet) / yTicks) * i;
        return (
          <g key={`y${i}`}>
            <line x1={pad.left} x2={width - pad.right} y1={y(r)} y2={y(r)} className="pl-grid" />
            <text x={pad.left - 8} y={y(r) + 4} className="pl-axis" textAnchor="end">
              {pct(r, 0)}
            </text>
          </g>
        );
      })}
      {Array.from({ length: xTicks + 1 }, (_, i) => {
        const v = (maxVol / xTicks) * i;
        return (
          <text key={`x${i}`} x={x(v)} y={height - pad.bottom + 18} className="pl-axis" textAnchor="middle">
            {pct(v, 0)}
          </text>
        );
      })}

      {/* Random portfolios, tinted by Sharpe ratio */}
      {cloud.map((p, i) => {
        const s = sharpe(p.mu, p.vol, riskFree);
        return (
          <circle
            key={i}
            cx={x(p.vol)}
            cy={y(p.mu)}
            r={2}
            className="pl-cloud-dot"
            style={{ opacity: 0.12 + 0.6 * Math.max(0, s / (tanSharpe || 1)) }}
          />
        );
      })}

      <g clipPath={`url(#${clipId})`}>
        {/* Capital Market Line: from the risk-free rate, tangent to the frontier */}
        <line
          x1={x(0)}
          y1={y(riskFree)}
          x2={x(maxVol)}
          y2={y(cmlEndR)}
          className="pl-cml"
        />
        {/* Efficient frontier curve */}
        {frontier.length > 1 && <path d={frontierPath} className="pl-frontier-line" />}
      </g>

      {/* Risk-free point */}
      <circle cx={x(0)} cy={y(riskFree)} r={4} className="pl-marker pl-marker--rf" />
      <text x={x(0) + 8} y={y(riskFree) - 6} className="pl-point-label">rf</text>

      {/* Individual asset endpoints */}
      {assets.map((a, i) => (
        <circle
          key={a.id}
          cx={x(a.sigma)}
          cy={y(a.mu)}
          r={5}
          fill={paletteColor(i)}
          stroke="var(--color-surface)"
          strokeWidth={1.5}
        />
      ))}

      {/* Special portfolios */}
      <circle cx={x(minVar.vol)} cy={y(minVar.mu)} r={6} className="pl-marker pl-marker--minvar" />
      <circle cx={x(tangency.vol)} cy={y(tangency.mu)} r={6} className="pl-marker pl-marker--sharpe" />

      {/* Current portfolio */}
      <circle cx={x(current.vol)} cy={y(current.mu)} r={8} className="pl-marker pl-marker--current" />
      <circle cx={x(current.vol)} cy={y(current.mu)} r={13} className="pl-marker-ring" />

      <text x={width / 2} y={height - 6} className="pl-axis-title" textAnchor="middle">
        Risk — annual volatility →
      </text>
      <text
        x={-height / 2}
        y={16}
        className="pl-axis-title"
        textAnchor="middle"
        transform="rotate(-90)"
      >
        Expected return →
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Outcome distribution panel (SVG histogram of terminal values)
// ---------------------------------------------------------------------------

function OutcomeDistribution({
  outcomes,
  years,
  runs,
}: {
  outcomes: { terminals: number[]; drawdowns: number[]; probLoss: number };
  years: number;
  runs: number;
}) {
  const { terminals, drawdowns, probLoss } = outcomes;
  const start = 100;
  const p5 = percentile(terminals, 0.05);
  const p50 = percentile(terminals, 0.5);
  const p95 = percentile(terminals, 0.95);
  const ddMed = percentile(drawdowns, 0.5);
  const ddBad = percentile(drawdowns, 0.95);

  const width = 720;
  const height = 210;
  const pad = { top: 14, right: 16, bottom: 34, left: 16 };
  const cap = Math.max(percentile(terminals, 0.98), p50 * 1.25, start * 1.5);
  const bins = 30;
  const binW = cap / bins;
  const counts = new Array(bins).fill(0);
  for (const t of terminals) {
    let b = Math.floor(t / binW);
    if (b < 0) b = 0;
    if (b > bins - 1) b = bins - 1;
    counts[b]++;
  }
  const maxCount = Math.max(...counts, 1);

  const x = (v: number) => pad.left + (v / cap) * (width - pad.left - pad.right);
  const barH = (c: number) => (c / maxCount) * (height - pad.top - pad.bottom);
  const baseY = height - pad.bottom;
  const mult = (v: number) => `${(v / start).toFixed(1)}×`;

  return (
    <div className="pl-panel">
      <div className="pl-panel-head">
        <h3>Range of outcomes</h3>
        <span className="pl-panel-sub">{runs.toLocaleString()} simulated {years}-year runs</span>
      </div>

      <svg
        className="pl-hist"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Histogram of simulated ending portfolio values"
      >
        {/* 5th–95th percentile band */}
        <rect
          x={x(p5)}
          y={pad.top}
          width={Math.max(0, x(p95) - x(p5))}
          height={height - pad.top - pad.bottom}
          className="pl-hist-band"
        />
        {/* bars */}
        {counts.map((c, i) => (
          <rect
            key={i}
            x={x(i * binW) + 1}
            y={baseY - barH(c)}
            width={Math.max(1, (width - pad.left - pad.right) / bins - 1.5)}
            height={barH(c)}
            className={i * binW + binW <= start ? "pl-hist-bar pl-hist-bar--loss" : "pl-hist-bar"}
          />
        ))}
        {/* break-even (start) line */}
        <line x1={x(start)} x2={x(start)} y1={pad.top} y2={baseY} className="pl-hist-start" />
        <text x={x(start)} y={pad.top - 2} className="pl-axis" textAnchor="middle">break-even</text>
        {/* median line */}
        <line x1={x(p50)} x2={x(p50)} y1={pad.top} y2={baseY} className="pl-hist-median" />
        {/* x-axis ticks in multiples of start */}
        {Array.from({ length: 6 }, (_, i) => {
          const v = (cap / 5) * i;
          return (
            <text key={i} x={x(v)} y={baseY + 16} className="pl-axis" textAnchor="middle">
              {mult(v)}
            </text>
          );
        })}
        <text x={(pad.left + width - pad.right) / 2} y={height - 4} className="pl-axis-title" textAnchor="middle">
          Ending value (multiple of what you started with)
        </text>
      </svg>

      <dl className="pl-stats pl-stats--4">
        <div><dt>Typical (median)</dt><dd>{mult(p50)}</dd></div>
        <div><dt>Unlucky → lucky (5–95%)</dt><dd>{mult(p5)} – {mult(p95)}</dd></div>
        <div><dt>Chance of a loss</dt><dd>{pct(probLoss, 0)}</dd></div>
        <div><dt>Worst dip (typical / bad run)</dt><dd>−{pct(ddMed, 0)} / −{pct(ddBad, 0)}</dd></div>
      </dl>
      <p className="pl-caption">
        The single path above is just one draw. Across {runs.toLocaleString()} runs,
        outcomes fan out enormously — and even good portfolios suffer deep
        temporary drops along the way. That spread is the risk you're paid for.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PortfolioLab() {
  const [assets, setAssets] = useState<Asset[]>(() =>
    DEFAULT_ASSET_IDS.map(makeAssetFromPreset)
  );
  const [rawWeights, setRawWeights] = useState<number[]>(() =>
    DEFAULT_ASSET_IDS.map(() => 50)
  );
  const [mode, setMode] = useState<"historical" | "custom">("historical");
  const [years, setYears] = useState(20);
  const [seed, setSeed] = useState(1);
  const [showFan, setShowFan] = useState(false);
  const [addValue, setAddValue] = useState("");
  const [riskFree, setRiskFree] = useState(0.03);
  const [pairCorr, setPairCorr] = useState(-0.2);
  const [scenarioNote, setScenarioNote] = useState<string | null>(null);
  const [simMode, setSimMode] = useState<"single" | "live">("single");

  const isPair = assets.length === 2;
  const weights = useMemo(() => normalizeWeights(rawWeights), [rawWeights]);

  const mus = useMemo(() => assets.map((a) => a.mu), [assets]);
  const sigmas = useMemo(() => assets.map((a) => a.sigma), [assets]);

  const paramsKey = useMemo(
    () =>
      assets.map((a) => `${a.id}:${a.mu}:${a.sigma}:${a.marketCorr}`).join("|") +
      (isPair ? `|pc:${pairCorr.toFixed(3)}` : ""),
    [assets, isPair, pairCorr]
  );
  const weightsKey = weights.map((w) => w.toFixed(4)).join(",");

  // Correlation matrix -> covariance + Cholesky factor drive all the math.
  const corr = useMemo(
    () => correlationMatrix(assets, isPair ? pairCorr : null),
    [paramsKey] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const cov = useMemo(() => covarianceMatrix(corr, sigmas), [corr, sigmas]);
  const chol = useMemo(() => cholesky(corr), [corr]);

  // Asset price paths — independent of weights, so weight tweaks don't reset
  // the animation.
  const assetSim = useMemo(
    () => simulateAssetPaths(mus, sigmas, chol, years, STEPS_PER_YEAR, seed),
    [paramsKey, years, seed] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const portfolioPath = useMemo(
    () => rebalancedPortfolioPath(assetSim.assetPaths, weights),
    [assetSim, weightsKey] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const fanPaths = useMemo(
    () =>
      showFan
        ? simulatePortfolioFan(mus, sigmas, chol, weights, years, STEPS_PER_YEAR, FAN_RUNS, seed + 101)
        : [],
    [paramsKey, weightsKey, years, seed, showFan] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Distribution of outcomes across many runs. Uses a fixed seed (independent
  // of the live-sim seed) so the histogram is a stable property of the
  // portfolio and doesn't churn every cycle in Live mode.
  const outcomes = useMemo(
    () => simulateOutcomeStats(mus, sigmas, chol, weights, years, STEPS_PER_YEAR, OUTCOME_RUNS, DIST_SEED),
    [paramsKey, weightsKey, years] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Efficient-frontier cloud (stable seed so it doesn't jitter).
  const cloud = useMemo(
    () => randomPortfolios(mus, cov, CLOUD_COUNT, CLOUD_SEED),
    [paramsKey] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const frontier = useMemo(() => efficientFrontier(cloud), [cloud]);
  const minVar = useMemo(() => minVariance(cloud), [cloud]);
  const tangency = useMemo(() => maxSharpe(cloud, riskFree), [cloud, riskFree]);

  const curMu = portfolioReturn(weights, mus);
  const curVol = portfolioVol(weights, cov);
  const naiveVol = weightedAverageVol(weights, sigmas);
  const curSharpe = sharpe(curMu, curVol, riskFree);
  const diversificationSaved = Math.max(0, naiveVol - curVol);

  // --- Canvas: one simulated series, revealed once (no looping) ----------
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const revealedRef = useRef(0);
  const drawRef = useRef<() => void>(() => {});
  const latest = useRef({ assetSim, portfolioPath, fanPaths, assets, years, showFan, simMode });
  latest.current = { assetSim, portfolioPath, fanPaths, assets, years, showFan, simMode };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const css = getComputedStyle(document.documentElement);
    const color = (name: string) => css.getPropertyValue(name).trim() || "#888";
    // Asset colors are stored as "var(--pl-cN)"; canvas can't parse var(),
    // so resolve the custom property to its literal value.
    const resolveColor = (c: string) => {
      const m = c.match(/var\((--[\w-]+)\)/);
      return m ? css.getPropertyValue(m[1]).trim() || "#888" : c;
    };
    const SANS = '11px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

    function sizeCanvas() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      canvas!.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas!.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      const { assetSim, portfolioPath, fanPaths, years, showFan } = latest.current;
      const rect = canvas!.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;
      const padL = 50;
      const padR = 14;
      const padT = 16;
      const padB = 38;
      const plotW = W - padL - padR;
      const plotH = H - padT - padB;
      ctx!.clearRect(0, 0, W, H);

      const steps = assetSim.steps;
      const revealed = Math.min(revealedRef.current, steps);

      // vertical scale across everything shown
      let maxV = 100;
      let minV = 100;
      const consider = (v: number) => {
        if (v > maxV) maxV = v;
        if (v < minV) minV = v;
      };
      assetSim.assetPaths.forEach((p) => p.forEach(consider));
      portfolioPath.forEach(consider);
      if (showFan) fanPaths.forEach((p) => p.forEach(consider));
      const yMax = maxV * 1.06;
      const yMin = Math.max(0, Math.min(100, minV) * 0.97);

      const xStep = (t: number) => padL + (t / steps) * plotW;
      const xYear = (yr: number) => padL + (yr / years) * plotW;
      const y = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin)) * plotH;

      ctx!.font = SANS;

      // horizontal gridlines + value labels
      const yStep = niceStep(yMax - yMin, 4);
      ctx!.textAlign = "right";
      ctx!.textBaseline = "middle";
      for (let gv = Math.ceil(yMin / yStep) * yStep; gv <= yMax; gv += yStep) {
        ctx!.strokeStyle = color("--color-border");
        ctx!.globalAlpha = 0.7;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(padL, y(gv));
        ctx!.lineTo(W - padR, y(gv));
        ctx!.stroke();
        ctx!.globalAlpha = 1;
        ctx!.fillStyle = color("--color-muted");
        ctx!.fillText(Math.round(gv).toLocaleString(), padL - 8, y(gv));
      }

      // vertical year gridlines + labels
      const yearStep = years <= 6 ? 1 : niceStep(years, 5);
      const ticks: number[] = [];
      for (let yr = 0; yr < years - 1e-9; yr += yearStep) ticks.push(yr);
      ticks.push(years);
      ctx!.textAlign = "center";
      ctx!.textBaseline = "top";
      for (const yr of ticks) {
        const px = xYear(yr);
        ctx!.strokeStyle = color("--color-border");
        ctx!.globalAlpha = 0.4;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(px, padT);
        ctx!.lineTo(px, H - padB);
        ctx!.stroke();
        ctx!.globalAlpha = 1;
        ctx!.fillStyle = color("--color-muted");
        ctx!.fillText(String(Math.round(yr)), px, H - padB + 7);
      }

      // starting-value baseline (dashed)
      ctx!.strokeStyle = color("--color-muted");
      ctx!.globalAlpha = 0.55;
      ctx!.setLineDash([4, 4]);
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(padL, y(100));
      ctx!.lineTo(W - padR, y(100));
      ctx!.stroke();
      ctx!.setLineDash([]);
      ctx!.globalAlpha = 1;

      const drawPath = (path: number[], stroke: string, w: number, alpha: number) => {
        ctx!.strokeStyle = stroke;
        ctx!.globalAlpha = alpha;
        ctx!.lineWidth = w;
        ctx!.lineJoin = "round";
        ctx!.beginPath();
        const end = Math.min(revealed, path.length - 1);
        for (let t = 0; t <= end; t++) {
          const px = xStep(t);
          const py = y(path[t]);
          if (t === 0) ctx!.moveTo(px, py);
          else ctx!.lineTo(px, py);
        }
        ctx!.stroke();
        ctx!.globalAlpha = 1;
      };

      if (showFan) {
        for (const f of fanPaths) drawPath(f, color("--color-accent"), 1, 0.12);
      }
      assetSim.assetPaths.forEach((p, i) => {
        drawPath(p, resolveColor(paletteColor(i)), 1.5, 0.85);
      });
      drawPath(portfolioPath, color("--color-accent"), 3, 1);

      // labels: y meaning (top-left) and x title (bottom center)
      ctx!.fillStyle = color("--color-muted");
      ctx!.font = SANS;
      ctx!.textAlign = "left";
      ctx!.textBaseline = "top";
      ctx!.fillText("Value · start = 100", padL, 1);

      ctx!.fillStyle = color("--color-text-soft");
      ctx!.font = '600 12px ui-sans-serif, system-ui, sans-serif';
      ctx!.textAlign = "center";
      ctx!.textBaseline = "alphabetic";
      ctx!.fillText("Years", padL + plotW / 2, H - 6);
    }

    drawRef.current = draw;
    sizeCanvas();

    const onResize = () => {
      sizeCanvas();
      draw();
    };
    window.addEventListener("resize", onResize);

    // Reveal the series left-to-right. In Single mode it plays once and holds.
    // In Live mode it holds briefly at the end, then draws a fresh series and
    // repeats. If the tab is hidden (rAF is paused) or reduced motion is
    // preferred, just show the whole series statically.
    const steps = latest.current.assetSim.steps;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    if (reduced || document.hidden) {
      revealedRef.current = steps;
      draw();
    } else {
      revealedRef.current = 0;
      const durationMs = 1600;
      const holdMs = 700;
      let startTs = 0;
      let doneTs = 0;
      const tick = (ts: number) => {
        if (!startTs) startTs = ts;
        const frac = Math.min(1, (ts - startTs) / durationMs);
        revealedRef.current = Math.round(frac * steps);
        draw();
        if (frac < 1) {
          raf = requestAnimationFrame(tick);
        } else if (latest.current.simMode === "live") {
          // hold on the completed chart, then start a fresh cycle
          if (!doneTs) doneTs = ts;
          if (ts - doneTs < holdMs) {
            raf = requestAnimationFrame(tick);
          } else {
            revealedRef.current = 0;
            setSeed((s) => s + 1); // new draw -> effect re-runs -> re-reveals
          }
        }
      };
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
    // Re-run (and re-animate) when a new series is generated or the mode flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetSim, simMode]);

  // Redraw at the current reveal point when the mix or overlays change,
  // without restarting the animation.
  useEffect(() => {
    drawRef.current();
  }, [portfolioPath, fanPaths, showFan, assets, years]);

  // --- Handlers ----------------------------------------------------------
  const setWeight = (i: number, v: number) =>
    setRawWeights((prev) => prev.map((w, idx) => (idx === i ? v : w)));

  const updateAsset = (i: number, patch: Partial<Asset>) =>
    setAssets((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));

  const removeAsset = (i: number) => {
    if (assets.length <= MIN_ASSETS) return;
    setAssets((prev) => prev.filter((_, idx) => idx !== i));
    setRawWeights((prev) => prev.filter((_, idx) => idx !== i));
  };

  const addAsset = (value: string) => {
    if (!value || assets.length >= MAX_ASSETS) return;
    if (value === "__custom__") {
      customCounter += 1;
      const colorIdx = assets.length % 8;
      setAssets((prev) => [
        ...prev,
        {
          id: `custom-${customCounter}`,
          name: `Custom ${customCounter}`,
          mu: 0.08,
          sigma: 0.15,
          marketCorr: 0.5,
          color: `var(--pl-c${colorIdx + 1})`,
          custom: true,
        },
      ]);
      setRawWeights((prev) => [...prev, 20]);
      setMode("custom"); // custom assets need editable params
    } else {
      setAssets((prev) => [...prev, makeAssetFromPreset(value)]);
      setRawWeights((prev) => [...prev, 20]);
    }
    setAddValue("");
  };

  const equalWeight = () => setRawWeights(assets.map(() => 100 / assets.length));

  const applyScenario = (s: Scenario) => {
    setAssets(s.assetIds.map(makeAssetFromPreset));
    setRawWeights([...s.weights]);
    if (s.pairCorr != null) setPairCorr(s.pairCorr);
    setMode("historical");
    setScenarioNote(s.note);
    setSeed((x) => x + 1);
  };

  const setModeSafe = (m: "historical" | "custom") => {
    if (m === "historical") {
      // snap preset assets back to their reference figures
      setAssets((prev) =>
        prev.map((a) => {
          const p = PRESET_ASSETS.find((x) => x.id === a.id);
          return p ? { ...a, mu: p.mu, sigma: p.sigma, marketCorr: p.marketCorr } : a;
        })
      );
    }
    setMode(m);
  };

  const locked = mode === "historical";
  const usedIds = new Set(assets.map((a) => a.id));
  const availablePresets = PRESET_ASSETS.filter((p) => !usedIds.has(p.id));

  return (
    <div className="pl">
      {/* ---------------- Controls ---------------- */}
      <div className="pl-controls">
        <ResetButton
          onReset={() => {
            setAssets(DEFAULT_ASSET_IDS.map(makeAssetFromPreset));
            setRawWeights(DEFAULT_ASSET_IDS.map(() => 50));
            setMode("historical"); setYears(20); setSeed(1); setShowFan(false);
            setAddValue(""); setRiskFree(0.03); setPairCorr(-0.2);
            setScenarioNote(null); setSimMode("single");
          }}
        />
        <div className="pl-mode" role="group" aria-label="Parameter source">
          <button
            type="button"
            className={mode === "historical" ? "active" : ""}
            onClick={() => setModeSafe("historical")}
          >
            Historical estimates
          </button>
          <button
            type="button"
            className={mode === "custom" ? "active" : ""}
            onClick={() => setModeSafe("custom")}
          >
            Custom
          </button>
        </div>
        <p className="pl-mode-note">
          {locked
            ? "Illustrative long-run figures (locked). Switch to Custom to edit."
            : "Edit each asset's expected return, volatility, and market correlation."}
        </p>

        <div className="pl-assets">
          {assets.map((a, i) => (
            <div className="pl-asset" key={a.id}>
              <div className="pl-asset-head">
                <span className="pl-swatch" style={{ background: paletteColor(i) }} />
                {a.custom && !locked ? (
                  <input
                    className="pl-name-input"
                    value={a.name}
                    aria-label="Asset name"
                    onChange={(e) => updateAsset(i, { name: e.target.value })}
                  />
                ) : (
                  <span className="pl-asset-name">{a.name}</span>
                )}
                <span className="pl-weight-badge">{pct(weights[i], 0)}</span>
                <button
                  type="button"
                  className="pl-remove"
                  aria-label={`Remove ${a.name}`}
                  disabled={assets.length <= MIN_ASSETS}
                  onClick={() => removeAsset(i)}
                >
                  ×
                </button>
              </div>

              <label className="pl-weight">
                <span className="visually-hidden">{a.name} weight</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={rawWeights[i]}
                  onChange={(e) => setWeight(i, Number(e.target.value))}
                />
              </label>

              <div className="pl-params">
                <label>
                  <span>Return<InfoTip text="The asset's expected annual return — its reward. In Historical mode these are illustrative long-run figures." /></span>
                  <span className="pl-field-row">
                    <input
                      type="number"
                      step={0.5}
                      disabled={locked}
                      value={+(a.mu * 100).toFixed(2)}
                      onChange={(e) => updateAsset(i, { mu: Number(e.target.value) / 100 })}
                    />
                    <em>%</em>
                  </span>
                </label>
                <label>
                  <span>Risk<InfoTip text="The asset's volatility (standard deviation) — how much its return swings year to year." /></span>
                  <span className="pl-field-row">
                    <input
                      type="number"
                      step={0.5}
                      disabled={locked}
                      value={+(a.sigma * 100).toFixed(2)}
                      onChange={(e) => updateAsset(i, { sigma: Number(e.target.value) / 100 })}
                    />
                    <em>%</em>
                  </span>
                </label>
                <label>
                  <span>Mkt corr<InfoTip text="Correlation with the common market factor (−1 to +1). It drives how this asset moves with the others; low or negative values diversify best." /></span>
                  <span className="pl-field-row">
                    <input
                      type="number"
                      step={0.05}
                      min={-1}
                      max={1}
                      disabled={locked}
                      value={+a.marketCorr.toFixed(2)}
                      onChange={(e) =>
                        updateAsset(i, {
                          marketCorr: Math.max(-1, Math.min(1, Number(e.target.value))),
                        })
                      }
                    />
                  </span>
                </label>
              </div>
            </div>
          ))}
        </div>

        {isPair && (
          <label className="pl-corr">
            <span className="pl-corr-label">
              Correlation ({assets[0].name} ↔ {assets[1].name})
              <InfoTip text="How the two assets move together, from −1 to +1. Drag toward −1 and the efficient frontier bows out — the essence of diversification." />{" "}
              <strong>{pairCorr.toFixed(2)}</strong>
            </span>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.05}
              value={pairCorr}
              onChange={(e) => setPairCorr(Number(e.target.value))}
            />
            <span className="pl-corr-hint">
              Drag toward −1 and watch the frontier bow out — that's diversification.
            </span>
          </label>
        )}

        <div className="pl-add-row">
          <select
            className="pl-add"
            value={addValue}
            aria-label="Add an asset"
            disabled={assets.length >= MAX_ASSETS}
            onChange={(e) => addAsset(e.target.value)}
          >
            <option value="">
              {assets.length >= MAX_ASSETS ? "Maximum 5 assets" : "+ Add asset…"}
            </option>
            {availablePresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="__custom__">Custom asset…</option>
          </select>
          <button type="button" className="pl-btn" onClick={equalWeight}>
            Equal weight
          </button>
        </div>

        <label className="pl-horizon">
          <span>Time horizon: <strong>{years} years</strong></span>
          <input
            type="range"
            min={1}
            max={40}
            step={1}
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
          />
        </label>

        <label className="pl-horizon">
          <span>Risk-free rate:<InfoTip text="The return on cash/Treasuries. It anchors the capital market line and determines the tangency (max-Sharpe) portfolio." /> <strong>{pct(riskFree, 1)}</strong></span>
          <input
            type="range"
            min={0}
            max={0.08}
            step={0.0025}
            value={riskFree}
            onChange={(e) => setRiskFree(Number(e.target.value))}
          />
        </label>

        <div className="pl-scenarios">
          <span className="pl-scenarios-title">Guided scenarios</span>
          <div className="pl-scenario-btns">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                className="pl-btn pl-scenario-btn"
                onClick={() => applyScenario(s)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------- Visuals ---------------- */}
      <div className="pl-visuals">
        {scenarioNote && (
          <div className="pl-scenario-note" role="status">
            <p>{scenarioNote}</p>
            <button
              type="button"
              className="pl-scenario-dismiss"
              aria-label="Dismiss scenario note"
              onClick={() => setScenarioNote(null)}
            >
              ×
            </button>
          </div>
        )}
        <div className="pl-panel">
          <div className="pl-panel-head">
            <h3>Simulation</h3>
            <div className="pl-panel-tools">
              <div className="pl-simmode" role="group" aria-label="Simulation mode">
                <button
                  type="button"
                  className={simMode === "single" ? "active" : ""}
                  aria-pressed={simMode === "single"}
                  onClick={() => setSimMode("single")}
                >
                  Single
                </button>
                <button
                  type="button"
                  className={simMode === "live" ? "active" : ""}
                  aria-pressed={simMode === "live"}
                  onClick={() => setSimMode("live")}
                >
                  Live
                </button>
              </div>
              <label className="pl-check">
                <input type="checkbox" checked={showFan} onChange={(e) => setShowFan(e.target.checked)} />
                Show outcome fan
              </label>
              <button type="button" className="pl-btn" onClick={() => setSeed((s) => s + 1)}>
                New draw
              </button>
            </div>
          </div>
          <canvas ref={canvasRef} className="pl-canvas" />
          <div className="pl-legend">
            {assets.map((a, i) => (
              <span className="pl-legend-item" key={a.id}>
                <span className="pl-swatch" style={{ background: paletteColor(i) }} /> {a.name}
              </span>
            ))}
            <span className="pl-legend-item pl-legend-item--port">
              <span className="pl-swatch pl-swatch--port" /> Portfolio
            </span>
          </div>
          <p className="pl-caption">
            A simulated path over {years} years: each thin line is an asset's
            price, the bold line is your rebalanced portfolio. Notice how the
            portfolio rides steadier than its riskiest holdings — that steadiness
            is diversification. <strong>Single</strong> plays one draw and holds;
            <strong> Live</strong> cycles fresh scenarios continuously.
          </p>
        </div>

        <div className="pl-panel-row">
          <div className="pl-panel">
            <div className="pl-panel-head">
              <h3>Efficient frontier</h3>
            </div>
            <FrontierChart
              cloud={cloud}
              frontier={frontier}
              assets={assets}
              minVar={minVar}
              tangency={tangency}
              current={{ mu: curMu, vol: curVol }}
              riskFree={riskFree}
            />
            <div className="pl-legend pl-legend--frontier">
              <span className="pl-legend-item"><span className="pl-dot pl-dot--current" /> Your mix</span>
              <span className="pl-legend-item"><span className="pl-dot pl-dot--minvar" /> Min variance</span>
              <span className="pl-legend-item"><span className="pl-dot pl-dot--sharpe" /> Tangency (max Sharpe)</span>
              <span className="pl-legend-item"><span className="pl-line-key pl-line-key--cml" /> Capital market line</span>
              <span className="pl-legend-item"><span className="pl-line-key pl-line-key--frontier" /> Efficient frontier</span>
              <span className="pl-legend-item"><span className="pl-dot pl-dot--asset" /> Single asset</span>
            </div>
            <p className="pl-caption">
              Each dot is a possible mix. The curve is the efficient frontier —
              the best return for each level of risk. Add cash at the risk-free
              rate and the straight <strong>capital market line</strong> beats
              the curve: every investor should hold the tangency portfolio and
              dial risk with cash. Its slope is the Sharpe ratio.
            </p>
          </div>

          <div className="pl-panel pl-readout">
            <div className="pl-panel-head">
              <h3>This portfolio</h3>
            </div>
            <dl className="pl-stats">
              <div><dt>Expected return</dt><dd>{pct(curMu)}</dd></div>
              <div><dt>Volatility (risk)</dt><dd>{pct(curVol)}</dd></div>
              <div><dt>Sharpe ratio</dt><dd>{curSharpe.toFixed(2)}</dd></div>
            </dl>

            <div className="pl-diversify">
              <p className="pl-diversify-title">Where risk went</p>
              <div className="pl-bar">
                <span className="pl-bar-label">If risks simply added up</span>
                <div className="pl-bar-track">
                  <div className="pl-bar-fill pl-bar-fill--naive" style={{ width: `${Math.min(100, (naiveVol / (naiveVol || 1)) * 100)}%` }} />
                </div>
                <span className="pl-bar-value">{pct(naiveVol)}</span>
              </div>
              <div className="pl-bar">
                <span className="pl-bar-label">Actual portfolio risk</span>
                <div className="pl-bar-track">
                  <div className="pl-bar-fill pl-bar-fill--actual" style={{ width: `${Math.min(100, (curVol / (naiveVol || 1)) * 100)}%` }} />
                </div>
                <span className="pl-bar-value">{pct(curVol)}</span>
              </div>
              <p className="pl-saved">
                Diversification removed <strong>{pct(diversificationSaved)}</strong> of
                risk — for free, without lowering expected return.
              </p>
            </div>
          </div>
        </div>

        <OutcomeDistribution outcomes={outcomes} years={years} runs={OUTCOME_RUNS} />
      </div>

      <p className="pl-disclaimer">
        A simplified model for learning, not a forecast or advice. It assumes
        returns are normally distributed and inputs are stable and known — real
        markets have fatter tails, and these estimates are uncertain. See the
        notes below on what mean-variance theory leaves out.
      </p>
    </div>
  );
}
