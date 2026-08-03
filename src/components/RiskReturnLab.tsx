import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import { assetStats } from "../data/generated/asset-stats";

/**
 * "Risk & return: the big idea" — the simplest, most important picture in
 * investing and the whole premise of this site: plot real asset classes by
 * their volatility (risk) and their long-run return, and a clear upward slope
 * appears. Return is the reward for bearing risk.
 *
 * Then the honest asterisk — the low-beta / low-volatility paradox: the line
 * isn't as steep as you'd guess, and the very riskiest bets don't pay in
 * proportion. Gold carries stock-like volatility for a bond-like return, and
 * within the stock market the lowest-volatility stocks have historically beaten
 * their risk. More risk is necessary for more return, but not sufficient.
 *
 * Data: Damodaran annual US series (nominal), the same stats the Portfolio Lab
 * uses. Educational only, not advice.
 */

const pct = (x: number, dp = 1) => `${(x * 100).toFixed(dp)}%`;

type Dot = { id: string; label: string; mu: number; sigma: number; color: string; ladder: boolean };
const A = assetStats.assets;
const DOTS: Dot[] = [
  { id: "tbills", label: "T-bills (cash)", ...A["tbills"], color: "var(--color-muted)", ladder: true },
  { id: "treasuries", label: "Treasury bonds", ...A["treasuries"], color: "var(--color-link)", ladder: true },
  { id: "corporate-bonds", label: "Corporate bonds", ...A["corporate-bonds"], color: "var(--pl-c2)", ladder: true },
  { id: "us-stocks", label: "US stocks", ...A["us-stocks"], color: "var(--pl-c1)", ladder: true },
  { id: "small-cap-value", label: "Small-cap value", ...A["small-cap-value"], color: "var(--color-accent)", ladder: true },
  { id: "gold", label: "Gold", ...A["gold"], color: "var(--color-warn)", ladder: false },
];

/** OLS fit of return on volatility through the "risk ladder" assets (gold, the
 *  exception, is deliberately left out of the fit so it shows up off the line). */
function fitLadder() {
  const pts = DOTS.filter((d) => d.ladder);
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.sigma, 0) / n;
  const my = pts.reduce((s, p) => s + p.mu, 0) / n;
  let cov = 0, varx = 0;
  for (const p of pts) { cov += (p.sigma - mx) * (p.mu - my); varx += (p.sigma - mx) ** 2; }
  const b = cov / varx;
  return { a: my - b * mx, b };
}
const FIT = fitLadder();

