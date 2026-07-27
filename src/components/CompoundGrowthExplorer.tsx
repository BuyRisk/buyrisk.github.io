import { useId, useMemo, useState } from "react";

/**
 * Interactive compound-growth explorer.
 *
 * A React island (hydrated client-side) that projects the future value of an
 * initial investment plus recurring monthly contributions, and draws the
 * growth curve as an inline SVG. Pure client-side math — no dependencies.
 */

type Projection = {
  points: { year: number; balance: number; contributed: number }[];
  finalBalance: number;
  totalContributed: number;
  totalGrowth: number;
};

function project(
  principal: number,
  monthly: number,
  annualRatePct: number,
  years: number
): Projection {
  const monthlyRate = annualRatePct / 100 / 12;
  const points: Projection["points"] = [
    { year: 0, balance: principal, contributed: principal },
  ];

  let balance = principal;
  let contributed = principal;

  for (let month = 1; month <= years * 12; month++) {
    balance = balance * (1 + monthlyRate) + monthly;
    contributed += monthly;
    if (month % 12 === 0) {
      points.push({ year: month / 12, balance, contributed });
    }
  }

  return {
    points,
    finalBalance: balance,
    totalContributed: contributed,
    totalGrowth: balance - contributed,
  };
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
        <span>{label}</span>
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

export default function CompoundGrowthExplorer() {
  const [principal, setPrincipal] = useState(10_000);
  const [monthly, setMonthly] = useState(300);
  const [rate, setRate] = useState(7);
  const [years, setYears] = useState(30);

  const result = useMemo(
    () => project(principal, monthly, rate, years),
    [principal, monthly, rate, years]
  );

  return (
    <div className="cge">
      <div className="cge-controls">
        <NumberField
          label="Starting amount"
          value={principal}
          min={0}
          max={5_000_000}
          step={5_000}
          prefix="$"
          integer
          onCommit={setPrincipal}
        />
        <NumberField
          label="Monthly contribution"
          value={monthly}
          min={0}
          max={20_000}
          step={100}
          prefix="$"
          integer
          onCommit={setMonthly}
        />
        <NumberField
          label="Annual return"
          value={rate}
          min={0}
          max={15}
          step={0.5}
          suffix="%"
          onCommit={setRate}
        />
        <NumberField
          label="Time horizon"
          value={years}
          min={1}
          max={100}
          step={1}
          suffix={" years"}
          integer
          onCommit={setYears}
        />
      </div>

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
      </div>

      <p className="cge-note">
        A simplified model: it assumes a steady average return, compounded
        monthly, with no taxes or fees. Real markets are far bumpier — this is a
        tool for intuition, not a forecast.
      </p>
    </div>
  );
}
