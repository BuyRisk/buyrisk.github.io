import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { fees } from "../data/generated/fees";

/**
 * "The Real Cost of Fees": a small annual expense ratio feels trivial, but over
 * decades it compounds into a startling share of the wealth you'd otherwise keep.
 * The calculator pits your fund's fee against a low-cost index fund and shows the
 * dollar gap; the trends view shows the real ICI history: fees fell for 30 years,
 * and index funds cost a fraction of active ones. Educational only, not advice.
 */

const DEFAULTS = {
  amount: 10_000,
  contribution: 500, // per month
  years: 30,
  grossReturn: 7, // %
  yourFee: fees.latest.activeEquity, // typical active equity fund today
  indexFee: fees.latest.indexEquity, // typical index equity fund today
};

const dollars = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const pct = (n: number, dp = 2) => `${n.toFixed(dp)}%`;

/** Future value of a starting balance plus monthly contributions at an annual net return. */
function project(amount: number, monthly: number, years: number, annualNet: number): { year: number; value: number }[] {
  const m = annualNet / 100 / 12;
  const out: { year: number; value: number }[] = [{ year: 0, value: amount }];
  let bal = amount;
  for (let month = 1; month <= years * 12; month++) {
    bal = bal * (1 + m) + monthly;
    if (month % 12 === 0) out.push({ year: month / 12, value: bal });
  }
  return out;
}

// Real-fee quick presets for "your fund."
const PRESETS = [
  { label: `Typical active fund · ${pct(fees.latest.activeEquity)}`, fee: fees.latest.activeEquity },
  { label: "Older active fund · 1.08%", fee: 1.08 },
  { label: "Advisor + fund · 1.50%", fee: 1.5 },
  { label: `Index fund · ${pct(fees.latest.indexEquity)}`, fee: fees.latest.indexEquity },
];

