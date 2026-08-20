import { useEffect, useRef, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";

/**
 * The bridge between the pure "waves" idea and messy reality: correlation is not
 * a constant. Two assets drawn as sine waves cancel nicely in calm markets, but
 * every so often correlation spikes toward +1 and the waves snap into phase — the
 * portfolio then swings as violently as its parts. Those spikes come in two
 * flavours: a red *crash* (a correlated sell-off — everything falls together) and
 * a green *boom* (a correlated rally). Both erase the cancellation; only one
 * hurts. The lesson: the single ρ in the variance formula is an average that
 * oversells diversification, because the free lunch is smallest exactly in those
 * correlated episodes — brutally so in a crash.
 *
 * Deterministic and exact for the readout: instantaneous correlation is ρ(t)
 * blended from ρ_normal to ρ_spike by a smooth bump, and at each plateau the
 * portfolio amplitude is closed-form √(x₁² + x₂² + 2x₁x₂ρ) with xᵢ = wᵢσᵢ. The
 * directional shock is a visual overlay only; the vertical scale is fit to the
 * true excursion each frame so the plunge never clips.
 */

const DEFAULTS = {
  ampA: 0.16,
  ampB: 0.14,
  weightA: 50, // % in asset A; B gets the rest
  normalCorr: -0.15,
  spikeCorr: 0.9,
};

const THETA_SPAN = 4 * Math.PI; // two cycles across the width
const EPISODE_PERIOD = 4 * Math.PI; // one high-correlation episode in view at a time
const EPISODE_HALFWIDTH = 0.55 * Math.PI; // episodes are a minority of the timeline
// A correlation spike isn't just "correlated" — it has a direction. On top of the
// correlation spike, the whole cluster is pushed together (down in a crash, up in
// a boom) and recovers, so a band reads as a real joint move, not just noise.
const SHOCK = 0.8; // directional shock at a band's center, in units of amplitude

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const pct = (x: number, dp = 1) => `${(x * 100).toFixed(dp)}%`;

type Regime = { r: number; sign: number }; // sign: -1 crash (down), +1 boom (up)

/** Smooth episode intensity r ∈ [0,1] and its direction at a point in world time.
 *  Episodes alternate crash → boom → crash … so both colours scroll through. */
function regimeAt(worldT: number): Regime {
  const k = Math.round(worldT / EPISODE_PERIOD - 0.5);
  const center = (k + 0.5) * EPISODE_PERIOD;
  const d = Math.abs(worldT - center);
  const r = d < EPISODE_HALFWIDTH ? 0.5 * (1 + Math.cos((Math.PI * d) / EPISODE_HALFWIDTH)) : 0;
  const sign = ((k % 2) + 2) % 2 === 0 ? -1 : 1; // even index = crash, odd = boom
  return { r, sign };
}

/** Portfolio wave amplitude for a given correlation, with xᵢ = wᵢσᵢ. */
function portAmp(xA: number, xB: number, corr: number): number {
  return Math.sqrt(Math.max(0, xA * xA + xB * xB + 2 * xA * xB * corr));
}

export default function CrashCorrelationLab() {
  const [ampA, setAmpA] = useState(DEFAULTS.ampA);
  const [ampB, setAmpB] = useState(DEFAULTS.ampB);
  const [weightA, setWeightA] = useState(DEFAULTS.weightA);
  const [normalCorr, setNormalCorr] = useState(DEFAULTS.normalCorr);
  const [spikeCorr, setSpikeCorr] = useState(DEFAULTS.spikeCorr);
  const [mode, setMode] = useState<"continuous" | "single">("continuous");

  const wA = weightA / 100;
  const wB = 1 - wA;
  const xA = wA * ampA;
  const xB = wB * ampB;
  const avgAmp = xA + xB; // if the two risks simply added up

  const calmVol = portAmp(xA, xB, normalCorr);
  const spikeVol = portAmp(xA, xB, spikeCorr);
  const cancelledCalm = avgAmp > 1e-9 ? (avgAmp - calmVol) / avgAmp : 0;
  const cancelledSpike = avgAmp > 1e-9 ? (avgAmp - spikeVol) / avgAmp : 0;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nowRef = useRef<HTMLSpanElement>(null);
  const phaseRef = useRef(0);
  const lastLabel = useRef("");

  const drawKey = JSON.stringify({ ampA, ampB, wA, normalCorr, spikeCorr, mode });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const css = getComputedStyle(document.documentElement);
    const color = (name: string) => css.getPropertyValue(name).trim() || "#888";
    const SANS = '600 12px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

    // instantaneous correlation and phase of asset B (A is the reference, phase 0)
    const corrAt = (t: number) => {
      const { r } = regimeAt(t);
      return normalCorr + (spikeCorr - normalCorr) * r;
    };
    const phaseBAt = (t: number) => Math.acos(clamp(corrAt(t), -1, 1));
    // asset & portfolio values include the directional shock (visual overlay).
    const assetValueA = (t: number) => {
      const { r, sign } = regimeAt(t);
      return ampA * (Math.sin(t) + SHOCK * r * sign);
    };
    const assetValueB = (t: number) => {
      const { r, sign } = regimeAt(t);
      return ampB * (Math.sin(t + phaseBAt(t)) + SHOCK * r * sign);
    };
    const portValue = (t: number) => {
      const { r, sign } = regimeAt(t);
      return wA * ampA * Math.sin(t) + wB * ampB * Math.sin(t + phaseBAt(t)) + SHOCK * r * sign * avgAmp;
    };

    function sizeCanvas() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      canvas!.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas!.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Fit the vertical scale to the biggest excursion (waves + shock) over a full
    // crash+boom cycle, so nothing ever runs off its band regardless of settings.
    function fitScale(): number {
      let maxAbs = 0.02;
      const N = 480;
      for (let i = 0; i < N; i++) {
        const t = (i / N) * (2 * EPISODE_PERIOD);
        maxAbs = Math.max(maxAbs, Math.abs(assetValueA(t)), Math.abs(assetValueB(t)), Math.abs(portValue(t)));
      }
      return maxAbs;
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
      const ampScale = ((bandH / 2) * 0.9) / fitScale();
      const phase0 = phaseRef.current;
      const accent = color("--color-accent");
      const err = color("--color-error");
      const theta = (x: number) => (x / plotW) * THETA_SPAN + phase0;

      // 1) episode bands: red where the market is crashing, green where it's booming.
      const step = 2;
      for (let x = 0; x <= plotW; x += step) {
        const { r, sign } = regimeAt(theta(x));
        if (r <= 0.01) continue;
        ctx!.fillStyle = sign < 0 ? err : accent;
        ctx!.globalAlpha = 0.14 * r;
        ctx!.fillRect(padL + x, 0, step + 1, H);
      }
      ctx!.globalAlpha = 1;

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
      ctx!.fillText("The two assets", padL, 2);
      ctx!.fillText("Your portfolio", padL, bandH + gap + 2);
      ctx!.textAlign = "right";
      ctx!.fillText("time →", W - padR, 2);
      ctx!.textAlign = "left";

      // faint guide: the volatility if risk simply added up (weighted-avg amplitude)
      ctx!.strokeStyle = color("--color-muted");
      ctx!.globalAlpha = 0.4;
      ctx!.setLineDash([4, 4]);
      for (const s of [-1, 1]) {
        ctx!.beginPath();
        ctx!.moveTo(padL, botCenter - s * avgAmp * ampScale);
        ctx!.lineTo(W - padR, botCenter - s * avgAmp * ampScale);
        ctx!.stroke();
      }
      ctx!.setLineDash([]);
      ctx!.globalAlpha = 1;

      // 2) the two asset waves (top). B's phase tracks the live correlation, so the
      //    pair drifts into lockstep and moves together inside an episode.
      const drawAsset = (valueOf: (t: number) => number, col: string) => {
        ctx!.strokeStyle = col;
        ctx!.globalAlpha = 0.9;
        ctx!.lineWidth = 2;
        ctx!.lineJoin = "round";
        ctx!.beginPath();
        for (let x = 0; x <= plotW; x += step) {
          const y = topCenter - valueOf(theta(x)) * ampScale;
          if (x === 0) ctx!.moveTo(padL + x, y);
          else ctx!.lineTo(padL + x, y);
        }
        ctx!.stroke();
      };
      drawAsset(assetValueA, color("--pl-c1"));
      drawAsset(assetValueB, color("--pl-c2"));
      ctx!.globalAlpha = 1;

      // 3) portfolio wave (bottom), recoloured red in a crash / green in a boom.
      ctx!.lineWidth = 3;
      ctx!.lineJoin = "round";
      let penDown = false;
      let prevKind = "";
      for (let x = 0; x <= plotW; x += step) {
        const t = theta(x);
        const { r, sign } = regimeAt(t);
        const y = botCenter - portValue(t) * ampScale;
        const kind = r > 0.45 ? (sign < 0 ? "crash" : "boom") : "calm";
        if (!penDown || kind !== prevKind) {
          if (penDown) ctx!.stroke();
          ctx!.beginPath();
          ctx!.strokeStyle = kind === "crash" ? err : accent;
          ctx!.moveTo(padL + x, y);
          penDown = true;
          prevKind = kind;
        } else {
          ctx!.lineTo(padL + x, y);
        }
      }
      if (penDown) ctx!.stroke();

      // 4) live "right now" label (newest time = right edge).
      const { r: rNow, sign: signNow } = regimeAt(theta(plotW));
      const kind = rNow > 0.45 ? (signNow < 0 ? "crash" : "boom") : "calm";
      if (nowRef.current && kind !== lastLabel.current) {
        lastLabel.current = kind;
        const el = nowRef.current;
        if (kind === "crash") {
          el.textContent = `Crash — correlation ≈ +${spikeCorr.toFixed(2)}, all falling together`;
          el.style.color = err;
        } else if (kind === "boom") {
          el.textContent = `Boom — correlation ≈ +${spikeCorr.toFixed(2)}, all rising together`;
          el.style.color = accent;
        } else {
          el.textContent = `Calm — correlation ≈ ${normalCorr.toFixed(2)}`;
          el.style.color = accent;
        }
      }
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
        phaseRef.current += 1.1 * dt;
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

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton
          onReset={() => {
            setAmpA(DEFAULTS.ampA);
            setAmpB(DEFAULTS.ampB);
            setWeightA(DEFAULTS.weightA);
            setNormalCorr(DEFAULTS.normalCorr);
            setSpikeCorr(DEFAULTS.spikeCorr);
            setMode("continuous");
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

        <label className="wl-slider">
          <span>
            <span className="wl-swatch" style={{ background: "var(--pl-c1)", display: "inline-block" }} /> Stocks — volatility{" "}
            <strong>{pct(ampA, 0)}</strong>
          </span>
          <input type="range" min={0.04} max={0.3} step={0.01} value={ampA} onChange={(e) => setAmpA(Number(e.target.value))} />
        </label>
        <label className="wl-slider">
          <span>
            <span className="wl-swatch" style={{ background: "var(--pl-c2)", display: "inline-block" }} /> Diversifier — volatility{" "}
            <strong>{pct(ampB, 0)}</strong>
          </span>
          <input type="range" min={0.04} max={0.3} step={0.01} value={ampB} onChange={(e) => setAmpB(Number(e.target.value))} />
        </label>
        <label className="wl-slider">
          <span>
            Weight in stocks{" "}
            <InfoTip text="How the portfolio splits between the two assets. Cancellation is strongest when the two weighted amplitudes are similar." />{" "}
            <strong>{weightA}% / {100 - weightA}%</strong>
          </span>
          <input type="range" min={0} max={100} step={1} value={weightA} onChange={(e) => setWeightA(Number(e.target.value))} />
        </label>

        <label className="wl-corr">
          <span className="wl-corr-label">
            Correlation in calm markets
            <InfoTip text="How the two assets move together in normal times, from −1 (opposite) to +1 (lockstep). Low or negative correlation is what lets the waves cancel." />{" "}
            <strong>{normalCorr.toFixed(2)}</strong>
          </span>
          <input type="range" min={-1} max={1} step={0.05} value={normalCorr} onChange={(e) => setNormalCorr(Number(e.target.value))} />
        </label>
        <label className="wl-corr">
          <span className="wl-corr-label">
            Correlation when it spikes
            <InfoTip text="Where the correlation jumps inside a shock — a crash or a boom alike. In real markets, assets that look independent in calm times move together in the extremes; correlations spike toward +1." />{" "}
            <strong>+{spikeCorr.toFixed(2)}</strong>
          </span>
          <input type="range" min={0} max={1} step={0.05} value={spikeCorr} onChange={(e) => setSpikeCorr(Number(e.target.value))} />
        </label>
      </div>

      <div className="wl-stage">
        <canvas ref={canvasRef} className="wl-canvas" />

        <div className="wl-lower">
          <div className="wl-readout">
            <div className="wl-bar">
              <span className="wl-bar-label">If the two risks simply added up</span>
              <div className="wl-bar-track">
                <div className="wl-bar-fill wl-bar-fill--avg" style={{ width: "100%" }} />
              </div>
              <span className="wl-bar-value">{pct(avgAmp)}</span>
            </div>
            <div className="wl-bar">
              <span className="wl-bar-label">Portfolio volatility in calm markets</span>
              <div className="wl-bar-track">
                <div className="wl-bar-fill wl-bar-fill--port" style={{ width: `${avgAmp > 0 ? Math.min(100, (calmVol / avgAmp) * 100) : 0}%` }} />
              </div>
              <span className="wl-bar-value">{pct(calmVol)}</span>
            </div>
            <div className="wl-bar">
              <span className="wl-bar-label">Portfolio volatility when correlations spike</span>
              <div className="wl-bar-track">
                <div className="wl-bar-fill wl-bar-fill--realized" style={{ width: `${avgAmp > 0 ? Math.min(100, (spikeVol / avgAmp) * 100) : 0}%` }} />
              </div>
              <span className="wl-bar-value">{pct(spikeVol)}</span>
            </div>
            <p className="wl-saved">
              In calm markets, diversification cancels <strong>{pct(cancelledCalm, 0)}</strong> of
              the risk. When correlations spike, only <strong>{pct(cancelledSpike, 0)}</strong>{" "}
              cancels — the protection fades exactly when the moves are largest.
            </p>
            <p className="wl-saved" style={{ marginTop: "var(--space-sm)" }}>
              Right now: <strong ref={nowRef} style={{ color: "var(--color-accent)" }}>Calm — correlation ≈ {normalCorr.toFixed(2)}</strong>
            </p>
          </div>

          <div className="wl-readout">
            <p className="wl-note" style={{ fontStyle: "normal" }}>
              <strong>Spikes go both ways.</strong> Correlations jump in the extremes — the green{" "}
              <em>booms</em> where everything rallies together and the red <em>crashes</em> where
              everything falls together. In both, the waves stop cancelling; the single ρ in the
              variance formula is an <em>average</em> that hides it.
            </p>
            <p className="wl-note">
              A rising tide lifting all boats is harmless — pleasant, even. A crash is the same
              statistics turned lethal: the free lunch is smallest in the rare moment it would have
              mattered most. That gap between the tidy average and the tails is why the next view
              drops the clean waves for real, noisy returns.
            </p>
          </div>
        </div>

        <p className="wl-note">
          Still idealized — here the shocks arrive on a neat cadence and alternate crash, boom,
          crash. Real ones don't. Correlation sets each wave's phase; the shaded bands are where it
          spikes.
        </p>
      </div>
    </div>
  );
}
