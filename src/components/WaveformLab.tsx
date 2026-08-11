import { useEffect, useMemo, useRef, useState } from "react";
import { PRESET_ASSETS } from "../data/assets";
import FrontierChart from "./FrontierChart";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import {
  covarianceMatrix,
  randomPortfolios,
  efficientFrontier,
  minVariance,
  portfolioReturn,
} from "../lib/portfolio";

/**
 * Deterministic "diversification as wave interference" illustration.
 *
 * Each asset is a clean sine wave: amplitude = its volatility, and its phase
 * comes from correlation (in-phase = +1, quarter-turn = 0, opposite = -1). The
 * weighted portfolio is the sum of those waves, drawn below. When the waves are
 * out of phase they partly cancel, so the portfolio is less volatile than its parts.
 *
 * This is exact, not hand-wavy: the portfolio wave's amplitude equals the
 * portfolio volatility sqrt(wᵀΣw) under corr(i,j) = cos(phase_i − phase_j).
 */

type WaveAsset = {
  id: string;
  name: string;
  amp: number; // volatility, e.g. 0.16
  corr: number; // correlation with the common factor, in [-1, 1]
  ret: number; // expected return (used only for the frontier's y-axis)
  custom?: boolean;
};

const MAX_ASSETS = 5;
const MIN_ASSETS = 2;
const CLOUD_COUNT = 2500;
const CLOUD_SEED = 20260727;
const DEFAULT_IDS = ["us-stocks", "treasuries"];
const THETA_SPAN = 4 * Math.PI; // two full cycles across the width
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const paletteColor = (i: number) => `var(--pl-c${(i % 8) + 1})`;
const pct = (x: number, dp = 1) => `${(x * 100).toFixed(dp)}%`;

let customCounter = 0;

function makeWaveAsset(id: string): WaveAsset {
  const p = PRESET_ASSETS.find((a) => a.id === id)!;
  return { id: p.id, name: p.name, amp: p.sigma, corr: p.marketCorr, ret: p.mu };
}

function normalize(raw: number[]): number[] {
  const total = raw.reduce((s, w) => s + Math.max(0, w), 0);
  if (total <= 0) return raw.map(() => 1 / raw.length);
  return raw.map((w) => Math.max(0, w) / total);
}

