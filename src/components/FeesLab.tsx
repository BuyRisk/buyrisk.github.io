import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { fees } from "../data/generated/fees";
import { fundLoads } from "../data/generated/fund-loads";
import { formatMoney, useCurrencyCode } from "../lib/currency";

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

const dollars = (n: number) => formatMoney(n);

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
  useCurrencyCode(); // re-render when the header currency picker changes
  const [mode, setMode] = useState<"cost" | "trends" | "hidden">("cost");
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
          <button type="button" className={mode === "hidden" ? "active" : ""} aria-pressed={mode === "hidden"} onClick={() => setMode("hidden")}>
            The fees you don't see
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
        ) : mode === "trends" ? (
          <p className="wl-note">
            The chart on the right is the real history of what fund investors actually paid,
            plotted <strong>directly</strong> from the Investment Company Institute's annual
            expense-ratio study (the calculator simply compounds a fixed fee against your
            balance each year). Two
            things stand out: fees fell dramatically over 30 years, and index funds cost a
            small fraction of what active funds charge. Switch back to the calculator to see
            what a gap like that does to a lifetime of saving.
          </p>
        ) : (
          <>
            <p className="wl-note" style={{ fontStyle: "normal", color: "var(--color-text-soft)" }}>
              The expense ratio isn't the whole bill. Three charges hide outside the sliders:
            </p>
            <dl className="ss-stats" style={{ marginTop: "0.5rem" }}>
              <div>
                <dt>Front load<InfoTip text="A sales commission taken BEFORE your money is invested — the classic 'A-share' charged up to 5.75%. Put in $10,000 and only $9,425 goes to work." /></dt>
                <dd>$10,000 → $9,425</dd>
              </div>
              <div>
                <dt>Back-end load (CDSC)<InfoTip text="A charge when you SELL, typically starting near 5% and declining the longer you hold — the 'B-share' design, built to be invisible at purchase." /></dt>
                <dd>up to ~5% to leave</dd>
              </div>
              <div>
                <dt>12b-1 fee<InfoTip text="An annual marketing-and-distribution fee inside the expense ratio, capped at 1%/yr: you pay the fund to advertise itself to other people." /></dt>
                <dd>up to 1%/yr</dd>
              </div>
            </dl>
            <p className="wl-note" style={{ marginTop: "0.5rem" }}>
              The chart shows how common they've really been across US equity fund share classes
              ({fundLoads.window}, CRSP). The good news: all three are dying — killed by the same
              index-fund fee war as the expense ratios in the trends view. The catch: the funds
              still charging them are exactly the ones a salesperson is paid to show you.
            </p>
          </>
        )}
      </div>

      <div className="wl-stage">
        {mode === "cost" ? (
          <CostView view={view} years={years} yourFee={yourFee} indexFee={indexFee} />
        ) : mode === "trends" ? (
          <TrendsView />
        ) : (
          <HiddenFeesView />
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
  const money = (v: number) => formatMoney(v, { compact: true });

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

// ---------------------------------------------------------------------------
// The fees you don't see: 12b-1 and back-end loads, rise and fall (CRSP).
// ---------------------------------------------------------------------------

function HiddenFeesView() {
  const S = fundLoads.series;
  const peak = S.reduce((a, b) => (b.pct12b1 > a.pct12b1 ? b : a));
  const first = S[0];
  const last = S[S.length - 1];
  const rearPeak = S.reduce((a, b) => (b.pctRearLoad > a.pctRearLoad ? b : a));
  return (
    <>
      <div className="wl-frontier">
        <h3>The rise and fall of the hidden fees</h3>
        <HiddenFeesChart series={S} />
        <p className="wl-fnote">
          Share of US equity fund share classes charging each fee. At the {peak.year} peak,{" "}
          <strong>{Math.round(peak.pct12b1 * 100)}%</strong> carried a 12b-1 marketing fee (median{" "}
          {((peak.med12b1 ?? 0) * 100).toFixed(2)}%/yr) and at theirs, {Math.round(rearPeak.pctRearLoad * 100)}%
          had a back-end load (median {((rearPeak.medRearLoad ?? 0) * 100).toFixed(0)}% to exit in year one).
          By {last.year} those had fallen to {Math.round(last.pct12b1 * 100)}% and{" "}
          {Math.round(last.pctRearLoad * 100)}%.
        </p>
      </div>

      <div className="wl-lower">
        <div className="wl-readout">
          <dl className="ss-stats">
            <div><dt>12b-1 at the {peak.year} peak</dt><dd>{Math.round(peak.pct12b1 * 100)}% of classes</dd></div>
            <div><dt>12b-1 in {last.year}</dt><dd>{Math.round(last.pct12b1 * 100)}% (median {((last.med12b1 ?? 0) * 100).toFixed(2)}%/yr)</dd></div>
            <div><dt>Back-end loads, {first.year}</dt><dd>{Math.round(first.pctRearLoad * 100)}% of classes</dd></div>
            <div><dt>Back-end loads, {last.year}</dt><dd>{Math.round(last.pctRearLoad * 100)}%</dd></div>
          </dl>
          <p className="wl-saved">
            These fees were never about managing your money — they paid for <strong>selling</strong> it:
            the front load was the broker's commission, the back-end load its exit-door twin, and the
            12b-1 a standing levy on your balance to market the fund to the next customer. None of them
            buys performance. They collapsed because investors walked to no-load index funds — proof that
            the one reliable fee-reduction strategy is simply refusing to pay. Before buying any fund,
            check all three in the prospectus's fee table, not just the expense ratio.{" "}
            <strong>Method:</strong> CRSP mutual-fund database, {fundLoads.window}; share classes charging
            actual 12b-1 &gt; 0, and deferred-sales-charge schedules in force (worst first-year rate).
            Educational only, not advice.
          </p>
        </div>
      </div>
    </>
  );
}

function HiddenFeesChart({ series }: { series: (typeof fundLoads.series) }) {
  const width = 760;
  const height = 360;
  const pad = { top: 18, right: 118, bottom: 34, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const y0 = series[0].year;
  const y1 = series[series.length - 1].year;
  const maxV = Math.max(...series.map((s) => s.pct12b1)) * 1.12;
  const x = (yr: number) => pad.left + ((yr - y0) / (y1 - y0)) * plotW;
  const y = (v: number) => pad.top + plotH - (v / maxV) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;
  const line = (key: "pct12b1" | "pctRearLoad") =>
    series.map((s, i) => `${i === 0 ? "M" : "L"}${x(s.year).toFixed(1)},${y(s[key]).toFixed(1)}`).join(" ");
  const last = series[series.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Share of equity fund share classes charging 12b-1 fees and back-end loads over time">
      {[0, 0.2, 0.4, 0.6].filter((v) => v <= maxV).map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{Math.round(v * 100)}%</text>
        </g>
      ))}
      {[y0, Math.round((y0 + y1) / 2), y1].map((yr) => (
        <text key={yr} x={x(yr)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>{yr}</text>
      ))}
      <path d={line("pct12b1")} fill="none" stroke="var(--pl-c3)" strokeWidth={2.6} strokeLinejoin="round" />
      <path d={line("pctRearLoad")} fill="none" stroke="var(--color-link)" strokeWidth={2.4} strokeLinejoin="round" />
      <text x={width - pad.right + 6} y={y(last.pct12b1) + 4} style={{ ...axisText, fill: "var(--pl-c3)", fontWeight: 600, fontSize: 10.5 }}>
        12b-1 {Math.round(last.pct12b1 * 100)}%
      </text>
      <text x={width - pad.right + 6} y={y(last.pctRearLoad) + 4} style={{ ...axisText, fill: "var(--color-link)", fontWeight: 600, fontSize: 10.5 }}>
        back-end {Math.round(last.pctRearLoad * 100)}%
      </text>
      <text x={pad.left + plotW / 2} y={height - 3} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Share of US equity fund share classes charging the fee
      </text>
    </svg>
  );
}
