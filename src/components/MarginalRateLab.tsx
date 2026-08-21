import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import { federalTax, marginalRate, TAX_YEARS, type FilingStatus, type Household, type SweepVar } from "../lib/usTax";

/**
 * "How is your next dollar taxed?" — the marginal-rate explorer, the companion
 * mode to the next-dollar priority ladder. Sweep extra income (ordinary or
 * capital gains) across a household and plot the tax on each ADDITIONAL
 * dollar. The point: "your bracket" is often not your marginal rate — the
 * Social Security tax torpedo, the phantom capital-gains bump, the senior-
 * deduction phase-out, and NIIT all show up as spikes.
 *
 * Engine: src/lib/usTax.ts (deliberately simplified; validated against the
 * MMM Case Study Spreadsheet — see scripts/verify-tax-engine.mjs).
 * Educational only, never tax advice.
 */

const SWEEP_MAX = 120_000;
const SWEEP_STEP = 250; // sample resolution of the curve
const DELTA = 10; // finite-difference step for the marginal rate

const money = (x: number) => `$${Math.round(x).toLocaleString()}`;

interface Preset {
  name: string;
  blurb: string;
  h: Omit<Household, "year">;
  sweep: SweepVar;
}
const PRESETS: Preset[] = [
  {
    name: "Retiree: the tax torpedo",
    blurb: "Social Security plus IRA withdrawals — watch the torpedo zone.",
    h: { status: "single", age65: 1, ordinary: 15_000, ssBenefit: 30_000, qdivLtcg: 0 },
    sweep: "ordinary",
  },
  {
    name: "Early retiree: harvesting gains",
    blurb: "Living on savings — how much gain fits in the 0% zone?",
    h: { status: "mfj", age65: 0, ordinary: 40_000, ssBenefit: 0, qdivLtcg: 0 },
    sweep: "qdivLtcg",
  },
  {
    name: "High earner",
    blurb: "Where NIIT and the top brackets kick in.",
    h: { status: "single", age65: 0, ordinary: 180_000, ssBenefit: 0, qdivLtcg: 40_000 },
    sweep: "ordinary",
  },
];

