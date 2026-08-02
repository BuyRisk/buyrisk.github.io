import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { historicalReturns } from "../data/generated/historical-returns";

/**
 * "How Much in Stocks?" The asset-allocation dial. Slide the stock/bond mix and
 * see the historical trade-off: more stocks lifts the long-run compound return but
 * deepens the worst drawdown you'd have had to sit through. Framed by Swedroe's
 * three dimensions of risk: ability, willingness, and need to take it.
 *
 * It also surfaces VOLATILITY DRAG: the compound (geometric) return is always
 * below the average (arithmetic) return by roughly ½·variance, so a smoother ride
 * compounds to more even at the same average: the quantitative case for not
 * bearing risk you aren't paid for.
 *
 * Real (inflation-adjusted) annual US returns, 1928–. Educational only, not advice.
 */

const S = historicalReturns.series;
// Real annual returns for the two building blocks: US stocks and 10-yr Treasuries.
const REAL = S.map((y) => ({
  stock: (1 + y.stocks) / (1 + y.inflation) - 1,
  bond: (1 + y.tbonds) / (1 + y.inflation) - 1,
}));
const SPAN = historicalReturns.span;

const pct = (x: number, dp = 1) => `${x >= 0 ? "" : "−"}${Math.abs(x * 100).toFixed(dp)}%`;

function stats(w: number) {
  const r = REAL.map((y) => w * y.stock + (1 - w) * y.bond);
  const n = r.length;
  const arith = r.reduce((s, v) => s + v, 0) / n;
  const variance = r.reduce((s, v) => s + (v - arith) ** 2, 0) / n;
  const vol = Math.sqrt(variance);
  const geo = Math.pow(r.reduce((p, v) => p * (1 + v), 1), 1 / n) - 1;
  let worst = Infinity, best = -Infinity;
  for (const v of r) { if (v < worst) worst = v; if (v > best) best = v; }
  // Max drawdown on the compounded real index.
  let idx = 1, peak = 1, mdd = 0;
  for (const v of r) { idx *= 1 + v; if (idx > peak) peak = idx; const dd = idx / peak - 1; if (dd < mdd) mdd = dd; }
  return { arith, geo, vol, worst, best, mdd, drag: arith - geo };
}

export default function AssetAllocationLab() {
  const [stockPct, setStockPct] = useState(60);

  const view = useMemo(() => {
    const cur = stats(stockPct / 100);
    const curve: { w: number; geo: number; mdd: number }[] = [];
    for (let p = 0; p <= 100; p += 2) { const s = stats(p / 100); curve.push({ w: p, geo: s.geo, mdd: s.mdd }); }
    return { cur, curve };
  }, [stockPct]);

  const c = view.cur;

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={() => setStockPct(60)} />

        <label className="wl-slider">
          <span>
            Stocks in your portfolio
            <InfoTip text="The share in stocks; the rest is 10-year Treasury bonds. This one dial trades higher long-run growth against a rougher, scarier ride." />{" "}
            <strong>{stockPct}%</strong>
          </span>
          <input type="range" min={0} max={100} step={5} value={stockPct} onChange={(e) => setStockPct(+e.target.value)} />
        </label>
        <p className="wl-note" style={{ marginTop: "-0.2rem" }}>
          {stockPct}% stocks · {100 - stockPct}% bonds
        </p>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">A {stockPct}/{100 - stockPct} stock/bond mix historically returned</span>
          <span className="ss-headline-value">{pct(c.geo)}/yr</span>
          <span className="ss-headline-sub">
            real (after inflation), but you'd have had to sit through a worst drop of <strong>{pct(c.mdd)}</strong>
          </span>
        </div>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          Every figure is computed <strong>directly</strong> from the actual year-by-year record: no simulation or
          bootstrap. Data: real (inflation-adjusted) US annual returns, {SPAN[0]}–{SPAN[1]} (stocks = S&P 500, bonds =
          10-year Treasuries; Aswath Damodaran). History is one sample, not a promise. Educational only, not advice.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>More stocks: higher growth, deeper drops</h3>
          <TradeoffChart curve={view.curve} stockPct={stockPct} />
          <p className="wl-fnote">
            The <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>upper line</span> is the long-run
            compound return; the <span style={{ color: "var(--pl-c3)", fontWeight: 700 }}>lower line</span> is the worst
            peak-to-trough drop you'd have endured. Adding stocks lifts both: the reward <em>and</em> the white-knuckle
            risk. The right mix is the one whose lower line you could actually live through without selling.
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <dl className="ss-stats">
              <div><dt>Compound return (real)</dt><dd>{pct(c.geo)}/yr</dd></div>
              <div><dt>Worst drawdown</dt><dd>{pct(c.mdd)}</dd></div>
              <div><dt>Volatility</dt><dd>{pct(c.vol)}</dd></div>
              <div><dt>Worst single year</dt><dd>{pct(c.worst)}</dd></div>
            </dl>
            <p className="wl-saved">
              Notice the <strong>volatility drag</strong>: this mix <em>averaged</em> {pct(c.arith)} a year, but only
              <strong> compounded</strong> at {pct(c.geo)}: a gap of {pct(c.drag)} lost purely to the bumps, because a
              −50% year needs a +100% year to recover. Cutting volatility raises what you actually keep, even at the same
              average. That's the deep reason not to bear risk you aren't paid for. How much stock is right for you comes
              down to three questions: your <strong>ability</strong> to take risk (how long is your horizon?), your{" "}
              <strong>willingness</strong> (can you hold through that worst drop without selling?), and your{" "}
              <strong>need</strong> (do your goals even require it?). Educational only, not advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TradeoffChart({ curve, stockPct }: { curve: { w: number; geo: number; mdd: number }[]; stockPct: number }) {
  const width = 760;
  const height = 380;
  const pad = { top: 18, right: 18, bottom: 44, left: 54 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const vMax = 0.1; // +10%
  const vMin = Math.min(-0.6, ...curve.map((c) => c.mdd)) - 0.02;
  const x = (w: number) => pad.left + (w / 100) * plotW;
  const y = (v: number) => pad.top + plotH - ((v - vMin) / (vMax - vMin)) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;
  const line = (key: "geo" | "mdd") => curve.map((c, i) => `${i === 0 ? "M" : "L"}${x(c.w)},${y(c[key])}`).join(" ");

  const cur = curve.reduce((a, c) => (Math.abs(c.w - stockPct) < Math.abs(a.w - stockPct) ? c : a), curve[0]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Compound return and worst drawdown as the stock allocation changes">
      {[0.1, 0, -0.2, -0.4, -0.6].map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeDasharray={v === 0 ? "4 3" : undefined} />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{pct(v, 0)}</text>
        </g>
      ))}
      {[0, 25, 50, 75, 100].map((w) => (
        <text key={w} x={x(w)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>{w}%</text>
      ))}

      <line x1={x(stockPct)} x2={x(stockPct)} y1={pad.top} y2={pad.top + plotH} stroke="var(--color-muted)" strokeDasharray="3 3" />
      <path d={line("mdd")} fill="none" stroke="var(--pl-c3)" strokeWidth={2.6} />
      <path d={line("geo")} fill="none" stroke="var(--color-accent)" strokeWidth={2.8} />
      <circle cx={x(stockPct)} cy={y(cur.geo)} r={5} fill="var(--color-accent)" />
      <circle cx={x(stockPct)} cy={y(cur.mdd)} r={5} fill="var(--pl-c3)" />

      <text x={pad.left + plotW / 2} y={height - 6} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Stock allocation → compound return (top) &amp; worst drawdown (bottom)
      </text>
    </svg>
  );
}