export default function FeesLab() {
  const [mode, setMode] = useState<"cost" | "trends">("cost");
  const [amount, setAmount] = useState(DEFAULTS.amount);
  const [contribution, setContribution] = useState(DEFAULTS.contribution);
  const [years, setYears] = useState(DEFAULTS.years);
  const [grossReturn, setGrossReturn] = useState(DEFAULTS.grossReturn);
  const [yourFee, setYourFee] = useState(DEFAULTS.yourFee);
  const [indexFee, setIndexFee] = useState(DEFAULTS.indexFee);

  const view = useMemo(() => {
    const gross = project(amount, contribution, years, grossReturn);
    const yours = project(amount, contribution, years, grossReturn - yourFee);
    const index = project(amount, contribution, years, grossReturn - indexFee);
    const grossFinal = gross[gross.length - 1].value;
    const yoursFinal = yours[yours.length - 1].value;
    const indexFinal = index[index.length - 1].value;
    const gap = indexFinal - yoursFinal; // extra wealth the cheaper fund keeps
    const dragYours = grossFinal - yoursFinal; // total dollars your fund's fee cost
    const dragShare = dragYours / grossFinal; // fee drag as a share of fee-free wealth
    return { gross, yours, index, grossFinal, yoursFinal, indexFinal, gap, dragYours, dragShare };
  }, [amount, contribution, years, grossReturn, yourFee, indexFee]);

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton
          onReset={() => {
            setMode("cost");
            setAmount(DEFAULTS.amount);
            setContribution(DEFAULTS.contribution);
            setYears(DEFAULTS.years);
            setGrossReturn(DEFAULTS.grossReturn);
            setYourFee(DEFAULTS.yourFee);
            setIndexFee(DEFAULTS.indexFee);
          }}
        />

        <div className="wl-simmode" role="group" aria-label="View">
          <button type="button" className={mode === "cost" ? "active" : ""} aria-pressed={mode === "cost"} onClick={() => setMode("cost")}>
            Fee calculator
          </button>
          <button type="button" className={mode === "trends" ? "active" : ""} aria-pressed={mode === "trends"} onClick={() => setMode("trends")}>
            Real fee trends
          </button>
        </div>

        {mode === "cost" ? (
          <>
            <label className="wl-slider">
              <span>
                Starting balance <strong>{dollars(amount)}</strong>
              </span>
              <input type="range" min={0} max={100_000} step={1_000} value={amount} onChange={(e) => setAmount(+e.target.value)} />
            </label>

            <label className="wl-slider">
              <span>
                Monthly contribution <strong>{dollars(contribution)}</strong>
              </span>
              <input type="range" min={0} max={3_000} step={50} value={contribution} onChange={(e) => setContribution(+e.target.value)} />
            </label>

            <label className="wl-slider">
              <span>
                Years invested <strong>{years}</strong>
              </span>
              <input type="range" min={5} max={45} step={1} value={years} onChange={(e) => setYears(+e.target.value)} />
            </label>

            <label className="wl-slider">
              <span>
                Return before fees
                <InfoTip text="The market return your fund earns before its expense ratio is deducted. The fee comes straight off the top, every year." />{" "}
                <strong>{pct(grossReturn, 1)}</strong>
              </span>
              <input type="range" min={2} max={12} step={0.5} value={grossReturn} onChange={(e) => setGrossReturn(+e.target.value)} />
            </label>

            <label className="wl-slider">
              <span>
                Your fund's fee
                <InfoTip text="The expense ratio: the percent of your balance the fund charges every year, whether it beats the market or not. The average active US equity fund charged 0.64% in 2025." />{" "}
                <strong>{pct(yourFee)}</strong>
              </span>
              <input type="range" min={0} max={2} step={0.01} value={yourFee} onChange={(e) => setYourFee(+e.target.value)} />
            </label>

            <label className="wl-slider">
              <span>
                Low-cost index fee
                <InfoTip text="What a broad index fund charges. The average US index equity fund charged just 0.05% in 2025, about one-thirteenth of the average active fund." />{" "}
                <strong>{pct(indexFee)}</strong>
              </span>
              <input type="range" min={0} max={1} step={0.01} value={indexFee} onChange={(e) => setIndexFee(+e.target.value)} />
            </label>

            <div className="wl-presets">
              <span className="wl-presets-label">Set your fee to:</span>
              {PRESETS.map((p) => (
                <button key={p.label} type="button" className="wl-chip" onClick={() => setYourFee(p.fee)} aria-pressed={Math.abs(yourFee - p.fee) < 0.005}>
                  {p.label}
                </button>
              ))}
            </div>

            <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
              <span className="ss-headline-label">Choosing the index fund would leave you with</span>
              <span className="ss-headline-value">{dollars(view.gap)} more</span>
              <span className="ss-headline-sub">
                after {years} years, money the {pct(yourFee)} fee would otherwise quietly drain
              </span>
            </div>
          </>
        ) : (
          <p className="wl-note">
            The chart on the right is the real history of what fund investors actually paid,
            plotted <strong>directly</strong> from the Investment Company Institute's annual
            expense-ratio study (the calculator simply compounds a fixed fee against your
            balance each year). Two
            things stand out: fees fell dramatically over 30 years, and index funds cost a
            small fraction of what active funds charge. Switch back to the calculator to see
            what a gap like that does to a lifetime of saving.
          </p>
        )}
      </div>

      <div className="wl-stage">
        {mode === "cost" ? (
          <CostView view={view} years={years} yourFee={yourFee} indexFee={indexFee} />
        ) : (
          <TrendsView />
        )}
      </div>
    </div>
  );
}