export default function MarginalRateLab({ header }: { header?: import("react").ReactNode } = {}) {
  const [year, setYear] = useState(TAX_YEARS[TAX_YEARS.length - 1]);
  const [status, setStatus] = useState<FilingStatus>("single");
  const [age65, setAge65] = useState(0);
  const [ordinary, setOrdinary] = useState(15_000);
  const [ssBenefit, setSsBenefit] = useState(30_000);
  const [qdivLtcg, setQdivLtcg] = useState(0);
  const [sweep, setSweep] = useState<SweepVar>("ordinary");

  const applyPreset = (p: Preset) => {
    setStatus(p.h.status);
    setAge65(p.h.age65);
    setOrdinary(p.h.ordinary);
    setSsBenefit(p.h.ssBenefit);
    setQdivLtcg(p.h.qdivLtcg);
    setSweep(p.sweep);
  };

  const base: Household = { year, status, age65, ordinary, ssBenefit, qdivLtcg };

  const view = useMemo(() => {
    const res = federalTax(base);
    const mNow = marginalRate(base, sweep, DELTA);
    // Sweep curve: marginal rate on each extra dollar of the chosen kind.
    const pts: { x: number; m: number }[] = [];
    for (let x = 0; x <= SWEEP_MAX; x += SWEEP_STEP) {
      const h = { ...base, [sweep]: base[sweep] + x };
      pts.push({ x, m: marginalRate(h, sweep, DELTA) });
    }
    // Average (cumulative) rate on the whole swept amount.
    const t0 = res.tax;
    const avg: { x: number; a: number }[] = pts.map(({ x }) => {
      if (x === 0) return { x, a: pts[0].m };
      const h = { ...base, [sweep]: base[sweep] + x };
      return { x, a: (federalTax(h).tax - t0) / x };
    });
    // Zone breakpoints for annotation: where the marginal rate changes.
    const zones: { from: number; to: number; m: number }[] = [];
    let start = 0;
    for (let i = 1; i <= pts.length; i++) {
      if (i === pts.length || Math.abs(pts[i].m - pts[start].m) > 0.004) {
        zones.push({ from: pts[start].x, to: i === pts.length ? SWEEP_MAX : pts[i].x, m: pts[start].m });
        start = i;
      }
    }
    const maxM = Math.max(...pts.map((p) => p.m), 0.3);
    return { res, mNow, pts, avg, zones, maxM };
  }, [year, status, age65, ordinary, ssBenefit, qdivLtcg, sweep]);

  const stickerPct = Math.round(view.res.bracketRate * 100);
  const marginalPct = (view.mNow * 100).toFixed(1);
  const surprise = view.mNow - view.res.bracketRate > 0.005;

  return (
    <div className="wl">
      <div className="wl-controls">
        {header}
        <div className="wl-presets" style={{ marginBottom: "var(--space-xs)" }}>
          <span className="wl-presets-label">Try a scenario:</span>
          {PRESETS.map((p) => (
            <button key={p.name} type="button" className="wl-chip" title={p.blurb} onClick={() => applyPreset(p)}>
              {p.name}
            </button>
          ))}
        </div>

        <div className="wl-simmode" role="group" aria-label="Filing status">
          <button type="button" className={status === "single" ? "active" : ""} aria-pressed={status === "single"} onClick={() => { setStatus("single"); setAge65(Math.min(age65, 1)); }}>Single</button>
          <button type="button" className={status === "mfj" ? "active" : ""} aria-pressed={status === "mfj"} onClick={() => setStatus("mfj")}>Married filing jointly</button>
        </div>

        <label className="wl-slider">
          <span>
            People 65 or older
            <InfoTip text="Adds the age-65 standard-deduction amount and (2025+) the $6,000-per-person senior deduction, whose 6% phase-out is itself a hidden marginal-rate bump." />{" "}
            <strong>{age65}</strong>
          </span>
          <input type="range" min={0} max={status === "single" ? 1 : 2} step={1} value={age65} onChange={(e) => setAge65(+e.target.value)} />
        </label>

        <label className="wl-slider">
          <span>
            Ordinary income
            <InfoTip text="Wages, pension, and traditional IRA/401(k) withdrawals or Roth conversions — everything taxed at the regular bracket rates." />{" "}
            <strong>{money(ordinary)}</strong>
          </span>
          <input type="range" min={0} max={250_000} step={1_000} value={ordinary} onChange={(e) => setOrdinary(+e.target.value)} />
        </label>

        <label className="wl-slider">
          <span>
            Social Security benefits
            <InfoTip text="Annual gross benefits. Between the provisional-income thresholds, each extra ordinary dollar drags up to $0.85 of benefits into taxable income — the 'tax torpedo'." />{" "}
            <strong>{money(ssBenefit)}</strong>
          </span>
          <input type="range" min={0} max={72_000} step={1_000} value={ssBenefit} onChange={(e) => setSsBenefit(+e.target.value)} />
        </label>

        <label className="wl-slider">
          <span>
            Qualified dividends + long-term gains
            <InfoTip text="Taxed at 0/15/20% — but stacked ON TOP of ordinary income, so ordinary dollars can push gains out of the 0% zone." />{" "}
            <strong>{money(qdivLtcg)}</strong>
          </span>
          <input type="range" min={0} max={150_000} step={1_000} value={qdivLtcg} onChange={(e) => setQdivLtcg(+e.target.value)} />
        </label>

        <div className="wl-field">
          <span className="wl-field-label">Your next dollar is…</span>
          <div className="wl-simmode" role="group" aria-label="Swept income type">
            <button type="button" className={sweep === "ordinary" ? "active" : ""} aria-pressed={sweep === "ordinary"} onClick={() => setSweep("ordinary")}>Ordinary income</button>
            <button type="button" className={sweep === "qdivLtcg" ? "active" : ""} aria-pressed={sweep === "qdivLtcg"} onClick={() => setSweep("qdivLtcg")}>Realized gains</button>
          </div>
        </div>

        <label className="wl-slider" style={{ maxWidth: 160 }}>
          <span>Tax year <strong>{year}</strong></span>
          <input type="range" min={TAX_YEARS[0]} max={TAX_YEARS[TAX_YEARS.length - 1]} step={1} value={year} onChange={(e) => setYear(+e.target.value)} />
        </label>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">You'd guess the {stickerPct}% bracket. Your next dollar is actually taxed at</span>
          <span className="ss-headline-value" style={{ color: surprise ? "var(--color-warn)" : "var(--color-accent)" }}>{marginalPct}%</span>
          <span className="ss-headline-sub">
            {surprise
              ? "— the hidden mechanisms below are stacking on top of the bracket rate."
              : "— matching the bracket here, but drag the sliders and watch the spikes appear."}
          </span>
        </div>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          <strong>Simplified on purpose:</strong> single/MFJ, standard deduction only, no state tax,
          no AMT, no credits, no payroll tax. Those omissions mean real returns differ — but the
          mechanisms shown (Social Security taxability, capital-gains stacking, the senior-deduction
          phase-out, NIIT) are real and exact. Parameters: IRS revenue procedures{" "}
          {TAX_YEARS[0]}–{TAX_YEARS[TAX_YEARS.length - 1]}. Educational only, <strong>not tax advice</strong>.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>The tax on each additional dollar</h3>
          <MarginalCurve pts={view.pts} avg={view.avg} zones={view.zones} maxM={view.maxM} sweep={sweep} />
          <p className="wl-fnote">
            The stepped line is the <strong>marginal rate</strong> — the tax on the next dollar as you add{" "}
            {sweep === "ordinary" ? "ordinary income" : "realized gains"} beyond today's{" "}
            {money(base[sweep])}. The smooth line is the <strong>average rate</strong> on everything added
            so far. Spikes above the bracket rates are the hidden mechanisms; valleys are planning
            opportunities (fill them deliberately — that's what "size your Roth conversion" means).
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <dl className="ss-stats">
              <div><dt>Federal tax at today's income</dt><dd>{money(view.res.tax)}</dd></div>
              <div><dt>Taxable part of Social Security</dt><dd>{money(view.res.taxableSS)}</dd></div>
              <div><dt>Standard (+senior) deduction</dt><dd>{money(view.res.deduction)}</dd></div>
              <div><dt>Taxable income</dt><dd>{money(view.res.taxableIncome)}</dd></div>
            </dl>
            <p className="wl-saved">
              The bracket table is a map of the <em>middle</em> of the tax system; the edges are where the
              surprises live. Every phase-in and phase-out — Social Security taxability, the 0% gains zone,
              the senior deduction, NIIT — creates a stretch where your next dollar is taxed far above (or
              below) its bracket. Knowing the shape of <em>your</em> curve is what turns tax planning from
              folklore into arithmetic. <a href="/personal-finance/next-dollar">And once you know the rate,
              the ladder tells you where that dollar should go →</a> Educational only, not advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MarginalCurve({ pts, avg, zones, maxM, sweep }: {
  pts: { x: number; m: number }[];
  avg: { x: number; a: number }[];
  zones: { from: number; to: number; m: number }[];
  maxM: number;
  sweep: SweepVar;
}) {
  const width = 760, height = 380;
  const pad = { top: 26, right: 18, bottom: 44, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const yMax = Math.min(0.65, maxM * 1.18);
  const x = (v: number) => pad.left + (v / SWEEP_MAX) * plotW;
  const y = (m: number) => pad.top + plotH - (Math.min(m, yMax) / yMax) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  // Step path for the marginal rate.
  let step = `M${x(pts[0].x)},${y(pts[0].m)}`;
  for (let i = 1; i < pts.length; i++) step += ` L${x(pts[i].x)},${y(pts[i - 1].m)} L${x(pts[i].x)},${y(pts[i].m)}`;
  const avgPath = avg.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.x)},${y(p.a)}`).join(" ");

  // Label the widest few zones with their rate.
  const labeled = [...zones].sort((a, b) => (b.to - b.from) - (a.to - a.from)).slice(0, 5);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Marginal and average federal tax rate on each additional dollar">
      {[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6].filter((v) => v <= yMax).map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{Math.round(v * 100)}%</text>
        </g>
      ))}
      {zones.map((z, i) => (
        <rect key={i} x={x(z.from)} y={y(z.m)} width={Math.max(0, x(z.to) - x(z.from))} height={pad.top + plotH - y(z.m)} fill="var(--color-warn)" opacity={0.05 + 0.3 * Math.min(1, z.m / yMax)} />
      ))}
      <path d={avgPath} fill="none" stroke="var(--color-link)" strokeWidth={1.8} strokeDasharray="5 4" />
      <path d={step} fill="none" stroke="var(--color-warn)" strokeWidth={2.4} strokeLinejoin="round" />
      {labeled.map((z, i) => (
        <text key={i} x={x((z.from + z.to) / 2)} y={y(z.m) - 6} textAnchor="middle" style={{ ...axisText, fill: "var(--color-text)", fontWeight: 700, fontSize: 11.5 }}>
          {(z.m * 100).toFixed(1)}%
        </text>
      ))}
      {[0, SWEEP_MAX / 2, SWEEP_MAX].map((v) => (
        <text key={v} x={x(v)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>+{money(v)}</text>
      ))}
      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Extra {sweep === "ordinary" ? "ordinary income" : "realized gains"} → · solid = marginal rate · dashed = average rate
      </text>
    </svg>
  );
}
