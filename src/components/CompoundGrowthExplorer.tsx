import { useEffect, useId, useMemo, useRef, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { bootstrapReturns, bandsOverTime, quantile, mean, HISTORY } from "../lib/bootstrap";
import { formatMoney, currencySymbol, useCurrencyCode } from "../lib/currency";

/**
 * Interactive compound-growth explorer.
 *
 * A React island (hydrated client-side) that projects the future value of an
 * initial investment plus recurring monthly contributions, and draws the
 * growth curve as an inline SVG. Pure client-side math, no dependencies.
 */

type Phase = {
  id: number;
  startYear: number;
  monthly: number;
  /** Optional per-phase overrides (percent). Undefined = use the base value. */
  rate?: number;
  fee?: number;
};

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
  baseRatePct: number,
  baseFeePct: number,
  years: number,
  phases: Phase[] = []
): Projection {
  const sorted = [...phases].sort((a, b) => a.startYear - b.startYear);
  // Contribution in effect during a given (fractional) year. Later phases with
  // startYear <= the current year override earlier ones; negative = withdrawal.
  const monthlyFor = (year: number) => {
    let m = monthly;
    for (const p of sorted) if (year >= p.startYear) m = p.monthly;
    return m;
  };
  // Net monthly return in effect during a given year; each phase may override the
  // expected return and/or the fee (e.g. a new asset allocation or a new advisor).
  const monthlyRateFor = (year: number) => {
    let gross = baseRatePct;
    let fee = baseFeePct;
    for (const p of sorted) if (year >= p.startYear) {
      if (p.rate != null) gross = p.rate;
      if (p.fee != null) fee = p.fee;
    }
    return (gross - fee) / 100 / 12;
  };

  const points: Projection["points"] = [
    { year: 0, balance: principal, contributed: principal },
  ];
  let balance = principal;
  let contributed = principal;
  let depletedYear: number | null = null;

  for (let month = 1; month <= years * 12; month++) {
    const grown = balance * (1 + monthlyRateFor((month - 1) / 12));
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
 * solution, no iteration. Can be negative if the starting amount alone already
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

// Human capital is the present value of future *real* earnings. Because labor
// income is relatively safe (bond-like), we discount it at a modest real rate:
// the line then falls to roughly zero at retirement without the steep curvature
// a high, equity-like discount rate would impose.
const HC_DISCOUNT = 3; // % real

/**
 * Human capital at a given age: the present value of remaining labor income up
 * to retirement, in real (today's-dollar) terms. Real income grows at
 * `growthPct`/yr from its value at `startAge`, discounted back at
 * `discountPct`/yr. Falls to zero at retirement.
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

// Money formatting lives in the shared currency module so the whole site tracks
// the header's currency picker. Full figures for realistic amounts, compact
// (…B/…T) once numbers get absurd, so labels and cards never overflow.
const currency = (n: number) => formatMoney(n);
const compactCurrency = (n: number) => formatMoney(n, { compact: true });

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
  const [focused, setFocused] = useState(false);
  const errorId = useId();

  // Keep the text box in sync when the value changes from outside (Reset, or the
  // horizon clamp pulling a phase's start year in) — but never while the user is
  // typing, so the cursor doesn't jump.
  useEffect(() => {
    if (focused) return;
    setText(integer ? Math.round(value).toLocaleString("en-US") : String(value));
    setError(false);
  }, [value, integer, focused]);

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
            onFocus={() => setFocused(true)}
            onBlur={() => { setFocused(false); handleBlur(); }}
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

/**
 * Bernstein-style lifecycle chart: three lines over a lifetime — human capital
 * (the value of future earnings), investment capital (savings, which become the
 * retirement nest egg), and their sum, total capital. Human capital falls to
 * zero at retirement; from there the nest egg is drawn down and either lasts or
 * runs dry, depending on the withdrawal rate.
 */
function LifecycleChart({ data, retireAge }: { data: LifePoint[]; retireAge: number }) {
  const width = 720;
  const height = 320;
  const pad = { top: 22, right: 20, bottom: 42, left: 66 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const ageMin = data[0]?.age ?? 20;
  const ageMax = data[data.length - 1]?.age ?? 80;
  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  const x = (age: number) => pad.left + ((age - ageMin) / (ageMax - ageMin || 1)) * plotW;
  const y = (v: number) => height - pad.bottom - (v / maxTotal) * plotH;

  const path = (key: "fin" | "hc" | "total") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(d.age).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");

  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;
  const showRetire = retireAge > ageMin && retireAge < ageMax;

  // Age ticks at tidy 5- or 10-year marks across the span.
  const span = ageMax - ageMin;
  const tickStep = span > 55 ? 10 : 5;
  const firstTick = Math.ceil(ageMin / tickStep) * tickStep;
  const ageTicks: number[] = [];
  for (let a = firstTick; a <= ageMax; a += tickStep) ageTicks.push(a);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Human capital, investment capital, and total capital over your lifetime, in today's dollars">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={pad.left} x2={width - pad.right} y1={y(maxTotal * f)} y2={y(maxTotal * f)} stroke="var(--color-border)" />
          <text x={pad.left - 8} y={y(maxTotal * f) + 4} textAnchor="end" style={axisText}>{compactCurrency(maxTotal * f)}</text>
        </g>
      ))}

      {showRetire && (
        <>
          <line x1={x(retireAge)} x2={x(retireAge)} y1={pad.top} y2={height - pad.bottom} stroke="var(--color-muted)" strokeWidth={1} strokeDasharray="3 3" />
          <text x={x(retireAge)} y={pad.top - 6} textAnchor="middle" style={{ ...axisText, fontSize: 10, fill: "var(--color-text-soft)" }}>retire at {retireAge}</text>
        </>
      )}

      <path d={path("hc")} fill="none" stroke="var(--pl-c3)" strokeWidth={2} />
      <path d={path("fin")} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
      <path d={path("total")} fill="none" stroke="var(--color-text)" strokeWidth={2.5} />

      {/* On-figure series labels, in a mostly-opaque box so the text stays legible
          over the lines. Anchored during accumulation, where the three lines are
          most distinct. */}
      {(() => {
        const accEnd = Math.max(2, retireAge - ageMin);
        const labels = [
          { key: "total" as const, name: "Total capital", color: "var(--color-text)", frac: 0.12, dy: -15 },
          { key: "hc" as const, name: "Human capital", color: "var(--pl-c3)", frac: 0.44, dy: -15 },
          { key: "fin" as const, name: "Investment capital", color: "var(--color-accent)", frac: 0.7, dy: 17 },
        ];
        return labels.map((l) => {
          const idx = Math.min(data.length - 1, Math.max(1, Math.round(accEnd * l.frac)));
          const d = data[idx];
          const w = l.name.length * 6.4 + 12;
          const h = 17;
          const cy = Math.min(height - pad.bottom - h / 2 - 2, Math.max(pad.top + h / 2, y(d[l.key]) + l.dy));
          const bx = Math.min(width - pad.right - w, Math.max(pad.left, x(d.age) - w / 2));
          return (
            <g key={l.key}>
              <rect x={bx} y={cy - h / 2} width={w} height={h} rx={4} fill="var(--color-surface)" opacity={0.9} stroke={l.color} strokeOpacity={0.45} />
              <text x={bx + w / 2} y={cy + 4} textAnchor="middle" style={{ fill: l.color, fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700 }}>{l.name}</text>
            </g>
          );
        });
      })()}

      {ageTicks.map((a) => (
        <text key={a} x={x(a)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>{a}</text>
      ))}
      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>Age</text>
    </svg>
  );
}