export default function WaveformLab() {
  const [assets, setAssets] = useState<WaveAsset[]>(() => DEFAULT_IDS.map(makeWaveAsset));
  const [rawWeights, setRawWeights] = useState<number[]>(() => DEFAULT_IDS.map(() => 50));
  const [pairCorr, setPairCorr] = useState(-0.2);
  const [mode, setMode] = useState<"continuous" | "single">("continuous");
  const [addValue, setAddValue] = useState("");

  const isPair = assets.length === 2;
  const weights = useMemo(() => normalize(rawWeights), [rawWeights]);

  // Phase per asset: correlation -> angle. +1 in-phase (0), 0 = 90°, -1 = 180°.
  const phases = useMemo(() => {
    if (isPair) return [0, Math.acos(clamp(pairCorr, -1, 1))];
    return assets.map((a) => Math.acos(clamp(a.corr, -1, 1)));
  }, [assets, isPair, pairCorr]);

  const amps = useMemo(() => assets.map((a) => a.amp), [assets]);

  // Portfolio wave amplitude = |Σ w_i A_i e^{iφ_i}| = portfolio volatility.
  const { portAmp, avgAmp } = useMemo(() => {
    let re = 0;
    let im = 0;
    let avg = 0;
    for (let i = 0; i < assets.length; i++) {
      const c = weights[i] * amps[i];
      re += c * Math.cos(phases[i]);
      im += c * Math.sin(phases[i]);
      avg += c;
    }
    return { portAmp: Math.sqrt(re * re + im * im), avgAmp: avg };
  }, [assets, weights, amps, phases]);

  const cancelled = avgAmp > 1e-9 ? (avgAmp - portAmp) / avgAmp : 0;

  // Efficient frontier, using the same correlation model that drives the waves:
  // corr(i, j) = cos(phase_i - phase_j). The y-axis uses each asset's expected
  // return; the current mix's volatility is exactly the portfolio wave's amplitude.
  const mus = useMemo(() => assets.map((a) => a.ret), [assets]);
  const cov = useMemo(() => {
    const n = assets.length;
    const C = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => Math.cos(phases[i] - phases[j]))
    );
    return covarianceMatrix(C, amps);
  }, [assets.length, phases, amps]);
  const modelKey = JSON.stringify({ mus, cov });
  const cloud = useMemo(
    () => randomPortfolios(mus, cov, CLOUD_COUNT, CLOUD_SEED),
    [modelKey] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const frontier = useMemo(() => efficientFrontier(cloud), [cloud]);
  const minVar = useMemo(() => minVariance(cloud), [cloud]);
  const assetPoints = useMemo(() => amps.map((a, i) => ({ vol: a, mu: mus[i] })), [amps, mus]);
  const curReturn = portfolioReturn(weights, mus);

  // --- Canvas ------------------------------------------------------------
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(0);

  const drawKey = JSON.stringify({
    ids: assets.map((a) => a.id),
    amps,
    phases,
    w: weights,
    mode,
  });

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
      const rect = canvas!.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;
      const padL = 40;
      const padR = 12;
      const plotW = W - padL - padR;
      ctx!.clearRect(0, 0, W, H);

      const gap = 18;
      const bandH = (H - gap) / 2;
      const topCenter = bandH / 2;
      const botCenter = bandH + gap + bandH / 2;
      const maxAmp = Math.max(...amps, 0.01);
      const ampScale = (bandH / 2) * 0.88 / (maxAmp * 1.05);
      const phase0 = phaseRef.current;

      // band centerlines + labels
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
      ctx!.fillText("Each asset's volatility", padL, 2);
      ctx!.fillText("Your portfolio", padL, bandH + gap + 2);
      ctx!.textAlign = "right";
      ctx!.fillText("time →", W - padR, 2);
      ctx!.textAlign = "left";

      // Return (%) scale on each band, so the wave amplitude reads as a number.
      // A wave's peak height IS that asset's volatility, e.g. a peak at 16%.
      const maxPlotVal = maxAmp * 1.05;
      const tick = maxPlotVal >= 0.22 ? 0.1 : 0.05;
      ctx!.font = '500 10px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx!.textBaseline = "middle";
      ctx!.textAlign = "right";
      for (const cy of [topCenter, botCenter]) {
        ctx!.fillStyle = color("--color-muted");
        ctx!.fillText("0%", padL - 6, cy);
        for (let k = 1; k * tick <= maxPlotVal + 1e-9; k++) {
          const off = k * tick * ampScale;
          for (const s of [-1, 1]) {
            const gy = cy - s * off;
            ctx!.strokeStyle = color("--color-border");
            ctx!.globalAlpha = 0.45;
            ctx!.setLineDash([2, 3]);
            ctx!.beginPath();
            ctx!.moveTo(padL, gy);
            ctx!.lineTo(W - padR, gy);
            ctx!.stroke();
            ctx!.setLineDash([]);
            ctx!.globalAlpha = 1;
            ctx!.fillStyle = color("--color-muted");
            ctx!.fillText(`${s > 0 ? "+" : "−"}${Math.round(k * tick * 100)}%`, padL - 6, gy);
          }
        }
      }
      ctx!.font = SANS;
      ctx!.textBaseline = "top";
      ctx!.textAlign = "left";

      const theta = (x: number) => (x / plotW) * THETA_SPAN + phase0;
      const step = 2;

      // asset waves (top band)
      assets.forEach((_, i) => {
        ctx!.strokeStyle = resolveColor(paletteColor(i));
        ctx!.globalAlpha = 0.85;
        ctx!.lineWidth = 2;
        ctx!.lineJoin = "round";
        ctx!.beginPath();
        for (let x = 0; x <= plotW; x += step) {
          const y = topCenter - amps[i] * Math.sin(theta(x) + phases[i]) * ampScale;
          if (x === 0) ctx!.moveTo(padL + x, y);
          else ctx!.lineTo(padL + x, y);
        }
        ctx!.stroke();
      });
      ctx!.globalAlpha = 1;

      // portfolio wave (bottom band)
      ctx!.strokeStyle = color("--color-accent");
      ctx!.lineWidth = 3;
      ctx!.lineJoin = "round";
      ctx!.beginPath();
      for (let x = 0; x <= plotW; x += step) {
        let v = 0;
        for (let i = 0; i < assets.length; i++) {
          v += weights[i] * amps[i] * Math.sin(theta(x) + phases[i]);
        }
        const y = botCenter - v * ampScale;
        if (x === 0) ctx!.moveTo(padL + x, y);
        else ctx!.lineTo(padL + x, y);
      }
      ctx!.stroke();

      // faint guide showing the max possible volatility (weighted-average amplitude)
      ctx!.strokeStyle = color("--color-muted");
      ctx!.globalAlpha = 0.4;
      ctx!.setLineDash([4, 4]);
      ctx!.lineWidth = 1;
      for (const s of [-1, 1]) {
        ctx!.beginPath();
        ctx!.moveTo(padL, botCenter - s * avgAmp * ampScale);
        ctx!.lineTo(W - padR, botCenter - s * avgAmp * ampScale);
        ctx!.stroke();
      }
      ctx!.setLineDash([]);
      ctx!.globalAlpha = 1;
    }

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
        phaseRef.current += 1.1 * dt; // scroll speed (rad/s)
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
  }, [drawKey]);

  // --- Handlers ----------------------------------------------------------
  // Dragging one weight sets it to that share and rescales the others to keep the
  // total at 100%, so every slider (not just the number) moves in response.
  const setWeight = (i: number, target: number) =>
    setRawWeights((prev) => {
      const w = normalize(prev); // current shares, sum 1
      const t = Math.min(1, Math.max(0, target / 100));
      const otherSum = w.reduce((s, x, idx) => (idx === i ? s : s + x), 0);
      const next = w.map((x, idx) => {
        if (idx === i) return t;
        if (otherSum <= 1e-9) return (1 - t) / (w.length - 1); // others were all zero
        return x * ((1 - t) / otherSum);
      });
      return next.map((x) => x * 100); // store 0–100 summing to 100
    });
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
        { id: `custom-${customCounter}`, name: `Custom ${customCounter}`, amp: 0.15, corr: 0.3, ret: 0.08, custom: true },
      ]);
    } else {
      setAssets((prev) => [...prev, makeWaveAsset(value)]);
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
            setAssets(DEFAULT_IDS.map(makeWaveAsset)); setRawWeights(DEFAULT_IDS.map(() => 50));
            setPairCorr(-0.2); setMode("continuous"); setAddValue("");
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
                  value={Math.round(weights[i] * 100)}
                  onChange={(e) => setWeight(i, Number(e.target.value))}
                />
              </label>

              <label className="wl-slider">
                <span>
                  Volatility
                  <InfoTip text="The asset's volatility (standard deviation of its return): how big its ups and downs are. Here it sets the height (amplitude) of the wave." />{" "}
                  <strong>{pct(a.amp, 0)}</strong>
                </span>
                <input
                  type="range"
                  min={0.02}
                  max={0.3}
                  step={0.01}
                  value={a.amp}
                  onChange={(e) => updateAsset(i, { amp: Number(e.target.value) })}
                />
              </label>

              {!isPair && (
                <label className="wl-slider">
                  <span>
                    Market correlation
                    <InfoTip text="How closely this asset moves with the common market wave (−1 to +1). It sets the wave's phase; each pair of assets is then correlated by the gap between their phases, so two assets that both only loosely track the market can still move together." />{" "}
                    <strong>{a.corr.toFixed(2)}</strong>
                  </span>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={a.corr}
                    onChange={(e) => updateAsset(i, { corr: Number(e.target.value) })}
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
              <InfoTip text="How the two assets move together, from −1 (opposite) to +1 (in lockstep). Lower correlation means the waves cancel more: more diversification." />{" "}
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
              +1: waves line up (no cancellation). −1: opposite waves cancel as much as possible — completely only when the two weighted amplitudes match.
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
              <span className="wl-bar-label">If the volatilities simply added up</span>
              <div className="wl-bar-track">
                <div className="wl-bar-fill wl-bar-fill--avg" style={{ width: "100%" }} />
              </div>
              <span className="wl-bar-value">{pct(avgAmp)}</span>
            </div>
            <div className="wl-bar">
              <span className="wl-bar-label">Actual portfolio volatility</span>
              <div className="wl-bar-track">
                <div
                  className="wl-bar-fill wl-bar-fill--port"
                  style={{ width: `${avgAmp > 0 ? Math.min(100, (portAmp / avgAmp) * 100) : 0}%` }}
                />
              </div>
              <span className="wl-bar-value">{pct(portAmp)}</span>
            </div>
            <p className="wl-saved">
              Out-of-phase waves cancel <strong>{pct(cancelled, 0)}</strong> of the
              volatility. That shrinkage is diversification: exactly the portfolio's
              volatility falling below the average of its parts.
            </p>
          </div>

          <div className="wl-frontier">
            <h3>On the efficient frontier</h3>
            <FrontierChart
              cloud={cloud}
              frontier={frontier}
              assetPoints={assetPoints}
              minVar={minVar}
              current={{ vol: portAmp, mu: curReturn }}
              ariaLabel="Efficient frontier showing where this portfolio's risk sits"
            />
            <div className="wl-flegend">
              <span><span className="wl-fdot wl-fdot--cur" /> Your mix</span>
              <span><span className="wl-fdot wl-fdot--mv" /> Min variance</span>
              <span><span className="wl-fdot wl-fdot--as" /> Single asset</span>
            </div>
            <p className="wl-fnote">
              Your portfolio's volatility above is its <em>risk</em> here: its spot on
              the horizontal axis. As you lower correlation, the frontier bows out
              and your mix slides left. (Return uses each asset's typical figure.)
            </p>
          </div>
        </div>

        <p className="wl-note">
          An idealized model: perfectly smooth, repeating waves. Real returns are
          noisy and never cancel this cleanly. That's
          <a href="/tools/randomness"> Part 2</a>. Correlation sets each wave's
          phase; amplitude is its volatility.
        </p>
      </div>
    </div>
  );
}
