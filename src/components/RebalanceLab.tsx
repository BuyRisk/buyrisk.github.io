import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { mulberry32 } from "../lib/portfolio";
import { historicalReturns } from "../data/generated/historical-returns";

/**
 * "Rebalancing: Discipline vs. Drift" — how the rule you use to rebalance a
 * stock/bond portfolio changes its risk and return.
 *
 * Three strategies race over the same simulated histories:
 *  • Never  — buy once, let it drift. Stocks out-grow bonds, so the mix creeps
 *    toward all-stock and the risk creeps up with it.
 *  • Annual — snap back to the target mix once a year.
 *  • Threshold — only trade when the stock weight drifts more than a band off
 *    target, so it acts less often for similar control.
 *
 * The teaching point is the one most people get backwards: rebalancing is a
 * RISK-control tool, not a return-booster. Letting stocks run usually earns a
 * bit MORE (you end up holding more of the higher-returning asset) but at the
 * cost of a portfolio far riskier than the one you signed up for.
 *
 * Returns are REAL (inflation-adjusted) annual US stock and 10-yr Treasury
 * returns, 1928–present (Damodaran), reshuffled by a circular block bootstrap
 * so each path keeps history's runs of good and bad years. Educational only.
 */

const SERIES = historicalReturns.series;
const REAL = SERIES.map((y) => ({
  s: (1 + y.stocks) / (1 + y.inflation) - 1,
  b: (1 + y.tbonds) / (1 + y.inflation) - 1,
}));
const NYEARS = REAL.length;
const PATHS = 1500;
const BLOCK = 5;

type Strat = "never" | "annual" | "threshold";
const STRATS: { key: Strat; label: string; color: string }[] = [
  { key: "never", label: "Never rebalance", color: "var(--color-muted)" },
  { key: "annual", label: "Annually", color: "var(--color-accent)" },
  { key: "threshold", label: "Threshold band", color: "var(--color-link)" },
];

type Result = { ret: number; vol: number; maxDD: number; endStock: number; trades: number };
type PathWeights = Record<Strat, number[]>;

