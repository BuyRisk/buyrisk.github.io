import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { R, N, dateAt, FIRST_YEAR, LAST_YEAR } from "../lib/monthlyReturns";

/**
 * "Time in the Market" — the cost of missing the best months. Take a recent window
 * of real US returns and watch what happens to a fully-invested $10,000 as you
 * remove its best months (as a market-timer who sold and sat out would). A handful
 * of missed months can turn a healthy return into nothing — because the best
 * months cluster right next to the worst, so dodging crashes means missing
 * rebounds. Educational only, not advice.
 */

const START_AMOUNT = 10_000;
const DEFAULTS = { horizon: 20, missed: 10 };
const MAX_MISS = 36;

const dollars = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = (n: number, dp = 1) => `${n >= 0 ? "" : "−"}${Math.abs(n).toFixed(dp)}%`;

export default function MarketTimingLab() {
  const [horizon, setHorizon] = useState(DEFAULTS.horizon);
  const [missed, setMissed] = useState(DEFAULTS.missed);

  const view = useMemo(() => {
    const months = horizon * 12;
    const startIdx = Math.max(0, N - months);
    const W = R.slice(startIdx);
    const m = W.length;
    const annualize = (mult: number) => Math.pow(mult, 12 / m) - 1;

    const full = W.reduce((p, r) => p * (1 + r), 1);
    // Indices sorted by return, descending.
    const order = W.map((_, i) => i).sort((a, b) => W[b] - W[a]);

    // Ending multiple after removing the K best (or worst) months (set to cash, 0%).
    const missBest = (k: number) => {
      let mult = full;
      for (let j = 0; j < k; j++) mult /= 1 + W[order[j]];
      return mult;
    };
    const missWorst = (k: number) => {
      let mult = full;
      for (let j = 0; j < k; j++) mult /= 1 + W[order[m - 1 - j]];
      return mult;
    };

    const curve = [];
    for (let k = 0; k <= MAX_MISS; k++) curve.push({ k, best: annualize(missBest(k)), worst: annualize(missWorst(k)) });

    // Do the best and worst months cluster together?
    const best10 = order.slice(0, 10);
    const worst10 = order.slice(m - 10);
    const nearWorst = best10.filter((bi) => worst10.some((wi) => Math.abs(bi - wi) <= 3)).length;

    return {
      m,
      spanStart: dateAt(startIdx).year,
      spanEnd: dateAt(N - 1).year,
      fullMult: full,
      fullAnn: annualize(full),
      missMult: missBest(missed),
      missAnn: annualize(missBest(missed)),
      curve,
      nearWorst,
    };
  }, [horizon, missed]);

  const stayedAhead = view.missMult >= view.fullMult;

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={() => { setHorizon(DEFAULTS.horizon); setMissed(DEFAULTS.missed); }} />

        <label className="wl-slider">
          <span>
            Look back over
            <InfoTip text="The tool uses the most recent window of this length of real (inflation-adjusted) US market returns." />{" "}
            <strong>{horizon} yr</strong>
          </span>
          <input type="range" min={10} max={50} step={1} value={horizon} onChange={(e) => setHorizon(+e.target.value)} />
        </label>

        <label className="wl-slider">
          <span>
            Best months you missed
            <InfoTip text="Imagine you were out of the market — in cash — for exactly these best months, as a mistimed sell-and-wait would leave you. Their return becomes zero." />{" "}
            <strong>{missed}</strong>
          </span>
          <input type="range" min={0} max={MAX_MISS} step={1} value={missed} onChange={(e) => setMissed(+e.target.value)} />
        </label>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">
            {dollars(START_AMOUNT)} over {view.spanStart}–{view.spanEnd}, missing the {missed} best month{missed === 1 ? "" : "s"}
          </span>
          <span className="ss-headline-value">{dollars(START_AMOUNT * view.missMult)}</span>
          <span className="ss-headline-sub">
            vs <strong>{dollars(START_AMOUNT * view.fullMult)}</strong> staying fully invested —{" "}
            {pct(view.missAnn * 100)}/yr vs {pct(view.fullAnn * 100)}/yr
          </span>
        </div>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          {view.m.toLocaleString()} months of real (inflation-adjusted) US total returns, most recent
          {" "}{horizon} years. "Missed" months earn 0% (cash). Data: Robert Shiller, monthly S&amp;P
          total return, {FIRST_YEAR}–{LAST_YEAR}.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>Your return as you miss the best (or worst) months</h3>
          <TimingChart curve={view.curve} missed={missed} fullAnn={view.fullAnn} />
          <p className="wl-fnote">
            The <span style={{ color: "var(--pl-c3)", fontWeight: 700 }}>orange</span> line is what your
            yearly return becomes as you sit out the <strong>best</strong> months — it falls off a cliff.
            The faint line is the mirror image: sitting out the <strong>worst</strong> months would be
            just as spectacular. The catch is you can't tell which is which in advance.
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <dl className="ss-stats">
              <div><dt>Fully invested</dt><dd>{pct(view.fullAnn * 100)}/yr</dd></div>
              <div><dt>Missing best {missed}</dt><dd>{pct(view.missAnn * 100)}/yr</dd></div>
              <div><dt>Ending value, invested</dt><dd>{dollars(START_AMOUNT * view.fullMult)}</dd></div>
              <div><dt>Ending value, missed</dt><dd>{dollars(START_AMOUNT * view.missMult)}</dd></div>
            </dl>
            <p className="wl-saved">
              Over roughly {view.m / 12 | 0} years — {view.m.toLocaleString()} months — sitting out just the{" "}
              <strong>{missed}</strong> best of them {stayedAhead ? "barely dents" : "guts"} the result:{" "}
              {pct(view.fullAnn * 100)} a year becomes <strong>{pct(view.missAnn * 100)}</strong>. And this
              isn't a fluke of one stretch: <strong>{view.nearWorst} of the 10 best months landed within
              three months of one of the 10 worst</strong>. The huge up-months come right after the crashes,
              so bailing out to dodge the drops is the surest way to miss the recoveries. "Time in the
              market beats timing the market" isn't a slogan — it's arithmetic. Educational only, not advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimingChart({ curve, missed, fullAnn }: { curve: { k: number; best: number; worst: number }[]; missed: number; fullAnn: number }) {
  const width = 760;
  const height = 380;
  const pad = { top: 18, right: 18, bottom: 44, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxK = curve[curve.length - 1].k;
  const vals = curve.flatMap((c) => [c.best, c.worst]);
  const maxV = Math.max(...vals, 0.02);
  const minV = Math.min(...vals, -0.02);
  const x = (k: number) => pad.left + (k / maxK) * plotW;
  const y = (v: number) => pad.top + plotH - ((v - minV) / (maxV - minV || 1)) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  const line = (key: "best" | "worst") => curve.map((c, i) => `${i === 0 ? "M" : "L"}${x(c.k)},${y(c[key])}`).join(" ");
  const yTicks = [minV, minV + (maxV - minV) * 0.5, 0, maxV].filter((v, i, a) => a.findIndex((w) => Math.abs(w - v) < 1e-9) === i);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Annualized return as the best or worst months are removed">
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeDasharray={Math.abs(v) < 1e-9 ? "4 3" : undefined} />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{pct(v * 100, 0)}</text>
        </g>
      ))}
      {[0, Math.round(maxK / 2), maxK].map((k) => (
        <text key={k} x={x(k)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>{k}</text>
      ))}

      {/* Current selection marker */}
      <line x1={x(missed)} x2={x(missed)} y1={pad.top} y2={pad.top + plotH} stroke="var(--color-muted)" strokeDasharray="3 3" />

      <path d={line("worst")} fill="none" stroke="var(--color-text-soft)" strokeWidth={1.6} opacity={0.4} />
      <path d={line("best")} fill="none" stroke="var(--pl-c3)" strokeWidth={2.8} />

      {/* Fully-invested reference dot at k=0 */}
      <circle cx={x(0)} cy={y(fullAnn)} r={4} fill="var(--color-accent)" />

      <text x={pad.left + plotW / 2} y={height - 6} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Number of best months missed → (annualized real return)
      </text>
    </svg>
  );
}
