import { useEffect, useMemo, useRef, useState } from "react";
import { PRESET_ASSETS } from "../data/assets";
import FrontierChart from "./FrontierChart";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import {
  type Asset,
  correlationMatrix,
  covarianceMatrix,
  cholesky,
  portfolioReturn,
  portfolioVol,
  weightedAverageVol,
  randomPortfolios,
  efficientFrontier,
  minVariance,
  simulateOU,
} from "../lib/portfolio";

/**
 * The noisy sequel to the waveforms tool. Each asset is a correlated
 * mean-reverting random series (amplitude ≈ volatility) rather than a clean
 * sine wave. The weighted portfolio still swings less than its parts — but with
 * real randomness the cancellation is never perfect, it varies run to run, and
 * sometimes every asset falls at once.
 */

type WaveAsset = Asset;

const MAX_ASSETS = 5;
const MIN_ASSETS = 2;
const CLOUD_COUNT = 2500;
const CLOUD_SEED = 20260728;
const SERIES_LEN = 1400;
const VISIBLE = 320;
const SCROLL_SPEED = 26; // logical points per second
const DEFAULT_IDS = ["us-stocks", "treasuries"];

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const paletteColor = (i: number) => `var(--pl-c${(i % 8) + 1})`;
const pct = (x: number, dp = 1) => `${(x * 100).toFixed(dp)}%`;

let customCounter = 0;

function makeAsset(id: string): WaveAsset {
  const p = PRESET_ASSETS.find((a) => a.id === id)!;
  return { id: p.id, name: p.name, mu: p.mu, sigma: p.sigma, marketCorr: p.marketCorr, color: p.color };
}

