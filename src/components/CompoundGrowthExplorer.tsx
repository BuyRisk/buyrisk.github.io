import { useId, useMemo, useRef, useState } from "react";
import InfoTip from "./InfoTip";
import { bootstrapReturns, bandsOverTime, quantile, mean, HISTORY } from "../lib/bootstrap";

/**
 * Interactive compound-growth explorer.
 *
 * A React island (hydrated client-side) that projects the future value of an
 * initial investment plus recurring monthly contributions, and draws the
 * growth curve as an inline SVG. Pure client-side math — no dependencies.
 */

type Phase = { id: number; startYear: number; monthly: number };

type Projection = {
  points: { year: number; balance: number; contributed: number }[];
  finalBalance: number;
  totalContributed: number;
  totalGrowth: number;
  depletedYear: number | null;
};

function project(
  principal: number,
  monthly: number,
  annualRatePct: number,
  years: number,
  phases: Phase[] = []
): Projection {
  const monthlyRate = annualRatePct / 100 / 12;
  const sorted = [...phases].sort((a, b) => a.startYear - b.startYear);
  // Contribution in effect during a given (fractional) year. Later phases with
  // startYear <= the current year override earlier ones; negative = withdrawal.
  const monthlyFor = (year: number) => {
    let m = monthly;
    for (const p of sorted) if (year >= p.startYear) m = p.monthly;
    return m;
  };

  const points: Projection["points"] = [
    { year: 0, balance: principal, contributed: principal },
  ];
  let balance = principal;
  let contributed = principal;
  let depletedYear: number | null = null;

  for (let month = 1; month <= years * 12; month++) {
    const grown = balance * (1 + monthlyRate);
    const wanted = monthlyFor((month - 1) / 12);
    let applied = wanted;
    balance = grown + wanted;
    if (balance < 0) {
      // Can't withdraw more than the account holds.
      applied = -grown;
      balance = 0;
      if (depletedYear === null) depletedYear = month / 12;
    }
    contributed += applied;
    if (month % 12 === 0) {
      points.push({ year: month / 12, balance, contributed });
    }
  }

  return {
    points,
    finalBalance: balance,
    totalContributed: contributed,
    totalGrowth: balance - contributed,
    depletedYear,
  };
}

/**
 * Inverse of `project`: the monthly contribution needed to reach `target` by
 * the end of the horizon, holding everything else constant. Closed-form annuity
 * solution — no iteration. Can be negative if the starting amount alone already
 * overshoots the target (the caller clamps at zero and explains).
 */
function requiredMonthly(
  target: number,
  principal: number,
  annualRatePct: number,
  years: number
): number {
  const r = annualRatePct / 100 / 12;
  const n = Math.round(years * 12);
  if (n <= 0) return 0;
  const fvPrincipal = principal * Math.pow(1 + r, n);
  if (Math.abs(r) < 1e-12) return (target - principal) / n;
  const annuityFactor = (Math.pow(1 + r, n) - 1) / r;
  return (target - fvPrincipal) / annuityFactor;
}

/**
 * Human capital at a given age: the present value of remaining labor income up
 * to retirement. Income grows at `growthPct`/yr from its value at `startAge`,
 * discounted back at `discountPct`/yr. Falls to zero at retirement.
 */
function humanCapital(
  atAge: number,
  startAge: number,
  income: number,
  growthPct: number,
  discountPct: number,
  retireAge: number
): number {
  const g = growthPct / 100;
  const d = discountPct / 100;
  let hc = 0;
  for (let a = Math.floor(atAge); a < retireAge; a++) {
    const inc = income * Math.pow(1 + g, a - startAge);
    hc += inc / Math.pow(1 + d, a - atAge);
  }
  return hc;
}

// Format a dollar amount, staying readable across a huge dynamic range.
// Realistic figures show in full ($447,156); once numbers get absurd — as they
// do over centuries of compounding — we switch to compact (…B, …T) and then
// scientific notation so labels and stat cards never overflow.
function formatCurrency(n: number, { alwaysCompact = false } = {}): string {
  const abs = Math.abs(n);
  const notation =
    abs >= 1e15 ? "scientific" : alwaysCompact || abs >= 1e9 ? "compact" : "standard";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    notation,
    maximumFractionDigits: notation === "standard" ? 0 : 1,
  });
}