function CostView({
  view,
  years,
  yourFee,
  indexFee,
}: {
  view: {
    gross: { year: number; value: number }[];
    yours: { year: number; value: number }[];
    index: { year: number; value: number }[];
    grossFinal: number;
    yoursFinal: number;
    indexFinal: number;
    gap: number;
    dragYours: number;
    dragShare: number;
  };
  years: number;
  yourFee: number;
  indexFee: number;
}) {
  return (
    <>
      <div className="wl-frontier">
        <h3>What your savings grow to</h3>
        <GrowthChart gross={view.gross} yours={view.yours} index={view.index} years={years} />
        <p className="wl-fnote">
          The <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>green</span> line is the
          low-cost index fund; the <span style={{ color: "var(--pl-c3)", fontWeight: 700 }}>orange</span> line
          is your fund. The shaded gap between them is wealth the higher fee compounds away.
          It widens every year because the fee is charged on a balance that would otherwise
          be growing.
        </p>
      </div>

      <div className="wl-lower">
        <div className="wl-readout">
          <dl className="ss-stats">
            <div><dt>Index fund ({pct(indexFee)})</dt><dd>{dollars(view.indexFinal)}</dd></div>
            <div><dt>Your fund ({pct(yourFee)})</dt><dd>{dollars(view.yoursFinal)}</dd></div>
            <div><dt>Difference</dt><dd>{dollars(view.gap)}</dd></div>
            <div><dt>Your fee's total drag</dt><dd>{Math.round(view.dragShare * 100)}% of your nest egg</dd></div>
          </dl>
          <p className="wl-saved">
            Over {years} years, your fund's <strong>{pct(yourFee)}</strong> fee quietly costs{" "}
            <strong>{dollars(view.dragYours)}</strong>, about <strong>{Math.round(view.dragShare * 100)}%</strong> of
            the wealth you'd have kept with no fee at all. The fee looks tiny each year, but
            it's charged on your whole balance, so it compounds right alongside your returns,
            just in the wrong direction. This is why costs are one of the very few things in
            investing you can actually control.
          </p>
        </div>
      </div>
    </>
  );
}

