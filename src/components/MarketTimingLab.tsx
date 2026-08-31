import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { marketDaily } from "../data/generated/market-daily";
import { shillerMonthly } from "../data/generated/shiller-monthly";
import { historicalReturns } from "../data/generated/historical-returns";
import { formatMoney, useCurrencyCode } from "../lib/currency";

/**
 * "Time in the Market": two lessons about timing, one tool.
 *
 * Mode 1 ("Missing the best days"): take a recent window of daily US market total
 * returns and watch a fully-invested $10,000 collapse as its best days are removed,
 * because the best days sit right next to the worst.
 *
 * Mode 2 ("Timing your buys", the Ben Carlson "worst market timer" story): four
 * savers contribute the same amount every month over decades. One deploys cash
 * only at the peak before every crash (worst), one waits to buy each bottom (a
 * dip-waiter, whose cash sits idle between lows), one invests immediately (steady),
 * one never invests (cash). The worst timer still buries the cash saver, because
 * they stayed invested and rode every recovery — and the dip-waiter trails steady,
 * because waiting keeps money in cash.
 * Monthly returns are REAL (inflation-adjusted). Educational only, not advice.
 */

// ── Mode 1 data: daily nominal market returns ──────────────────────────────
const R = marketDaily.returns;
const START_YEAR = +marketDaily.startDate.slice(0, 4);
const END_YEAR = +marketDaily.endDate.slice(0, 4);
const TD = 252;
const MAX_SPAN = END_YEAR - START_YEAR;
const START_AMOUNT = 10_000;
const DEFAULTS = { horizon: 20, missed: 10 };
const MAX_MISS = 50;

// ── Mode 2 data: monthly REAL market total returns + real T-bill (cash) ────
const RM = shillerMonthly.returns; // month-over-month real total returns
const L = RM.length - 1;
const END_ABS = shillerMonthly.endYear * 12 + (shillerMonthly.endMonth - 1);

// Monthly real T-bill return for each calendar year, from Damodaran's annuals.
const CASH_BY_YEAR: Record<number, number> = {};
for (const y of historicalReturns.series) {
  const realAnnual = (1 + y.tbills) / (1 + y.inflation) - 1;
  CASH_BY_YEAR[y.year] = Math.pow(1 + realAnnual, 1 / 12) - 1;
}
const CASH_MIN_Y = historicalReturns.span[0];
const CASH_MAX_Y = historicalReturns.span[1];
const cashMonthly = (year: number) => CASH_BY_YEAR[Math.max(CASH_MIN_Y, Math.min(CASH_MAX_Y, year))];

const TIMING_MAX_YR = Math.min(shillerMonthly.endYear - CASH_MIN_Y, 90);
const TIMING_DEFAULT = 40;
const CONTRIB = 500; // $/month; results scale linearly, so the exact figure is cosmetic
const THETA = 0.1; // 10% drawdown defines a "crash" (peak→trough)

/** Bull/bear dating on a total-return index: peak indices (tops) and trough indices (bottoms). */
function datePeaksTroughs(P: number[]) {
  const peaks: number[] = [];
  const troughs: number[] = [];
  let mode: "bull" | "bear" = "bull";
  let peakIdx = 0;
  let troughIdx = 0;
  for (let i = 1; i < P.length; i++) {
    if (mode === "bull") {
      if (P[i] > P[peakIdx]) peakIdx = i;
      else if (P[i] <= P[peakIdx] * (1 - THETA)) { mode = "bear"; troughIdx = i; peaks.push(peakIdx); }
    } else {
      if (P[i] < P[troughIdx]) troughIdx = i;
      else if (P[i] >= P[troughIdx] * (1 + THETA)) { mode = "bull"; troughs.push(troughIdx); peakIdx = i; }
    }
  }
  if (mode === "bear") troughs.push(troughIdx);
  return { peaks, troughs };
}