const currency = (n: number) => formatCurrency(n);
const compactCurrency = (n: number) => formatCurrency(n, { alwaysCompact: true });

function Chart({ points }: { points: Projection["points"] }) {
  const width = 640;
  const height = 260;
  const pad = { top: 16, right: 16, bottom: 28, left: 56 };

  const maxBalance = Math.max(...points.map((p) => p.balance), 1);
  const maxYear = Math.max(...points.map((p) => p.year), 1);

  const x = (year: number) =>
    pad.left + (year / maxYear) * (width - pad.left - pad.right);
  const y = (value: number) =>
    height - pad.bottom - (value / maxBalance) * (height - pad.top - pad.bottom);

  const line = (key: "balance" | "contributed") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.year)},${y(p[key])}`).join(" ");

  const area = `${line("balance")} L${x(maxYear)},${height - pad.bottom} L${x(
    0
  )},${height - pad.bottom} Z`;

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => {
    const value = (maxBalance / yTicks) * i;
    return { value, y: y(value) };
  });

  return (
    <svg
      className="cge-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Line chart showing projected balance versus total contributions over time"
    >
      {ticks.map((t) => (
        <g key={t.value}>
          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={t.y}
            y2={t.y}
            className="cge-gridline"
          />
          <text x={pad.left - 8} y={t.y + 4} className="cge-axis-label" textAnchor="end">
            {compactCurrency(t.value)}
          </text>
        </g>
      ))}

      <path d={area} className="cge-area" />
      <path d={line("balance")} className="cge-line cge-line--balance" />
      <path d={line("contributed")} className="cge-line cge-line--contributed" />

      <text x={x(maxYear)} y={height - 8} className="cge-axis-label" textAnchor="end">
        {maxYear} yrs
      </text>
      <text x={pad.left} y={height - 8} className="cge-axis-label" textAnchor="start">
        Year 0
      </text>
    </svg>
  );
}

type NumberFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
  integer?: boolean;
  info?: string;
  onCommit: (value: number) => void;
};

/**
 * A labelled control that can be set either by dragging the slider or by
 * typing an exact value. Typed values outside [min, max] surface a small
 * "value out of range" message and are not applied to the projection until
 * corrected; the slider always reflects the last valid committed value.
 */
function NumberField({
  label,
  value,
  min,
  max,
  step,
  prefix,
  suffix,
  integer,
  info,
  onCommit,
}: NumberFieldProps) {
  const [text, setText] = useState(() => String(value));
  const [error, setError] = useState(false);
  const errorId = useId();

  const parse = (raw: string) => Number(raw.replace(/[,$%\s]/g, ""));

  const handleType = (raw: string) => {
    setText(raw);
    const cleaned = raw.replace(/[,$%\s]/g, "");
    if (cleaned === "") {
      setError(false); // empty while editing isn't an error, just don't commit
      return;
    }
    const parsed = parse(raw);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      setError(true);
      return;
    }
    setError(false);
    onCommit(integer ? Math.round(parsed) : parsed);
  };

  const handleSlider = (n: number) => {
    setError(false);
    setText(String(n));
    onCommit(n);
  };

  const handleBlur = () => {
    const parsed = parse(text);
    if (Number.isFinite(parsed) && parsed >= min && parsed <= max) {
      const v = integer ? Math.round(parsed) : parsed;
      setText(integer ? v.toLocaleString("en-US") : String(v));
      setError(false);
    } else if (text.replace(/[,$%\s]/g, "") === "") {
      setText(String(value)); // restore last valid value if left blank
      setError(false);
    }
  };

  return (
    <div className="cge-field">
      <div className="cge-label">
        <span>
          {label}
          {info && <InfoTip text={info} />}
        </span>
        <span className="cge-value-box" data-invalid={error || undefined}>
          {prefix && <span className="cge-adorn">{prefix}</span>}
          <input
            className="cge-value-input"
            type="text"
            inputMode="decimal"
            value={text}
            aria-label={label}
            aria-invalid={error}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => handleType(e.target.value)}
            onBlur={handleBlur}
          />
          {suffix && <span className="cge-adorn">{suffix}</span>}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={`${label} slider`}
        onChange={(e) => handleSlider(Number(e.target.value))}
      />
      {error && (
        <span className="cge-error" id={errorId} role="alert">
          value out of range
        </span>
      )}
    </div>
  );
}

type LifePoint = { age: number; fin: number; hc: number; total: number };

function LifecycleChart({ data, retireAge }: { data: LifePoint[]; retireAge: number }) {
  const width = 680;
  const height = 280;
  const pad = { top: 16, right: 16, bottom: 36, left: 62 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const ageMin = data[0]?.age ?? 30;
  const ageMax = data[data.length - 1]?.age ?? 65;
  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  const x = (age: number) => pad.left + ((age - ageMin) / (ageMax - ageMin || 1)) * plotW;
  const y = (v: number) => height - pad.bottom - (v / maxTotal) * plotH;

  const finArea =
    "M" + data.map((d) => `${x(d.age)},${y(d.fin)}`).join(" L") +
    ` L${x(ageMax)},${y(0)} L${x(ageMin)},${y(0)} Z`;
  const hcArea =
    "M" + data.map((d) => `${x(d.age)},${y(d.total)}`).join(" L") + " L" +
    [...data].reverse().map((d) => `${x(d.age)},${y(d.fin)}`).join(" L") + " Z";

  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;
  const showRetire = retireAge > ageMin && retireAge < ageMax;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Human capital and financial capital over your lifetime">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={pad.left} x2={width - pad.right} y1={y(maxTotal * f)} y2={y(maxTotal * f)} stroke="var(--color-border)" />
          <text x={pad.left - 8} y={y(maxTotal * f) + 4} textAnchor="end" style={axisText}>{compactCurrency(maxTotal * f)}</text>
        </g>
      ))}
      <path d={finArea} fill="var(--color-accent)" opacity={0.75} />
      <path d={hcArea} fill="var(--pl-c3)" opacity={0.55} />
      {showRetire && (
        <>
          <line x1={x(retireAge)} x2={x(retireAge)} y1={pad.top} y2={height - pad.bottom} stroke="var(--color-text)" strokeWidth={1} strokeDasharray="3 3" />
          <text x={x(retireAge)} y={pad.top + 2} textAnchor="middle" style={{ ...axisText, fontSize: 10 }}>retire {retireAge}</text>
        </>
      )}
      {data.filter((_, i) => i % Math.ceil(data.length / 6) === 0).map((d) => (
        <text key={d.age} x={x(d.age)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>{Math.round(d.age)}</text>
      ))}
      <text x={pad.left + plotW / 2} y={height - 3} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>Age →</text>
    </svg>
  );
}

// --- Historical (block-bootstrap) accumulation panel --------------------------

const HIST_PATHS = 1200;
const HIST_BLOCK = 5;
const HIST_SEED = 135790;

/**
 * The honest counterpart to the smooth-curve projection: run the same starting
 * amount + monthly contributions through {@link HIST_PATHS} alternate histories
 * stitched from real US returns, and show the *range* of where you might land —
 * plus the skew that a single "average return" hides. Everything is in today's
 * dollars (real returns), so no separate inflation step is needed.
 */
function HistoricalGrowthPanel({
  principal,
  monthly,
  years,
  stockPct,
  target,
  isGoal,
}: {
  principal: number;
  monthly: number;
  years: number;
  stockPct: number;
  target: number;
  isGoal: boolean;
}) {
  const stats = useMemo(() => {
    const annual = monthly * 12;
    const paths = bootstrapReturns({
      years,
      paths: HIST_PATHS,
      blockLen: HIST_BLOCK,
      stockPct: stockPct / 100,
      real: true,
      seed: HIST_SEED,
    });
    const balances: number[][] = new Array(HIST_PATHS);
    for (let p = 0; p < HIST_PATHS; p++) {
      const row = new Array<number>(years + 1);
      row[0] = principal;
      let bal = principal;
      for (let y = 0; y < years; y++) {
        bal = bal * (1 + paths[p][y]) + annual;
        row[y + 1] = bal;
      }
      balances[p] = row;
    }
    const finals = balances.map((b) => b[years]);
    return {
      bands: bandsOverTime(balances, [0.1, 0.25, 0.5, 0.75, 0.9]),
      median: quantile(finals, 0.5),
      mean: mean(finals),
      p10: quantile(finals, 0.1),
      p90: quantile(finals, 0.9),
      hitTarget: target > 0 ? finals.filter((f) => f >= target).length / finals.length : null,
    };
  }, [principal, monthly, years, stockPct, target]);

  return (
    <div className="cge-output">
      <div className="sk-headline">
        <span className="sk-headline-label">Typical ending balance (today's dollars)</span>
        <span className="sk-headline-value">{compactCurrency(stats.median)}</span>
      </div>
      <GrowthFan bands={stats.bands} years={years} />
      <dl className="cge-stats" style={{ marginTop: "var(--space-md)" }}>
        <div className="cge-stat">
          <dt>Typical (median)</dt>
          <dd>{currency(stats.median)}</dd>
        </div>
        <div className="cge-stat">
          <dt>Average (mean)</dt>
          <dd className="cge-stat--accent">{currency(stats.mean)}</dd>
        </div>
        <div className="cge-stat">
          <dt>Unlucky 10% below</dt>
          <dd>{currency(stats.p10)}</dd>
        </div>
      </dl>
      <p className="cge-note" style={{ marginTop: "var(--space-sm)" }}>
        The <strong>average is well above the typical</strong> result — a handful of
        lucky return-sequences drag the mean up while most outcomes land lower. Real
        growth isn't a smooth line; it's a wide, right-skewed fan.{" "}
        {isGoal && stats.hitTarget !== null && (
          <>
            About <strong>{Math.round(stats.hitTarget * 100)}%</strong> of histories
            reached your target.
          </>
        )}
      </p>
      <p className="cge-note">
        {HIST_PATHS.toLocaleString()} alternate timelines, block-bootstrapped from
        real US returns ({HISTORY.span[0]}–{HISTORY.span[1]}). Data: Aswath Damodaran.
      </p>
    </div>
  );
}

function GrowthFan({ bands, years }: { bands: { p: number; series: number[] }[]; years: number }) {
  const width = 640;
  const height = 260;
  const pad = { top: 14, right: 14, bottom: 28, left: 58 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const byP = (p: number) => bands.find((b) => Math.abs(b.p - p) < 1e-9)!.series;
  const b10 = byP(0.1), b25 = byP(0.25), b50 = byP(0.5), b75 = byP(0.75), b90 = byP(0.9);
  const yMax = Math.max(...b90, 1) * 1.05;
  const x = (t: number) => pad.left + (t / years) * plotW;
  const y = (v: number) => height - pad.bottom - (Math.max(0, v) / yMax) * plotH;
  const areaPath = (lo: number[], hi: number[]) =>
    "M" + hi.map((v, t) => `${x(t)},${y(v)}`).join(" L") + " L" +
    lo.map((v, t) => ({ v, t })).reverse().map(({ v, t }) => `${x(t)},${y(v)}`).join(" L") + " Z";
  const median = "M" + b50.map((v, t) => `${x(t)},${y(v)}`).join(" L");
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  return (
    <svg className="cge-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Fan chart of possible balances across simulated histories">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={pad.left} x2={width - pad.right} y1={y(yMax * f)} y2={y(yMax * f)} className="cge-gridline" />
          <text x={pad.left - 6} y={y(yMax * f) + 4} textAnchor="end" style={axisText}>{compactCurrency(yMax * f)}</text>
        </g>
      ))}
      <path d={areaPath(b10, b90)} fill="var(--color-accent)" opacity={0.16} />
      <path d={areaPath(b25, b75)} fill="var(--color-accent)" opacity={0.28} />
      <path d={median} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} />
      {[0, Math.round(years / 2), years].map((t) => (
        <text key={t} x={x(t)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>{t === 0 ? "now" : `yr ${t}`}</text>
      ))}
    </svg>
  );
}

export default function CompoundGrowthExplorer() {
  const [mode, setMode] = useState<"project" | "goal">("project");
  const [principal, setPrincipal] = useState(10_000);
  const [monthly, setMonthly] = useState(300);
  const [rate, setRate] = useState(10);
  const [inflation, setInflation] = useState(3);
  const [fee, setFee] = useState(0.5);
  const [years, setYears] = useState(30);
  const [target, setTarget] = useState(1_000_000);
  const [withdrawalRate, setWithdrawalRate] = useState(4);
  const [phases, setPhases] = useState<Phase[]>([]);
  const phaseCounter = useRef(0);
  const [showLifecycle, setShowLifecycle] = useState(false);
  const [currentAge, setCurrentAge] = useState(30);
  const [income, setIncome] = useState(70_000);
  const [incomeGrowth, setIncomeGrowth] = useState(2);
  const [retireAge, setRetireAge] = useState(65);
  const [stockPct, setStockPct] = useState(90);
  const [simMode, setSimMode] = useState<"simple" | "historical">("simple");
  const [histStock, setHistStock] = useState(90);

  // Life phases only apply in project mode (goal mode solves for one monthly).
  const activePhases = mode === "project" ? phases : [];

  // Fees come straight out of your return, in every period — a 0.5% fee on a
  // 10% return leaves 9.5% to compound. Everything downstream uses this
  // after-fee rate, so the drag flows through all contribution phases too.
  const effectiveRate = rate - fee;

  // In goal mode the monthly contribution becomes the answer: solve for it, then
  // project forward with that value so the chart still reaches the target.
  const rawRequired =
    mode === "goal"
      ? requiredMonthly(target, principal, effectiveRate, years)
      : monthly;
  const effectiveMonthly = Math.max(0, rawRequired);
  const alreadyThere = mode === "goal" && rawRequired <= 0;

  const phasesKey = activePhases.map((p) => `${p.startYear}:${p.monthly}`).join("|");
  const result = useMemo(
    () => project(principal, effectiveMonthly, effectiveRate, years, activePhases),
    [principal, effectiveMonthly, effectiveRate, years, phasesKey] // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Same projection without the fee, to show what the fee cost over the horizon.
  const resultNoFee = useMemo(
    () => project(principal, effectiveMonthly, rate, years, activePhases),
    [principal, effectiveMonthly, rate, years, phasesKey] // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Inflation doesn't touch the dollar balance — it erodes what those dollars
  // buy. Deflate by cumulative inflation to express the result in today's money.
  const inflationFactor = Math.pow(1 + inflation / 100, years);
  const realFinal = result.finalBalance / inflationFactor;
  const feeCost = Math.max(0, resultNoFee.finalBalance - result.finalBalance);

  const addPhase = () => {
    setPhases((prev) => {
      if (prev.length >= 2) return prev;
      phaseCounter.current += 1;
      const lastStart = prev.length ? prev[prev.length - 1].startYear : 0;
      const startYear = Math.min(years, Math.max(lastStart + 5, Math.round(years / 2)));
      // First extra phase: a changed contribution. Second: a retirement drawdown.
      const monthlyDefault = prev.length === 0 ? monthly * 2 : -2000;
      return [...prev, { id: phaseCounter.current, startYear, monthly: monthlyDefault }];
    });
  };
  const removePhase = (id: number) => setPhases((prev) => prev.filter((p) => p.id !== id));
  const updatePhase = (id: number, patch: Partial<Phase>) =>
    setPhases((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  // Bengen 4%-rule sustainable retirement income from the ending balance.
  const annualIncome = (result.finalBalance * withdrawalRate) / 100;
  const monthlyIncome = annualIncome / 12;
  const monthlyIncomeReal = monthlyIncome / inflationFactor;

  // Lifecycle: financial capital (the balance) vs human capital (PV of income).
  const lifecycle = useMemo(
    () =>
      result.points.map((pt) => {
        const age = currentAge + pt.year;
        const hc = humanCapital(age, currentAge, income, incomeGrowth, rate, retireAge);
        return { age, fin: pt.balance, hc, total: pt.balance + hc };
      }),
    [result, currentAge, income, incomeGrowth, rate, retireAge]
  );
  const hcNow = humanCapital(currentAge, currentAge, income, incomeGrowth, rate, retireAge);
  const trueEquity = principal + hcNow > 0 ? (principal * (stockPct / 100)) / (principal + hcNow) : 0;

  return (
    <div className="cge">
      <div className="cge-controls">
        <div className="wl-simmode" role="group" aria-label="Projection mode">
          <button type="button" className={simMode === "simple" ? "active" : ""} aria-pressed={simMode === "simple"} onClick={() => setSimMode("simple")}>
            Simplified
          </button>
          <button type="button" className={simMode === "historical" ? "active" : ""} aria-pressed={simMode === "historical"} onClick={() => setSimMode("historical")}>
            Historical
          </button>
        </div>
        <div className="cge-mode" role="group" aria-label="Calculation mode">
          <button
            type="button"
            className={mode === "project" ? "active" : ""}
            aria-pressed={mode === "project"}
            onClick={() => setMode("project")}
          >
            Project a balance
          </button>
          <button
            type="button"
            className={mode === "goal" ? "active" : ""}
            aria-pressed={mode === "goal"}
            onClick={() => setMode("goal")}
          >
            Reach a goal
          </button>
        </div>

        <NumberField
          label="Starting amount"
          info="What you're investing today, before any monthly contributions."
          value={principal}
          min={0}
          max={5_000_000}
          step={5_000}
          prefix="$"
          integer
          onCommit={setPrincipal}
        />
        {mode === "project" ? (
          <NumberField
            key="contribution"
            label="Monthly contribution"
            info="How much you add every month. Contributions are invested and compound alongside your starting amount."
            value={monthly}
            min={0}
            max={20_000}
            step={100}
            prefix="$"
            integer
            onCommit={setMonthly}
          />
        ) : (
          <NumberField
            key="target"
            label="Target balance"
            info="The ending balance you're aiming for. The tool solves for the monthly contribution that gets you there."
            value={target}
            min={0}
            max={10_000_000}
            step={10_000}
            prefix="$"
            integer
            onCommit={setTarget}
          />
        )}
        <NumberField
          label="Annual return"
          info="Your assumed average yearly return before inflation and fees (a nominal return), compounded monthly. US stocks have averaged roughly 10% nominal — about 7% after inflation — over the long run, but real returns are bumpy."
          value={rate}
          min={0}
          max={15}
          step={0.5}
          suffix="%"
          onCommit={setRate}
        />
        <NumberField
          label="Inflation"
          info="How fast prices rise each year. It doesn't shrink your dollar balance, but it erodes what those dollars buy — so we also show your result in today's purchasing power. The US long-run average is around 3%."
          value={inflation}
          min={0}
          max={10}
          step={0.25}
          suffix="%"
          onCommit={setInflation}
        />
        <NumberField
          label="Annual fees"
          info="Yearly investing costs — fund expense ratios plus any advisory fee — as a share of your balance. Fees come straight out of your return every year, so even 1% compounds into a surprisingly large drag over decades. Broad index funds run under 0.1%."
          value={fee}
          min={0}
          max={3}
          step={0.05}
          suffix="%"
          onCommit={setFee}
        />
        <NumberField
          label="Time horizon"
          info="How many years you stay invested. Time is compounding's biggest lever — the curve bends sharply upward in the later years."
          value={years}
          min={1}
          max={100}
          step={1}
          suffix={" years"}
          integer
          onCommit={setYears}
        />

        {simMode === "historical" && (
          <NumberField
            label="Stocks in portfolio"
            info="Stock share of your portfolio; the rest is 10-year Treasuries. More stocks lifts the median outcome but widens the fan — the range of where you might land."
            value={histStock}
            min={0}
            max={100}
            step={5}
            suffix="%"
            integer
            onCommit={setHistStock}
          />
        )}

        {simMode === "simple" && mode === "project" && (
          <>
            {activePhases.map((ph) => (
              <div className="cge-phase" key={ph.id}>
                <div className="cge-phase-head">
                  <span>{ph.monthly < 0 ? "Retirement drawdown" : "Life change"}</span>
                  <button
                    type="button"
                    className="cge-phase-remove"
                    aria-label="Remove phase"
                    onClick={() => removePhase(ph.id)}
                  >
                    ×
                  </button>
                </div>
                <NumberField
                  key={`start-${ph.id}`}
                  label="Starting in year"
                  info="The year this new contribution level kicks in — for example, when the kids leave home, or when you retire."
                  value={ph.startYear}
                  min={1}
                  max={years}
                  step={1}
                  suffix={" yr"}
                  integer
                  onCommit={(v) => updatePhase(ph.id, { startYear: v })}
                />
                <NumberField
                  key={`amt-${ph.id}`}
                  label="Monthly amount"
                  info="From that year on: positive keeps contributing, negative withdraws each month (e.g. spending in retirement)."
                  value={ph.monthly}
                  min={-20_000}
                  max={20_000}
                  step={100}
                  prefix="$"
                  integer
                  onCommit={(v) => updatePhase(ph.id, { monthly: v })}
                />
              </div>
            ))}
            {activePhases.length < 2 && (
              <button type="button" className="cge-phase-add" onClick={addPhase}>
                + {activePhases.length === 0 ? "Add a life change" : "Add a retirement drawdown"}
              </button>
            )}
          </>
        )}
      </div>

      {simMode === "historical" ? (
        <HistoricalGrowthPanel
          principal={principal}
          monthly={effectiveMonthly}
          years={years}
          stockPct={histStock}
          target={target}
          isGoal={mode === "goal"}
        />
      ) : (
      <div className="cge-output">
        <Chart points={result.points} />

        <div className="cge-legend">
          <span className="cge-legend-item">
            <span className="cge-swatch cge-swatch--balance" /> Projected balance
          </span>
          <span className="cge-legend-item">
            <span className="cge-swatch cge-swatch--contributed" /> Money you put in
          </span>
        </div>

        {mode === "project" ? (
          <dl className="cge-stats">
            <div className="cge-stat">
              <dt>Final balance</dt>
              <dd className="cge-stat--big">{currency(result.finalBalance)}</dd>
            </div>
            <div className="cge-stat">
              <dt>You contributed</dt>
              <dd>{currency(result.totalContributed)}</dd>
            </div>
            <div className="cge-stat">
              <dt>Growth from returns</dt>
              <dd className="cge-stat--accent">{currency(result.totalGrowth)}</dd>
            </div>
          </dl>
        ) : (
          <dl className="cge-stats">
            <div className="cge-stat">
              <dt>Required monthly contribution</dt>
              <dd className="cge-stat--big cge-stat--accent">
                {currency(effectiveMonthly)}
              </dd>
            </div>
            <div className="cge-stat">
              <dt>You'd contribute in total</dt>
              <dd>{currency(result.totalContributed)}</dd>
            </div>
            <div className="cge-stat">
              <dt>Growth from returns</dt>
              <dd>{currency(result.totalGrowth)}</dd>
            </div>
          </dl>
        )}

        <div className="cge-realfee">
          <span className="cge-realfee-item">
            {mode === "goal" ? "Target in today's dollars" : "In today's dollars"}
            <strong>{currency(realFinal)}</strong>
          </span>
          <span className="cge-realfee-item">
            {fee > 0 ? (
              <>
                {fee}% fee costs you{" "}
                <strong className="cge-realfee-cost">{currency(feeCost)}</strong>
              </>
            ) : (
              <>No fee drag</>
            )}
          </span>
        </div>

        {alreadyThere && (
          <p className="cge-goal-note">
            Your starting amount alone already grows past this target — no monthly
            saving required.
          </p>
        )}

        {result.depletedYear !== null && (
          <p className="cge-goal-note">
            Heads up: your withdrawals outpace the balance — the money runs out in
            year {Math.round(result.depletedYear)}.
          </p>
        )}

        <div className="cge-retire">
          <div className="cge-retire-top">
            <span className="cge-retire-title">Retirement income</span>
            <label className="cge-retire-rate">
              Withdraw{" "}
              <input
                type="range"
                min={2}
                max={10}
                step={0.25}
                value={withdrawalRate}
                aria-label="Withdrawal rate"
                onChange={(e) => setWithdrawalRate(Number(e.target.value))}
              />
              <span className="cge-retire-ratebox">
                <input
                  type="number"
                  className="cge-retire-rateinput"
                  min={1}
                  max={10}
                  step={0.25}
                  value={withdrawalRate}
                  aria-label="Withdrawal rate percent"
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) {
                      setWithdrawalRate(Math.min(10, Math.max(1, v)));
                    }
                  }}
                />
                %
              </span>
            </label>
          </div>
          <p className="cge-retire-figure">
            ≈ <strong>{currency(monthlyIncome)}</strong> / month
            <span className="cge-retire-year"> · {currency(annualIncome)} / year</span>
          </p>
          <p className="cge-retire-real">
            ≈ {currency(monthlyIncomeReal)} / month in today's dollars
          </p>
          <p className="cge-retire-note">
            Bengen's {withdrawalRate}% rule: a first-year withdrawal you raise with
            inflation each year, which historically lasted ~30 years.{" "}
            <a href="/tools/burn-rate">Will it cover your costs? →</a>
          </p>
        </div>
      </div>
      )}

      {simMode === "simple" && mode === "project" && (
        <div className="cge-lifecycle-wrap">
          <button type="button" className="cge-life-toggle" onClick={() => setShowLifecycle((v) => !v)}>
            {showLifecycle ? "▾ Hide" : "▸ Show"} lifecycle view — human &amp; financial capital
          </button>
          {showLifecycle && (
            <div className="cge-lifecycle">
              <div className="cge-life-controls">
                <NumberField label="Current age" info="Your age today — the left edge of the lifecycle chart." value={currentAge} min={18} max={80} step={1} integer onCommit={setCurrentAge} />
                <NumberField label="Annual income" info="Your labor income today. Human capital is the present value of your future paychecks." value={income} min={0} max={1_000_000} step={5_000} prefix="$" integer onCommit={setIncome} />
                <NumberField label="Income growth" info="How fast your pay rises each year." value={incomeGrowth} min={0} max={8} step={0.5} suffix="%" onCommit={setIncomeGrowth} />
                <NumberField label="Retirement age" info="When labor income stops — where human capital reaches zero." value={retireAge} min={40} max={90} step={1} integer onCommit={setRetireAge} />
                <NumberField label="Stocks in portfolio" info="The share of your invested savings held in stocks — used to gauge your true, total-wealth stock exposure." value={stockPct} min={0} max={100} step={5} suffix="%" integer onCommit={setStockPct} />
              </div>
              <LifecycleChart data={lifecycle} retireAge={retireAge} />
              <div className="cge-life-legend">
                <span><span className="cge-life-key" style={{ background: "var(--color-accent)" }} /> Financial capital (your savings)</span>
                <span><span className="cge-life-key" style={{ background: "var(--pl-c3)" }} /> Human capital (future earnings)</span>
              </div>
              <p className="cge-life-insight">
                At age {currentAge}, your wealth is mostly <strong>human capital</strong>:
                about {compactCurrency(hcNow)} of future earnings versus {compactCurrency(principal)} saved.
                So even a {stockPct}%-stock portfolio is only{" "}
                <strong>{Math.round(trueEquity * 100)}%</strong> of your <em>total</em> capital
                in stocks — the classic case that the young can afford more equity risk, and
                why target-date funds start aggressive and glide safer as human capital runs out.
              </p>
            </div>
          )}
        </div>
      )}

      {simMode === "simple" && (
        <p className="cge-note">
          A simplified model: it assumes a steady average return, compounded
          monthly, with fees and inflation applied evenly and taxes left out. Real
          markets are far bumpier — switch to <strong>Historical</strong> to see
          the real, block-bootstrapped range instead of a single line.
        </p>
      )}
    </div>
  );
}