// --- Historical (block-bootstrap) accumulation panel --------------------------

const HIST_PATHS = 1200;
const HIST_BLOCK = 5;
const HIST_SEED = 135790;

// Retirement-survival Monte Carlo uses its own, larger path count: a success
// probability is a binomial estimate and wants more paths than a fan chart to
// stay smooth as the user drags the withdrawal slider.
const RET_PATHS = 2000;
const RET_SEED = 24681;

/**
 * Share of block-bootstrapped histories in which a portfolio outlasts a
 * retirement of `years`. Each year we take an inflation-adjusted withdrawal,
 * constant in REAL terms, so against real returns it's a fixed fraction `w` of
 * the *starting* balance (normalized to 1), then let the survivors grow by
 * that year's real return. If the pot can't cover a year's spending, that
 * timeline has failed. This is Bengen's / the Trinity study's experiment, run
 * over bootstrapped history instead of a single rolling window.
 */
function survivalFrom(returns: number[][], withdrawalPct: number, years: number): number {
  const w = withdrawalPct / 100;
  let survived = 0;
  for (let p = 0; p < returns.length; p++) {
    let bal = 1;
    let ok = true;
    for (let t = 0; t < years; t++) {
      bal -= w; // spend first (inflation-adjusted, i.e. constant real)
      if (bal <= 0) {
        ok = false;
        break;
      }
      bal *= 1 + returns[p][t]; // survivors ride the market
    }
    if (ok) survived++;
  }
  return survived / returns.length;
}

/** Success-rate-vs-withdrawal-rate sparkline, with a marker at the live rate. */
function SurvivalCurve({
  curve,
  rate,
}: {
  curve: { rate: number; ok: number }[];
  rate: number;
}) {
  const w = 320;
  const h = 76;
  const pad = { l: 6, r: 6, t: 8, b: 15 };
  const RMIN = curve[0]?.rate ?? 2;
  const RMAX = curve[curve.length - 1]?.rate ?? 10;
  const x = (r: number) => pad.l + ((r - RMIN) / (RMAX - RMIN)) * (w - pad.l - pad.r);
  const y = (ok: number) => pad.t + (1 - ok) * (h - pad.t - pad.b);
  const line = curve.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.rate).toFixed(1)},${y(p.ok).toFixed(1)}`).join(" ");
  const area = `${line} L${x(RMAX).toFixed(1)},${y(0).toFixed(1)} L${x(RMIN).toFixed(1)},${y(0).toFixed(1)} Z`;
  const cur = curve.reduce((a, b) => (Math.abs(b.rate - rate) < Math.abs(a.rate - rate) ? b : a));
  return (
    <svg
      className="cge-survcurve"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Chance of lasting versus withdrawal rate: ${Math.round(cur.ok * 100)}% at ${rate}%.`}
    >
      <path d={area} className="cge-survcurve-area" />
      <path d={line} className="cge-survcurve-line" />
      <line x1={x(rate)} x2={x(rate)} y1={pad.t} y2={h - pad.b} className="cge-survcurve-cursor" />
      <circle cx={x(cur.rate)} cy={y(cur.ok)} r={4} className="cge-survcurve-dot" />
      {[2, 4, 6, 8, 10].map((t) => (
        <text key={t} x={x(t)} y={h - 3} className="cge-survcurve-tick" textAnchor="middle">
          {t}%
        </text>
      ))}
    </svg>
  );
}

