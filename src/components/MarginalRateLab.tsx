import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import {
  federalTax, findCliffs, irmaa, marginalRate, totalCost, TAX_YEARS,
  type Cliff, type FilingStatus, type Household, type SweepVar,
} from "../lib/usTax";

/**
 * "How is your next dollar taxed?" — the marginal-rate explorer, the companion
 * mode to the next-dollar priority ladder. Sweep extra income (wages, IRA
 * withdrawals, or capital gains) across a household and plot the tax on each
 * ADDITIONAL dollar. The point: "your bracket" is often not your marginal
 * rate — the Social Security tax torpedo, the phantom capital-gains bump, the
 * senior-deduction phase-out, and NIIT stack spikes on top of it; the EIC and
 * CTC phase-ins push it NEGATIVE; and the saver's-credit tiers, the EIC
 * investment-income cutoff, and Medicare's IRMAA aren't rates at all but
 * CLIFFS — lump sums triggered by one dollar.
 *
 * Engine: src/lib/usTax.ts (deliberately simplified; validated against the
 * MMM Case Study Spreadsheet — see scripts/verify-tax-engine.mjs).
 * Educational only, never tax advice.
 */

const SWEEP_MAX = 120_000;
const SWEEP_STEP = 250; // sample resolution of the curve
const DELTA = 10; // finite-difference step for the marginal rate

const money = (x: number) => `${x < 0 ? "−" : ""}$${Math.round(Math.abs(x)).toLocaleString()}`;

interface Preset {
  name: string;
  blurb: string;
  h: Omit<Household, "year">;
  sweep: SweepVar;
  irmaaOn?: boolean;
}
const PRESETS: Preset[] = [
  {
    name: "Retiree: the tax torpedo",
    blurb: "Social Security plus IRA withdrawals — watch the torpedo zone.",
    h: { status: "single", age65: 1, wages: 0, otherOrdinary: 15_000, ssBenefit: 30_000, qdivLtcg: 0, kids: 0, saverContrib: 0 },
    sweep: "otherOrdinary",
  },
  {
    name: "Working family: the rollercoaster",
    blurb: "EIC and child-credit phase-ins pay you to earn — then reverse.",
    h: { status: "single", age65: 0, wages: 8_000, otherOrdinary: 0, ssBenefit: 0, qdivLtcg: 0, kids: 2, saverContrib: 0 },
    sweep: "wages",
  },
  {
    name: "Low-income saver: the cliffs",
    blurb: "One dollar across a saver's-credit tier can cost hundreds.",
    h: { status: "mfj", age65: 0, wages: 46_000, otherOrdinary: 0, ssBenefit: 0, qdivLtcg: 0, kids: 0, saverContrib: 4_000 },
    sweep: "wages",
  },
  {
    name: "Early retiree: harvesting gains",
    blurb: "Living on savings — how much gain fits in the 0% zone?",
    h: { status: "mfj", age65: 0, wages: 0, otherOrdinary: 40_000, ssBenefit: 0, qdivLtcg: 0, kids: 0, saverContrib: 0 },
    sweep: "qdivLtcg",
  },
  {
    name: "Medicare: the IRMAA cliff",
    blurb: "A Roth conversion that crosses a MAGI line raises both spouses' premiums.",
    h: { status: "mfj", age65: 2, wages: 0, otherOrdinary: 185_000, ssBenefit: 35_000, qdivLtcg: 0, kids: 0, saverContrib: 0 },
    sweep: "otherOrdinary",
    irmaaOn: true,
  },
  {
    name: "High earner",
    blurb: "Where NIIT, the CTC phase-out, and the top brackets kick in.",
    h: { status: "single", age65: 0, wages: 180_000, otherOrdinary: 0, ssBenefit: 0, qdivLtcg: 40_000, kids: 0, saverContrib: 0 },
    sweep: "wages",
  },
];

