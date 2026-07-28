import { useEffect, useMemo, useState } from "react";
import { mulberry32, makeNormal } from "../lib/portfolio";

/**
 * CAPM teaching tool — two linked panels:
 *  A) the characteristic line (regress an asset's excess returns on the
 *     market's; slope = beta, intercept = alpha, R² = systematic share), with
 *     resampling so the estimated beta visibly wiggles around the true beta.
 *  B) the Security Market Line (expected return vs beta); the asset sits off
 *     the line by exactly its alpha — above = underpriced, below = overpriced.
 */

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const pct = (x: number, dp = 1) => `${(x * 100).toFixed(dp)}%`;
const signedPct = (x: number, dp = 1) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(dp)}%`;

type Point = { m: number; a: number };

function simulateSample(
  beta: number,
  alpha: number,
  idio: number,
  sigM: number,
  n: number,
  seed: number
): Point[] {
  const rng = mulberry32(seed);
  const norm = makeNormal(rng);
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const m = norm() * sigM; // market excess return (centered at 0)
    const a = alpha + beta * m + norm() * idio;
    pts.push({ m, a });
  }
  return pts;
}

function ols(pts: Point[]) {
  const n = pts.length;
  if (n < 2) return { beta: 0, alpha: 0, r2: 0 };
  let sm = 0;
  let sa = 0;
  for (const p of pts) {
    sm += p.m;
    sa += p.a;
  }
  const mm = sm / n;
  const ma = sa / n;
  let cov = 0;
  let varm = 0;
  let vara = 0;
  for (const p of pts) {
    const dm = p.m - mm;
    const da = p.a - ma;
    cov += dm * da;
    varm += dm * dm;
    vara += da * da;
  }
  const beta = varm > 0 ? cov / varm : 0;
  const alpha = ma - beta * mm;
  const r2 = varm > 0 && vara > 0 ? (cov * cov) / (varm * vara) : 0;
  return { beta, alpha, r2 };
}

const REFERENCE = [
  { label: "Cash", beta: 0 },
  { label: "Defensive", beta: 0.6 },
  { label: "Market", beta: 1 },
  { label: "Aggressive", beta: 1.4 },
];

export default function CapmLab() {
  const [rf, setRf] = useState(0.03);
  const [premium, setPremium] = useState(0.05);
  const [sigM, setSigM] = useState(0.15);
  const [beta, setBeta] = useState(1.2);
  const [alpha, setAlpha] = useState(0.01);
  const [idio, setIdio] = useState(0.1);
  const [n, setN] = useState(60);
  const [blend, setBlend] = useState(1);
  const [seed, setSeed] = useState(1);
  const [mode, setMode] = useState<"static" | "live">("static");

  // Live resampling: bump the seed periodically so the estimate wiggles.
  useEffect(() => {
    if (mode !== "live") return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const id = window.setInterval(() => setSeed((s) => s + 1), 1200);
    return () => window.clearInterval(id);
  }, [mode]);

  const sample = useMemo(
    () => simulateSample(beta, alpha, idio, sigM, n, seed),
    [beta, alpha, idio, sigM, n, seed]
  );
  const est = useMemo(() => ols(sample), [sample]);

  // Population risk decomposition
  const sysVar = beta * beta * sigM * sigM;
  const idioVar = idio * idio;
  const totalVar = sysVar + idioVar;
  const sysShare = totalVar > 0 ? sysVar / totalVar : 0;

  const capmReturn = rf + beta * premium;
  const assetReturn = capmReturn + alpha;
  const verdict =
    alpha > 0.003
      ? { text: "Underpriced — it offers more return than its beta demands.", cls: "cl-up" }
      : alpha < -0.003
        ? { text: "Overpriced — it offers less return than its beta demands.", cls: "cl-down" }
        : { text: "Fairly priced — it sits right on the Security Market Line.", cls: "cl-fair" };

  return (
    <div className="wl">
      <div className="wl-controls">
        <p className="cl-group">The market</p>
        <label className="wl-slider">
          <span>Risk-free rate <strong>{pct(rf)}</strong></span>
          <input type="range" min={0} max={0.08} step={0.0025} value={rf} onChange={(e) => setRf(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>Market risk premium <strong>{pct(premium)}</strong></span>
          <input type="range" min={0.01} max={0.1} step={0.0025} value={premium} onChange={(e) => setPremium(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>Market volatility <strong>{pct(sigM, 0)}</strong></span>
          <input type="range" min={0.08} max={0.25} step={0.005} value={sigM} onChange={(e) => setSigM(+e.target.value)} />
        </label>

        <p className="cl-group">Your asset</p>
        <label className="wl-slider">
          <span>Beta (β) <strong>{beta.toFixed(2)}</strong></span>
          <input type="range" min={-0.5} max={2.5} step={0.05} value={beta} onChange={(e) => setBeta(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>Alpha (α) <strong>{signedPct(alpha)}</strong></span>
          <input type="range" min={-0.05} max={0.05} step={0.0025} value={alpha} onChange={(e) => setAlpha(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>Idiosyncratic noise <strong>{pct(idio, 0)}</strong></span>
          <input type="range" min={0} max={0.25} step={0.005} value={idio} onChange={(e) => setIdio(+e.target.value)} />
        </label>

        <p className="cl-group">Estimating beta</p>
        <label className="wl-slider">
          <span>Sample size <strong>{n} periods</strong></span>
          <input type="range" min={20} max={240} step={4} value={n} onChange={(e) => setN(+e.target.value)} />
        </label>
        <div className="wl-simmode" role="group" aria-label="Sampling mode">
          <button type="button" className={mode === "static" ? "active" : ""} aria-pressed={mode === "static"} onClick={() => setMode("static")}>
            Static
          </button>
          <button type="button" className={mode === "live" ? "active" : ""} aria-pressed={mode === "live"} onClick={() => setMode("live")}>
            Live
          </button>
          <button type="button" className="wl-btn" onClick={() => setSeed((s) => s + 1)}>
            New sample
          </button>
        </div>

        <p className="cl-group">Move along the line</p>
        <label className="wl-slider">
          <span>Cash ⇄ Market blend <strong>{pct(blend, 0)} market</strong></span>
          <input type="range" min={0} max={1.5} step={0.05} value={blend} onChange={(e) => setBlend(+e.target.value)} />
        </label>
      </div>

      <div className="wl-stage">
        <div className="cl-stage">
          <CharacteristicLine sample={sample} beta={beta} alpha={alpha} est={est} />
          <SecurityMarketLine
            rf={rf}
            premium={premium}
            beta={beta}
            alpha={alpha}
            blend={blend}
            capmReturn={capmReturn}
            assetReturn={assetReturn}
          />
        </div>

        <div className="cl-readouts">
          <div className="wl-readout">
            <h3>What beta measures</h3>
            <dl className="cl-stats">
              <div><dt>True β</dt><dd>{beta.toFixed(2)}</dd></div>
              <div><dt>Estimated β̂</dt><dd>{est.beta.toFixed(2)}</dd></div>
              <div><dt>Estimated α̂</dt><dd>{signedPct(est.alpha)}</dd></div>
              <div><dt>R² (fit)</dt><dd>{pct(est.r2, 0)}</dd></div>
            </dl>
            <div className="wl-bar">
              <span className="wl-bar-label">Systematic (market) risk</span>
              <div className="wl-bar-track">
                <div className="wl-bar-fill wl-bar-fill--port" style={{ width: `${pct(sysShare, 1)}` }} />
              </div>
              <span className="wl-bar-value">{pct(sysShare, 0)}</span>
            </div>
            <p className="wl-saved">
              Only the <strong>{pct(sysShare, 0)}</strong> systematic slice is rewarded —
              the rest is idiosyncratic and diversifies away. With more data, β̂ closes
              in on the true β; with a small sample it wanders.
            </p>
          </div>

          <div className="wl-readout">
            <h3>What beta prices</h3>
            <dl className="cl-stats">
              <div><dt>CAPM says (r_f + β·premium)</dt><dd>{pct(capmReturn)}</dd></div>
              <div><dt>This asset offers</dt><dd>{pct(assetReturn)}</dd></div>
              <div><dt>Alpha (the gap)</dt><dd>{signedPct(alpha)}</dd></div>
            </dl>
            <p className={`cl-verdict ${verdict.cls}`}>{verdict.text}</p>
            <p className="wl-note">
              Portfolio beta is just a weighted average of the parts — unlike volatility,
              it adds up linearly. The market portfolio (β = 1) is the tangency portfolio
              from the <a href="/tools/portfolio">Portfolio Lab</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function CharacteristicLine({
  sample,
  beta,
  alpha,
  est,
}: {
  sample: Point[];
  beta: number;
  alpha: number;
  est: { beta: number; alpha: number; r2: number };
}) {
  const width = 440;
  const height = 320;
  const pad = { top: 16, right: 16, bottom: 40, left: 48 };

  const ms = sample.map((p) => p.m);
  const as = sample.map((p) => p.a);
  const mAbs = Math.max(0.05, ...ms.map(Math.abs)) * 1.1;
  const aAbs = Math.max(0.05, ...as.map(Math.abs)) * 1.1;

  const x = (m: number) => pad.left + ((m + mAbs) / (2 * mAbs)) * (width - pad.left - pad.right);
  const y = (a: number) => height - pad.bottom - ((a + aAbs) / (2 * aAbs)) * (height - pad.top - pad.bottom);

  const lineY = (fn: (m: number) => number) => ({
    x1: x(-mAbs),
    y1: clamp(y(fn(-mAbs)), pad.top, height - pad.bottom),
    x2: x(mAbs),
    y2: clamp(y(fn(mAbs)), pad.top, height - pad.bottom),
  });
  const trueLine = lineY((m) => alpha + beta * m);
  const fitLine = lineY((m) => est.alpha + est.beta * m);

  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  return (
    <div className="cl-panel">
      <h3>Characteristic line</h3>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Scatter of asset excess return versus market excess return, with a fitted regression line">
        {/* zero axes */}
        <line x1={x(0)} y1={pad.top} x2={x(0)} y2={height - pad.bottom} stroke="var(--color-border)" />
        <line x1={pad.left} y1={y(0)} x2={width - pad.right} y2={y(0)} stroke="var(--color-border)" />
        {/* points */}
        {sample.map((p, i) => (
          <circle key={i} cx={x(p.m)} cy={y(p.a)} r={2.5} fill="var(--color-text-soft)" opacity={0.5} />
        ))}
        {/* true line (dashed) then fitted line (solid) */}
        <line x1={trueLine.x1} y1={trueLine.y1} x2={trueLine.x2} y2={trueLine.y2} stroke="var(--color-muted)" strokeWidth={1.5} strokeDasharray="5 4" />
        <line x1={fitLine.x1} y1={fitLine.y1} x2={fitLine.x2} y2={fitLine.y2} stroke="var(--color-accent)" strokeWidth={2.5} />
        <text x={(pad.left + width - pad.right) / 2} y={height - 6} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
          Market excess return →
        </text>
        <text x={12} y={(pad.top + height - pad.bottom) / 2} textAnchor="middle" transform={`rotate(-90 12 ${(pad.top + height - pad.bottom) / 2})`} style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
          Asset excess return →
        </text>
      </svg>
      <div className="cl-legend">
        <span><span className="cl-key cl-key--fit" /> Fitted (slope = β̂)</span>
        <span><span className="cl-key cl-key--true" /> True line</span>
      </div>
    </div>
  );
}

function SecurityMarketLine({
  rf,
  premium,
  beta,
  alpha,
  blend,
  capmReturn,
  assetReturn,
}: {
  rf: number;
  premium: number;
  beta: number;
  alpha: number;
  blend: number;
  capmReturn: number;
  assetReturn: number;
}) {
  const width = 440;
  const height = 320;
  const pad = { top: 16, right: 20, bottom: 40, left: 48 };

  const betaMax = Math.max(1.6, beta + 0.4, blend + 0.4);
  const betaMin = Math.min(-0.3, beta - 0.2);
  const rets = [rf, capmReturn, assetReturn, rf + betaMax * premium, rf + betaMin * premium];
  const rMax = Math.max(...rets) * 1.1;
  const rMin = Math.min(...rets, 0);

  const x = (b: number) => pad.left + ((b - betaMin) / (betaMax - betaMin)) * (width - pad.left - pad.right);
  const y = (r: number) => height - pad.bottom - ((r - rMin) / (rMax - rMin)) * (height - pad.top - pad.bottom);

  const blendRet = rf + blend * premium;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  return (
    <div className="cl-panel">
      <h3>Security market line</h3>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Security market line: expected return versus beta, with the asset plotted off the line by its alpha">
        {/* axes */}
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={height - pad.bottom} stroke="var(--color-border)" />
        <line x1={pad.left} y1={y(rf)} x2={width - pad.right} y2={y(rf)} stroke="var(--color-border)" strokeDasharray="3 3" />
        {[0, 0.5, 1, 1.5, 2].filter((b) => b >= betaMin && b <= betaMax).map((b) => (
          <text key={b} x={x(b)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>β={b}</text>
        ))}
        {/* SML */}
        <line x1={x(betaMin)} y1={y(rf + betaMin * premium)} x2={x(betaMax)} y2={y(rf + betaMax * premium)} stroke="var(--color-text)" strokeWidth={2} />
        {/* reference assets (on the line) */}
        {REFERENCE.filter((rref) => rref.beta <= betaMax).map((rref) => (
          <g key={rref.label}>
            <circle cx={x(rref.beta)} cy={y(rf + rref.beta * premium)} r={4} fill="var(--color-muted)" stroke="var(--color-surface)" strokeWidth={1.5} />
            <text x={x(rref.beta)} y={y(rf + rref.beta * premium) - 8} textAnchor="middle" style={{ ...axisText, fontSize: 10 }}>{rref.label}</text>
          </g>
        ))}
        {/* cash-market blend dot */}
        <circle cx={x(blend)} cy={y(blendRet)} r={5} fill="none" stroke="var(--color-link)" strokeWidth={2} />
        {/* alpha connector + your asset */}
        <line x1={x(beta)} y1={y(capmReturn)} x2={x(beta)} y2={y(assetReturn)} stroke="var(--color-accent)" strokeWidth={1.5} strokeDasharray="3 3" />
        <circle cx={x(beta)} cy={y(assetReturn)} r={7} fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth={2} />
        <text x={x(beta) + 10} y={y(assetReturn) + (alpha >= 0 ? -6 : 14)} style={{ ...axisText, fill: "var(--color-accent)", fontWeight: 600, fontSize: 11 }}>
          α = {signedPct(alpha)}
        </text>
        <text x={(pad.left + width - pad.right) / 2} y={height - 6} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
          Beta (systematic risk) →
        </text>
        <text x={12} y={(pad.top + height - pad.bottom) / 2} textAnchor="middle" transform={`rotate(-90 12 ${(pad.top + height - pad.bottom) / 2})`} style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
          Expected return →
        </text>
      </svg>
      <div className="cl-legend">
        <span><span className="cl-key cl-key--asset" /> Your asset</span>
        <span><span className="cl-key cl-key--blend" /> Cash+market blend</span>
        <span><span className="cl-key cl-key--ref" /> Fairly priced</span>
      </div>
    </div>
  );
}