export default function RandomnessLab() {
  const [assets, setAssets] = useState<WaveAsset[]>(() => DEFAULT_IDS.map(makeAsset));
  const [rawWeights, setRawWeights] = useState<number[]>(() => DEFAULT_IDS.map(() => 50));
  const [pairCorr, setPairCorr] = useState(-0.2);
  const [mode, setMode] = useState<"continuous" | "single">("continuous");
  const [seed, setSeed] = useState(1);
  const [addValue, setAddValue] = useState("");

  const isPair = assets.length === 2;
  const weights = useMemo(() => normalize(rawWeights), [rawWeights]);
  const mus = useMemo(() => assets.map((a) => a.mu), [assets]);
  const sigmas = useMemo(() => assets.map((a) => a.sigma), [assets]);
  const corr = useMemo(
    () => correlationMatrix(assets, isPair ? pairCorr : null),
    [assets, isPair, pairCorr]
  );
  const cov = useMemo(() => covarianceMatrix(corr, sigmas), [corr, sigmas]);
  const chol = useMemo(() => cholesky(corr), [corr]);

  const regenKey = JSON.stringify({ sigmas, corr, seed });
  const series = useMemo(
    () => simulateOU(sigmas, chol, SERIES_LEN, seed),
    [regenKey] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const portVol = portfolioVol(weights, cov);
  const avgVol = weightedAverageVol(weights, sigmas);
  const cancelled = avgVol > 1e-9 ? (avgVol - portVol) / avgVol : 0;

  const weightsKey = weights.map((w) => w.toFixed(4)).join(",");
  const { realizedVol, allDownFrac } = useMemo(() => {
    const L = series[0]?.length || 0;
    let sum = 0;
    let sumsq = 0;
    let allDown = 0;
    for (let t = 0; t < L; t++) {
      let p = 0;
      let allNeg = true;
      for (let i = 0; i < assets.length; i++) {
        const v = series[i][t];
        p += weights[i] * v;
        if (v >= 0) allNeg = false;
      }
      sum += p;
      sumsq += p * p;
      if (allNeg) allDown++;
    }
    const mean = L ? sum / L : 0;
    const varr = L ? Math.max(0, sumsq / L - mean * mean) : 0;
    return { realizedVol: Math.sqrt(varr), allDownFrac: L ? allDown / L : 0 };
  }, [series, weightsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Frontier
  const modelKey = JSON.stringify({ mus, cov });
  const cloud = useMemo(
    () => randomPortfolios(mus, cov, CLOUD_COUNT, CLOUD_SEED),
    [modelKey] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const frontier = useMemo(() => efficientFrontier(cloud), [cloud]);
  const minVar = useMemo(() => minVariance(cloud), [cloud]);
  const assetPoints = useMemo(() => sigmas.map((s, i) => ({ vol: s, mu: mus[i] })), [sigmas, mus]);
  const curReturn = portfolioReturn(weights, mus);

  // --- Canvas ------------------------------------------------------------
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offsetRef = useRef(0);
  const drawRef = useRef<() => void>(() => {});
  const latest = useRef({ series, weights, sigmas, assets });
  latest.current = { series, weights, sigmas, assets };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const css = getComputedStyle(document.documentElement);
    const color = (name: string) => css.getPropertyValue(name).trim() || "#888";
    const resolveColor = (c: string) => {
      const m = c.match(/var\((--[\w-]+)\)/);
      return m ? css.getPropertyValue(m[1]).trim() || "#888" : c;
    };
    const SANS = '600 12px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

    function sizeCanvas() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      canvas!.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas!.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      const { series, weights, sigmas, assets } = latest.current;
      const rect = canvas!.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;
      const padL = 12;
      const padR = 12;
      const plotW = W - padL - padR;
      ctx!.clearRect(0, 0, W, H);

      const gap = 18;
      const bandH = (H - gap) / 2;
      const topCenter = bandH / 2;
      const botCenter = bandH + gap + bandH / 2;
      const maxAmp = Math.max(...sigmas, 0.01);
      const ampScale = ((bandH / 2) * 0.92) / (maxAmp * 2.8);
      const off = Math.floor(offsetRef.current);
      const len = series[0]?.length || 1;

      ctx!.strokeStyle = color("--color-border");
      ctx!.lineWidth = 1;
      for (const cy of [topCenter, botCenter]) {
        ctx!.beginPath();
        ctx!.moveTo(padL, cy);
        ctx!.lineTo(W - padR, cy);
        ctx!.stroke();
      }
      ctx!.fillStyle = color("--color-muted");
      ctx!.font = SANS;
      ctx!.textAlign = "left";
      ctx!.textBaseline = "top";
      ctx!.fillText("Each asset (noisy returns)", padL, 2);
      ctx!.fillText("Your portfolio", padL, bandH + gap + 2);
      ctx!.textAlign = "right";
      ctx!.fillText("time →", W - padR, 2);
      ctx!.textAlign = "left";

      const clampY = (yy: number, center: number) =>
        clamp(yy, center - bandH / 2 + 1, center + bandH / 2 - 1);

      // asset series (top band)
      assets.forEach((_, i) => {
        ctx!.strokeStyle = resolveColor(paletteColor(i));
        ctx!.globalAlpha = 0.8;
        ctx!.lineWidth = 1.5;
        ctx!.lineJoin = "round";
        ctx!.beginPath();
        for (let k = 0; k <= VISIBLE; k++) {
          const idx = Math.min(off + k, len - 1);
          const y = clampY(topCenter - series[i][idx] * ampScale, topCenter);
          const px = padL + (k / VISIBLE) * plotW;
          if (k === 0) ctx!.moveTo(px, y);
          else ctx!.lineTo(px, y);
        }
        ctx!.stroke();
      });
      ctx!.globalAlpha = 1;

      // portfolio series (bottom band)
      ctx!.strokeStyle = color("--color-accent");
      ctx!.lineWidth = 3;
      ctx!.lineJoin = "round";
      ctx!.beginPath();
      for (let k = 0; k <= VISIBLE; k++) {
        const idx = Math.min(off + k, len - 1);
        let v = 0;
        for (let i = 0; i < assets.length; i++) v += weights[i] * series[i][idx];
        const y = clampY(botCenter - v * ampScale, botCenter);
        const px = padL + (k / VISIBLE) * plotW;
        if (k === 0) ctx!.moveTo(px, y);
        else ctx!.lineTo(px, y);
      }
      ctx!.stroke();
    }

    drawRef.current = draw;
    sizeCanvas();
    draw();

    const onResize = () => {
      sizeCanvas();
      draw();
    };
    window.addEventListener("resize", onResize);

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    if (mode === "continuous" && !reduced && !document.hidden) {
      let last = 0;
      const tick = (ts: number) => {
        if (!last) last = ts;
        const dt = Math.min(0.05, (ts - last) / 1000);
        last = ts;
        offsetRef.current += SCROLL_SPEED * dt;
        const len = latest.current.series[0]?.length || SERIES_LEN;
        if (offsetRef.current + VISIBLE >= len - 1) {
          offsetRef.current = 0;
          setSeed((s) => s + 1); // fresh random series
        }
        draw();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Redraw on data changes (single mode / param tweaks) without re-animating.
  useEffect(() => {
    drawRef.current();
  }, [regenKey, weightsKey]);

  // --- Handlers ----------------------------------------------------------
  const setWeight = (i: number, v: number) =>
    setRawWeights((prev) => prev.map((w, idx) => (idx === i ? v : w)));
  const updateAsset = (i: number, patch: Partial<WaveAsset>) =>
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
      setAssets((prev) => [
        ...prev,
        {
          id: `custom-${customCounter}`,
          name: `Custom ${customCounter}`,
          mu: 0.08,
          sigma: 0.15,
          marketCorr: 0.3,
          color: paletteColor(prev.length),
          custom: true,
        },
      ]);
    } else {
      setAssets((prev) => [...prev, makeAsset(value)]);
    }
    setRawWeights((prev) => [...prev, 30]);
    setAddValue("");
  };
  const equalWeight = () => setRawWeights(assets.map(() => 100 / assets.length));

  const usedIds = new Set(assets.map((a) => a.id));
  const availablePresets = PRESET_ASSETS.filter((p) => !usedIds.has(p.id));

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton
          onReset={() => {
            setAssets(DEFAULT_IDS.map(makeAsset)); setRawWeights(DEFAULT_IDS.map(() => 50));
            setPairCorr(-0.2); setMode("continuous"); setSeed(1); setAddValue("");
          }}
        />
        <div className="wl-simmode" role="group" aria-label="Simulation mode">
          <button
            type="button"
            className={mode === "continuous" ? "active" : ""}
            aria-pressed={mode === "continuous"}
            onClick={() => setMode("continuous")}
          >
            Continuous
          </button>
          <button
            type="button"
            className={mode === "single" ? "active" : ""}
            aria-pressed={mode === "single"}
            onClick={() => setMode("single")}
          >
            Snapshot
          </button>
          <button type="button" className="wl-btn" onClick={() => setSeed((s) => s + 1)}>
            New draw
          </button>
        </div>

        <div className="wl-assets">
          {assets.map((a, i) => (
            <div className="wl-asset" key={a.id}>
              <div className="wl-asset-head">
                <span className="wl-swatch" style={{ background: paletteColor(i) }} />
                {a.custom ? (
                  <input
                    className="wl-name-input"
                    value={a.name}
                    aria-label="Asset name"
                    onChange={(e) => updateAsset(i, { name: e.target.value })}
                  />
                ) : (
                  <span className="wl-asset-name">{a.name}</span>
                )}
                <span className="wl-weight-badge">{pct(weights[i], 0)}</span>
                <button
                  type="button"
                  className="wl-remove"
                  aria-label={`Remove ${a.name}`}
                  disabled={assets.length <= MIN_ASSETS}
                  onClick={() => removeAsset(i)}
                >
                  ×
                </button>
              </div>

              <label className="wl-slider">
                <span>Weight</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={rawWeights[i]}
                  onChange={(e) => setWeight(i, Number(e.target.value))}
                />
              </label>

              <label className="wl-slider">
                <span>
                  Swing
                  <InfoTip text="The asset's volatility — the typical size of its random ups and downs each period." />{" "}
                  <strong>{pct(a.sigma, 0)}</strong>
                </span>
                <input
                  type="range"
                  min={0.02}
                  max={0.3}
                  step={0.01}
                  value={a.sigma}
                  onChange={(e) => updateAsset(i, { sigma: Number(e.target.value) })}
                />
              </label>

              {!isPair && (
                <label className="wl-slider">
                  <span>
                    Correlation
                    <InfoTip text="How closely this asset's returns track the others, from −1 to +1. Higher correlation means they tend to fall together." />{" "}
                    <strong>{a.marketCorr.toFixed(2)}</strong>
                  </span>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={a.marketCorr}
                    onChange={(e) => updateAsset(i, { marketCorr: Number(e.target.value) })}
                  />
                </label>
              )}
            </div>
          ))}
        </div>

        {isPair && (
          <label className="wl-corr">
            <span className="wl-corr-label">
              Correlation ({assets[0].name} ↔ {assets[1].name})
              <InfoTip text="How the two assets move together (−1 to +1). Even near −1, real randomness leaves a residual wobble — perfect cancellation never happens." />{" "}
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
            <span className="wl-corr-hint">
              Even near −1, real randomness leaves a residual wobble — it never
              fully cancels.
            </span>
          </label>
        )}

        <div className="wl-add-row">
          <select
            className="wl-add"
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
          <button type="button" className="wl-btn" onClick={equalWeight}>
            Equal weight
          </button>
        </div>
      </div>

      <div className="wl-stage">
        <canvas ref={canvasRef} className="wl-canvas" />

        <div className="wl-lower">
          <div className="wl-readout">
            <div className="wl-bar">
              <span className="wl-bar-label">If the swings simply added up</span>
              <div className="wl-bar-track">
                <div className="wl-bar-fill wl-bar-fill--avg" style={{ width: "100%" }} />
              </div>
              <span className="wl-bar-value">{pct(avgVol)}</span>
            </div>
            <div className="wl-bar">
              <span className="wl-bar-label">Portfolio swing — in theory</span>
              <div className="wl-bar-track">
                <div
                  className="wl-bar-fill wl-bar-fill--port"
                  style={{ width: `${avgVol > 0 ? Math.min(100, (portVol / avgVol) * 100) : 0}%` }}
                />
              </div>
              <span className="wl-bar-value">{pct(portVol)}</span>
            </div>
            <div className="wl-bar">
              <span className="wl-bar-label">…in this actual run</span>
              <div className="wl-bar-track">
                <div
                  className="wl-bar-fill wl-bar-fill--realized"
                  style={{ width: `${avgVol > 0 ? Math.min(100, (realizedVol / avgVol) * 100) : 0}%` }}
                />
              </div>
              <span className="wl-bar-value">{pct(realizedVol)}</span>
            </div>
            <p className="wl-saved">
              Diversification should cancel <strong>{pct(cancelled, 0)}</strong> of the
              swing — but this run came out to {pct(realizedVol)}, not the theoretical{" "}
              {pct(portVol)}. Randomness means it's never exact, and every asset fell
              together <strong>{pct(allDownFrac, 0)}</strong> of the time.
            </p>
          </div>

          <div className="wl-frontier">
            <h3>On the efficient frontier</h3>
            <FrontierChart
              cloud={cloud}
              frontier={frontier}
              assetPoints={assetPoints}
              minVar={minVar}
              current={{ vol: portVol, mu: curReturn }}
              ariaLabel="Efficient frontier showing where this portfolio's risk sits"
            />
            <div className="wl-flegend">
              <span><span className="wl-fdot wl-fdot--cur" /> Your mix</span>
              <span><span className="wl-fdot wl-fdot--mv" /> Min variance</span>
              <span><span className="wl-fdot wl-fdot--as" /> Single asset</span>
            </div>
            <p className="wl-fnote">
              The marker uses the theoretical volatility; the run-to-run wobble on
              the left is why real results scatter around it. (Return uses each
              asset's typical figure.)
            </p>
          </div>
        </div>

        <p className="wl-note">
          A simple Monte Carlo of correlated, mean-reverting returns — no fat tails
          or real history yet. Hit “New draw” a few times: the cancellation, and
          how often assets sink together, shifts every run.
        </p>
      </div>
    </div>
  );
}

function normalize(raw: number[]): number[] {
  const total = raw.reduce((s, w) => s + Math.max(0, w), 0);
  if (total <= 0) return raw.map(() => 1 / raw.length);
  return raw.map((w) => Math.max(0, w) / total);
}
