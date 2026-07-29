import { useEffect, useMemo, useRef, useState } from "react";
import { mulberry32, makeNormal } from "../lib/portfolio";
import { crspDiversification } from "../data/generated/crsp-diversification";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";

/**
 * "How many stocks is enough?" — diversification WITHIN one asset class.
 *
 * N equally-weighted stocks, each volatility sigma, all sharing an average
 * pairwise correlation rho. Portfolio volatility = sigma*sqrt(rho + (1-rho)/N),
 * which falls from sigma toward an irreducible floor of sigma*sqrt(rho) — the
 * systematic (market) risk that CAPM's beta prices. Shown two ways: a live
 * cloud of noisy stock paths collapsing into a steadier portfolio, and the
 * classic risk-vs-number-of-stocks curve.
 */

const MAX_N = 50;
const SERIES_LEN = 1400;
const VISIBLE = 320;
const SCROLL_SPEED = 26;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const pct = (x: number, dp = 1) => `${(x * 100).toFixed(dp)}%`;

const portVol = (sigma: number, rho: number, n: number) =>
  sigma * Math.sqrt(rho + (1 - rho) / Math.max(1, n));

// Single-factor equicorrelated mean-reverting series (cheap for large N).
function simulateStocks(
  n: number,
  sigma: number,
  rho: number,
  length: number,
  seed: number,
  theta = 0.07,
  warmup = 200
): number[][] {
  const rng = mulberry32(seed);
  const norm = makeNormal(rng);
  const persist = 1 - theta;
  const shock = sigma * Math.sqrt(2 * theta - theta * theta);
  const r = clamp(rho, 0, 0.999);
  const sf = Math.sqrt(r);
  const si = Math.sqrt(1 - r);
  const X = new Array(n).fill(0);
  const series = Array.from({ length: n }, () => new Array(length).fill(0));
  const total = warmup + length;
  for (let t = 0; t < total; t++) {
    const F = norm();
    for (let i = 0; i < n; i++) {
      const z = sf * F + si * norm();
      X[i] = X[i] * persist + shock * z;
      if (t >= warmup) series[i][t - warmup] = X[i];
    }
  }
  return series;
}

