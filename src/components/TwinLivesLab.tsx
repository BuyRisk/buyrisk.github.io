import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { HISTORY } from "../lib/bootstrap";
import { axisText, captionText, linePath } from "../lib/chart";
import { formatMoney, useCurrencyCode } from "../lib/currency";

/**
 * Twin lives: two identical savers — same monthly saving, same portfolio, same
 * career length, same discipline — who differ in exactly one thing: the year
 * they started. Real market history does the rest, and the endings can sit
 * multiples apart.
 *
 * The accumulation-side mirror of sequence-of-returns risk: late-career
 * returns dominate (that's when the pile is biggest), so a bull market in your
 * 50s beats the identical bull market in your 20s. The lesson is honest
 * humility: markets decide a huge share of the outcome, and the only levers a
 * saver controls are the savings rate, diversification, costs — and staying in.
 *
 * Deterministic replay of real US history (Damodaran, inflation-adjusted).
 */

const currency = (n: number) => formatMoney(n);

interface Cohort {
  start: number;
  ending: number;
  balances: number[]; // year 0..career
}

/** Real portfolio return for one historical year at a stock/bond mix. */
const realReturn = (y: (typeof HISTORY.series)[number], stockPct: number) => {
  const nominal = stockPct * y.stocks + (1 - stockPct) * y.tbonds;
  return (1 + nominal) / (1 + y.inflation) - 1;
};