function simulateTiming(years: number) {
  const m = years * 12;
  const r = RM.slice(L - m + 1, L + 1);
  // Real market index P and real cash index Q over the window (length m+1).
  const P = [1];
  const Q = [1];
  for (let t = 0; t < m; t++) {
    const calYear = Math.floor((END_ABS - (m - 1 - t)) / 12);
    P.push(P[t] * (1 + r[t]));
    Q.push(Q[t] * (1 + cashMonthly(calYear)));
  }
  const { peaks, troughs } = datePeaksTroughs(P);
  const nextOnOrAfter = (arr: number[], t: number) => {
    for (const d of arr) if (d >= t) return d;
    return m; // no future event → the dollar stays in cash to the end
  };

  let steady = 0, worst = 0, best = 0, cash = 0;
  for (let t = 0; t < m; t++) {
    steady += CONTRIB * (P[m] / P[t]); // invest the month it arrives
    cash += CONTRIB * (Q[m] / Q[t]); // never invest
    const dw = nextOnOrAfter(peaks, t); // worst: buy at the next top
    const db = nextOnOrAfter(troughs, t); // best: buy at the next bottom
    worst += CONTRIB * (Q[dw] / Q[t]) * (P[m] / P[dw]);
    best += CONTRIB * (Q[db] / Q[t]) * (P[m] / P[db]);
  }
  const spanEnd = shillerMonthly.endYear;
  return {
    contributed: CONTRIB * m,
    best, steady, worst, cash,
    crashes: peaks.length,
    spanStart: spanEnd - years,
    spanEnd,
  };
}

const dollars = (n: number) => formatMoney(n);
const pct = (n: number, dp = 1) => `${n >= 0 ? "" : "−"}${Math.abs(n).toFixed(dp)}%`;
const mult = (n: number, base: number) => `${(n / base).toFixed(1)}×`;