export default function StockCountLab() {
  const [n, setN] = useState(10);
  const [sigma, setSigma] = useState(0.3);
  const [rho, setRho] = useState(0.2);
  const [mode, setMode] = useState<"continuous" | "single">("continuous");
  const [seed, setSeed] = useState(1);

  const series = useMemo(
    () => simulateStocks(n, sigma, rho, SERIES_LEN, seed),
    [n, sigma, rho, seed]
  );

  const floor = sigma * Math.sqrt(rho);
  const curVol = portVol(sigma, rho, n);
  const singleVol = sigma;
  const removedVar = 1 - 1 / n; // fraction of diversifiable VARIANCE removed

  // --- Canvas ------------------------------------------------------------
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offsetRef = useRef(0);
  const drawRef = useRef<() => void>(() => {});
  const latest = useRef({ series, sigma });
  latest.current = { series, sigma };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const css = getComputedStyle(document.documentElement);
    const color = (name: string) => css.getPropertyValue(name).trim() || "#888";
    const SANS = '600 12px ui-sans-serif, system-ui, sans-serif';

    function sizeCanvas() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      canvas!.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas!.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      const { series, sigma } = latest.current;
      const N = series.length;
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
      const ampScale = ((bandH / 2) * 0.92) / (Math.max(sigma, 0.01) * 2.8);
      const off = Math.floor(offsetRef.current);
      const len = series[0]?.length || 1;
      const clampY = (yy: number, c: number) => clamp(yy, c - bandH / 2 + 1, c + bandH / 2 - 1);

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
      ctx!.fillText(`${N} individual stocks`, padL, 2);
      ctx!.fillText("Equal-weight portfolio", padL, bandH + gap + 2);
      ctx!.textAlign = "right";
      ctx!.fillText("time →", W - padR, 2);
      ctx!.textAlign = "left";

      // individual stocks (faint)
      ctx!.strokeStyle = color("--color-text-soft");
      ctx!.globalAlpha = Math.max(0.08, Math.min(0.5, 3 / N));
      ctx!.lineWidth = 1;
      for (let i = 0; i < N; i++) {
        ctx!.beginPath();
        for (let k = 0; k <= VISIBLE; k++) {
          const idx = Math.min(off + k, len - 1);
          const y = clampY(topCenter - series[i][idx] * ampScale, topCenter);
          const px = padL + (k / VISIBLE) * plotW;
          if (k === 0) ctx!.moveTo(px, y);
          else ctx!.lineTo(px, y);
        }
        ctx!.stroke();
      }
      ctx!.globalAlpha = 1;

      // portfolio (bold)
      ctx!.strokeStyle = color("--color-accent");
      ctx!.lineWidth = 3;
      ctx!.lineJoin = "round";
      ctx!.beginPath();
      for (let k = 0; k <= VISIBLE; k++) {
        const idx = Math.min(off + k, len - 1);
        let v = 0;
        for (let i = 0; i < N; i++) v += series[i][idx];
        v /= N;
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
          setSeed((s) => s + 1);
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

  useEffect(() => {
    drawRef.current();
  }, [series]);

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton
          onReset={() => {
            setN(10); setSigma(0.3); setRho(0.2); setMode("continuous"); setSeed(1);
          }}
        />
        <div className="wl-simmode" role="group" aria-label="Simulation mode">
          <button type="button" className={mode === "continuous" ? "active" : ""} aria-pressed={mode === "continuous"} onClick={() => setMode("continuous")}>
            Continuous
          </button>
          <button type="button" className={mode === "single" ? "active" : ""} aria-pressed={mode === "single"} onClick={() => setMode("single")}>
            Snapshot
          </button>
          <button type="button" className="wl-btn" onClick={() => setSeed((s) => s + 1)}>
            New draw
          </button>
          <button
            type="button"
            className="wl-btn"
            onClick={() => {
              setSigma(crspDiversification.sigmaAnnualMedian);
              setRho(crspDiversification.avgPairwiseCorr);
            }}
          >
            Real US stocks
          </button>
        </div>

        <label className="wl-slider">
          <span>
            Number of stocks
            <InfoTip text="How many equally-weighted stocks you hold. Adding more averages away each company's own risk." />{" "}
            <strong>{n}</strong>
          </span>
          <input type="range" min={1} max={MAX_N} step={1} value={n} onChange={(e) => setN(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>
            Volatility per stock
            <InfoTip text="How jumpy a single stock is on its own. Individual stocks are far more volatile than the market — often 30%+ a year." />{" "}
            <strong>{pct(sigma, 0)}</strong>
          </span>
          <input type="range" min={0.1} max={0.6} step={0.01} value={sigma} onChange={(e) => setSigma(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>
            Average correlation
            <InfoTip text="How much the stocks move together (0 to 1). It sets the risk floor you can't diversify away: the more correlated, the higher the floor." />{" "}
            <strong>{rho.toFixed(2)}</strong>
          </span>
          <input type="range" min={0} max={0.8} step={0.01} value={rho} onChange={(e) => setRho(+e.target.value)} />
        </label>
        <p className="wl-note" style={{ marginTop: "0.4rem" }}>
          Real stocks are positively correlated (typically 0.1–0.4), so they can't
          diversify to zero — only down to the market floor.
        </p>
      </div>

      <div className="wl-stage">
        <canvas ref={canvasRef} className="wl-canvas" />

        <div className="wl-lower">
          <div className="wl-readout">
            <div className="wl-bar">
              <span className="wl-bar-label">One stock alone</span>
              <div className="wl-bar-track">
                <div className="wl-bar-fill wl-bar-fill--avg" style={{ width: "100%" }} />
              </div>
              <span className="wl-bar-value">{pct(singleVol, 0)}</span>
            </div>
            <div className="wl-bar">
              <span className="wl-bar-label">Your {n}-stock portfolio</span>
              <div className="wl-bar-track">
                <div className="wl-bar-fill wl-bar-fill--port" style={{ width: `${singleVol > 0 ? Math.min(100, (curVol / singleVol) * 100) : 0}%` }} />
              </div>
              <span className="wl-bar-value">{pct(curVol, 1)}</span>
            </div>
            <div className="wl-bar">
              <span className="wl-bar-label">The floor (∞ stocks) = σ√ρ</span>
              <div className="wl-bar-track">
                <div className="wl-bar-fill wl-bar-fill--realized" style={{ width: `${singleVol > 0 ? Math.min(100, (floor / singleVol) * 100) : 0}%` }} />
              </div>
              <span className="wl-bar-value">{pct(floor, 1)}</span>
            </div>
            <p className="wl-saved">
              With {n} stocks you've removed <strong>{pct(removedVar, 0)}</strong> of the
              diversifiable risk (in variance terms). But you can never beat the{" "}
              {pct(floor, 1)} floor — that leftover is systematic risk, the same thing{" "}
              <a href="/tools/capm">CAPM's beta</a> prices.
            </p>
          </div>

          <div className="wl-frontier">
            <h3>Risk vs. number of stocks</h3>
            <RiskCurve sigma={sigma} rho={rho} n={n} />
            <p className="wl-fnote">
              Most of the benefit comes early — about 20–30 stocks captures the bulk
              of it. Beyond that the curve flattens against the floor. The dots are
              the <strong>actual</strong> curve for US stocks; hit “Real US stocks”
              to snap the model onto them. {crspDiversification.source}
            </p>
          </div>
        </div>

        <p className="wl-note">
          Each thin line is one stock's noisy ups and downs; the bold line is your
          equal-weight portfolio. Add stocks and watch it steady — but never go
          flat.
        </p>
      </div>
    </div>
  );
}

function RiskCurve({ sigma, rho, n }: { sigma: number; rho: number; n: number }) {
  const width = 440;
  const height = 300;
  const pad = { top: 16, right: 18, bottom: 40, left: 52 };
  const NMAX = MAX_N;
  const empirical = crspDiversification.curve.filter((p) => p.n <= NMAX);
  const empiricalMax = empirical.length ? empirical[0].volAnnual : 0;
  const yMax = Math.max(sigma, empiricalMax) * 1.05;
  const floor = sigma * Math.sqrt(rho);

  const x = (k: number) => pad.left + ((k - 1) / (NMAX - 1)) * (width - pad.left - pad.right);
  const y = (v: number) => height - pad.bottom - (v / yMax) * (height - pad.top - pad.bottom);

  const path = Array.from({ length: NMAX }, (_, i) => i + 1)
    .map((k, i) => `${i === 0 ? "M" : "L"}${x(k)},${y(portVol(sigma, rho, k))}`)
    .join(" ");
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Portfolio volatility falling as the number of stocks increases, toward a floor">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const v = yMax * f;
        return (
          <g key={f}>
            <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" />
            <text x={pad.left - 8} y={y(v) + 4} textAnchor="end" style={axisText}>{pct(v, 0)}</text>
          </g>
        );
      })}
      {[1, 10, 20, 30, 40, 50].map((k) => (
        <text key={k} x={x(k)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>{k}</text>
      ))}
      {/* floor asymptote */}
      <line x1={pad.left} x2={width - pad.right} y1={y(floor)} y2={y(floor)} stroke="var(--color-warn)" strokeWidth={1.5} strokeDasharray="5 4" />
      <text x={width - pad.right} y={y(floor) - 5} textAnchor="end" style={{ ...axisText, fill: "var(--color-warn)", fontWeight: 600 }}>
        floor σ√ρ = {pct(floor, 1)}
      </text>
      {/* curve */}
      <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} strokeLinejoin="round" />
      {/* empirical (real CRSP) curve — a fixed reference the model can be fit to */}
      <polyline
        points={empirical.map((p) => `${x(p.n)},${y(p.volAnnual)}`).join(" ")}
        fill="none"
        stroke="var(--color-text-soft)"
        strokeWidth={1.25}
        strokeDasharray="2 3"
        opacity={0.9}
      />
      {empirical.map((p) => (
        <circle key={p.n} cx={x(p.n)} cy={y(p.volAnnual)} r={2.6} fill="var(--color-text-soft)" />
      ))}
      <text
        x={x(empirical[empirical.length - 1].n)}
        y={y(empirical[empirical.length - 1].volAnnual) + 16}
        textAnchor="end"
        style={{ ...axisText, fill: "var(--color-text-soft)", fontWeight: 600 }}
      >
        actual US stocks
      </text>
      {/* current N marker */}
      <circle cx={x(n)} cy={y(portVol(sigma, rho, n))} r={6} fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth={2} />
      <text x={(pad.left + width - pad.right) / 2} y={height - 6} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Number of stocks →
      </text>
      <text x={13} y={(pad.top + height - pad.bottom) / 2} textAnchor="middle" transform={`rotate(-90 13 ${(pad.top + height - pad.bottom) / 2})`} style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Portfolio volatility →
      </text>
    </svg>
  );
}
