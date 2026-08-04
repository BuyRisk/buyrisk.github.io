import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import { assetStats } from "../data/generated/asset-stats";
import { historicalReturns } from "../data/generated/historical-returns";
import { globalEquity } from "../data/generated/global-equity";
import { mulberry32, makeNormal } from "../lib/portfolio";

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

// Broad, diversified equity by region (Ken French, since 1990) — all
// CAPM-consistent, yet realized returns over this window show US exceptionalism.
const REGIONS = [
  { key: "us", label: "US", mu: globalEquity.assets.us.mu, sigma: globalEquity.assets.us.sigma, color: "var(--pl-c1)" },
  { key: "dev", label: "Developed ex-US", mu: globalEquity.assets.devExUs.mu, sigma: globalEquity.assets.devExUs.sigma, color: "var(--color-link)" },
  { key: "em", label: "Emerging", mu: globalEquity.assets.emerging.mu, sigma: globalEquity.assets.emerging.sigma, color: "var(--color-warn)" },
];
const MAX_REG_MU = Math.max(...REGIONS.map((r) => r.mu));
const G_SPAN = `${globalEquity.span[0].slice(0, 4)}–${globalEquity.span[1].slice(0, 4)}`;

// Growth of $1 compounded by each year's nominal return, for stocks / 10-yr
// Treasuries / T-bills, plus inflation as a "just to keep up" reference. Same
// risk-return lesson as the scatter, played out over a century: the squiggliest
// line (stocks) is also the one that climbs the highest.
type GrowthRow = { year: number; stocks: number; bonds: number; bills: number; infl: number };
const GROWTH: GrowthRow[] = (() => {
  let s = 1, b = 1, t = 1, i = 1;
  const rows: GrowthRow[] = [{ year: historicalReturns.series[0].year - 1, stocks: 1, bonds: 1, bills: 1, infl: 1 }];
  for (const y of historicalReturns.series) {
    s *= 1 + y.stocks; b *= 1 + y.tbonds; t *= 1 + y.tbills; i *= 1 + y.inflation;
    rows.push({ year: y.year, stocks: s, bonds: b, bills: t, infl: i });
  }
  return rows;
})();
const growthMoney = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${v.toFixed(0)}`);

// The three CAPM-consistent, diversified asset classes we grow over time.
type AssetKey = "stocks" | "bonds" | "bills";
const RR_ASSETS: { key: AssetKey; statKey: string; retKey: "stocks" | "tbonds" | "tbills"; label: string; color: string }[] = [
  { key: "stocks", statKey: "us-stocks", retKey: "stocks", label: "US stocks", color: "var(--pl-c1)" },
  { key: "bonds", statKey: "treasuries", retKey: "tbonds", label: "Treasury bonds", color: "var(--color-link)" },
  { key: "bills", statKey: "tbills", retKey: "tbills", label: "T-bills (cash)", color: "var(--color-muted)" },
];
const NYEARS = GROWTH.length - 1;
const INFL_REF = GROWTH.map((r) => r.infl); // real cumulative inflation, the "bar to beat"

// "Simplified": one hypothetical path per asset drawn at that asset's real
// long-run volatility (a static-vol random walk). Same idea as the scatter —
// higher volatility means a wilder squiggle — but a clean model, not real history.
const SIMPLE_PATHS: Record<AssetKey, number[]> = (() => {
  const rng = mulberry32(20260804);
  const norm = makeNormal(rng);
  const last = GROWTH[GROWTH.length - 1];
  const out = { stocks: [1], bonds: [1], bills: [1] } as Record<AssetKey, number[]>;
  for (const a of RR_ASSETS) {
    const sigma = assetStats.assets[a.statKey].sigma;
    // De-mean the noise and set the drift so the path both wiggles by σ AND
    // lands on the real historical endpoint (so stocks still finish highest).
    const target = last[a.key];
    const z = Array.from({ length: NYEARS }, () => norm());
    const zbar = z.reduce((s, x) => s + x, 0) / NYEARS;
    const muLog = Math.log(target) / NYEARS;
    let cum = 0;
    for (let t = 0; t < NYEARS; t++) { cum += muLog + sigma * (z[t] - zbar); out[a.key].push(Math.exp(cum)); }
  }
  return out;
})();

// "Historical": a block-bootstrap Monte Carlo of the REAL annual returns. Every
// path draws one shared 5-year-block timeline (so the assets co-move within an
// alternate history), giving each asset a cloud of paths plus a bold median.
const MC_PATHS = 24, MC_BLOCK = 5;
const MC: { paths: Record<AssetKey, number[][]>; medians: Record<AssetKey, number[]> } = (() => {
  const rng = mulberry32(13572468);
  const R = historicalReturns.series, N = R.length;
  const paths: Record<AssetKey, number[][]> = { stocks: [], bonds: [], bills: [] };
  for (let p = 0; p < MC_PATHS; p++) {
    const idx: number[] = [];
    let i = 0;
    while (i < NYEARS) { const start = (rng() * N) | 0; for (let b = 0; b < MC_BLOCK && i < NYEARS; b++, i++) idx.push((start + b) % N); }
    let s = 1, bd = 1, bl = 1;
    const sA = [1], bA = [1], lA = [1];
    for (const j of idx) { s *= 1 + R[j].stocks; bd *= 1 + R[j].tbonds; bl *= 1 + R[j].tbills; sA.push(s); bA.push(bd); lA.push(bl); }
    paths.stocks.push(sA); paths.bonds.push(bA); paths.bills.push(lA);
  }
  const median = (arrs: number[][]) => {
    const T = arrs[0].length, med = new Array<number>(T), col = new Array<number>(arrs.length);
    for (let t = 0; t < T; t++) { for (let k = 0; k < arrs.length; k++) col[k] = arrs[k][t]; col.sort((a, b) => a - b); med[t] = col[col.length >> 1]; }
    return med;
  };
  return { paths, medians: { stocks: median(paths.stocks), bonds: median(paths.bonds), bills: median(paths.bills) } };
})();

export default function RiskReturnLab() {
  const [risk, setRisk] = useState(0.194); // chosen volatility (default ≈ US stocks)
  const [showParadox, setShowParadox] = useState(true);
  const [growthMode, setGrowthMode] = useState<"simplified" | "historical">("simplified");

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
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
            <h3 style={{ margin: 0 }}>Watch it play out: the growth of $1 over a lifetime</h3>
            <div className="wl-simmode" role="group" aria-label="Growth view">
              <button type="button" className={growthMode === "simplified" ? "active" : ""} aria-pressed={growthMode === "simplified"} onClick={() => setGrowthMode("simplified")}>Simplified</button>
              <button type="button" className={growthMode === "historical" ? "active" : ""} aria-pressed={growthMode === "historical"} onClick={() => setGrowthMode("historical")}>Historical</button>
            </div>
          </div>
          <GrowthOverTimeChart mode={growthMode} />
          <div className="wl-flegend">
            <span><span className="wl-fdot" style={{ background: "var(--pl-c1)" }} /> US stocks</span>
            <span><span className="wl-fdot" style={{ background: "var(--color-link)" }} /> Treasury bonds</span>
            <span><span className="wl-fdot" style={{ background: "var(--color-muted)" }} /> T-bills (cash)</span>
            <span><span className="wl-fdot" style={{ background: "var(--color-warn)", opacity: 0.7 }} /> Inflation</span>
          </div>
          <p className="wl-fnote">
            {growthMode === "simplified" ? (
              <>Each line is <strong>one</strong> hypothetical path drawn at that asset's real long-run volatility — the
              higher the volatility, the wilder the squiggle. Stocks lurch around and pull far ahead; cash barely moves,
              and barely grows. Flip to <strong>Historical</strong> to swap this model for real-return Monte Carlo.</>
            ) : (
              <>Each faint line is <strong>one alternate history</strong>, stitched from real US return blocks; the bold
              line is each asset's <strong>median</strong>. The stock cloud is vast — huge upside, but real runs that
              disappoint — while cash barely spreads. More volatility means more uncertainty, and a higher typical
              destination.</>
            )}{" "}
            Log scale (every gridline is 10×), nominal dollars; the dashed line is inflation — what $1 needed to keep its
            purchasing power.
          </p>
          <div className="rr-paradox">
            <strong>The catch: this only holds when you're diversified.</strong> These lines are broad, whole-market
            indices, and CAPM only pays you for the <em>market</em> risk you can't diversify away. Hold a single,
            undiversified stock and you take on a pile of extra risk that earns nothing on average — most individual stocks
            have historically trailed even T-bills, with a handful of winners carrying the whole market. This describes the
            <em> basket</em>, not the ticket. (See <a href="/tools/stock-picking">Stock-Picking</a>.)
          </div>
        </div>

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

            <div className="rr-regions">
              <p className="wl-diversify-title" style={{ marginBottom: "var(--space-sm)" }}>
                One level up: which region wins is anyone's guess
              </p>
              {REGIONS.map((r) => (
                <div className="wl-bar" key={r.key}>
                  <span className="wl-bar-label">{r.label} <span style={{ color: "var(--color-muted)" }}>· {pct(r.sigma, 0)} vol</span></span>
                  <span className="wl-bar-value">{pct(r.mu, 1)}/yr</span>
                  <div className="wl-bar-track"><div className="wl-bar-fill" style={{ width: `${(r.mu / MAX_REG_MU) * 100}%`, background: r.color }} /></div>
                </div>
              ))}
              <p className="wl-saved" style={{ marginTop: "var(--space-sm)" }}>
                All three are broad, diversified, <strong>CAPM-consistent</strong> equity — bearing market risk they should
                be paid for. Yet since {G_SPAN} the <strong>US delivered the most return at the least risk</strong> ("US
                exceptionalism"), while developed international <em>lagged</em> despite higher volatility. Realized returns
                over any one window drift from the clean line, and leadership rotates: the US led the 2010s, international
                the 2000s, Japan was once a third of the world. You can't call the next winner — which is the whole case
                for owning them all in proportion. <a href="/tools/home-bias">See Home Bias →</a>
              </p>
              <p className="wl-note" style={{ marginTop: "0.4rem" }}>
                Realized nominal annual return &amp; volatility of each region's broad market, {G_SPAN}. Data: Ken French
                Data Library.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GrowthOverTimeChart({ mode }: { mode: "simplified" | "historical" }) {
  const width = 760, height = 400;
  const pad = { top: 20, right: 72, bottom: 40, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  // Fixed log axis (stable across the toggle); x is years elapsed, 0..NYEARS.
  const loLog = Math.log10(0.4), hiLog = Math.log10(300_000);
  const x = (t: number) => pad.left + (t / NYEARS) * plotW;
  const y = (v: number) => pad.top + plotH - ((Math.log10(Math.max(v, 0.3)) - loLog) / (hiLog - loLog)) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;
  const pathOf = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const decades: number[] = [];
  for (let p = Math.ceil(loLog); p <= Math.floor(hiLog); p++) decades.push(10 ** p);
  const xTicks = [0, 20, 40, 60, 80].filter((t) => t <= NYEARS);

  // End labels (single path in Simplified; the median in Historical), spaced apart.
  const ends = RR_ASSETS.map((a) => ({ color: a.color, v: mode === "simplified" ? SIMPLE_PATHS[a.key][NYEARS] : MC.medians[a.key][NYEARS] }));
  const endYs = ends.map((e) => y(e.v));
  const adjY = [...endYs];
  const order = ends.map((_, i) => i).sort((a, b) => endYs[a] - endYs[b]);
  for (let k = 1; k < order.length; k++) {
    const prev = order[k - 1], cur = order[k];
    if (adjY[cur] - adjY[prev] < 13) adjY[cur] = adjY[prev] + 13;
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Growth of one dollar over time: stocks, bonds, bills and inflation on a log scale">
      {decades.map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{growthMoney(v)}</text>
        </g>
      ))}
      {xTicks.map((t) => (
        <text key={t} x={x(t)} y={height - pad.bottom + 18} textAnchor="middle" style={axisText}>{t === 0 ? "start" : `yr ${t}`}</text>
      ))}
      {/* inflation reference (dashed) */}
      <path d={pathOf(INFL_REF)} fill="none" stroke="var(--color-warn)" strokeWidth={1.6} strokeDasharray="5 4" opacity={0.7} />
      {mode === "simplified"
        ? RR_ASSETS.map((a) => (
            <path key={a.key} d={pathOf(SIMPLE_PATHS[a.key])} fill="none" stroke={a.color} strokeWidth={a.key === "stocks" ? 2.2 : 1.8} strokeLinejoin="round" />
          ))
        : (
          <>
            {RR_ASSETS.flatMap((a) =>
              MC.paths[a.key].map((p, pi) => (
                <path key={`${a.key}-${pi}`} d={pathOf(p)} fill="none" stroke={a.color} strokeWidth={0.7} opacity={0.12} />
              )),
            )}
            {RR_ASSETS.map((a) => (
              <path key={`med-${a.key}`} d={pathOf(MC.medians[a.key])} fill="none" stroke={a.color} strokeWidth={2.6} strokeLinejoin="round" />
            ))}
          </>
        )}
      {ends.map((e, i) => (
        <text key={`end-${i}`} x={x(NYEARS) + 6} y={adjY[i] + 4} style={{ ...axisText, fill: e.color, fontWeight: 700, fontSize: 11 }}>{growthMoney(e.v)}</text>
      ))}
      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Years invested → · growth of $1 (log scale, nominal)
      </text>
    </svg>
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