const SWEEP_LABEL: Record<SweepVar, string> = {
  wages: "wages",
  otherOrdinary: "IRA withdrawals",
  qdivLtcg: "realized gains",
};

export default function MarginalRateLab({ header }: { header?: import("react").ReactNode } = {}) {
  const [year, setYear] = useState(TAX_YEARS[TAX_YEARS.length - 1]);
  const [status, setStatus] = useState<FilingStatus>("single");
  const [age65, setAge65] = useState(0);
  const [wages, setWages] = useState(0);
  const [otherOrdinary, setOtherOrdinary] = useState(15_000);
  const [ssBenefit, setSsBenefit] = useState(30_000);
  const [qdivLtcg, setQdivLtcg] = useState(0);
  const [kids, setKids] = useState(0);
  const [saverContrib, setSaverContrib] = useState(0);
  const [includeIrmaa, setIncludeIrmaa] = useState(false);
  const [sweep, setSweep] = useState<SweepVar>("otherOrdinary");

  const applyPreset = (p: Preset) => {
    setStatus(p.h.status);
    setAge65(p.h.age65);
    setWages(p.h.wages);
    setOtherOrdinary(p.h.otherOrdinary);
    setSsBenefit(p.h.ssBenefit);
    setQdivLtcg(p.h.qdivLtcg);
    setKids(p.h.kids);
    setSaverContrib(p.h.saverContrib);
    setIncludeIrmaa(p.irmaaOn ?? false);
    setSweep(p.sweep);
  };

  const irmaaOn = includeIrmaa && age65 > 0;
  const base: Household = { year, status, age65, wages, otherOrdinary, ssBenefit, qdivLtcg, kids, saverContrib };

  const view = useMemo(() => {
    const res = federalTax(base);
    const irmaaRes = irmaa(base);
    const cliffs = findCliffs(base, sweep, SWEEP_MAX, irmaaOn);
    const mNow = marginalRate(base, sweep, DELTA, irmaaOn);

    // Sweep curve: marginal rate on each extra dollar of the chosen kind.
    // Cliffs are lump sums, not rates — subtract any jump inside the finite-
    // difference window so the line stays a rate and the cliff gets a marker.
    const pts: { x: number; m: number }[] = [];
    for (let x = 0; x <= SWEEP_MAX; x += SWEEP_STEP) {
      const h = { ...base, [sweep]: base[sweep] + x };
      const jumps = cliffs.reduce((s, c) => (c.x > x && c.x <= x + DELTA ? s + c.jump : s), 0);
      pts.push({ x, m: marginalRate(h, sweep, DELTA, irmaaOn) - jumps / DELTA });
    }
    // Average (cumulative) rate on the whole swept amount — cliffs included.
    const t0 = totalCost(base, irmaaOn);
    const avg: { x: number; a: number }[] = pts.map(({ x }) => {
      if (x === 0) return { x, a: pts[0].m };
      const h = { ...base, [sweep]: base[sweep] + x };
      return { x, a: (totalCost(h, irmaaOn) - t0) / x };
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
    const minM = Math.min(...pts.map((p) => p.m), 0);
    const nextCliff = cliffs.find((c) => c.x > 0) ?? null;
    return { res, irmaaRes, cliffs, mNow, pts, avg, zones, maxM, minM, nextCliff };
  }, [year, status, age65, wages, otherOrdinary, ssBenefit, qdivLtcg, kids, saverContrib, sweep, irmaaOn]);

  const stickerPct = Math.round(view.res.bracketRate * 100);
  const marginalPct = (view.mNow * 100).toFixed(1);
  const surprise = Math.abs(view.mNow - view.res.bracketRate) > 0.005;

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
            <InfoTip text="Adds the age-65 standard-deduction amount and (2025+) the $6,000-per-person senior deduction, whose 6%-per-person phase-out is itself a hidden marginal-rate bump. Also enables the Medicare IRMAA overlay." />{" "}
            <strong>{age65}</strong>
          </span>
          <input type="range" min={0} max={status === "single" ? 1 : 2} step={1} value={age65} onChange={(e) => setAge65(+e.target.value)} />
        </label>

        <label className="wl-slider">
          <span>
            Wages &amp; self-employment
            <InfoTip text="Earned income. It's what the EIC and the refundable child credit phase IN on — at low incomes, the next earned dollar can have a negative tax rate." />{" "}
            <strong>{money(wages)}</strong>
          </span>
          <input type="range" min={0} max={250_000} step={1_000} value={wages} onChange={(e) => setWages(+e.target.value)} />
        </label>

        <label className="wl-slider">
          <span>
            Pension, IRA withdrawals &amp; conversions
            <InfoTip text="Ordinary income that ISN'T earned: pension, traditional IRA/401(k) withdrawals, Roth conversions. Taxed at bracket rates, but it can't phase in the earned-income credits." />{" "}
            <strong>{money(otherOrdinary)}</strong>
          </span>
          <input type="range" min={0} max={250_000} step={1_000} value={otherOrdinary} onChange={(e) => setOtherOrdinary(+e.target.value)} />
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
            <InfoTip text="Taxed at 0/15/20% — but stacked ON TOP of ordinary income, so ordinary dollars can push gains out of the 0% zone. Also counts as investment income for the EIC's disqualification cap." />{" "}
            <strong>{money(qdivLtcg)}</strong>
          </span>
          <input type="range" min={0} max={150_000} step={1_000} value={qdivLtcg} onChange={(e) => setQdivLtcg(+e.target.value)} />
        </label>

        <label className="wl-slider">
          <span>
            Qualifying children
            <InfoTip text="Children under 17 living with you. Drives the Child Tax Credit (all of them) and the EIC (up to three count)." />{" "}
            <strong>{kids}</strong>
          </span>
          <input type="range" min={0} max={4} step={1} value={kids} onChange={(e) => setKids(+e.target.value)} />
        </label>

        <label className="wl-slider">
          <span>
            Retirement contributions (saver's credit)
            <InfoTip text="401(k)/IRA contributions eligible for the saver's credit. The credit rate is 50%, 20%, or 10% of up to $2,000 per person, by AGI tier — and each tier boundary is a cliff. Enter income AFTER any pre-tax contributions; this slider is just the credit basis (MFJ assumed split evenly)." />{" "}
            <strong>{money(saverContrib)}</strong>
          </span>
          <input type="range" min={0} max={8_000} step={250} value={saverContrib} onChange={(e) => setSaverContrib(+e.target.value)} />
        </label>

        {age65 > 0 && (
          <label className="wl-check" style={{ display: "flex", gap: "0.5rem", alignItems: "baseline", fontFamily: "var(--font-sans)", fontSize: "var(--step--1)" }}>
            <input type="checkbox" checked={includeIrmaa} onChange={(e) => setIncludeIrmaa(e.target.checked)} />
            <span>
              Include Medicare premiums (IRMAA)
              <InfoTip text="This year's MAGI sets Part B and D premiums two years from now. Crossing a threshold by one dollar raises the premium a whole tier for every enrolled person — a cliff, not a rate." />
            </span>
          </label>
        )}

        <div className="wl-field">
          <span className="wl-field-label">Your next dollar is…</span>
          <div className="wl-simmode" role="group" aria-label="Swept income type">
            <button type="button" className={sweep === "wages" ? "active" : ""} aria-pressed={sweep === "wages"} onClick={() => setSweep("wages")}>Wages</button>
            <button type="button" className={sweep === "otherOrdinary" ? "active" : ""} aria-pressed={sweep === "otherOrdinary"} onClick={() => setSweep("otherOrdinary")}>IRA / conversion</button>
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
            {view.nextCliff
              ? <>— and {money(view.nextCliff.x)} further sits a {money(view.nextCliff.jump)} cliff: one dollar across it costs {money(view.nextCliff.jump)} all at once.</>
              : surprise
                ? "— the hidden mechanisms below are stacking on top of (or against) the bracket rate."
                : "— matching the bracket here, but drag the sliders and watch the spikes appear."}
          </span>
        </div>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          <strong>Simplified on purpose:</strong> single/MFJ only (no head-of-household), standard
          deduction only, no state tax, no AMT, no payroll tax, no dependent-care or education
          credits. The credits that ARE here — EIC (with its investment-income cutoff), Child Tax
          Credit (phase-out smoothed), saver's credit, and the IRMAA premium overlay — use real IRS
          parameters ({TAX_YEARS[0]}–{TAX_YEARS[TAX_YEARS.length - 1]}) and the real mechanisms. Real
          returns differ. Educational only, <strong>not tax advice</strong>.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>The tax on each additional dollar</h3>
          <MarginalCurve pts={view.pts} avg={view.avg} zones={view.zones} cliffs={view.cliffs} maxM={view.maxM} minM={view.minM} sweep={sweep} />
          <p className="wl-fnote">
            The stepped line is the <strong>marginal rate</strong> — the tax on the next dollar as you add{" "}
            {SWEEP_LABEL[sweep]} beyond today's {money(base[sweep])}. The smooth line is the{" "}
            <strong>average rate</strong> on everything added so far. Below 0% the government is paying{" "}
            <em>you</em> to earn the next dollar; red flags are <strong>cliffs</strong> — lump sums lost the
            instant one dollar crosses a line. Valleys are planning opportunities (fill them deliberately —
            that's what "size your Roth conversion" means); cliffs are stopping points (land $1 under, not
            $1 over).
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <dl className="ss-stats">
              <div><dt>{view.res.tax < 0 ? "Federal refund (credits > tax)" : "Federal tax at today's income"}</dt><dd>{money(Math.abs(view.res.tax))}</dd></div>
              <div><dt>Taxable part of Social Security</dt><dd>{money(view.res.taxableSS)}</dd></div>
              <div><dt>Standard (+senior) deduction</dt><dd>{money(view.res.deduction)}</dd></div>
              {view.res.eic > 0 && <div><dt>Earned Income Credit</dt><dd>{money(view.res.eic)}</dd></div>}
              {view.res.ctc + view.res.actc > 0 && <div><dt>Child Tax Credit (incl. refundable)</dt><dd>{money(view.res.ctc + view.res.actc)}</dd></div>}
              {view.res.saversCredit > 0 && <div><dt>Saver's credit</dt><dd>{money(view.res.saversCredit)}</dd></div>}
              {irmaaOn && <div><dt>Medicare Part B+D premiums (tier {view.irmaaRes.tier})</dt><dd>{money(view.irmaaRes.annualTotal)}/yr</dd></div>}
            </dl>
            <p className="wl-saved">
              The bracket table is a map of the <em>middle</em> of the tax system; the edges are where the
              surprises live. Every phase-in, phase-out, and threshold — Social Security taxability, the 0%
              gains zone, the EIC and child credit, the saver's-credit tiers, the senior deduction, NIIT,
              Medicare's IRMAA — creates a stretch where your next dollar is taxed far above (or below) its
              bracket, or triggers a lump sum outright. Knowing the shape of <em>your</em> curve is what
              turns tax planning from folklore into arithmetic. <a href="/personal-finance/next-dollar">And
              once you know the rate, the ladder tells you where that dollar should go →</a> Educational
              only, not advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MarginalCurve({ pts, avg, zones, cliffs, maxM, minM, sweep }: {
  pts: { x: number; m: number }[];
  avg: { x: number; a: number }[];
  zones: { from: number; to: number; m: number }[];
  cliffs: Cliff[];
  maxM: number;
  minM: number;
  sweep: SweepVar;
}) {
  const width = 760, height = 380;
  const pad = { top: 26, right: 18, bottom: 44, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const yMax = Math.min(0.65, maxM * 1.18);
  const yMin = minM < 0 ? Math.max(-0.65, minM * 1.12) : 0;
  const x = (v: number) => pad.left + (v / SWEEP_MAX) * plotW;
  const y = (m: number) => pad.top + plotH - ((Math.max(yMin, Math.min(m, yMax)) - yMin) / (yMax - yMin)) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  // Step path for the marginal rate.
  let step = `M${x(pts[0].x)},${y(pts[0].m)}`;
  for (let i = 1; i < pts.length; i++) step += ` L${x(pts[i].x)},${y(pts[i - 1].m)} L${x(pts[i].x)},${y(pts[i].m)}`;
  const avgPath = avg.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.x)},${y(p.a)}`).join(" ");

  // Label the widest few zones with their rate.
  const labeled = [...zones].sort((a, b) => (b.to - b.from) - (a.to - a.from)).slice(0, 5);

  const gridVals: number[] = [];
  for (let v = 0; v <= yMax; v += 0.1) gridVals.push(+v.toFixed(1));
  for (let v = -0.1; v >= yMin; v -= 0.1) gridVals.push(+v.toFixed(1));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Marginal and average federal tax rate on each additional dollar, with cliff markers">
      {gridVals.map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeWidth={v === 0 ? 1.8 : 1} />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{Math.round(v * 100)}%</text>
        </g>
      ))}
      {zones.filter((z) => z.m > 0).map((z, i) => (
        <rect key={i} x={x(z.from)} y={y(z.m)} width={Math.max(0, x(z.to) - x(z.from))} height={Math.max(0, y(0) - y(z.m))} fill="var(--color-warn)" opacity={0.05 + 0.3 * Math.min(1, z.m / yMax)} />
      ))}
      {zones.filter((z) => z.m < 0).map((z, i) => (
        <rect key={i} x={x(z.from)} y={y(0)} width={Math.max(0, x(z.to) - x(z.from))} height={Math.max(0, y(z.m) - y(0))} fill="var(--color-accent)" opacity={0.1 + 0.3 * Math.min(1, z.m / yMin || 0)} />
      ))}
      <path d={avgPath} fill="none" stroke="var(--color-link)" strokeWidth={1.8} strokeDasharray="5 4" />
      <path d={step} fill="none" stroke="var(--color-warn)" strokeWidth={2.4} strokeLinejoin="round" />
      {cliffs.map((c, i) => (
        <g key={i}>
          <line x1={x(c.x)} x2={x(c.x)} y1={pad.top} y2={pad.top + plotH} stroke="var(--color-error)" strokeWidth={1.6} strokeDasharray="3 3" />
          <text x={x(c.x)} y={pad.top + 12 + (i % 2) * 13} textAnchor={x(c.x) > width - 90 ? "end" : "start"} dx={x(c.x) > width - 90 ? -4 : 4} style={{ ...axisText, fill: "var(--color-error)", fontWeight: 700, fontSize: 11.5 }}>
            ▼ {money(c.jump)} cliff
          </text>
        </g>
      ))}
      {labeled.map((z, i) => (
        <text key={i} x={x((z.from + z.to) / 2)} y={y(z.m) + (z.m < 0 ? 14 : -6)} textAnchor="middle" style={{ ...axisText, fill: "var(--color-text)", fontWeight: 700, fontSize: 11.5 }}>
          {(z.m * 100).toFixed(1)}%
        </text>
      ))}
      {[0, SWEEP_MAX / 2, SWEEP_MAX].map((v) => (
        <text key={v} x={x(v)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>+{money(v)}</text>
      ))}
      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Extra {SWEEP_LABEL[sweep]} → · solid = marginal rate · dashed = average rate · red = cliff
      </text>
    </svg>
  );
}
