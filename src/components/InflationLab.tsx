import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { inflation } from "../data/generated/inflation";

/**
 * "What happened to your dollar?" — rebase real US CPI category price levels to a
 * year of your choosing and watch how differently everyday prices moved: college
 * and healthcare soaring far past the overall average, while toys and clothing
 * stayed flat or got cheaper. Plus the plain purchasing-power erosion of a dollar.
 * Data: US BLS via FRED. Educational only.
 */

const DEFAULT_START = 1990;
const END = inflation.commonEnd;

const dollars = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 100 ? 2 : 0 });

const palette = (i: number) => `var(--pl-c${(i % 8) + 1})`;

function indexAt(cat: (typeof inflation.categories)[number], year: number): number | undefined {
  return cat.series.find((p) => p.year === year)?.index;
}

export default function InflationLab() {
  const [startYear, setStartYear] = useState(DEFAULT_START);
  const [amount, setAmount] = useState(100);

  const view = useMemo(() => {
    const cats = inflation.categories.map((c, i) => {
      const base = indexAt(c, startYear)!;
      const rebased = c.series
        .filter((p) => p.year >= startYear && p.year <= END)
        .map((p) => ({ year: p.year, value: (p.index / base) * 100 }));
      const mult = rebased[rebased.length - 1].value / 100;
      return { id: c.id, name: c.name, baseline: !!c.baseline, color: c.baseline ? "var(--color-accent)" : palette(i - 1), rebased, mult };
    });
    const all = cats.find((c) => c.baseline)!;
    const others = cats.filter((c) => !c.baseline);
    const fastest = others.reduce((a, b) => (b.mult > a.mult ? b : a));
    const slowest = others.reduce((a, b) => (b.mult < a.mult ? b : a));
    const years = END - startYear;
    const annualized = Math.pow(all.mult, 1 / years) - 1;
    return { cats, all, fastest, slowest, years, annualized };
  }, [startYear]);

  const costNow = amount * view.all.mult;
  const lostShare = 1 - 1 / view.all.mult;

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={() => { setStartYear(DEFAULT_START); setAmount(100); }} />

        <label className="wl-slider">
          <span>
            Start year
            <InfoTip text="Prices are rebased to 100 in this year, so every line shows how many times more (or less) that category costs today." />{" "}
            <strong>{startYear}</strong>
          </span>
          <input type="range" min={inflation.commonStart} max={END - 1} step={1} value={startYear} onChange={(e) => setStartYear(+e.target.value)} />
        </label>

        <label className="wl-slider">
          <span>
            An amount, then
            <InfoTip text="A dollar figure in your start year — we'll show what the same basket of goods costs today." />{" "}
            <strong>{dollars(amount)}</strong>
          </span>
          <input type="range" min={10} max={1000} step={10} value={amount} onChange={(e) => setAmount(+e.target.value)} />
        </label>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">{dollars(amount)} of goods in {startYear} costs, today</span>
          <span className="ss-headline-value">{dollars(costNow)}</span>
          <span className="ss-headline-sub">
            your dollar lost {Math.round(lostShare * 100)}% of its buying power
          </span>
        </div>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          Overall prices rose about <strong>{(view.annualized * 100).toFixed(1)}%</strong> a
          year since {startYear} — but the average hides enormous spread. <strong>Method:</strong> the official
          category price indexes, plotted directly and rebased to your chosen year (no modelling). Data: US
          BLS consumer price indexes via FRED.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>Prices since {startYear} (rebased to 100)</h3>
          <PriceChart cats={view.cats} startYear={startYear} />
          <p className="wl-fnote">
            Every line starts together at 100. Lines that climb got pricier; lines
            that dip below 100 got <em>cheaper</em>. The gap between{" "}
            <strong>{view.fastest.name}</strong> and <strong>{view.slowest.name}</strong> is
            the story a single inflation number erases.
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <dl className="ss-stats">
              <div><dt>Rose the most</dt><dd>{view.fastest.name} · {view.fastest.mult.toFixed(1)}×</dd></div>
              <div><dt>Rose the least</dt><dd>{view.slowest.name} · {view.slowest.mult.toFixed(1)}×</dd></div>
              <div><dt>Overall (all items)</dt><dd>{view.all.mult.toFixed(1)}×</dd></div>
              <div><dt>Per year, overall</dt><dd>{(view.annualized * 100).toFixed(1)}%</dd></div>
            </dl>
            <p className="wl-saved">
              Since {startYear}, <strong>{view.fastest.name.toLowerCase()}</strong> cost{" "}
              <strong>{view.fastest.mult.toFixed(1)}×</strong> as much, while{" "}
              <strong>{view.slowest.name.toLowerCase()}</strong>{" "}
              {view.slowest.mult < 1 ? (
                <>actually got <strong>cheaper</strong> ({Math.round((1 - view.slowest.mult) * 100)}% less)</>
              ) : (
                <>rose only {view.slowest.mult.toFixed(1)}×</>
              )}
              . "Inflation" is really many different stories at once — which is why the
              category you spend most on matters more than the headline number.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PriceChart({ cats, startYear }: { cats: { name: string; baseline: boolean; color: string; rebased: { year: number; value: number }[]; mult: number }[]; startYear: number }) {
  const width = 760;
  const height = 380;
  const pad = { top: 18, right: 120, bottom: 34, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxV = Math.max(...cats.flatMap((c) => c.rebased.map((p) => p.value))) * 1.03;
  const x = (year: number) => pad.left + ((year - startYear) / (END - startYear || 1)) * plotW;
  const y = (v: number) => pad.top + plotH - (v / maxV) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  // Endpoint labels: nudge apart vertically so they don't overlap.
  const labels = cats
    .map((c) => ({ name: c.name, color: c.color, baseline: c.baseline, mult: c.mult, y: y(c.rebased[c.rebased.length - 1].value) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].y - labels[i - 1].y < 14) labels[i].y = labels[i - 1].y + 14;
  }

  const yTicks = [100, ...[0.25, 0.5, 0.75, 1].map((f) => Math.round((maxV * f) / 100) * 100)].filter((v, i, a) => v > 0 && a.indexOf(v) === i);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Price levels of everyday categories since the start year, rebased to 100">
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeDasharray={v === 100 ? "4 3" : undefined} />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{v}</text>
        </g>
      ))}
      {[startYear, Math.round((startYear + END) / 2), END].map((yr) => (
        <text key={yr} x={x(yr)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>{yr}</text>
      ))}
      {cats.map((c) => (
        <path
          key={c.name}
          d={c.rebased.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.year)},${y(p.value)}`).join(" ")}
          fill="none"
          stroke={c.color}
          strokeWidth={c.baseline ? 3 : 1.8}
          opacity={c.baseline ? 1 : 0.9}
        />
      ))}
      {labels.map((l) => (
        <text key={l.name} x={width - pad.right + 6} y={l.y + 3} style={{ ...axisText, fill: l.color, fontWeight: l.baseline ? 700 : 600, fontSize: 10.5 }}>
          {l.name} {l.mult.toFixed(1)}×
        </text>
      ))}
      <text x={pad.left + plotW / 2} y={height - 3} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        {startYear} = 100 · higher is pricier, below the dashed line is cheaper
      </text>
    </svg>
  );
}
