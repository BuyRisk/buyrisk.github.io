import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { formatMoney, useCurrencyCode } from "../lib/currency";
import { NOMINAL_TIP } from "../lib/returnBasis";

/**
 * "What's a fair price?" — a two-stage discounted-cash-flow valuation with the
 * knobs exposed. The lesson is NOT how to do a DCF; it's how violently the
 * "right" price swings when the assumptions move a hair. A one-point change
 * in growth or the discount rate — differences well inside honest experts'
 * disagreement — moves fair value by double digits.
 *
 * That's why prices jump on small news, why two careful analysts can be 2×
 * apart, and why "the market is wrong about this stock" is such an expensive
 * sentence: it means your fog is thinner than everyone else's fog.
 *
 * Model: cash flow next year, growing at g for 10 years, then at g∞ forever
 * (Gordon terminal value), all discounted at r. Deliberately the standard
 * textbook setup — the fragility is in the arithmetic, not the model choice.
 */

const currency = (n: number) => formatMoney(n);

/** Two-stage DCF per share: 10 years at g, terminal Gordon growth at gT, discount r. */
function fairValue(cf1: number, g: number, gT: number, r: number): number {
  if (r <= gT + 0.0001) return Infinity; // Gordon blows up as r → g∞
  let pv = 0;
  let cf = cf1;
  for (let t = 1; t <= 10; t++) {
    pv += cf / Math.pow(1 + r, t);
    cf *= 1 + g;
  }
  // cf is now CF year 11 ÷ (1+g)... after the loop cf = CF_11; terminal at end of year 10.
  const terminal = cf * (1 + gT) / (1 + g) / (r - gT);
  return pv + (terminal / Math.pow(1 + r, 10));
}