export default function MarketTimingLab() {
  useCurrencyCode(); // re-render when the header currency picker changes
  const [mode, setMode] = useState<"best-days" | "timing">("best-days");
  const [horizon, setHorizon] = useState(DEFAULTS.horizon);
  const [missed, setMissed] = useState(DEFAULTS.missed);
  const [timingYears, setTimingYears] = useState(TIMING_DEFAULT);

  const bestDays = useMemo(() => {
    const startYr = Math.max(START_YEAR, END_YEAR - horizon);
    const startIdx = marketDaily.yearStart[startYr] ?? 0;
    const W = R.slice(startIdx);
    const m = W.length;
    const annualize = (x: number) => Math.pow(x, TD / m) - 1;
    const full = W.reduce((p, r) => p * (1 + r), 1);
    const order = W.map((_, i) => i).sort((a, b) => W[b] - W[a]);
    const missBest = (k: number) => { let x = full; for (let j = 0; j < k; j++) x /= 1 + W[order[j]]; return x; };
    const missWorst = (k: number) => { let x = full; for (let j = 0; j < k; j++) x /= 1 + W[order[m - 1 - j]]; return x; };
    const curve = [];
    for (let k = 0; k <= MAX_MISS; k++) curve.push({ k, best: annualize(missBest(k)), worst: annualize(missWorst(k)) });
    const best10 = order.slice(0, 10);
    const worst10 = order.slice(m - 10);
    const nearWorst = best10.filter((bi) => worst10.some((wi) => Math.abs(bi - wi) <= 5)).length;
    return { m, spanStart: startYr, spanEnd: END_YEAR, fullMult: full, fullAnn: annualize(full), missMult: missBest(missed), missAnn: annualize(missBest(missed)), curve, nearWorst };
  }, [horizon, missed]);

  const timing = useMemo(() => simulateTiming(timingYears), [timingYears]);

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={() => { setMode("best-days"); setHorizon(DEFAULTS.horizon); setMissed(DEFAULTS.missed); setTimingYears(TIMING_DEFAULT); }} />

        <div className="wl-field">
          <span className="wl-field-label">What to explore</span>
          <div className="wl-simmode wl-simmode--wrap" role="group" aria-label="Choose a scenario">
            <button
              type="button"
              className={mode === "best-days" ? "active" : ""}
              aria-pressed={mode === "best-days"}
              onClick={() => setMode("best-days")}
              title={`Direct calculation on actual daily returns: no simulation. We compound the real day-by-day US market return and remove the single best days. Data: Fama–French daily market factor (Mkt−RF + RF), ${START_YEAR}–${END_YEAR}.`}
            >
              Missing the best days
            </button>
            <button
              type="button"
              className={mode === "timing" ? "active" : ""}
              aria-pressed={mode === "timing"}
              onClick={() => setMode("timing")}
              title="Direct historical simulation: no bootstrap. Each saver's monthly contributions are deployed on the actual month-by-month path. Data: Shiller monthly real S&P total return (1871–); cash earns the real 3-month T-bill (Damodaran)."
            >
              Timing your buys
            </button>
          </div>
        </div>

        {mode === "best-days" ? (
          <>
            <label className="wl-slider">
              <span>
                Look back over
                <InfoTip text="The tool uses the most recent window of this many years of daily US market total returns (dividends included)." />{" "}
                <strong>{horizon} yr</strong>
              </span>
              <input type="range" min={5} max={MAX_SPAN} step={1} value={horizon} onChange={(e) => setHorizon(+e.target.value)} />
            </label>

            <label className="wl-slider">
              <span>
                Best days you missed
                <InfoTip text="Imagine you were out of the market (in cash) for exactly these best days, as a mistimed sell-and-wait would leave you. Their return becomes zero." />{" "}
                <strong>{missed}</strong>
              </span>
              <input type="range" min={0} max={MAX_MISS} step={1} value={missed} onChange={(e) => setMissed(+e.target.value)} />
            </label>

            <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
              <span className="ss-headline-label">
                {dollars(START_AMOUNT)} over {bestDays.spanStart}–{bestDays.spanEnd}, missing the {missed} best day{missed === 1 ? "" : "s"}
              </span>
              <span className="ss-headline-value">{dollars(START_AMOUNT * bestDays.missMult)}</span>
              <span className="ss-headline-sub">
                vs <strong>{dollars(START_AMOUNT * bestDays.fullMult)}</strong> staying fully invested:{" "}
                {pct(bestDays.missAnn * 100)}/yr vs {pct(bestDays.fullAnn * 100)}/yr
              </span>
            </div>

            <p className="wl-note" style={{ marginTop: "0.5rem" }}>
              {bestDays.m.toLocaleString()} trading days of nominal US market total returns, most recent
              {" "}{bestDays.spanEnd - bestDays.spanStart} years. "Missed" days earn 0% (cash). Data: Fama–French
              daily market factor (Mkt−RF + RF), {START_YEAR}–{END_YEAR}.
            </p>
          </>
        ) : (
          <>
            <label className="wl-slider">
              <span>
                Save every month for
                <InfoTip text="Each saver sets aside the same amount every month over this many years. Money not yet invested earns the real (inflation-adjusted) T-bill rate." />{" "}
                <strong>{timingYears} yr</strong>
              </span>
              <input type="range" min={15} max={TIMING_MAX_YR} step={1} value={timingYears} onChange={(e) => setTimingYears(+e.target.value)} />
            </label>

            <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
              <span className="ss-headline-label">
                The world's worst market timer (bought only at the {timing.crashes} peaks before every crash) ended with
              </span>
              <span className="ss-headline-value">{dollars(timing.worst)}</span>
              <span className="ss-headline-sub">
                {mult(timing.worst, timing.cash)} what he'd have by never investing ({dollars(timing.cash)}), on {dollars(timing.contributed)} saved
              </span>
            </div>

            <p className="wl-note" style={{ marginTop: "0.5rem" }}>
              Four savers each set aside {dollars(CONTRIB)}/month over {timing.spanStart}–{timing.spanEnd}. Values are
              REAL (inflation-adjusted, today's dollars). Market: Shiller monthly real total return; cash earns the real
              3-month T-bill. A "crash" is a {THETA * 100}% drop. Educational only, not advice.
            </p>
          </>
        )}
      </div>

      <div className="wl-stage">
        {mode === "best-days" ? (
          <>
            <div className="wl-frontier">
              <h3>Your return as you miss the best (or worst) days</h3>
              <BestDaysChart curve={bestDays.curve} missed={missed} fullAnn={bestDays.fullAnn} />
              <p className="wl-fnote">
                The <span style={{ color: "var(--pl-c3)", fontWeight: 700 }}>blue</span> line is what your
                yearly return becomes as you sit out the <strong>best</strong> days. It falls off a cliff.
                The faint line is the mirror image: sitting out the <strong>worst</strong> days would be
                just as spectacular. The catch is you can't tell which is which in advance.
              </p>
            </div>

            <div className="wl-lower">
              <div className="wl-readout">
                <dl className="ss-stats">
                  <div><dt>Fully invested</dt><dd>{pct(bestDays.fullAnn * 100)}/yr</dd></div>
                  <div><dt>Missing best {missed}</dt><dd>{pct(bestDays.missAnn * 100)}/yr</dd></div>
                  <div><dt>Ending value, invested</dt><dd>{dollars(START_AMOUNT * bestDays.fullMult)}</dd></div>
                  <div><dt>Ending value, missed</dt><dd>{dollars(START_AMOUNT * bestDays.missMult)}</dd></div>
                </dl>
                <p className="wl-saved">
                  Over {bestDays.spanStart}–{bestDays.spanEnd} ({bestDays.m.toLocaleString()} trading days) sitting out
                  just the <strong>{missed}</strong> best of them turns {pct(bestDays.fullAnn * 100)} a year into{" "}
                  <strong>{pct(bestDays.missAnn * 100)}</strong>. And this isn't a fluke:{" "}
                  <strong>{bestDays.nearWorst} of the 10 best days landed within a week of one of the 10 worst</strong>.
                  The huge up-days come right in the middle of the crashes, so bailing out to dodge the drops is
                  the surest way to miss the recoveries. "Time in the market beats timing the market" isn't a
                  slogan. It's arithmetic. And missing rebounds isn't the only cost: in Barber and Odean's landmark
                  study, <em>Trading Is Hazardous to Your Wealth</em>, the households that traded the most trailed the
                  market by roughly 6.5 points a year. Educational only, not advice.
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="wl-frontier">
              <h3>Four savers, same paychecks, wildly different timing</h3>
              <TimingBars timing={timing} />
              <p className="wl-fnote">
                Every saver set aside the same {dollars(CONTRIB)} a month. The only difference is <em>when</em> they
                moved it into the market, and whether they moved it at all. Bought-at-the-worst still lands a world
                apart from never-invested.
              </p>
            </div>

            <div className="wl-lower">
              <div className="wl-readout">
                <dl className="ss-stats">
                  <div><dt>Invested steadily (every month)</dt><dd>{dollars(timing.steady)}</dd></div>
                  <div><dt>Dip-buyer (waits for each low)</dt><dd>{dollars(timing.best)}</dd></div>
                  <div><dt>Worst timing (every peak)</dt><dd>{dollars(timing.worst)}</dd></div>
                  <div><dt>Never invested (cash)</dt><dd>{dollars(timing.cash)}</dd></div>
                </dl>
                <p className="wl-saved">
                  Over {timing.spanStart}–{timing.spanEnd}, the <strong>worst</strong> possible market timer, who only ever
                  bought at the {timing.crashes} peaks right before each crash, still turned {dollars(timing.contributed)} of
                  savings into <strong>{dollars(timing.worst)}</strong>, because he never sold and rode every recovery to the
                  end. The saver who stayed in cash ended with just {dollars(timing.cash)}, barely more than he put in, once
                  inflation is counted. And notice the <strong>dip-buyer</strong> who waited to buy every low actually
                  <em> trailed</em> the saver who invested every month on autopilot ({dollars(timing.best)} vs{" "}
                  {dollars(timing.steady)}): waiting in cash for a lower price costs you the growth you miss while waiting —
                  and any cash still waiting for a dip at the end never gets in at all. Being <em>in</em> the market swamps
                  timing it. Educational only, not advice.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BestDaysChart({ curve, missed, fullAnn }: { curve: { k: number; best: number; worst: number }[]; missed: number; fullAnn: number }) {
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
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Annualized return as the best or worst days are removed">
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeDasharray={Math.abs(v) < 1e-9 ? "4 3" : undefined} />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{pct(v * 100, 0)}</text>
        </g>
      ))}
      {[0, Math.round(maxK / 2), maxK].map((k) => (
        <text key={k} x={x(k)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>{k}</text>
      ))}
      <line x1={x(missed)} x2={x(missed)} y1={pad.top} y2={pad.top + plotH} stroke="var(--color-muted)" strokeDasharray="3 3" />
      <path d={line("worst")} fill="none" stroke="var(--color-text-soft)" strokeWidth={1.6} opacity={0.4} />
      <path d={line("best")} fill="none" stroke="var(--pl-c3)" strokeWidth={2.8} />
      <circle cx={x(0)} cy={y(fullAnn)} r={4} fill="var(--color-accent)" />
      <text x={pad.left + plotW / 2} y={height - 6} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Number of best days missed → (annualized return)
      </text>
    </svg>
  );
}

function TimingBars({ timing }: { timing: ReturnType<typeof simulateTiming> }) {
  const width = 760;
  const height = 380;
  const pad = { top: 24, right: 18, bottom: 52, left: 64 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const bars = [
    { label: "Steady", sub: "every month", value: timing.steady, color: "var(--color-accent)" },
    { label: "Dip-buyer", sub: "waits for lows", value: timing.best, color: "var(--pl-c2)" },
    { label: "Worst", sub: "every peak", value: timing.worst, color: "var(--pl-c3)" },
    { label: "Cash", sub: "never invested", value: timing.cash, color: "var(--color-text-soft)" },
  ];
  const maxV = Math.max(...bars.map((b) => b.value)) * 1.12;
  const y = (v: number) => pad.top + plotH - (v / maxV) * plotH;
  const n = bars.length;
  const bandW = plotW / n;
  const barW = Math.min(96, bandW * 0.62);
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;
  const money = (v: number) => formatMoney(v, { compact: true });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Ending wealth for four market-timing strategies">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const v = maxV * f;
        return (
          <g key={f}>
            <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" />
            <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{money(v)}</text>
          </g>
        );
      })}

      {/* Total contributed reference line */}
      <line x1={pad.left} x2={width - pad.right} y1={y(timing.contributed)} y2={y(timing.contributed)} stroke="var(--color-text)" strokeDasharray="5 4" opacity={0.7} />
      <text x={width - pad.right} y={y(timing.contributed) - 6} textAnchor="end" style={{ ...axisText, fontStyle: "italic", fill: "var(--color-text-soft)" }}>
        total saved {money(timing.contributed)}
      </text>

      {bars.map((b, i) => {
        const cx = pad.left + bandW * i + bandW / 2;
        return (
          <g key={b.label}>
            <rect x={cx - barW / 2} y={y(b.value)} width={barW} height={pad.top + plotH - y(b.value)} rx={5} fill={b.color} />
            <text x={cx} y={y(b.value) - 20} textAnchor="middle" style={{ ...axisText, fill: "var(--color-text)", fontWeight: 700, fontSize: 14 }}>
              {money(b.value)}
            </text>
            <text x={cx} y={y(b.value) - 6} textAnchor="middle" style={{ ...axisText, fill: "var(--color-text-soft)", fontSize: 11 }}>
              {mult(b.value, timing.contributed)}
            </text>
            <text x={cx} y={height - pad.bottom + 18} textAnchor="middle" style={{ ...axisText, fill: "var(--color-text)", fontWeight: 600, fontSize: 12.5 }}>
              {b.label}
            </text>
            <text x={cx} y={height - pad.bottom + 33} textAnchor="middle" style={axisText}>
              {b.sub}
            </text>
          </g>
        );
      })}
      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Ending wealth, inflation-adjusted · same monthly savings, different timing
      </text>
    </svg>
  );
}