/**
 * The honest counterpart to the smooth-curve projection: run the same starting
 * amount + monthly contributions through {@link HIST_PATHS} alternate histories
 * stitched from real US returns, and show the *range* of where you might land,
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
    const paths = bootstrapReturns({
      years,
      paths: HIST_PATHS,
      blockLen: HIST_BLOCK,
      stockPct: stockPct / 100,
      real: true,
      seed: HIST_SEED,
    });

    // Goal mode: solve the constant monthly saving needed to hit the target in
    // EACH history, so we can report a realistic range instead of one number.
    if (isGoal && target > 0) {
      const req = new Array<number>(HIST_PATHS);
      for (let p = 0; p < HIST_PATHS; p++) {
        let gp = 1; // growth factor on the starting amount
        let ga = 0; // ending value of $1 saved each year (annuity factor)
        for (let y = 0; y < years; y++) {
          const r = paths[p][y];
          gp *= 1 + r;
          ga = ga * (1 + r) + 1;
        }
        req[p] = ga > 0 ? Math.max(0, (target - gp * principal) / ga) / 12 : 0;
      }
      // Lower required saving = luckier markets, so p10 is the "kind" case.
      const reqMedian = quantile(req, 0.5);
      // At that typical pace, how much of the goal is your own money vs growth.
      const totalContributed = principal + reqMedian * 12 * years;
      const growthShare = Math.max(0, target - totalContributed);
      return {
        goal: true as const,
        reqMedian,
        reqLucky: quantile(req, 0.1),
        reqUnlucky: quantile(req, 0.9),
        totalContributed,
        growthShare,
      };
    }

    const annual = monthly * 12;
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

    // Downturn profile: how rough each simulated timeline was, measured on the
    // pure market path (growth of $1, contributions removed) so contributions
    // don't mask the drops. Per path: deepest fall from a prior high, number of
    // 20%+ bear markets, and years spent below a prior high. We report medians,
    // to show downturns aren't the exception — every timeline has them.
    const ddArr = new Array<number>(HIST_PATHS);
    const bearArr = new Array<number>(HIST_PATHS);
    const uwArr = new Array<number>(HIST_PATHS);
    for (let p = 0; p < HIST_PATHS; p++) {
      let g = 1, peak = 1, maxDD = 0, underwater = 0, bears = 0, inBear = false;
      for (let y = 0; y < years; y++) {
        g *= 1 + paths[p][y];
        if (g >= peak) { peak = g; inBear = false; }
        const dd = g / peak - 1;
        if (dd < maxDD) maxDD = dd;
        if (dd < -1e-9) underwater++;
        if (dd <= -0.2 && !inBear) { inBear = true; bears++; }
      }
      ddArr[p] = maxDD;
      bearArr[p] = bears;
      uwArr[p] = underwater;
    }

    return {
      goal: false as const,
      bands: bandsOverTime(balances, [0.1, 0.25, 0.5, 0.75, 0.9]),
      median: quantile(finals, 0.5),
      mean: mean(finals),
      p10: quantile(finals, 0.1),
      p90: quantile(finals, 0.9),
      downturn: {
        maxDD: quantile(ddArr, 0.5),
        bears: Math.round(quantile(bearArr, 0.5)),
        underwater: Math.round(quantile(uwArr, 0.5)),
      },
    };
  }, [principal, monthly, years, stockPct, target, isGoal]);

  if (stats.goal) {
    return (
      <div className="cge-output">
        <div className="sk-headline">
          <span className="sk-headline-label">To reach {compactCurrency(target)} in {years} years, save about</span>
          <span className="sk-headline-value">{currency(stats.reqMedian)}/mo</span>
        </div>
        <dl className="cge-stats" style={{ marginTop: "var(--space-md)" }}>
          <div className="cge-stat">
            <dt>Typical (median)</dt>
            <dd className="cge-stat--big">{currency(stats.reqMedian)}/mo</dd>
          </div>
          <div className="cge-stat">
            <dt>If markets are kind</dt>
            <dd>{currency(stats.reqLucky)}/mo</dd>
          </div>
          <div className="cge-stat">
            <dt>If markets are unkind</dt>
            <dd>{currency(stats.reqUnlucky)}/mo</dd>
          </div>
        </dl>
        <div className="cge-legend" style={{ marginTop: "var(--space-sm)" }}>
          <span className="cge-legend-item">
            <span className="cge-swatch cge-swatch--balance" /> Goal (projected balance) {compactCurrency(target)}
          </span>
          <span className="cge-legend-item">
            <span className="cge-swatch cge-swatch--contributed" /> Money you put in {compactCurrency(stats.totalContributed)}
          </span>
        </div>
        <p className="cge-note" style={{ marginTop: "var(--space-sm)" }}>
          There's no single right answer; how much you need depends on returns nobody can predict. Across the
          histories, the monthly saving to hit your goal ranges from about <strong>{currency(stats.reqLucky)}</strong>{" "}
          in kind markets to <strong>{currency(stats.reqUnlucky)}</strong> in unkind ones. A sturdy plan aims near the
          higher end and treats good luck as a bonus. At the typical pace you'd contribute about{" "}
          <strong>{currency(stats.totalContributed)}</strong> of your own money, and the other{" "}
          <strong>{currency(stats.growthShare)}</strong> of your {compactCurrency(target)} goal comes from compounding.
        </p>
        <p className="cge-note">
          {HIST_PATHS.toLocaleString()} alternate timelines, block-bootstrapped from real US returns
          ({HISTORY.span[0]}–{HISTORY.span[1]}). Data: Aswath Damodaran.
        </p>
      </div>
    );
  }

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

      <div className="cge-downturn">
        <p className="cge-downturn-lead">
          <strong>Downturns are normal.</strong> Every one of these {HIST_PATHS.toLocaleString()} timelines lived through them.
        </p>
        <dl className="cge-stats">
          <div className="cge-stat"><dt>Bear markets (20%+ drops)</dt><dd>{stats.downturn.bears} in a typical run</dd></div>
          <div className="cge-stat"><dt>Worst drop from a high</dt><dd>−{Math.round(-stats.downturn.maxDD * 100)}%</dd></div>
          <div className="cge-stat"><dt>Years below a prior high</dt><dd>~{stats.downturn.underwater}</dd></div>
        </dl>
      </div>

      <p className="cge-note" style={{ marginTop: "var(--space-sm)" }}>
        The <strong>average sits well above the typical</strong> result: a few lucky return-sequences pull the mean up
        while most land lower. But the outcome that matters isn't really the average, it's whether you hold on. The
        typical timeline fell about <strong>−{Math.round(-stats.downturn.maxDD * 100)}%</strong> from a high at some
        point, and the gap between ending near {compactCurrency(stats.p10)} and far less is mostly whether you keep
        investing through drops like that instead of selling near the bottom. Crashes aren't a failure of the plan;
        they're baked into the same returns that produce the growth.
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
  // Subscribe to the header's currency picker; `symbol` feeds the input prefixes,
  // and reading the code re-renders the whole tool (and its children) on a change.
  const symbol = currencySymbol(useCurrencyCode());
  const [mode, setMode] = useState<"project" | "goal">("project");
  const [principal, setPrincipal] = useState(10_000);
  const [monthly, setMonthly] = useState(300);
  const [rate, setRate] = useState(10);
  const [inflation, setInflation] = useState(3);
  const [fee, setFee] = useState(0.5);
  const [years, setYears] = useState(30);
  const [target, setTarget] = useState(1_000_000);
  const [withdrawalRate, setWithdrawalRate] = useState(4);
  const [retYears, setRetYears] = useState(30);
  const [retStock, setRetStock] = useState(60);
  const [phases, setPhases] = useState<Phase[]>([]);
  const phaseCounter = useRef(0);
  const [showLifecycle, setShowLifecycle] = useState(true);
  const [currentAge, setCurrentAge] = useState(20);
  const [income, setIncome] = useState(70_000);
  const [incomeGrowth, setIncomeGrowth] = useState(2);
  const [simMode, setSimMode] = useState<"simple" | "historical">("simple");
  const [histStock, setHistStock] = useState(90);

  // Life phases only apply in project mode (goal mode solves for one monthly).
  const activePhases = mode === "project" ? phases : [];

  // Fees come straight out of your return, in every period: a 0.5% fee on a
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

  const phasesKey = activePhases.map((p) => `${p.startYear}:${p.monthly}:${p.rate ?? ""}:${p.fee ?? ""}`).join("|");
  const result = useMemo(
    () => project(principal, effectiveMonthly, rate, fee, years, activePhases),
    [principal, effectiveMonthly, rate, fee, years, phasesKey] // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Same projection with every fee zeroed (base and per-phase), to show what fees
  // cost over the horizon.
  const resultNoFee = useMemo(
    () => project(principal, effectiveMonthly, rate, 0, years, activePhases.map((p) => ({ ...p, fee: 0 }))),
    [principal, effectiveMonthly, rate, years, phasesKey] // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Inflation doesn't touch the dollar balance; it erodes what those dollars
  // buy. Deflate by cumulative inflation to express the result in today's money.
  const inflationFactor = Math.pow(1 + inflation / 100, years);
  const realFinal = result.finalBalance / inflationFactor;
  const feeCost = Math.max(0, resultNoFee.finalBalance - result.finalBalance);
  // The headline fee % is only meaningful when one fee applies throughout. Once a
  // phase overrides the fee, we report the total dollar drag instead of a single %.
  const feesVary = activePhases.some((p) => p.fee != null && p.fee !== fee);

  // Life phases change your *contribution* (a raise, the kids leaving home). They
  // are contributions-only — retirement spending is modelled by the withdrawal
  // box below, so there is only ever one drawdown and no double-counting.
  const canAddLife = activePhases.length < 4;

  const addPhase = () => {
    setPhases((prev) => {
      if (prev.length >= 4) return prev;
      phaseCounter.current += 1;
      const lastStart = prev.length ? Math.max(...prev.map((p) => p.startYear)) : 0;
      const startYear = Math.min(years, Math.max(lastStart + 5, Math.round(years / 2)));
      return [...prev, { id: phaseCounter.current, startYear, monthly: monthly }];
    });
  };

  // Keep phase start years inside the horizon: if the user shortens the horizon
  // below a phase's start, pull it back in so the phase can't silently go stale.
  useEffect(() => {
    setPhases((prev) =>
      prev.some((p) => p.startYear > years)
        ? prev.map((p) => (p.startYear > years ? { ...p, startYear: years } : p))
        : prev,
    );
  }, [years]);

  // Mode-appropriate real nest egg (today's dollars), so the retirement box and
  // the lifecycle chart always agree with the headline on screen: the
  // deterministic ending balance in Simplified, the block-bootstrap MEDIAN in
  // Historical. (Goal mode targets `target` either way, so it uses the
  // deterministic path.)
  const detNestEggReal = realFinal;
  const histMedianReal = useMemo(() => {
    if (simMode !== "historical" || mode !== "project") return null;
    const paths = bootstrapReturns({ years, paths: HIST_PATHS, blockLen: HIST_BLOCK, stockPct: histStock / 100, real: true, seed: HIST_SEED });
    const annual = effectiveMonthly * 12;
    const finals = paths.map((pr) => {
      let bal = principal;
      for (let y = 0; y < years; y++) bal = bal * (1 + pr[y]) + annual;
      return bal;
    });
    return quantile(finals, 0.5);
  }, [simMode, mode, years, histStock, principal, effectiveMonthly]);
  const nestEggReal = histMedianReal ?? detNestEggReal;
  // Scale the deterministic lifecycle accumulation so its endpoint lands on that
  // nest egg (a no-op in Simplified; in Historical it aligns the curve to the
  // median so the chart and the headline tell the same story).
  const lifeScale = detNestEggReal > 0 ? nestEggReal / detNestEggReal : 1;
  const removePhase = (id: number) => setPhases((prev) => prev.filter((p) => p.id !== id));
  const updatePhase = (id: number, patch: Partial<Phase>) =>
    setPhases((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  // First-year retirement income (4%-rule style), in today's dollars, from the
  // mode-appropriate real nest egg so it matches the chart and the headline.
  const annualIncomeReal = (nestEggReal * withdrawalRate) / 100;
  const monthlyIncomeReal = annualIncomeReal / 12;

  // Retirement-survival simulation. It doesn't depend on the size of the pile,
  // only on the withdrawal rate, horizon, and stock/bond mix, so one
  // bootstrapped return matrix is reused for both the live rate and the whole
  // success-vs-rate curve. Regenerating the matrix (the costly part) only when
  // the horizon or allocation changes keeps dragging the slider instant.
  const retReturns = useMemo(
    () =>
      bootstrapReturns({
        years: retYears,
        paths: RET_PATHS,
        blockLen: HIST_BLOCK,
        stockPct: retStock / 100,
        seed: RET_SEED,
        real: true,
      }),
    [retYears, retStock]
  );
  const survival = useMemo(
    () => survivalFrom(retReturns, withdrawalRate, retYears),
    [retReturns, withdrawalRate, retYears]
  );
  const survivalCurve = useMemo(() => {
    const pts: { rate: number; ok: number }[] = [];
    for (let r = 2; r <= 10.0001; r += 0.25) pts.push({ rate: r, ok: survivalFrom(retReturns, r, retYears) });
    return pts;
  }, [retReturns, retYears]);
  const survivalPct = Math.round(survival * 100);
  const verdict =
    survival >= 0.95
      ? { tone: "good", label: "Very safe", text: "outlasted the horizon in almost every history." }
      : survival >= 0.85
        ? { tone: "good", label: "Likely to last", text: "survived most histories, though a bad first decade could still bite." }
        : survival >= 0.7
          ? { tone: "warn", label: "Getting risky", text: "ran dry in a meaningful share of histories. This is sequence-of-returns risk, not just bad luck." }
          : survival >= 0.5
            ? { tone: "bad", label: "A coin flip", text: "ran out of money in roughly half of all histories." }
            : { tone: "bad", label: "Very likely to fail", text: "ran out of money in most histories. A rate this high has rarely survived a full retirement." };

  // Retirement happens when the accumulation horizon ends: you invest for
  // `years`, so you retire at currentAge + years and the nest egg is exactly the
  // balance the tool projects above (in real, today's-dollar terms).
  const retireAge = currentAge + years;

  // Geometric-mean real return of the retirement stock/bond mix, straight from
  // US history — the same allocation the survival odds above are built on. This
  // deterministic rate drives whether the drawn-down nest egg grows or shrinks.
  const retRealReturn = useMemo(() => {
    const rs = retStock / 100;
    let g = 1;
    for (const yr of HISTORY.series) g *= (1 + (rs * yr.stocks + (1 - rs) * yr.tbonds)) / (1 + yr.inflation);
    return Math.pow(g, 1 / HISTORY.series.length) - 1;
  }, [retStock]);

  // The full lifecycle, in real dollars: human capital falls to zero at
  // retirement while investment capital accumulates into the nest egg, then the
  // nest egg is drawn down (constant real withdrawal) and either lasts or fails.
  const lifecycle = useMemo(() => {
    const infl = 1 + inflation / 100;
    const out: LifePoint[] = [];
    for (let t = 0; t <= years; t++) {
      const age = currentAge + t;
      const fin = ((result.points[t]?.balance ?? 0) / Math.pow(infl, t)) * lifeScale; // nominal -> real, aligned to the nest egg
      const hc = humanCapital(age, currentAge, income, incomeGrowth, HC_DISCOUNT, retireAge);
      out.push({ age, fin, hc, total: fin + hc });
    }
    const nestEgg = out[out.length - 1]?.fin ?? 0;
    const withdrawal = (withdrawalRate / 100) * nestEgg; // constant in real terms
    let bal = nestEgg;
    // Draw the nest egg down across the retirement the user planned for.
    for (let s = 1; s <= retYears; s++) {
      bal = Math.max(0, bal * (1 + retRealReturn) - withdrawal);
      out.push({ age: retireAge + s, fin: bal, hc: 0, total: bal });
    }
    return out;
  }, [result, currentAge, years, income, incomeGrowth, inflation, retireAge, withdrawalRate, retYears, retRealReturn, lifeScale]);

  const hcNow = lifecycle[0]?.hc ?? 0;
  const endBalance = lifecycle[lifecycle.length - 1]?.fin ?? 0;
  const endAge = lifecycle[lifecycle.length - 1]?.age ?? retireAge + retYears;
  // Age at which the nest egg is exhausted, if it happens within the horizon.
  const depletedAge = (() => {
    for (let i = years + 1; i < lifecycle.length; i++) {
      if (lifecycle[i].fin <= 0) return lifecycle[i].age;
    }
    return null;
  })();

  return (
    <div className="cge">
      <div className="cge-controls">
        <ResetButton
          onReset={() => {
            setMode("project"); setPrincipal(10_000); setMonthly(300); setRate(10);
            setInflation(3); setFee(0.5); setYears(30); setTarget(1_000_000);
            setWithdrawalRate(4); setRetYears(30); setRetStock(60); setPhases([]); setShowLifecycle(true); setCurrentAge(20);
            setIncome(70_000); setIncomeGrowth(2);
            setSimMode("simple"); setHistStock(90);
          }}
        />
        <div className="wl-simmode" role="group" aria-label="Projection mode">
          <button type="button" className={simMode === "simple" ? "active" : ""} aria-pressed={simMode === "simple"} onClick={() => setSimMode("simple")}>
            Simplified
          </button>
          <button
            type="button"
            className={simMode === "historical" ? "active" : ""}
            aria-pressed={simMode === "historical"}
            onClick={() => setSimMode("historical")}
            title={`Block-bootstrap Monte Carlo: ${HIST_PATHS.toLocaleString()} alternate timelines stitched together from real ${HIST_BLOCK}-year blocks of US return history (${HISTORY.span[0]}–${HISTORY.span[1]}, inflation-adjusted). Data: Aswath Damodaran.`}
          >
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
          prefix={symbol}
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
            prefix={symbol}
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
            prefix={symbol}
            integer
            onCommit={setTarget}
          />
        )}
        <NumberField
          label="Annual return"
          info="Your assumed average yearly return before inflation and fees (a nominal return), compounded monthly. US stocks have averaged roughly 10% nominal (about 7% after inflation) over the long run, but real returns are bumpy."
          value={rate}
          min={0}
          max={15}
          step={0.5}
          suffix="%"
          onCommit={setRate}
        />
        <NumberField
          label="Inflation"
          info="How fast prices rise each year. It doesn't shrink your dollar balance, but it erodes what those dollars buy, so we also show your result in today's purchasing power. The US long-run average is around 3%."
          value={inflation}
          min={0}
          max={10}
          step={0.25}
          suffix="%"
          onCommit={setInflation}
        />
        <NumberField
          label="Annual fees"
          info="Yearly investing costs (fund expense ratios plus any advisory fee) as a share of your balance. Fees come straight out of your return every year, so even 1% compounds into a surprisingly large drag over decades. Broad index funds run under 0.1%."
          value={fee}
          min={0}
          max={3}
          step={0.05}
          suffix="%"
          onCommit={setFee}
        />
        <NumberField
          label="Time horizon"
          info="How many years you stay invested. Time is compounding's biggest lever; the curve bends sharply upward in the later years."
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
            info="Stock share of your portfolio; the rest is 10-year Treasuries. More stocks lifts the median outcome but widens the fan, the range of where you might land."
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
                  <span>Life phase</span>
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
                  info="The year this new contribution level kicks in (for example, when the kids leave home, or when you retire)."
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
                  label="New monthly contribution"
                  info="From that year on, how much you contribute each month (e.g. a raise lets you save more, or the kids leaving home frees up cash). Contributions only — model retirement spending with the withdrawal box below."
                  value={ph.monthly}
                  min={0}
                  max={20_000}
                  step={100}
                  prefix={symbol}
                  integer
                  onCommit={(v) => updatePhase(ph.id, { monthly: v })}
                />
                <NumberField
                  key={`rate-${ph.id}`}
                  label="Return from here"
                  info="Expected annual return from this phase onward (e.g. if you shift to a more conservative allocation in retirement). Leave it at the base return to keep it unchanged."
                  value={ph.rate ?? rate}
                  min={0}
                  max={15}
                  step={0.5}
                  suffix="%"
                  onCommit={(v) => updatePhase(ph.id, { rate: v })}
                />
                <NumberField
                  key={`fee-${ph.id}`}
                  label="Fee from here"
                  info="Annual fee from this phase onward (e.g. if you switch to an advisor or a different fund). Leave it at the base fee to keep it unchanged."
                  value={ph.fee ?? fee}
                  min={0}
                  max={3}
                  step={0.05}
                  suffix="%"
                  onCommit={(v) => updatePhase(ph.id, { fee: v })}
                />
              </div>
            ))}
            {canAddLife && (
              <div className="cge-phase-actions">
                <button type="button" className="cge-phase-add" onClick={() => addPhase()}>
                  + Add a life phase
                </button>
              </div>
            )}
            <p className="cge-note" style={{ marginTop: "0.3rem" }}>
              Life phases change your <strong>contribution</strong> from a chosen year on (a raise, or the kids leaving
              home). They add money only — <strong>retirement spending is modelled by the withdrawal box below.</strong>
            </p>
          </>
        )}
      </div>

      <div className="cge-rightcol">
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
            {Math.round(feeCost) > 0 ? (
              feesVary ? (
                <span title="The total drag from your base fee plus every per-phase fee change, added across the whole timeline.">
                  Fees cost you{" "}
                  <strong className="cge-realfee-cost">{currency(feeCost)}</strong>
                </span>
              ) : (
                <>
                  {fee}% fee costs you{" "}
                  <strong className="cge-realfee-cost">{currency(feeCost)}</strong>
                </>
              )
            ) : (
              <>No fee drag</>
            )}
          </span>
        </div>

        {alreadyThere && (
          <p className="cge-goal-note">
            Your starting amount alone already grows past this target, so no
            monthly saving is required.
          </p>
        )}

        {result.depletedYear !== null && (
          <p className="cge-goal-note">
            Heads up: your withdrawals outpace the balance, so the money runs out
            in year {Math.round(result.depletedYear)}.
          </p>
        )}
      </div>
      )}

      {/* Retirement drawdown — rendered in every mode, so the withdrawal box is the
          single, always-visible drawdown control. It reads the real nest egg, which
          tracks the headline (deterministic in Simplified, median in Historical). */}
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
            ≈ <strong>{currency(monthlyIncomeReal)}</strong> / month
            <span className="cge-retire-year"> · {currency(annualIncomeReal)} / year</span>
          </p>
          <p className="cge-retire-real">
            in today's dollars, from a {compactCurrency(nestEggReal)} nest egg
          </p>

          <div className="cge-retire-strategy">
            <label>
              Years in retirement
              <input
                type="number"
                min={10}
                max={50}
                step={1}
                value={retYears}
                aria-label="Years in retirement"
                onChange={(e) => {
                  const v = Math.round(Number(e.target.value));
                  if (Number.isFinite(v)) setRetYears(Math.min(50, Math.max(10, v)));
                }}
              />
            </label>
            <label className="cge-retire-alloc">
              Stocks in retirement
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={retStock}
                aria-label="Stock share in retirement"
                onChange={(e) => setRetStock(Number(e.target.value))}
              />
              <span className="cge-retire-allocval">
                {retStock}% stocks / {100 - retStock}% bonds
              </span>
            </label>
          </div>

          <div className={`cge-survival cge-survival--${verdict.tone}`}>
            <div className="cge-survival-head">
              <span className="cge-survival-pct">{survivalPct}%</span>
              <span className="cge-survival-copy">
                chance the money lasts {retYears} years.{" "}
                <strong className="cge-survival-verdict">{verdict.label}</strong>
              </span>
            </div>
            <SurvivalCurve curve={survivalCurve} rate={withdrawalRate} />
            <p className="cge-survival-text">
              Across {RET_PATHS.toLocaleString()} block-bootstrapped US histories, drawing{" "}
              <strong>{withdrawalRate}%</strong> a year (raised with inflation) {verdict.text}
            </p>
          </div>

          <p className="cge-retire-note">
            The <strong>“4% rule”</strong> is a widely cited <em>approximation</em> of a safe
            withdrawal rate: draw 4% of your balance the first year, then raise that dollar
            amount with inflation. William Bengen, whose research first found that roughly 4–5%
            survived every historical 30-year retirement, never claimed a single number is
            guaranteed; the odds above show why higher rates get dangerous fast.{" "}
            <a href="/tools/burn-rate">Stress-test it against your real costs →</a>
          </p>
        </div>
      </div>

      {/* Lifecycle view is a deterministic companion; show it in every mode. */}
      {(
        <div className="cge-lifecycle-wrap">
          <button type="button" className="cge-life-toggle" onClick={() => setShowLifecycle((v) => !v)}>
            {showLifecycle ? "▾ Hide" : "▸ Show"} lifecycle view: human capital, savings &amp; the drawdown
          </button>
          {showLifecycle && (
            <div className="cge-lifecycle">
              <div className="cge-life-controls">
                <NumberField label="Current age" info="Your age today, the left edge of the chart. You invest for the horizon set above, so you retire at this age plus that many years." value={currentAge} min={16} max={70} step={1} integer onCommit={setCurrentAge} />
                <NumberField label="Annual income" info="Your labor income today. Human capital is the present value of your future paychecks, in today's dollars." value={income} min={0} max={1_000_000} step={5_000} prefix={symbol} integer onCommit={setIncome} />
                <NumberField label="Income growth" info="How fast your real pay rises each year, above inflation." value={incomeGrowth} min={0} max={8} step={0.5} suffix="%" onCommit={setIncomeGrowth} />
              </div>
              <p className="cge-life-caption">
                Everything here is in <strong>today's dollars</strong>, built from your inputs above: invest for {years} year{years === 1 ? "" : "s"},
                retire at <strong>{retireAge}</strong>, then draw <strong>{withdrawalRate}%</strong> a year from a{" "}
                {retStock}%-stock nest egg for {retYears} years, through age {retireAge + retYears}. The drawdown grows at
                that mix's <em>historical</em> real return, while the build-up uses your steady <strong>{effectiveRate}%</strong>{" "}
                assumption{simMode === "historical" ? "; the nest egg here is the median of the histories above" : ""}.
              </p>
              <LifecycleChart data={lifecycle} retireAge={retireAge} />
              <div className="cge-life-legend">
                <span><span className="cge-life-key" style={{ background: "var(--color-text)" }} /> Total capital</span>
                <span><span className="cge-life-key" style={{ background: "var(--pl-c3)" }} /> Human capital (future earnings)</span>
                <span><span className="cge-life-key" style={{ background: "var(--color-accent)" }} /> Investment capital (your nest egg)</span>
              </div>
              <p className="cge-life-insight">
                At {currentAge}, almost all your wealth is <strong>human capital</strong>: about{" "}
                {compactCurrency(hcNow)} of future earnings versus {compactCurrency(principal)} saved. A paycheck
                you haven't earned yet behaves like a bond, which is why the young can afford more equity risk.
                By <strong>{retireAge}</strong> you've converted that into a{" "}
                <strong>{compactCurrency(nestEggReal)}</strong> nest egg, and human capital is gone.{" "}
                {depletedAge !== null ? (
                  <>From there, drawing {withdrawalRate}% a year with a {retStock}%-stock mix, the money{" "}
                  <strong>runs dry at age {depletedAge}</strong>, because the drawdown outpaces the returns.</>
                ) : endBalance > nestEggReal * 1.05 ? (
                  <>From there, drawing {withdrawalRate}% a year earns more than you spend, so the nest egg{" "}
                  <strong>keeps growing</strong> to about {compactCurrency(endBalance)} by age {endAge}: runaway
                  compounding, even in retirement.</>
                ) : (
                  <>From there, drawing {withdrawalRate}% a year roughly balances the returns, so the nest egg{" "}
                  <strong>still holds about {compactCurrency(endBalance)}</strong> at age {endAge}.</>
                )}{" "}
                But this is one smooth, average path: the <strong>{survivalPct}% chance</strong> of lasting, above, comes
                from the bumpy real histories, where a bad first decade (sequence-of-returns risk) sinks some runs even
                when the average looks safe.
              </p>
            </div>
          )}
        </div>
      )}

      {simMode === "simple" && (
        <p className="cge-note">
          A simplified model: it assumes a steady average return, compounded
          monthly, with fees and inflation applied evenly and taxes left out. Real
          markets are far bumpier; switch to <strong>Historical</strong> to see
          the real, block-bootstrapped range instead of a single line.
        </p>
      )}
    </div>
  );
}