/** Growth the market price implies at discount rate r (bisection on g). */
function impliedGrowth(cf1: number, gT: number, r: number, price: number): number | null {
  let lo = -0.5, hi = 0.6;
  if (fairValue(cf1, lo, gT, r) > price || fairValue(cf1, hi, gT, r) < price) return null;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (fairValue(cf1, mid, gT, r) < price) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export default function FairPriceLab() {
  useCurrencyCode();
  const [cf1, setCf1] = useState(5);
  const [g, setG] = useState(8); // % growth, years 1–10
  const [gT, setGT] = useState(2.5); // % terminal growth
  const [r, setR] = useState(9); // % discount rate
  const [price, setPrice] = useState(100);

  const view = useMemo(() => {
    const fv = fairValue(cf1, g / 100, gT / 100, r / 100);
    const bumpG = fairValue(cf1, (g + 1) / 100, gT / 100, r / 100);
    const cutR = fairValue(cf1, g / 100, gT / 100, (r - 1) / 100);
    const implied = impliedGrowth(cf1, gT / 100, r / 100, price);
    // Sensitivity grid: growth (rows) × discount rate (cols), ±2pp around you.
    const gs = [-2, -1, 0, 1, 2].map((d) => g + d);
    const rs = [-2, -1, 0, 1, 2].map((d) => r + d);
    const grid = gs.map((gg) => rs.map((rr) => fairValue(cf1, gg / 100, gT / 100, rr / 100)));
    return { fv, bumpG, cutR, implied, gs, rs, grid };
  }, [cf1, g, gT, r, price]);

  const swingG = view.bumpG / view.fv - 1;
  const swingR = view.cutR / view.fv - 1;

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={() => { setCf1(5); setG(8); setGT(2.5); setR(9); setPrice(100); }} />

        <p className="br-group">Your assumptions about the business</p>
        <label className="wl-slider">
          <span>
            Cash flow per share, next year
            <InfoTip text="What the business hands its owners per share next year — free cash flow or dividends plus buybacks. The one input you can half-see; everything else is a guess about the future." />{" "}
            <strong>{currency(cf1)}</strong>
          </span>
          <input type="range" min={1} max={20} step={0.5} value={cf1} onChange={(e) => setCf1(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>
            Growth, next 10 years
            <InfoTip text="Annual cash-flow growth for the next decade. Honest experts routinely disagree by several points on this number for the same company." />{" "}
            <strong>{g}%/yr</strong>
          </span>
          <input type="range" min={-5} max={25} step={0.5} value={g} onChange={(e) => setG(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>
            Growth forever after
            <InfoTip text="The terminal growth rate — usually pinned near long-run GDP growth. Small number, huge lever: most of a growth stock's value sits in the terminal years." />{" "}
            <strong>{gT}%/yr</strong>
          </span>
          <input type="range" min={0} max={4} step={0.25} value={gT} onChange={(e) => setGT(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>
            Discount rate (nominal)
            <InfoTip text={`The return you demand for bearing this risk — buy risk, get paid. Riskier cash flows deserve a higher rate, which means a lower price today. ${NOMINAL_TIP} Discount nominal cash flows at a nominal rate; the growth rates above are nominal too.`} />{" "}
            <strong>{r}%</strong>
          </span>
          <input type="range" min={5} max={15} step={0.25} value={r} onChange={(e) => setR(+e.target.value)} />
        </label>

        <p className="br-group">What the market says</p>
        <label className="wl-slider">
          <span>
            Market price
            <InfoTip text="Flip the question: at your discount rate, what 10-year growth does this price imply? Valuation in reverse is often more honest than valuation forward." />{" "}
            <strong>{currency(price)}</strong>
          </span>
          <input type="range" min={20} max={400} step={5} value={price} onChange={(e) => setPrice(+e.target.value)} />
        </label>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">Your assumptions say a fair price is</span>
          <span className="ss-headline-value">{Number.isFinite(view.fv) ? currency(view.fv) : "∞"}</span>
          <span className="ss-headline-sub">
            Nudge growth up one point: {currency(view.bumpG)} ({swingG >= 0 ? "+" : ""}{(swingG * 100).toFixed(0)}%).
            Trim the discount rate one point: {currency(view.cutR)} ({swingR >= 0 ? "+" : ""}{(swingR * 100).toFixed(0)}%).
            One-point nudges, double-digit swings — that's the whole lesson.
          </span>
        </div>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          A textbook two-stage DCF, deliberately plain: real analysts add stages and scenarios, but
          more moving parts means <em>more</em> assumptions, not fewer. Educational only, not
          advice — and certainly not a way to price actual stocks.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>The same company, 25 defensible opinions</h3>
          <SensitivityGrid gs={view.gs} rs={view.rs} grid={view.grid} centerPrice={view.fv} marketPrice={price} />
          <p className="wl-fnote">
            Every cell is the SAME business — only growth (rows) and the discount rate (columns) move,
            each within ±2 points, a range easily inside honest disagreement. Green cells sit above the
            market price ({currency(price)}), red below: reasonable people holding this table both buy
            and sell to each other all day. When a small surprise shifts everyone's central guess one
            cell over, the price gaps — no irrationality required.
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <dl className="ss-stats">
              <div>
                <dt>At {currency(price)}, the market implies growth of</dt>
                <dd>{view.implied === null ? "—" : `${(view.implied * 100).toFixed(1)}%/yr`}</dd>
              </div>
              <div><dt>Value in the first 10 years</dt><dd>{Number.isFinite(view.fv) ? `${Math.round((1 - terminalShare(cf1, g / 100, gT / 100, r / 100)) * 100)}%` : "—"}</dd></div>
              <div><dt>Value in "forever after"</dt><dd>{Number.isFinite(view.fv) ? `${Math.round(terminalShare(cf1, g / 100, gT / 100, r / 100) * 100)}%` : "—"}</dd></div>
            </dl>
            <p className="wl-saved">
              Read the implied growth, then ask the only question that matters: <em>do I truly know
              better than that?</em> Most of the value lives in the terminal years — the part nobody
              can see. This is why prices leap on small news, why two careful analysts sit 2× apart,
              and why this site keeps saying the reliable edge isn't a better guess — it's
              diversification, costs, and time. See{" "}
              <a href="/info/market-valuations">market-level valuations (CAPE)</a> for the same
              fragility at the whole-market scale.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Share of total value sitting in the terminal (post-year-10) block. */
function terminalShare(cf1: number, g: number, gT: number, r: number): number {
  const total = fairValue(cf1, g, gT, r);
  if (!Number.isFinite(total) || total <= 0) return 0;
  let pv10 = 0;
  let cf = cf1;
  for (let t = 1; t <= 10; t++) {
    pv10 += cf / Math.pow(1 + r, t);
    cf *= 1 + g;
  }
  return Math.max(0, 1 - pv10 / total);
}

function SensitivityGrid({ gs, rs, grid, centerPrice, marketPrice }: {
  gs: number[]; rs: number[]; grid: number[][]; centerPrice: number; marketPrice: number;
}) {
  const width = 760, height = 380;
  const pad = { top: 44, right: 18, bottom: 16, left: 92 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const cw = plotW / rs.length;
  const ch = plotH / gs.length;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Fair value across growth and discount-rate assumptions">
      <text x={pad.left + plotW / 2} y={14} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        discount rate →
      </text>
      {rs.map((rr, j) => (
        <text key={j} x={pad.left + cw * (j + 0.5)} y={pad.top - 8} textAnchor="middle" style={axisText}>{rr}%</text>
      ))}
      <text x={14} y={pad.top + plotH / 2} textAnchor="middle" transform={`rotate(-90 14 ${pad.top + plotH / 2})`} style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        ← 10-yr growth
      </text>
      {gs.map((gg, i) => (
        <text key={i} x={pad.left - 8} y={pad.top + ch * (i + 0.5) + 4} textAnchor="end" style={axisText}>{gg}%/yr</text>
      ))}
      {grid.map((row, i) =>
        row.map((v, j) => {
          const above = Number.isFinite(v) && v >= marketPrice;
          const rel = Number.isFinite(v) ? Math.min(1, Math.abs(v / marketPrice - 1)) : 1;
          const isCenter = i === 2 && j === 2;
          return (
            <g key={`${i}-${j}`}>
              <rect
                x={pad.left + cw * j + 2} y={pad.top + ch * i + 2} width={cw - 4} height={ch - 4} rx={6}
                fill={above ? "var(--color-accent)" : "var(--color-error)"}
                opacity={0.10 + 0.4 * rel}
                stroke={isCenter ? "var(--color-text)" : "none"}
                strokeWidth={isCenter ? 2 : 0}
              />
              <text x={pad.left + cw * (j + 0.5)} y={pad.top + ch * (i + 0.5) + 4} textAnchor="middle"
                style={{ ...axisText, fill: "var(--color-text)", fontWeight: isCenter ? 700 : 500, fontSize: 12.5 }}>
                {Number.isFinite(v) ? currency(v) : "∞"}
              </text>
            </g>
          );
        }),
      )}
    </svg>
  );
}
