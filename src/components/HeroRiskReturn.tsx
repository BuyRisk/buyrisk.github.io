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
/**
 * Labels are spelled out — "Bonds" vs "Corporate" left it unclear that the
 * first meant Treasuries. `place` keeps the crowded low-volatility cluster
 * legible: those three sit within a few pixels horizontally, so their labels
 * go to the RIGHT of each dot (they separate vertically instead), while the
 * two right-hand dots label above.
 */
const DOTS = [
  { label: "Cash (T-bills)", ...A["tbills"], place: "right" },
  { label: "Treasury bonds", ...A["treasuries"], place: "right" },
  { label: "Corporate bonds", ...A["corporate-bonds"], place: "right" },
  { label: "US stocks", ...A["us-stocks"], place: "above" },
  { label: "Small-cap value", ...A["small-cap-value"], place: "above" },
] as const;

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

const LO = 0.03, HI = 0.38; // spans cash → small-cap value, the real ladder
const pct = (x: number, dp = 0) => `${(x * 100).toFixed(dp)}%`;
const SPAN = `${assetStats.span[0]}–${assetStats.span[1]}`;

export default function HeroRiskReturn() {
  const [risk, setRisk] = useState(0.15);
  const expected = FIT.a + FIT.b * risk;

  const W = 620, H = 300;
  const pad = { top: 20, right: 20, bottom: 42, left: 62 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  // Must clear small-cap value (38% vol, 17.8% return) or it lands off-canvas.
  const xMax = 0.44, yMax = 0.20;
  const x = (v: number) => pad.left + (v / xMax) * plotW;
  const y = (v: number) => pad.top + plotH - (v / yMax) * plotH;

  return (
    <div className="hrr">
      <svg viewBox={`0 0 ${W} ${H}`} className="hrr-chart" role="img"
        aria-label="Real US asset classes plotted by risk and return: higher volatility has come with higher return.">
        {[0, 0.04, 0.08, 0.12, 0.16, 0.2].map((v) => (
          <g key={v}>
            <line x1={pad.left} x2={W - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" />
            <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{pct(v)}</text>
          </g>
        ))}
        {/* y-axis title, rotated up the left edge */}
        <text
          transform={`rotate(-90 14 ${pad.top + plotH / 2}) translate(14 ${pad.top + plotH / 2})`}
          textAnchor="middle"
          style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)" }}
        >
          Average annual return
        </text>
        {/* the risk/return line the dots sit on */}
        <line x1={x(LO)} y1={y(FIT.a + FIT.b * LO)} x2={x(HI)} y2={y(FIT.a + FIT.b * HI)}
          stroke="var(--color-text-soft)" strokeWidth={1.5} strokeDasharray="5 4" />
        {DOTS.map((d) => {
          const right = d.place === "right";
          return (
            <g key={d.label}>
              <circle cx={x(d.sigma)} cy={y(d.mu)} r={5.5} fill="var(--color-accent)" />
              <text
                x={x(d.sigma) + (right ? 10 : 0)}
                y={y(d.mu) + (right ? 4 : -12)}
                textAnchor={right ? "start" : "middle"}
                style={{ ...axisText, fill: "var(--color-text-soft)", fontWeight: 600 }}
              >
                {d.label}
              </text>
            </g>
          );
        })}
        {/* the reader's chosen risk level */}
        <line x1={x(risk)} x2={x(risk)} y1={pad.top} y2={pad.top + plotH}
          stroke="var(--color-warn)" strokeWidth={1.4} strokeDasharray="3 3" />
        <circle cx={x(risk)} cy={y(expected)} r={8} fill="none" stroke="var(--color-warn)" strokeWidth={2.5} />
        <text x={pad.left + plotW / 2} y={H - 8} textAnchor="middle"
          style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)" }}>
          “Risk” (volatility — how much it bounced around) →
        </text>
      </svg>

      <div className="hrr-controls">
        <label className="hrr-slider">
          <span>How much volatility can you take? <strong>{pct(risk)}</strong></span>
          <input type="range" min={LO} max={HI} step={0.005} value={risk}
            aria-label="Risk level" onChange={(e) => setRisk(+e.target.value)} />
        </label>
        <p className="hrr-readout">
          History paid about <strong>{pct(expected, 1)}/yr</strong> for that much risk.
        </p>
        <p className="hrr-note">
          Real US asset classes, {SPAN}. Volatility is the <strong>standard
          deviation</strong> of annual returns; return is their average. That
          upward slope is the whole idea: returns are compensation for bearing
          risk. <a href="/tools/factors">Open the full tool →</a>
        </p>
      </div>
    </div>
  );
}