/** Simulate one path of yearly returns under one strategy; track weight + value. */
function runStrategy(rets: { s: number; b: number }[], target: number, band: number, strat: Strat) {
  let vs = target, vb = 1 - target; // start at target on $1
  const weights: number[] = [target];
  const yearly: number[] = [];
  let peak = 1, maxDD = 0, trades = 0;
  for (const r of rets) {
    vs *= 1 + r.s;
    vb *= 1 + r.b;
    let tot = vs + vb;
    // apply the rebalancing rule at year end
    if (strat === "annual") {
      vs = tot * target; vb = tot * (1 - target); trades++;
    } else if (strat === "threshold") {
      if (Math.abs(vs / tot - target) > band) { vs = tot * target; vb = tot * (1 - target); trades++; }
    }
    tot = vs + vb;
    yearly.push(r.s * (vs / tot) + r.b * (vb / tot)); // approx realized weight-return (post-trade weights)
    peak = Math.max(peak, tot);
    maxDD = Math.max(maxDD, 1 - tot / peak);
    weights.push(vs / tot);
  }
  const endVal = vs + vb;
  const years = rets.length;
  const ret = endVal ** (1 / years) - 1;
  const mean = yearly.reduce((a, x) => a + x, 0) / years;
  const vol = Math.sqrt(yearly.reduce((a, x) => a + (x - mean) ** 2, 0) / years);
  return { res: { ret, vol, maxDD, endStock: vs / endVal, trades } as Result, weights };
}

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export default function RebalanceLab() {
  const [target, setTarget] = useState(60); // % stocks
  const [horizon, setHorizon] = useState(30);
  const [band, setBand] = useState(5); // percentage points
  const [seed, setSeed] = useState(1);
  const [sel, setSel] = useState<Strat>("annual");

  const sim = useMemo(() => {
    const t = target / 100;
    const bnd = band / 100;
    const rng = mulberry32(seed * 2654435761);
    // pre-draw block-bootstrap index paths, shared across strategies for a fair race
    const results: Record<Strat, Result[]> = { never: [], annual: [], threshold: [] };
    let samplePath: PathWeights = { never: [], annual: [], threshold: [] };
    for (let p = 0; p < PATHS; p++) {
      const rets: { s: number; b: number }[] = [];
      let i = 0;
      while (i < horizon) {
        const start = (rng() * NYEARS) | 0;
        for (let b2 = 0; b2 < BLOCK && i < horizon; b2++, i++) rets.push(REAL[(start + b2) % NYEARS]);
      }
      for (const st of STRATS) {
        const { res, weights } = runStrategy(rets, t, bnd, st.key);
        results[st.key].push(res);
        if (p === 0) samplePath[st.key] = weights; // first path = the illustrative history
      }
    }
    const agg = (k: Strat): Result => ({
      ret: median(results[k].map((r) => r.ret)),
      vol: median(results[k].map((r) => r.vol)),
      maxDD: median(results[k].map((r) => r.maxDD)),
      endStock: median(results[k].map((r) => r.endStock)),
      trades: median(results[k].map((r) => r.trades)),
    });
    return { table: { never: agg("never"), annual: agg("annual"), threshold: agg("threshold") }, samplePath };
  }, [target, horizon, band, seed]);

  const reset = () => { setTarget(60); setHorizon(30); setBand(5); setSeed(1); setSel("annual"); };
  const pct = (x: number, dp = 1) => `${(x * 100).toFixed(dp)}%`;
  const t = target / 100;

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={reset} />

        <label className="wl-slider">
          <span>
            Target stock / bond mix
            <InfoTip text="Your intended split between stocks and bonds. Rebalancing pulls the portfolio back toward this mix; 'never' lets it drift away." />{" "}
            <strong>{target} / {100 - target}</strong>
          </span>
          <input type="range" min={10} max={90} step={5} value={target} onChange={(e) => setTarget(+e.target.value)} />
        </label>

        <label className="wl-slider">
          <span>
            Horizon
            <InfoTip text="How many years the portfolio runs. The longer the horizon, the more an un-rebalanced portfolio drifts toward all-stock." />{" "}
            <strong>{horizon} years</strong>
          </span>
          <input type="range" min={5} max={50} step={1} value={horizon} onChange={(e) => setHorizon(+e.target.value)} />
        </label>

        <label className="wl-slider">
          <span>
            Threshold band
            <InfoTip text="How far the stock weight may drift from target before the threshold strategy trades. A ±5 point band on a 60% target rebalances only outside 55–65%." />{" "}
            <strong>±{band} pts</strong>
          </span>
          <input type="range" min={1} max={20} step={1} value={band} onChange={(e) => setBand(+e.target.value)} />
        </label>

        <button type="button" className="wl-btn" style={{ width: "100%" }} onClick={() => setSeed((s) => s + 1)}>
          ↻ New simulated history
        </button>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">Never rebalancing drifts a {target}% stock start to a median</span>
          <span className="ss-headline-value">{Math.round(sim.table.never.endStock * 100)}% stock</span>
          <span className="ss-headline-sub">
            after {horizon} years — riskier than you signed up for. Rebalancing holds it near <strong>{target}%</strong>.
          </span>
        </div>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          <strong>Method:</strong> {PATHS.toLocaleString()} Monte-Carlo histories, each a circular block bootstrap
          (5-year blocks) of real US stock and 10-yr Treasury returns, {historicalReturns.span[0]}–{historicalReturns.span[1]}.
          Figures are medians across paths. No trading costs or taxes modelled. Educational only, not advice.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>How the stock weight drifts (one simulated history)</h3>
          <DriftChart sample={sim.samplePath} target={t} sel={sel} />
          <div className="wl-flegend">
            {STRATS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSel(s.key)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, opacity: sel === s.key ? 1 : 0.6, fontWeight: sel === s.key ? 700 : 400 }}
                aria-pressed={sel === s.key}
              >
                <span className="wl-fdot" style={{ background: s.color }} /> {s.label}
              </button>
            ))}
          </div>
          <p className="wl-fnote">
            Same market history, three rules. The un-rebalanced line climbs as stocks out-grow bonds — so its risk quietly
            rises. The rebalanced lines hug the target: annually snaps back every year; the threshold line only jumps when
            it strays past the ±{band}-point band.
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout" style={{ gridColumn: "1 / -1" }}>
            <div style={{ overflowX: "auto" }}>
            <table className="mmm-table">
              <thead>
                <tr>
                  <th>Strategy</th>
                  <th>Real return</th>
                  <th>Volatility</th>
                  <th>Worst drop</th>
                  <th>Ends at</th>
                  <th>Trades</th>
                </tr>
              </thead>
              <tbody>
                {STRATS.map((s) => {
                  const r = sim.table[s.key];
                  return (
                    <tr key={s.key} className={sel === s.key ? "mmm-row--active" : ""} onClick={() => setSel(s.key)} style={{ cursor: "pointer" }}>
                      <td style={{ textAlign: "left" }}>{s.label}</td>
                      <td>{pct(r.ret, 1)}</td>
                      <td>{pct(r.vol, 1)}</td>
                      <td>−{pct(r.maxDD, 0)}</td>
                      <td>{Math.round(r.endStock * 100)}% stk</td>
                      <td>{Math.round(r.trades)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            <p className="wl-saved">
              Notice the trade-off: <strong>never</strong> rebalancing often shows the highest return — but only because it
              quietly became a mostly-stock portfolio, and its volatility and worst drop rise to match.{" "}
              <strong>Annual</strong> and <strong>threshold</strong> give up a sliver of return to keep the risk near what you actually chose, and
              the threshold rule gets there with far fewer trades. Rebalancing buys discipline, not extra return.
              Educational only, not advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DriftChart({ sample, target, sel }: { sample: Record<Strat, number[]>; target: number; sel: Strat }) {
  const width = 760, height = 380;
  const pad = { top: 20, right: 18, bottom: 40, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const steps = sample.never.length;
  const all = [...sample.never, ...sample.annual, ...sample.threshold];
  const yMax = Math.min(1, Math.max(...all) + 0.06);
  const yMin = Math.max(0, Math.min(...all) - 0.06);
  const x = (i: number) => pad.left + (i / (steps - 1)) * plotW;
  const y = (v: number) => pad.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;
  const line = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ticks = 4;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Stock weight over time by rebalancing strategy">
      {Array.from({ length: ticks + 1 }, (_, k) => yMin + ((yMax - yMin) * k) / ticks).map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{Math.round(v * 100)}%</text>
        </g>
      ))}
      {/* target line */}
      <line x1={pad.left} x2={width - pad.right} y1={y(target)} y2={y(target)} stroke="var(--color-accent)" strokeDasharray="2 4" opacity={0.55} />
      <text x={width - pad.right} y={y(target) - 6} textAnchor="end" style={{ ...axisText, fill: "var(--color-accent)", fontWeight: 700 }}>target {Math.round(target * 100)}%</text>
      {STRATS.map((s) => (
        <path key={s.key} d={line(sample[s.key])} fill="none" stroke={s.color} strokeWidth={sel === s.key ? 3 : 1.8} opacity={sel === s.key ? 1 : 0.45} strokeLinejoin="round" />
      ))}
      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Years → · share of the portfolio in stocks
      </text>
    </svg>
  );
}
