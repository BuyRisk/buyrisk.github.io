import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { C, N, dateAt, FIRST_YEAR, LAST_YEAR } from "../lib/monthlyReturns";
import { formatMoney, useCurrencyCode } from "../lib/currency";

/**
 * "All at Once, or Bit by Bit?": lump-sum vs dollar-cost averaging, tested across
 * every start month in 150+ years of real US stock returns. Because markets rise
 * more often than they fall, investing a windfall all at once usually beats
 * spreading it out, but the tool also shows the skew: DCA gives up a little
 * expected return to narrow the range of outcomes. Educational only, not advice.
 */

// Prefix sums of 1/C, so a DCA schedule's value has a closed form (see below).
const P: number[] = (() => {
  const p = new Array<number>(N + 1);
  p[0] = 0;
  for (let i = 0; i < N; i++) p[i + 1] = p[i] + 1 / C[i];
  return p;
})();

const DEFAULTS = { amount: 60_000, spread: 12, horizon: 10 };

const dollars = (n: number) => formatMoney(n);
const pct = (n: number, dp = 1) => `${n >= 0 ? "" : "−"}${Math.abs(n).toFixed(dp)}%`;

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export default function DcaLab() {
  useCurrencyCode(); // re-render when the header currency picker changes
  const [amount, setAmount] = useState(DEFAULTS.amount);
  const [spread, setSpread] = useState(DEFAULTS.spread);
  const [horizon, setHorizon] = useState(DEFAULTS.horizon);

  const view = useMemo(() => {
    const H = horizon * 12;
    const S = Math.min(spread, H);
    // For a start month t, growth to the horizon end is C[t+H]/C[t] (lump) and,
    // for DCA, (1/S)·Σ C[t+H]/C[t+j] = C[t+H]·(P[t+S]−P[t])/S. The horizon factor
    // C[t+H] is shared, so who *wins* depends only on the S-month drip window.
    const ls: number[] = [];
    const dca: number[] = [];
    const outperf: number[] = []; // ls/dca − 1
    let lsWins = 0;
    const last = N - H;
    for (let t = 0; t <= last; t++) {
      const lsMult = C[t + H] / C[t];
      const dcaMult = (C[t + H] * (P[t + S] - P[t])) / S;
      ls.push(lsMult);
      dca.push(dcaMult);
      const o = lsMult / dcaMult - 1;
      outperf.push(o);
      if (lsMult > dcaMult) lsWins++;
    }
    const n = ls.length;
    const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    const lsSorted = [...ls].sort((a, b) => a - b);
    const dcaSorted = [...dca].sort((a, b) => a - b);
    return {
      n,
      winRate: lsWins / n,
      medianOutperf: quantile([...outperf].sort((a, b) => a - b), 0.5),
      meanLs: mean(ls),
      meanDca: mean(dca),
      lsP5: quantile(lsSorted, 0.05),
      lsP95: quantile(lsSorted, 0.95),
      dcaP5: quantile(dcaSorted, 0.05),
      dcaP95: quantile(dcaSorted, 0.95),
      outperf,
      firstStart: dateAt(0).year,
      lastStart: dateAt(last).year,
    };
  }, [spread, horizon]);

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={() => { setAmount(DEFAULTS.amount); setSpread(DEFAULTS.spread); setHorizon(DEFAULTS.horizon); }} />

        <label className="wl-slider">
          <span>
            Windfall to invest
            <InfoTip text="A lump of cash to put to work: an inheritance, bonus, or sale. Do you invest it all today, or spread it out?" />{" "}
            <strong>{dollars(amount)}</strong>
          </span>
          <input type="range" min={5_000} max={250_000} step={5_000} value={amount} onChange={(e) => setAmount(+e.target.value)} />
        </label>

        <div className="wl-field">
          <span className="wl-field-label">
            Spread the buying over
            <InfoTip text="Dollar-cost averaging invests an equal slice each month over this window, instead of all at once. Cash waiting to be invested earns nothing (in real terms) here." />
          </span>
          <div className="wl-simmode wl-simmode--wrap" role="group" aria-label="DCA spread">
            {[3, 6, 12, 24].map((m) => (
              <button key={m} type="button" className={spread === m ? "active" : ""} aria-pressed={spread === m} onClick={() => setSpread(m)}>{m} mo</button>
            ))}
          </div>
        </div>

        <label className="wl-slider">
          <span>
            Then hold for
            <InfoTip text="How long you stay invested afterward. Once all the money is in, both strategies hold the same portfolio, so the horizon scales the dollars but not who wins." />{" "}
            <strong>{horizon} yr</strong>
          </span>
          <input type="range" min={3} max={30} step={1} value={horizon} onChange={(e) => setHorizon(+e.target.value)} />
        </label>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">Investing it all at once won</span>
          <span className="ss-headline-value">{Math.round(view.winRate * 100)}% of the time</span>
          <span className="ss-headline-sub">
            across every start month, {view.firstStart}–{view.lastStart}, beating {spread}-month
            averaging by a median of {pct(view.medianOutperf * 100)} — on {dollars(amount)}, that's{" "}
            <strong>{dollars(amount * (view.meanLs - view.meanDca))}</strong> more on average
          </span>
        </div>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          Tested on {view.n.toLocaleString()} overlapping {horizon}-year windows of real (inflation-adjusted)
          US total returns. Data: Robert Shiller, monthly S&amp;P total return, {FIRST_YEAR}–{LAST_YEAR}.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>How much lump sum beat (or trailed) averaging</h3>
          <OutperfHistogram outperf={view.outperf} winRate={view.winRate} spread={spread} />
          <p className="wl-fnote">
            Each bar counts start months. To the{" "}
            <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>right of zero</span>, lump
            sum ended ahead; to the <span style={{ color: "var(--pl-c3)", fontWeight: 700 }}>left</span>,
            averaging won: the times you happened to drip money in as prices fell. Most of the mass
            sits on the right, because markets rise more often than they fall.
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <dl className="ss-stats">
              <div><dt>Lump sum: average end</dt><dd>{dollars(amount * view.meanLs)}</dd></div>
              <div><dt>Averaging: average end</dt><dd>{dollars(amount * view.meanDca)}</dd></div>
              <div><dt>Lump sum: worst 5% → best 5%</dt><dd>{dollars(amount * view.lsP5)} – {dollars(amount * view.lsP95)}</dd></div>
              <div><dt>Averaging: worst 5% → best 5%</dt><dd>{dollars(amount * view.dcaP5)} – {dollars(amount * view.dcaP95)}</dd></div>
            </dl>
            <p className="wl-saved">
              Investing all at once won <strong>{Math.round(view.winRate * 100)}%</strong> of the time
              and ended higher on average ({dollars(amount * view.meanLs)} vs {dollars(amount * view.meanDca)}),
              because money in the market sooner spends more time compounding. Dollar-cost averaging isn't
              about beating that. It's about a <strong>narrower range of outcomes</strong> and less regret
              if you happen to invest right before a fall. If the cash is already yours and you can stomach
              the volatility, the math favors lump sum; if buying in all at once would keep you up at night,
              averaging is a reasonable price for peace of mind. Educational only, not advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function OutperfHistogram({ outperf, winRate, spread }: { outperf: number[]; winRate: number; spread: number }) {
  const width = 760;
  const height = 380;
  const pad = { top: 18, right: 18, bottom: 44, left: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  // Bin the outperformance (%) into fixed 2-point bins, clamped to [−20, +40].
  const LO = -20, HI = 40, STEP = 2;
  const nBins = (HI - LO) / STEP;
  const bins = new Array<number>(nBins).fill(0);
  for (const o of outperf) {
    const pctVal = Math.max(LO, Math.min(HI - 1e-9, o * 100));
    bins[Math.floor((pctVal - LO) / STEP)]++;
  }
  const maxCount = Math.max(...bins, 1);
  const x = (pctVal: number) => pad.left + ((pctVal - LO) / (HI - LO)) * plotW;
  const y = (c: number) => pad.top + plotH - (c / maxCount) * plotH;
  const bw = plotW / nBins;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Distribution of how much lump-sum investing beat dollar-cost averaging">
      {bins.map((c, i) => {
        const binLo = LO + i * STEP;
        const wins = binLo >= 0;
        return (
          <rect key={i} x={x(binLo) + 1} y={y(c)} width={bw - 2} height={pad.top + plotH - y(c)} rx={2}
            fill={wins ? "var(--color-accent)" : "var(--pl-c3)"} opacity={0.85} />
        );
      })}
      {/* Zero line */}
      <line x1={x(0)} x2={x(0)} y1={pad.top} y2={pad.top + plotH} stroke="var(--color-text)" strokeWidth={1.5} strokeDasharray="4 3" />
      <text x={x(0)} y={pad.top - 5} textAnchor="middle" style={{ ...axisText, fontWeight: 700, fill: "var(--color-text-soft)" }}>tie</text>

      {[-20, -10, 0, 10, 20, 30, 40].map((v) => (
        <text key={v} x={x(v)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>{v > 0 ? `+${v}` : v}%</text>
      ))}
      <text x={pad.left + plotW / 2} y={height - 6} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Lump sum's ending value vs {spread}-month averaging → ({Math.round(winRate * 100)}% of months lump sum won)
      </text>
    </svg>
  );
}