export default function RiskReturnLab() {
  const [risk, setRisk] = useState(0.194); // chosen volatility (default ≈ US stocks)
  const [showParadox, setShowParadox] = useState(true);

  const expected = FIT.a + FIT.b * risk;
  const tbills = A["tbills"], scv = A["small-cap-value"];

  const span = useMemo(() => `${assetStats.span[0]}–${assetStats.span[1]}`, []);

  return (
    <div className="wl">
      <div className="wl-controls">
        <p className="cl-group" style={{ marginTop: 0 }}>The big idea</p>
        <p className="wl-note" style={{ fontStyle: "normal", color: "var(--color-text-soft)" }}>
          Each dot is a real US asset class, {span}, placed by how much it bounced around (risk) and what it returned.
          They line up: to earn more, you had to accept more risk. That's not a coincidence — it's the deal.
        </p>

        <label className="wl-slider" style={{ marginTop: "var(--space-sm)" }}>
          <span>
            How much volatility can you take?
            <InfoTip text="Slide to a level of risk (yearly volatility) and read off the return history tended to pay for it. This is the average tendency across a century — never a guarantee for any single year." />{" "}
            <strong>{pct(risk, 0)}</strong>
          </span>
          <input type="range" min={0.03} max={0.38} step={0.005} value={risk} onChange={(e) => setRisk(+e.target.value)} />
        </label>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">At about {pct(risk, 0)} volatility, history paid roughly</span>
          <span className="ss-headline-value">{pct(expected, 1)}/yr</span>
          <span className="ss-headline-sub">nominal — on this line, each extra point of volatility added about <strong>{FIT.b.toFixed(2)}</strong> of a point of return</span>
        </div>

        <label className="pl-check" style={{ marginTop: "var(--space-sm)" }}>
          <input type="checkbox" checked={showParadox} onChange={(e) => setShowParadox(e.target.checked)} />
          Show the low-beta paradox
        </label>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          <strong>Method:</strong> nominal annualized return and volatility of annual returns, Damodaran US data
          ({span}). The line is fit through the core asset ladder; gold is shown but left out of the fit. Educational
          only, not advice.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>More risk, more reward — the century-long pattern</h3>
          <RiskReturnChart risk={risk} expected={expected} showParadox={showParadox} />
          <div className="wl-flegend">
            <span><span className="wl-fdot" style={{ background: "var(--color-accent)" }} /> Asset classes</span>
            <span><span className="wl-fdot" style={{ background: "var(--color-text)" }} /> Risk/return line</span>
            {showParadox && <span><span className="wl-fdot" style={{ background: "var(--color-warn)" }} /> Off the line (paradox)</span>}
          </div>
          <p className="wl-fnote">
            From cash at the bottom-left to small-cap value at the top-right, more volatility came with more return. The
            open marker is where your chosen risk level lands on that line.
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <p className="wl-saved">
              This upward slope is the entire premise of investing — and of this site. Nobody hands you return for free;
              it's the compensation for holding assets that can fall, sometimes hard. Cash returned{" "}
              <strong>{pct(tbills.mu, 1)}</strong> at almost no risk; small-cap value returned{" "}
              <strong>{pct(scv.mu, 1)}</strong> but with gut-wrenching {pct(scv.sigma, 0)} swings.
            </p>
            {showParadox && (
              <div className="rr-paradox">
                <strong>The catch — the low-beta paradox.</strong> The line is flatter than you'd guess, and the extra
                risk isn't always paid for. <span style={{ color: "var(--color-warn)", fontWeight: 700 }}>Gold</span>{" "}
                carries stock-like volatility ({pct(assetStats.assets["gold"].sigma, 0)}) for a bond-like return
                ({pct(assetStats.assets["gold"].mu, 1)}), sitting well below the line. And inside the stock market the
                puzzle is sharper still: the <em>lowest</em>-volatility, lowest-beta stocks have historically delivered
                <strong> better risk-adjusted returns</strong> than the wild ones — the opposite of what simple theory
                predicts. Switch to the <strong>CAPM tab</strong> and flip on the real US data to see that same line come
                in too flat. The lesson: risk is <em>necessary</em> for return, but piling on the most volatile bets is
                not <em>sufficient</em>. Educational only, not advice.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskReturnChart({ risk, expected, showParadox }: { risk: number; expected: number; showParadox: boolean }) {
  const width = 760, height = 400;
  const pad = { top: 22, right: 24, bottom: 46, left: 54 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const xMax = 0.4, yMax = 0.2;
  const x = (s: number) => pad.left + (s / xMax) * plotW;
  const y = (m: number) => pad.top + plotH - (m / yMax) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Asset-class return versus volatility, showing the upward risk-return relationship">
      {[0, 0.05, 0.1, 0.15, 0.2].map((m) => (
        <g key={m}>
          <line x1={pad.left} x2={width - pad.right} y1={y(m)} y2={y(m)} stroke="var(--color-border)" />
          <text x={pad.left - 6} y={y(m) + 4} textAnchor="end" style={axisText}>{pct(m, 0)}</text>
        </g>
      ))}
      {[0, 0.1, 0.2, 0.3, 0.4].map((s) => (
        <text key={s} x={x(s)} y={height - pad.bottom + 18} textAnchor="middle" style={axisText}>{pct(s, 0)}</text>
      ))}
      {/* risk/return line */}
      <line x1={x(0)} y1={y(FIT.a)} x2={x(xMax)} y2={y(FIT.a + FIT.b * xMax)} stroke="var(--color-text)" strokeWidth={2} opacity={0.8} />
      {/* chosen-risk marker */}
      <line x1={x(risk)} x2={x(risk)} y1={y(expected)} y2={height - pad.bottom} stroke="var(--color-accent)" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
      <circle cx={x(risk)} cy={y(expected)} r={6} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} />
      {/* asset dots */}
      {DOTS.filter((d) => d.ladder || showParadox).map((d) => (
        <g key={d.id}>
          <circle cx={x(d.sigma)} cy={y(d.mu)} r={6} fill={d.color} stroke="var(--color-surface)" strokeWidth={1.5}>
            <title>{`${d.label}: ${pct(d.mu, 1)} return, ${pct(d.sigma, 0)} volatility`}</title>
          </circle>
          <text x={x(d.sigma) + (d.id === "small-cap-value" ? -10 : 10)} y={y(d.mu) + (d.id === "gold" ? 16 : 4)} textAnchor={d.id === "small-cap-value" ? "end" : "start"} style={{ ...axisText, fill: "var(--color-text)", fontWeight: 600, fontSize: 12 }}>
            {d.label}
          </text>
        </g>
      ))}
      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Risk (volatility) → · return on the vertical axis
      </text>
    </svg>
  );
}
