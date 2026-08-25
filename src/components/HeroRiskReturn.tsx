import { useState } from "react";
import { assetStats } from "../data/generated/asset-stats";
import { axisText } from "../lib/chart";

/**
 * The homepage's five-second demo: the site's entire thesis in one control.
 * Drag a risk level and read what a century of US markets actually paid for
 * bearing it — each dot a real asset class, the line the trade they sit on.
 *
 * A deliberately compact preview, not a lab: one slider, no tabs, no method
 * panel. It exists so a first-time visitor understands what this site *is*
 * before navigating anywhere, and it links straight to the full tool.
 * Same Damodaran data (and the same ladder fit) as RiskReturnLab.
 */

const A = assetStats.assets;
const DOTS = [
  { label: "Cash", ...A["tbills"] },
  { label: "Bonds", ...A["treasuries"] },
  { label: "Corporate", ...A["corporate-bonds"] },
  { label: "Stocks", ...A["us-stocks"] },
  { label: "Small value", ...A["small-cap-value"] },
];

/** OLS of return on volatility across the risk ladder. */
const FIT = (() => {
  const n = DOTS.length;
  const mx = DOTS.reduce((s, p) => s + p.sigma, 0) / n;
  const my = DOTS.reduce((s, p) => s + p.mu, 0) / n;
  let cov = 0, varx = 0;
  for (const p of DOTS) { cov += (p.sigma - mx) * (p.mu - my); varx += (p.sigma - mx) ** 2; }
  const b = cov / varx;
  return { a: my - b * mx, b };
})();

const LO = 0.03, HI = 0.32;
const pct = (x: number, dp = 0) => `${(x * 100).toFixed(dp)}%`;
const SPAN = `${assetStats.span[0]}–${assetStats.span[1]}`;

export default function HeroRiskReturn() {
  const [risk, setRisk] = useState(0.15);
  const expected = FIT.a + FIT.b * risk;

  const W = 620, H = 300;
  const pad = { top: 16, right: 18, bottom: 40, left: 46 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const xMax = 0.36, yMax = 0.16;
  const x = (v: number) => pad.left + (v / xMax) * plotW;
  const y = (v: number) => pad.top + plotH - (v / yMax) * plotH;

  return (
    <div className="hrr">
      <svg viewBox={`0 0 ${W} ${H}`} className="hrr-chart" role="img"
        aria-label="Real US asset classes plotted by risk and return: higher volatility has come with higher return.">
        {[0, 0.04, 0.08, 0.12, 0.16].map((v) => (
          <g key={v}>
            <line x1={pad.left} x2={W - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" />
            <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{pct(v)}</text>
          </g>
        ))}
        {/* the risk/return line the dots sit on */}
        <line x1={x(LO)} y1={y(FIT.a + FIT.b * LO)} x2={x(HI)} y2={y(FIT.a + FIT.b * HI)}
          stroke="var(--color-text-soft)" strokeWidth={1.5} strokeDasharray="5 4" />
        {DOTS.map((d) => (
          <g key={d.label}>
            <circle cx={x(d.sigma)} cy={y(d.mu)} r={5.5} fill="var(--color-accent)" />
            <text x={x(d.sigma)} y={y(d.mu) - 11} textAnchor="middle"
              style={{ ...axisText, fill: "var(--color-text-soft)", fontWeight: 600 }}>{d.label}</text>
          </g>
        ))}
        {/* the reader's chosen risk level */}
        <line x1={x(risk)} x2={x(risk)} y1={pad.top} y2={pad.top + plotH}
          stroke="var(--color-warn)" strokeWidth={1.4} strokeDasharray="3 3" />
        <circle cx={x(risk)} cy={y(expected)} r={8} fill="none" stroke="var(--color-warn)" strokeWidth={2.5} />
        <text x={pad.left + plotW / 2} y={H - 8} textAnchor="middle"
          style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)" }}>
          Risk (how much it bounced around) →
        </text>
      </svg>

      <div className="hrr-controls">
        <label className="hrr-slider">
          <span>How much risk can you take? <strong>{pct(risk)}</strong></span>
          <input type="range" min={LO} max={HI} step={0.005} value={risk}
            aria-label="Risk level" onChange={(e) => setRisk(+e.target.value)} />
        </label>
        <p className="hrr-readout">
          History paid about <strong>{pct(expected, 1)}/yr</strong> for that much risk.
        </p>
        <p className="hrr-note">
          Real US asset classes, {SPAN}. That upward slope is the whole idea:
          returns are compensation for bearing risk.{" "}
          <a href="/tools/factors">Open the full tool →</a>
        </p>
      </div>
    </div>
  );
}