export default function TwinLivesLab() {
  useCurrencyCode();
  const [monthly, setMonthly] = useState(500);
  const [career, setCareer] = useState(40);
  const [stockPct, setStockPct] = useState(80);
  const [startA, setStartA] = useState(1960);
  const [startB, setStartB] = useState(1969);

  const firstYear = HISTORY.series[0].year;
  const lastStart = HISTORY.series[HISTORY.series.length - 1].year - career + 1;
  const a = Math.min(startA, lastStart);
  const b = Math.min(startB, lastStart);

  const view = useMemo(() => {
    const annual = monthly * 12;
    const R = HISTORY.series.map((y) => realReturn(y, stockPct / 100));
    const cohorts: Cohort[] = [];
    for (let s = firstYear; s <= lastStart; s++) {
      const i0 = s - firstYear;
      const balances = [0];
      let bal = 0;
      for (let y = 0; y < career; y++) {
        bal = (bal + annual) * (1 + R[i0 + y]);
        balances.push(bal);
      }
      cohorts.push({ start: s, ending: bal, balances });
    }
    const byStart = new Map(cohorts.map((c) => [c.start, c]));
    const best = cohorts.reduce((x, c) => (c.ending > x.ending ? c : x));
    const worst = cohorts.reduce((x, c) => (c.ending < x.ending ? c : x));
    return {
      cohorts, byStart, best, worst,
      A: byStart.get(a)!, B: byStart.get(b)!,
      contributed: annual * career,
      medianEnding: [...cohorts.map((c) => c.ending)].sort((x, y) => x - y)[Math.floor(cohorts.length / 2)],
    };
  }, [monthly, career, stockPct, a, b, firstYear, lastStart]);

  const ratio = Math.max(view.A.ending, view.B.ending) / Math.max(1, Math.min(view.A.ending, view.B.ending));

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={() => { setMonthly(500); setCareer(40); setStockPct(80); setStartA(1960); setStartB(1969); }} />

        <p className="br-group">The twins (identical in every way but one)</p>
        <label className="wl-slider">
          <span>
            Saved every month (today's dollars)
            <InfoTip text="Both twins save the same inflation-adjusted amount every month of their careers, invested identically. Only the calendar differs." />{" "}
            <strong>{currency(monthly)}</strong>
          </span>
          <input type="range" min={100} max={3_000} step={50} value={monthly} onChange={(e) => setMonthly(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>Career length <strong>{career} years</strong></span>
          <input type="range" min={20} max={45} step={1} value={career} onChange={(e) => setCareer(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>
            Stocks in portfolio <strong>{stockPct}%</strong>
            <InfoTip text="Stock share; the rest is 10-year Treasuries. Returns are real (inflation-adjusted) US history." />
          </span>
          <input type="range" min={0} max={100} step={5} value={stockPct} onChange={(e) => setStockPct(+e.target.value)} />
        </label>

        <p className="br-group">When each twin starts working</p>
        <label className="wl-slider">
          <span>Twin A starts in <strong>{a}</strong></span>
          <input type="range" min={firstYear} max={lastStart} step={1} value={a} onChange={(e) => setStartA(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>Twin B starts in <strong>{b}</strong></span>
          <input type="range" min={firstYear} max={lastStart} step={1} value={b} onChange={(e) => setStartB(+e.target.value)} />
        </label>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">
            Identical savers, {career}-year careers, {currency(view.contributed)} contributed each. The difference between starting in {a} and {b}:
          </span>
          <span className="ss-headline-value" style={{ color: ratio > 1.5 ? "var(--color-warn)" : "var(--color-accent)" }}>
            {ratio.toFixed(1)}×
          </span>
          <span className="ss-headline-sub">
            {currency(view.A.ending)} vs {currency(view.B.ending)} — same discipline, different decade. Neither twin did anything wrong.
          </span>
        </div>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          Real (inflation-adjusted) US returns, {HISTORY.span[0]}–{HISTORY.span[1]}. Savings are
          assumed steady in today's dollars; taxes, fees, and raises are left out — both twins face
          the same omissions. Educational only, not advice.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>Two identical careers</h3>
          <TwinPathsChart A={view.A} B={view.B} career={career} contributed={view.contributed} monthly={monthly} />
          <p className="wl-fnote">
            The dotted line is what each twin put in. Everything above it is the market's doing — and
            notice <em>when</em> the gap opens: late in the career, when the pile is biggest. A bull
            market in your 50s is worth many times the same bull market in your 20s. That's
            accumulation-side sequence risk, the mirror image of the retirement version.
          </p>
        </div>

        <div className="wl-frontier" style={{ marginTop: "var(--space-md)" }}>
          <h3>Every start year since {HISTORY.span[0]}</h3>
          <CohortChart cohorts={view.cohorts} A={view.A} B={view.B} best={view.best} worst={view.worst} contributed={view.contributed} />
          <p className="wl-fnote">
            Ending wealth for every possible start year, same saver every time. Luckiest cohort
            ({view.best.start}): {currency(view.best.ending)}. Unluckiest ({view.worst.start}):{" "}
            {currency(view.worst.ending)} — {(view.best.ending / Math.max(1, view.worst.ending)).toFixed(1)}×
            apart on identical behavior. You don't get to choose your decade. You do get to choose the
            savings rate, the diversification, and the costs — the levers that work in <em>every</em> decade.
          </p>
        </div>
      </div>
    </div>
  );
}

function TwinPathsChart({ A, B, career, contributed, monthly }: { A: Cohort; B: Cohort; career: number; contributed: number; monthly: number }) {
  const width = 760, height = 340;
  const pad = { top: 14, right: 18, bottom: 40, left: 60 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const yMax = Math.max(A.ending, B.ending, ...A.balances, ...B.balances) * 1.05;
  const x = (yr: number) => pad.left + (yr / career) * plotW;
  const y = (v: number) => pad.top + plotH - (Math.min(v, yMax) / yMax) * plotH;
  const path = (c: Cohort) => linePath(c.balances, (_, i) => x(i), (v) => y(v));
  const contribPath = linePath(Array.from({ length: career + 1 }, (_, i) => i), (i) => x(i), (i) => y(monthly * 12 * i));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Balance over two identical careers with different start years">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={pad.left} x2={width - pad.right} y1={y(yMax * f)} y2={y(yMax * f)} stroke="var(--color-border)" />
          <text x={pad.left - 6} y={y(yMax * f) + 4} textAnchor="end" style={axisText}>{currency(yMax * f)}</text>
        </g>
      ))}
      <path d={contribPath} fill="none" stroke="var(--color-muted)" strokeWidth={1.4} strokeDasharray="2 4" />
      <path d={path(A)} fill="none" stroke="var(--color-accent)" strokeWidth={2.6} />
      <path d={path(B)} fill="none" stroke="var(--color-link)" strokeWidth={2.6} />
      <text x={x(career) - 4} y={y(A.ending) - 6} textAnchor="end" style={{ ...axisText, fill: "var(--color-accent)", fontWeight: 700 }}>
        A: {A.start}–{A.start + career - 1}
      </text>
      <text x={x(career) - 4} y={y(B.ending) + (Math.abs(y(A.ending) - y(B.ending)) < 18 ? 16 : -6)} textAnchor="end" style={{ ...axisText, fill: "var(--color-link)", fontWeight: 700 }}>
        B: {B.start}–{B.start + career - 1}
      </text>
      {[0, Math.round(career / 2), career].map((yr) => (
        <text key={yr} x={x(yr)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>year {yr}</text>
      ))}
      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={captionText}>
        career year → · dotted = total contributed ({currency(contributed)} by the end)
      </text>
    </svg>
  );
}

function CohortChart({ cohorts, A, B, best, worst, contributed }: { cohorts: Cohort[]; A: Cohort; B: Cohort; best: Cohort; worst: Cohort; contributed: number }) {
  const width = 760, height = 300;
  const pad = { top: 16, right: 18, bottom: 40, left: 60 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const s0 = cohorts[0].start;
  const s1 = cohorts[cohorts.length - 1].start;
  const yMax = best.ending * 1.06;
  const x = (s: number) => pad.left + ((s - s0) / Math.max(1, s1 - s0)) * plotW;
  const y = (v: number) => pad.top + plotH - (Math.min(v, yMax) / yMax) * plotH;
  const line = linePath(cohorts, (c) => x(c.start), (c) => y(c.ending));
  const area = `${line} L${x(s1)},${y(0)} L${x(s0)},${y(0)} Z`;
  const decades = [];
  for (let d = Math.ceil(s0 / 10) * 10; d <= s1; d += 10) decades.push(d);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Ending wealth by career start year">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={pad.left} x2={width - pad.right} y1={y(yMax * f)} y2={y(yMax * f)} stroke="var(--color-border)" />
          <text x={pad.left - 6} y={y(yMax * f) + 4} textAnchor="end" style={axisText}>{currency(yMax * f)}</text>
        </g>
      ))}
      <path d={area} fill="var(--color-accent)" opacity={0.12} />
      <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
      <line x1={pad.left} x2={width - pad.right} y1={y(contributed)} y2={y(contributed)} stroke="var(--color-muted)" strokeWidth={1.2} strokeDasharray="2 4" />
      <text x={width - pad.right - 4} y={y(contributed) - 5} textAnchor="end" style={axisText}>amount contributed</text>
      {[{ c: A, color: "var(--color-accent)", tag: "A" }, { c: B, color: "var(--color-link)", tag: "B" }].map(({ c, color, tag }) => (
        <g key={tag}>
          <circle cx={x(c.start)} cy={y(c.ending)} r={5} fill={color} stroke="var(--color-surface)" strokeWidth={1.5} />
          <text x={x(c.start)} y={y(c.ending) - 9} textAnchor="middle" style={{ ...axisText, fill: color, fontWeight: 700 }}>{tag}</text>
        </g>
      ))}
      {decades.map((d) => (
        <text key={d} x={x(d)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>{d}</text>
      ))}
      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={captionText}>
        career start year → · ending wealth in today's dollars, identical saver every time
      </text>
    </svg>
  );
}