function GrowthChart({
  gross,
  yours,
  index,
  years,
}: {
  gross: { year: number; value: number }[];
  yours: { year: number; value: number }[];
  index: { year: number; value: number }[];
  years: number;
}) {
  const width = 760;
  const height = 380;
  const pad = { top: 18, right: 18, bottom: 34, left: 64 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxV = gross[gross.length - 1].value * 1.03;
  const x = (yr: number) => pad.left + (yr / (years || 1)) * plotW;
  const y = (v: number) => pad.top + plotH - (v / maxV) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  const path = (pts: { year: number; value: number }[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.year)},${y(p.value)}`).join(" ");

  // Shaded gap between the index and your-fund curves.
  const gapArea =
    path(index) +
    " " +
    [...yours].reverse().map((p) => `L${x(p.year)},${y(p.value)}`).join(" ") +
    " Z";

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => maxV * f);
  const xTicks = [0, Math.round(years / 2), years];
  const money = (v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Savings growth with a low-cost index fund versus a higher-fee fund">
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" />
          <text x={pad.left - 8} y={y(v) + 4} textAnchor="end" style={axisText}>{money(v)}</text>
        </g>
      ))}
      {xTicks.map((yr) => (
        <text key={yr} x={x(yr)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>{yr === 0 ? "now" : `yr ${yr}`}</text>
      ))}

      <path d={gapArea} fill="var(--pl-c3)" opacity={0.14} />
      <path d={path(index)} fill="none" stroke="var(--color-accent)" strokeWidth={3} />
      <path d={path(yours)} fill="none" stroke="var(--pl-c3)" strokeWidth={2.4} />

      <text x={pad.left + plotW / 2} y={height - 3} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        The shaded wedge is what the higher fee costs you
      </text>
    </svg>
  );
}

function TrendsView() {
  // Equity active vs index is the clearest story; keep both for the "declined + gap."
  const shown = fees.series.filter((s) => s.kind === "equity");
  const active = shown.find((s) => s.active)!;
  const index = shown.find((s) => !s.active)!;
  const firstA = active.points[0], lastA = active.points[active.points.length - 1];
  const lastI = index.points[index.points.length - 1];

  return (
    <>
      <div className="wl-frontier">
        <h3>What US fund investors actually paid, {fees.start}–{fees.end}</h3>
        <TrendChart series={shown} />
        <p className="wl-fnote">
          Asset-weighted average expense ratios: what the typical invested dollar really
          paid. The average active equity fund's fee fell from{" "}
          <strong>{pct(firstA.ratio)}</strong> in {firstA.year} to <strong>{pct(lastA.ratio)}</strong>{" "}
          in {lastA.year}, while index equity funds charge just <strong>{pct(lastI.ratio)}</strong>,
          a fraction of the active average.
        </p>
      </div>

      <div className="wl-lower">
        <div className="wl-readout">
          <dl className="ss-stats">
            <div><dt>Active equity, {firstA.year}</dt><dd>{pct(firstA.ratio)}</dd></div>
            <div><dt>Active equity, {lastA.year}</dt><dd>{pct(lastA.ratio)}</dd></div>
            <div><dt>Index equity, {lastI.year}</dt><dd>{pct(lastI.ratio)}</dd></div>
            <div><dt>Active-vs-index gap today</dt><dd>{pct(lastA.ratio - lastI.ratio)}</dd></div>
          </dl>
          <p className="wl-saved">
            Two forces drove fees down: investors moved trillions into low-cost index funds,
            and competition pushed even active funds to trim their charges. But a real gap
            remains: the average active equity fund still costs about{" "}
            <strong>{(lastA.ratio / lastI.ratio).toFixed(0)}×</strong> what the average index
            fund does. That difference is small as a yearly percentage and enormous once it
            compounds, which is exactly what the calculator shows.
          </p>
        </div>
      </div>
    </>
  );
}

function TrendChart({ series }: { series: (typeof fees.series) }) {
  const width = 760;
  const height = 380;
  const pad = { top: 18, right: 132, bottom: 34, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const allPts = series.flatMap((s) => s.points);
  const minYear = Math.min(...allPts.map((p) => p.year));
  const maxYear = Math.max(...allPts.map((p) => p.year));
  const maxV = Math.max(...allPts.map((p) => p.ratio)) * 1.08;

  const x = (yr: number) => pad.left + ((yr - minYear) / (maxYear - minYear || 1)) * plotW;
  const y = (v: number) => pad.top + plotH - (v / maxV) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  const colorFor = (active: boolean) => (active ? "var(--pl-c3)" : "var(--color-accent)");

  const labels = series
    .map((s) => {
      const last = s.points[s.points.length - 1];
      return { name: s.name, active: s.active, ratio: last.ratio, y: y(last.ratio), color: colorFor(s.active) };
    })
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].y - labels[i - 1].y < 14) labels[i].y = labels[i - 1].y + 14;
  }

  const yTicks = [0, 0.5, 1, 1.5].filter((v) => v <= maxV);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Average fund expense ratios over time, active versus index">
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{v.toFixed(1)}%</text>
        </g>
      ))}
      {[minYear, Math.round((minYear + maxYear) / 2), maxYear].map((yr) => (
        <text key={yr} x={x(yr)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>{yr}</text>
      ))}
      {series.map((s) => (
        <path
          key={s.id}
          d={s.points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.year)},${y(p.ratio)}`).join(" ")}
          fill="none"
          stroke={colorFor(s.active)}
          strokeWidth={2.4}
        />
      ))}
      {labels.map((l) => (
        <text key={l.name} x={width - pad.right + 6} y={l.y + 3} style={{ ...axisText, fill: l.color, fontWeight: 600, fontSize: 10.5 }}>
          {l.name} {pct(l.ratio)}
        </text>
      ))}
      <text x={pad.left + plotW / 2} y={height - 3} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Asset-weighted average expense ratio · lower is cheaper
      </text>
    </svg>
  );
}
