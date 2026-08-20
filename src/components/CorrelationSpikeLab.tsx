import { useEffect, useRef, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";

/**
 * The bridge between the pure "waves" idea and messy reality: correlation is not
 * a constant. Two assets drawn as sine waves cancel nicely in calm markets, but
 * every so often correlation spikes toward +1 and the waves snap into phase — the
 * portfolio then swings as violently as its parts. These spikes are not inherently
 * good or bad: the assets lurch together up (a rally) or down (a sell-off) alike.
 * Either way the cancellation vanishes, so the episodes are shaded a single
 * neutral highlight — no colour verdict on the outcome. The lesson: the single ρ
 * in the variance formula is an average that oversells diversification, because
 * the free lunch is smallest exactly in those correlated episodes.
 *
 * Deterministic and exact for the readout: instantaneous correlation is ρ(t)
 * blended from ρ_normal to ρ_spike by a smooth bump, and at each plateau the
 * portfolio amplitude is closed-form √(x₁² + x₂² + 2x₁x₂ρ) with xᵢ = wᵢσᵢ. The
 * directional lurch is a visual overlay only; the vertical scale is fit to the
 * true excursion each frame so the swing never clips.
 */

const DEFAULTS = {
  ampA: 0.16,
  ampB: 0.14,
  weightA: 50, // % in asset A; B gets the rest
  normalCorr: -0.15,
  spikeCorr: 0.9,
};

const THETA_SPAN = 4 * Math.PI; // two cycles across the width
const EPISODE_PERIOD = 4 * Math.PI; // one spike episode in view at a time
const EPISODE_HALFWIDTH = 0.55 * Math.PI; // episodes are a minority of the timeline
// A correlation spike usually rides a joint move. On top of the correlation
// spike the whole cluster lurches together — sometimes up, sometimes down — and
// recovers, so a band reads as a real episode, not just noise. It carries no
// good/bad verdict: the direction alternates and the shading stays neutral.
const SHOCK = 0.8; // directional lurch at a band's center, in units of amplitude

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const pct = (x: number, dp = 1) => `${(x * 100).toFixed(dp)}%`;

type Regime = { r: number; sign: number }; // sign is the lurch direction (±1), not a verdict

/** Smooth episode intensity r ∈ [0,1] and its lurch direction at a point in world
 *  time. Direction alternates so joint moves go both up and down. */
function regimeAt(worldT: number): Regime {
  const k = Math.round(worldT / EPISODE_PERIOD - 0.5);
  const center = (k + 0.5) * EPISODE_PERIOD;
  const d = Math.abs(worldT - center);
  const r = d < EPISODE_HALFWIDTH ? 0.5 * (1 + Math.cos((Math.PI * d) / EPISODE_HALFWIDTH)) : 0;
  const sign = ((k % 2) + 2) % 2 === 0 ? -1 : 1;
  return { r, sign };
}

/** Portfolio wave amplitude for a given correlation, with xᵢ = wᵢσᵢ. */
function portAmp(xA: number, xB: number, corr: number): number {
  return Math.sqrt(Math.max(0, xA * xA + xB * xB + 2 * xA * xB * corr));
}

export default function CorrelationSpikeLab() {
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

    const corrAt = (t: number) => {
      const { r } = regimeAt(t);
      return normalCorr + (spikeCorr - normalCorr) * r;
    };
    const phaseBAt = (t: number) => Math.acos(clamp(corrAt(t), -1, 1));
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

    // Fit the vertical scale to the biggest excursion (waves + lurch) over a full
    // cycle, so nothing ever runs off its band regardless of settings.
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
      const muted = color("--color-muted");
      const theta = (x: number) => (x / plotW) * THETA_SPAN + phase0;

      // 1) episode bands: a single neutral highlight wherever correlation spikes —
      //    no colour verdict on whether the joint move is good or bad.
      const step = 2;
      for (let x = 0; x <= plotW; x += step) {
        const { r } = regimeAt(theta(x));
        if (r <= 0.01) continue;
        ctx!.fillStyle = muted;
        ctx!.globalAlpha = 0.16 * r;
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
      ctx!.fillStyle = muted;
      ctx!.font = SANS;
      ctx!.textAlign = "left";
      ctx!.textBaseline = "top";
      ctx!.fillText("The two assets", padL, 2);
      ctx!.fillText("Your portfolio", padL, bandH + gap + 2);
      ctx!.textAlign = "right";
      ctx!.fillText("time →", W - padR, 2);
      ctx!.textAlign = "left";

      // faint guide: the volatility if risk simply added up (weighted-avg amplitude)
      ctx!.strokeStyle = muted;
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

      // 3) portfolio wave (bottom) — one colour throughout; the shaded band, not
      //    the line's hue, marks the correlated episode.
      ctx!.strokeStyle = accent;
      ctx!.lineWidth = 3;
      ctx!.lineJoin = "round";
      ctx!.beginPath();
      for (let x = 0; x <= plotW; x += step) {
        const y = botCenter - portValue(theta(x)) * ampScale;
        if (x === 0) ctx!.moveTo(padL + x, y);
        else ctx!.lineTo(padL + x, y);
      }
      ctx!.stroke();

      // 4) live "right now" label (newest time = right edge).
      const { r: rNow } = regimeAt(theta(plotW));
      const kind = rNow > 0.45 ? "spiking" : "calm";
      if (nowRef.current && kind !== lastLabel.current) {
        lastLabel.current = kind;
        const el = nowRef.current;
        el.textContent =
          kind === "spiking"
            ? `Correlation spiking — ρ ≈ +${spikeCorr.toFixed(2)}, moving together`
            : `Calm — ρ ≈ ${normalCorr.toFixed(2)}`;
        el.style.color = color("--color-text");
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
            <InfoTip text="Where the correlation jumps during an episode. In real markets, assets that look independent in calm times move together in the extremes — booms and busts alike — as correlations spike toward +1." />{" "}
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
              Right now: <strong ref={nowRef} style={{ color: "var(--color-text)" }}>Calm — ρ ≈ {normalCorr.toFixed(2)}</strong>
            </p>
          </div>

          <div className="wl-readout">
            <p className="wl-note" style={{ fontStyle: "normal" }}>
              <strong>Correlation isn't a constant.</strong> In the calm middle the two assets
              drift apart and the waves cancel; in the shaded episodes they lurch together — the
              waves snap into phase and the cancellation vanishes. Those episodes are neither good
              nor bad in themselves: the joint move can be up (a rally) or down (a sell-off).
            </p>
            <p className="wl-note">
              But the single ρ in the variance formula is an <em>average</em> that hides them — and
              it bites hardest on the downside, where the free lunch is smallest exactly when a
              shock is dragging everything down at once. That gap between the tidy average and the
              tails is why the next view drops the clean waves for real, noisy returns.
            </p>
          </div>
        </div>

        <p className="wl-note">
          Still idealized — here the episodes arrive on a neat cadence. Real ones don't. Correlation
          sets each wave's phase; the shaded bands are where it spikes.
        </p>
      </div>
    </div>
  );
}
