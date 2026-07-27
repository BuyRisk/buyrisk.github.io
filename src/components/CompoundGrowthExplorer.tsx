import { useMemo, useState } from "react";

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
        <label className="cge-field">
          <span className="cge-label">
            Starting amount <strong>{currency(principal)}</strong>
          </span>
          <input
            type="range"
            min={0}
            max={5_000_000}
            step={5_000}
            value={principal}
            onChange={(e) => setPrincipal(Number(e.target.value))}
          />
        </label>

        <label className="cge-field">
          <span className="cge-label">
            Monthly contribution <strong>{currency(monthly)}</strong>
          </span>
          <input
            type="range"
            min={0}
            max={20_000}
            step={100}
            value={monthly}
            onChange={(e) => setMonthly(Number(e.target.value))}
          />
        </label>

        <label className="cge-field">
          <span className="cge-label">
            Annual return <strong>{rate}%</strong>
          </span>
          <input
            type="range"
            min={0}
            max={20}
            step={0.5}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
          />
        </label>

        <label className="cge-field">
          <span className="cge-label">
            Time horizon <strong>{years} years</strong>
          </span>
          <input
            type="range"
            min={1}
            max={300}
            step={1}
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
          />
        </label>
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
