import { useEffect, useMemo, useRef, useState } from "react";
import {
  type Asset,
  type PortfolioPoint,
  normalizeWeights,
  portfolioReturn,
  portfolioVol,
  weightedAverageVol,
  sharpe,
  randomPortfolios,
  minVariance,
  maxSharpe,
  simulateAssetPaths,
  rebalancedPortfolioPath,
  simulatePortfolioFan,
} from "../lib/portfolio";
import { PRESET_ASSETS, DEFAULT_ASSET_IDS } from "../data/assets";

const RISK_FREE = 0.03;
const STEPS_PER_YEAR = 52;
const CLOUD_SEED = 20260726;
const CLOUD_COUNT = 1600;
const MAX_ASSETS = 5;
const MIN_ASSETS = 2;
const FAN_RUNS = 12;

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

// ---------------------------------------------------------------------------
// Efficient frontier panel (SVG)
// ---------------------------------------------------------------------------

function FrontierChart({
  cloud,
  assets,
  minVar,
  maxShp,
  current,
}: {
  cloud: PortfolioPoint[];
  assets: Asset[];
  minVar: PortfolioPoint;
  maxShp: PortfolioPoint;
  current: { mu: number; vol: number };
}) {
  const width = 520;
  const height = 360;
  const pad = { top: 20, right: 20, bottom: 44, left: 56 };

  const vols = cloud.map((p) => p.vol).concat(assets.map((a) => a.sigma), current.vol);
  const rets = cloud.map((p) => p.mu).concat(assets.map((a) => a.mu), current.mu);
  const maxVol = Math.max(...vols) * 1.08;
  const minRet = Math.min(...rets, 0);
  const maxRet = Math.max(...rets) * 1.05;

  const x = (v: number) => pad.left + (v / maxVol) * (width - pad.left - pad.right);
  const y = (r: number) =>
    height - pad.bottom - ((r - minRet) / (maxRet - minRet)) * (height - pad.top - pad.bottom);

  const bestSharpe = Math.max(...cloud.map((p) => p.sharpe), 0.001);

  const xTicks = 5;
  const yTicks = 5;

  return (
    <svg
      className="pl-frontier"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Efficient frontier: a cloud of possible portfolios plotted by risk and expected return"
    >
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
      {cloud.map((p, i) => (
        <circle
          key={i}
          cx={x(p.vol)}
          cy={y(p.mu)}
          r={2}
          className="pl-cloud-dot"
          style={{ opacity: 0.15 + 0.6 * Math.max(0, p.sharpe / bestSharpe) }}
        />
      ))}

      {/* Individual asset endpoints */}
      {assets.map((a, i) => (
        <g key={a.id}>
          <circle cx={x(a.sigma)} cy={y(a.mu)} r={5} fill={paletteColor(i)} stroke="var(--color-surface)" strokeWidth={1.5} />
        </g>
      ))}

      {/* Special portfolios */}
      <circle cx={x(minVar.vol)} cy={y(minVar.mu)} r={6} className="pl-marker pl-marker--minvar" />
      <circle cx={x(maxShp.vol)} cy={y(maxShp.mu)} r={6} className="pl-marker pl-marker--sharpe" />

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

  const weights = useMemo(() => normalizeWeights(rawWeights), [rawWeights]);

  const paramsKey = useMemo(
    () => assets.map((a) => `${a.id}:${a.mu}:${a.sigma}:${a.marketCorr}`).join("|"),
    [assets]
  );
  const weightsKey = weights.map((w) => w.toFixed(4)).join(",");

  // Asset price paths — independent of weights, so weight tweaks don't reset
  // the animation.
  const assetSim = useMemo(
    () => simulateAssetPaths(assets, years, STEPS_PER_YEAR, seed),
    [paramsKey, years, seed]
  );
  const portfolioPath = useMemo(
    () => rebalancedPortfolioPath(assetSim.assetPaths, weights),
    [assetSim, weightsKey]
  );
  const fanPaths = useMemo(
    () =>
      showFan
        ? simulatePortfolioFan(assets, weights, years, STEPS_PER_YEAR, FAN_RUNS, seed + 101)
        : [],
    [paramsKey, weightsKey, years, seed, showFan]
  );

  // Efficient-frontier cloud (stable seed so it doesn't jitter).
  const cloud = useMemo(
    () => randomPortfolios(assets, CLOUD_COUNT, RISK_FREE, CLOUD_SEED),
    [paramsKey]
  );
  const minVar = useMemo(() => minVariance(cloud), [cloud]);
  const maxShp = useMemo(() => maxSharpe(cloud), [cloud]);

  const curMu = portfolioReturn(weights, assets);
  const curVol = portfolioVol(weights, assets);
  const naiveVol = weightedAverageVol(weights, assets);
  const curSharpe = sharpe(curMu, curVol, RISK_FREE);
  const diversificationSaved = Math.max(0, naiveVol - curVol);

  // --- Canvas: one simulated series, revealed once (no looping) ----------
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const revealedRef = useRef(0);
  const drawRef = useRef<() => void>(() => {});
  const latest = useRef({ assetSim, portfolioPath, fanPaths, assets, years, showFan });
  latest.current = { assetSim, portfolioPath, fanPaths, assets, years, showFan };

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

    // Reveal the new series left-to-right, once. If the tab is hidden (rAF is
    // paused) or the user prefers reduced motion, just show the whole series.
    const steps = latest.current.assetSim.steps;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    if (reduced || document.hidden) {
      revealedRef.current = steps;
      draw();
    } else {
      revealedRef.current = 0;
      const durationMs = 1400;
      let startTs = 0;
      const tick = (ts: number) => {
        if (!startTs) startTs = ts;
        const frac = Math.min(1, (ts - startTs) / durationMs);
        revealedRef.current = Math.round(frac * steps);
        draw();
        if (frac < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
    // Re-run (and re-animate) only when a NEW series is generated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetSim]);

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
                  <span>Return</span>
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
                  <span>Risk</span>
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
                  <span>Mkt corr</span>
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
      </div>

      {/* ---------------- Visuals ---------------- */}
      <div className="pl-visuals">
        <div className="pl-panel">
          <div className="pl-panel-head">
            <h3>Live simulation</h3>
            <div className="pl-panel-tools">
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
            One simulated path over {years} years: each thin line is an asset's
            price, the bold line is your rebalanced portfolio. Notice how the
            portfolio rides steadier than its riskiest holdings — that steadiness
            is diversification. Hit “New draw” for a fresh random scenario.
          </p>
        </div>

        <div className="pl-panel-row">
          <div className="pl-panel">
            <div className="pl-panel-head">
              <h3>Efficient frontier</h3>
            </div>
            <FrontierChart
              cloud={cloud}
              assets={assets}
              minVar={minVar}
              maxShp={maxShp}
              current={{ mu: curMu, vol: curVol }}
            />
            <div className="pl-legend pl-legend--frontier">
              <span className="pl-legend-item"><span className="pl-dot pl-dot--current" /> Your mix</span>
              <span className="pl-legend-item"><span className="pl-dot pl-dot--minvar" /> Min variance</span>
              <span className="pl-legend-item"><span className="pl-dot pl-dot--sharpe" /> Max Sharpe</span>
              <span className="pl-legend-item"><span className="pl-dot pl-dot--asset" /> Single asset</span>
            </div>
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
      </div>

      <p className="pl-disclaimer">
        A simplified single-factor model for learning, not a forecast or advice.
        Correlations are driven by each asset's link to a common market factor.
      </p>
    </div>
  );
}
