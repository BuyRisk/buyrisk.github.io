import { useEffect, useRef, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";

/**
 * The bridge between the pure "waves" idea and messy reality: correlation is not
 * a constant. Two assets drawn as sine waves cancel nicely in calm markets, but
 * inside a scrolling "crash" band their correlation spikes toward +1 — the waves
 * snap into phase and the portfolio swings as violently as its parts. The one
 * lesson: diversification fades exactly when you need it most.
 *
 * Deterministic and exact. Instantaneous correlation is ρ(t) = ρ_normal blended
 * to ρ_crash by a smooth regime bump r(t); at each plateau the portfolio wave's
 * amplitude is exactly √(x₁² + x₂² + 2x₁x₂ρ) with xᵢ = wᵢσᵢ, so the calm/crash
 * volatility readouts below are closed-form, not sampled.
 */

const DEFAULTS = {
  ampA: 0.16,
  ampB: 0.14,
  weightA: 50, // % in asset A; B gets the rest
  normalCorr: -0.15,
  crashCorr: 0.9,
};

const THETA_SPAN = 4 * Math.PI; // two cycles across the width
const CRASH_PERIOD = 4 * Math.PI; // one crash sweeps through the view at a time
const CRASH_HALFWIDTH = 0.55 * Math.PI; // crashes are a minority of the timeline

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const pct = (x: number, dp = 1) => `${(x * 100).toFixed(dp)}%`;

/** Smooth crash intensity r ∈ [0,1] at a point in "world" time (0 = calm). */
function regime(worldT: number): number {
  const k = Math.round(worldT / CRASH_PERIOD - 0.5);
  const center = (k + 0.5) * CRASH_PERIOD;
  const d = Math.abs(worldT - center);
  if (d >= CRASH_HALFWIDTH) return 0;
  return 0.5 * (1 + Math.cos((Math.PI * d) / CRASH_HALFWIDTH));
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
  const [crashCorr, setCrashCorr] = useState(DEFAULTS.crashCorr);
  const [mode, setMode] = useState<"continuous" | "single">("continuous");

  const wA = weightA / 100;
  const wB = 1 - wA;
  const xA = wA * ampA;
  const xB = wB * ampB;
  const avgAmp = xA + xB; // if the two risks simply added up

  const calmVol = portAmp(xA, xB, normalCorr);
  const crashVol = portAmp(xA, xB, crashCorr);
  const cancelledCalm = avgAmp > 1e-9 ? (avgAmp - calmVol) / avgAmp : 0;
  const cancelledCrash = avgAmp > 1e-9 ? (avgAmp - crashVol) / avgAmp : 0;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nowRef = useRef<HTMLSpanElement>(null);
  const phaseRef = useRef(0);
  const lastLabel = useRef("");

  const drawKey = JSON.stringify({ ampA, ampB, wA, normalCorr, crashCorr, mode });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const css = getComputedStyle(document.documentElement);
    const color = (name: string) => css.getPropertyValue(name).trim() || "#888";
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
      const maxAmp = Math.max(ampA, ampB, 0.01);
      const ampScale = ((bandH / 2) * 0.86) / (maxAmp * 1.05);
      const phase0 = phaseRef.current;
      const accent = color("--color-accent");
      const err = color("--color-error");
      const theta = (x: number) => (x / plotW) * THETA_SPAN + phase0;
      const corrAt = (worldT: number) =>
        normalCorr + (crashCorr - normalCorr) * regime(worldT);

      // 1) crash bands: a translucent red column wherever the market is in crisis.
      const step = 2;
      for (let x = 0; x <= plotW; x += step) {
        const r = regime(theta(x));
        if (r <= 0.01) continue;
        ctx!.fillStyle = err;
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

      // 2) the two asset waves (top). Asset A fixed phase 0; asset B's phase
      //    tracks the instantaneous correlation, so it drifts into lockstep in a crash.
      const drawAsset = (amp: number, phaseOf: (t: number) => number, col: string) => {
        ctx!.strokeStyle = col;
        ctx!.globalAlpha = 0.9;
        ctx!.lineWidth = 2;
        ctx!.lineJoin = "round";
        ctx!.beginPath();
        for (let x = 0; x <= plotW; x += step) {
          const y = topCenter - amp * Math.sin(theta(x) + phaseOf(theta(x))) * ampScale;
          if (x === 0) ctx!.moveTo(padL + x, y);
          else ctx!.lineTo(padL + x, y);
        }
        ctx!.stroke();
      };
      drawAsset(ampA, () => 0, color("--pl-c1"));
      drawAsset(ampB, (t) => Math.acos(clamp(corrAt(t), -1, 1)), color("--pl-c2"));
      ctx!.globalAlpha = 1;

      // 3) portfolio wave (bottom) = wA·A + wB·B, recolored red inside the crash.
      ctx!.lineWidth = 3;
      ctx!.lineJoin = "round";
      let penDown = false;
      let prevCrash = false;
      for (let x = 0; x <= plotW; x += step) {
        const t = theta(x);
        const r = regime(t);
        const phaseB = Math.acos(clamp(corrAt(t), -1, 1));
        const v = wA * ampA * Math.sin(t) + wB * ampB * Math.sin(t + phaseB);
        const y = botCenter - v * ampScale;
        const inCrash = r > 0.45;
        if (!penDown || inCrash !== prevCrash) {
          if (penDown) ctx!.stroke();
          ctx!.beginPath();
          ctx!.strokeStyle = inCrash ? err : accent;
          ctx!.moveTo(padL + x, y);
          penDown = true;
          prevCrash = inCrash;
        } else {
          ctx!.lineTo(padL + x, y);
        }
      }
      if (penDown) ctx!.stroke();

      // 4) live "right now" regime label (newest time = right edge).
      const rNow = regime(theta(plotW));
      const label = rNow > 0.45 ? "crash" : "calm";
      if (nowRef.current && label !== lastLabel.current) {
        lastLabel.current = label;
        nowRef.current.textContent =
          label === "crash"
            ? `Crash — correlation ≈ +${crashCorr.toFixed(2)}`
            : `Calm — correlation ≈ ${normalCorr.toFixed(2)}`;
        nowRef.current.style.color = label === "crash" ? err : accent;
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
            setCrashCorr(DEFAULTS.crashCorr);
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
            Correlation in a crash
            <InfoTip text="Where the correlation jumps to inside a crisis. In real markets, assets that look independent in calm times tend to fall together in a crash — correlations spike toward +1." />{" "}
            <strong>+{crashCorr.toFixed(2)}</strong>
          </span>
          <input type="range" min={0} max={1} step={0.05} value={crashCorr} onChange={(e) => setCrashCorr(Number(e.target.value))} />
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
              <span className="wl-bar-label">Portfolio volatility in a crash</span>
              <div className="wl-bar-track">
                <div className="wl-bar-fill wl-bar-fill--realized" style={{ width: `${avgAmp > 0 ? Math.min(100, (crashVol / avgAmp) * 100) : 0}%` }} />
              </div>
              <span className="wl-bar-value">{pct(crashVol)}</span>
            </div>
            <p className="wl-saved">
              In calm markets, diversification cancels <strong>{pct(cancelledCalm, 0)}</strong> of
              the risk. In a crash, when correlations jump toward +1, only{" "}
              <strong>{pct(cancelledCrash, 0)}</strong> cancels — the protection fades exactly
              when you need it most.
            </p>
            <p className="wl-saved" style={{ marginTop: "var(--space-sm)" }}>
              Right now: <strong ref={nowRef} style={{ color: "var(--color-accent)" }}>Calm — correlation ≈ {normalCorr.toFixed(2)}</strong>
            </p>
          </div>

          <div className="wl-readout">
            <p className="wl-note" style={{ fontStyle: "normal" }}>
              <strong>Why this matters.</strong> A single correlation number — the ρ in the
              variance formula — hides this. It's an <em>average</em> over calm and crisis alike,
              so it flatters diversification: the free lunch is smallest in the rare moments that
              do the most damage, when nearly everything falls together.
            </p>
            <p className="wl-note">
              That gap between the tidy average and what happens in the tails is exactly why the
              next view drops the clean waves for real, noisy returns — where cancellation is
              never perfect and crashes aren't scheduled.
            </p>
          </div>
        </div>

        <p className="wl-note">
          Still an idealized model — the crashes here arrive on a neat cadence. Real ones don't.
          Correlation sets each wave's phase; the red bands are where it spikes.
        </p>
      </div>
    </div>
  );
}
