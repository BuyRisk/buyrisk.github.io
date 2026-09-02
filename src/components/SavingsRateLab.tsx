import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { formatMoney, useCurrencyCode } from "../lib/currency";
import { REAL_TIP } from "../lib/returnBasis";

/**
 * "Savings Rate & Financial Independence": the punchline of the control-volume
 * view of net worth: what fills the tank is INPUT − OUTPUT (your savings rate),
 * and what the tank generates (investment returns) eventually covers your OUTPUT
 * forever. The startling result: how long that takes depends on your savings
 * RATE and return, almost not at all on your income. Two people saving 20% reach
 * independence in the same number of years whether they earn $50k or $500k.
 * Educational only, not advice.
 */

const currency = (n: number) => formatMoney(n);

const MAX_YEARS = 60;

/**
 * Years to financial independence, saving a constant fraction `s` of take-home
 * pay, earning real return `r`, targeting a nest egg of spending / `wr` (the flip
 * side of the 4% rule). `n0` is any starting net worth expressed in *years of
 * income* (net worth / income); at n0 = 0 income cancels out entirely and the
 * result depends only on `s` and `r`. Once n0 > 0, the head start's size
 * relative to income matters, so income starts to move the timeline.
 */
function yearsToFI(s: number, r: number, wr: number, n0 = 0): number {
  const target = (1 - s) / wr; // nest egg needed, in years of income
  if (n0 >= target) return 0; // the head start alone already covers it
  if (r <= 0) return s > 0 ? (target - n0) / s : Infinity; // linear fill, or never
  // With a real return, solve (1+r)^t = (target + s/r) / (n0 + s/r).
  const denom = n0 + s / r;
  if (denom <= 0) return Infinity; // no savings and no starting balance
  const g = (target + s / r) / denom;
  return g > 1 ? Math.log(g) / Math.log1p(r) : 0;
}

const fmtYears = (y: number) => (!Number.isFinite(y) ? "never" : y >= MAX_YEARS ? `${MAX_YEARS}+` : `${y.toFixed(0)}`);

export default function SavingsRateLab() {
  useCurrencyCode(); // re-render when the header currency picker changes
  const [savings, setSavings] = useState(20); // % of take-home
  const [ret, setRet] = useState(5); // real return %
  const [wr, setWr] = useState(4); // withdrawal rate %
  const [income, setIncome] = useState(60_000); // take-home $/yr
  const [netWorth, setNetWorth] = useState(0); // current invested savings, $
  const [age, setAge] = useState(30);

  const view = useMemo(() => {
    const s = savings / 100;
    const r = ret / 100;
    const w = wr / 100;
    const n0 = income > 0 ? netWorth / income : 0; // head start, in years of income
    const years = yearsToFI(s, r, w, n0);
    const yearsFromZero = yearsToFI(s, r, w, 0); // same plan with no head start
    const spending = income * (1 - s);
    const annualSaved = income * s;
    const target = w > 0 ? spending / w : Infinity;
    const fiAge = Number.isFinite(years) ? age + years : Infinity;

    // The iconic curve: years to FI across every savings rate, at these r & wr.
    const curve: { s: number; years: number }[] = [];
    for (let p = 1; p <= 90; p++) curve.push({ s: p, years: Math.min(MAX_YEARS + 5, yearsToFI(p / 100, r, w, n0)) });

    // How many years the head start shaves off, when both timelines are finite.
    const yearsSaved =
      netWorth > 0 && Number.isFinite(years) && Number.isFinite(yearsFromZero)
        ? Math.max(0, yearsFromZero - years)
        : 0;

    return { years, spending, annualSaved, target, fiAge, curve, yearsSaved, multiple: w > 0 ? 1 / w : Infinity };
  }, [savings, ret, wr, income, netWorth, age]);

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={() => { setSavings(20); setRet(5); setWr(4); setIncome(60_000); setNetWorth(0); setAge(30); }} />

        <label className="wl-slider">
          <span>
            Savings rate
            <InfoTip text="The share of your take-home pay you save and invest, instead of spending. This one number drives almost everything." />{" "}
            <strong>{savings}%</strong>
          </span>
          <input type="range" min={1} max={90} step={1} value={savings} onChange={(e) => setSavings(+e.target.value)} />
        </label>

        <label className="wl-slider">
          <span>
            Take-home pay
            <InfoTip text="Your spendable income after taxes. With no starting net worth, slide it and the YEARS barely move: income sets how big your numbers are, not how long FI takes. Add a head start below and income starts to matter." />{" "}
            <strong>{currency(income)}/yr</strong>
          </span>
          <input type="range" min={10_000} max={400_000} step={5_000} value={income} onChange={(e) => setIncome(+e.target.value)} />
        </label>

        <label className="wl-slider">
          <span>
            Current net worth
            <InfoTip text="Money you've already invested. Leave it at $0 for the classic result where income doesn't matter. Add a balance and it gives you a head start that pulls the finish line closer, and the bigger it is relative to your pay, the more it helps." />{" "}
            <strong>{currency(netWorth)}</strong>
          </span>
          <input type="range" min={0} max={5_000_000} step={10_000} value={netWorth} onChange={(e) => setNetWorth(+e.target.value)} />
        </label>

        <label className="wl-slider">
          <span>
            Real return
            <InfoTip text={`Expected investment return above inflation. A globally diversified stock/bond mix has historically returned roughly 4–6% real over long periods. Nothing is guaranteed. ${REAL_TIP}`} />{" "}
            <strong>{ret}%</strong>
          </span>
          <input type="range" min={0} max={8} step={0.5} value={ret} onChange={(e) => setRet(+e.target.value)} />
        </label>

        <label className="wl-slider">
          <span>
            Withdrawal rate
            <InfoTip text="The share of the nest egg you'll live on each year in retirement. 4% is the classic rule of thumb; lower is safer and needs a bigger pile." />{" "}
            <strong>{wr}%</strong>
          </span>
          <input type="range" min={2.5} max={6} step={0.25} value={wr} onChange={(e) => setWr(+e.target.value)} />
        </label>

        <label className="wl-slider">
          <span>
            Your age today
            <InfoTip text="Just to translate 'years to FI' into an age. It doesn't affect the math." />{" "}
            <strong>{age}</strong>
          </span>
          <input type="range" min={18} max={75} step={1} value={age} onChange={(e) => setAge(+e.target.value)} />
        </label>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">Saving {savings}% of your pay, you reach financial independence in</span>
          <span className="ss-headline-value">{fmtYears(view.years)} {Number.isFinite(view.years) && view.years < MAX_YEARS ? "years" : ""}</span>
          <span className="ss-headline-sub">
            {Number.isFinite(view.fiAge) && view.fiAge < age + MAX_YEARS
              ? <>around age <strong>{view.fiAge.toFixed(0)}</strong>, a {currency(view.target)} nest egg ({view.multiple.toFixed(0)}× spending)</>
              : <>at this savings rate the finish line is more than {MAX_YEARS} years out</>}
          </span>
        </div>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          {netWorth > 0 ? (
            <>
              Saving a constant share of pay, earning {ret}% real, on top of your{" "}
              <strong>{currency(netWorth)}</strong> head start.{" "}
              {view.yearsSaved >= 0.5 ? (
                <>That pulls FI in by about <strong>{view.yearsSaved.toFixed(0)} year{view.yearsSaved >= 1.5 ? "s" : ""}</strong>, and because the head start is a fixed sum, your income now nudges the timeline too.</>
              ) : (
                <>Because the head start is a fixed sum, your income now nudges the timeline too.</>
              )}{" "}
              Educational only, not advice.
            </>
          ) : (
            <>
              Starting from zero, saving a constant share of pay, earning {ret}% real. Years to FI depend on your savings
              rate and return, <strong>not</strong> your income. Educational only, not advice.
            </>
          )}
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>Years to financial independence vs. your savings rate</h3>
          <SavingsCurve curve={view.curve} savings={savings} years={view.years} />
          <p className="wl-fnote">
            The curve is brutal at the left and merciful at the right: going from a 10% to a 20% savings rate cuts far
            more time than going from 60% to 70%. Every extra point of savings does double duty: it grows the pile
            faster <em>and</em> shrinks the pile you need.
          </p>
        </div>

        <div className="wl-lower" style={{ display: "flex", gap: "var(--space-md)", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div className="wl-readout" style={{ flex: "1 1 320px" }}>
            <dl className="ss-stats">
              <div><dt>Years to FI</dt><dd>{fmtYears(view.years)}</dd></div>
              <div><dt>FI age</dt><dd>{Number.isFinite(view.fiAge) && view.fiAge < age + MAX_YEARS ? view.fiAge.toFixed(0) : "—"}</dd></div>
              <div><dt>Nest egg needed</dt><dd>{Number.isFinite(view.target) ? currency(view.target) : "—"}</dd></div>
              <div><dt>Saved per year</dt><dd>{currency(view.annualSaved)}</dd></div>
            </dl>
            <p className="wl-saved">
              {netWorth > 0 ? (
                <>
                  With a head start, that clean result bends a little. Because your{" "}
                  <strong>{currency(netWorth)}</strong> is a fixed sum, a smaller paycheck makes it a{" "}
                  <em>bigger</em> fraction of what you need and pulls FI closer, while a bigger paycheck shrinks
                  its relative weight. Set net worth back to $0 to see the pure version, where only your savings{" "}
                  <em>rate</em> and return set the clock. Educational only, not advice.
                </>
              ) : (
                <>
                  Here's the part that surprises people: drag <strong>take-home pay</strong> from {currency(20_000)} to{" "}
                  {currency(400_000)} and the <strong>years barely change</strong>. A bigger paycheck makes every number
                  bigger (the savings, the spending, the target), but they scale together, so the <em>rate</em> is what
                  sets your timeline. It's the closest thing personal finance has to a law of conservation: what you don't
                  spend is what funds your independence, and how fast you get there is set by the fraction, not the size, of the
                  flow. Educational only, not advice.
                </>
              )}
            </p>
          </div>

          <div className="wl-readout" style={{ flex: "0 1 260px" }}>
            <h3 style={{ marginTop: 0 }}>The shockingly simple table</h3>
            <MmmTable savings={savings} />
            <p className="wl-fnote" style={{ marginTop: "var(--space-sm)" }}>
              Recreated from Mr. Money Mustache,{" "}
              <a href="https://www.mrmoneymustache.com/2012/01/13/the-shockingly-simple-math-behind-early-retirement/" target="_blank" rel="noopener noreferrer">
                "The Shockingly Simple Math Behind Early Retirement"
              </a>{" "}
              (2012). It assumes a 5% real return and a 4% withdrawal rate, the same defaults as this tool, which is why
              the rows line up. Set those sliders differently and your curve above will diverge from his table.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mr. Money Mustache's canonical savings-rate → years-to-retirement table. */
const MMM_TABLE: { rate: number; years: string }[] = [
  { rate: 5, years: "66" }, { rate: 10, years: "51" }, { rate: 15, years: "43" },
  { rate: 20, years: "37" }, { rate: 25, years: "32" }, { rate: 30, years: "28" },
  { rate: 35, years: "25" }, { rate: 40, years: "22" }, { rate: 45, years: "19" },
  { rate: 50, years: "17" }, { rate: 55, years: "14.5" }, { rate: 60, years: "12.5" },
  { rate: 65, years: "10.5" }, { rate: 70, years: "8.5" }, { rate: 75, years: "7" },
  { rate: 80, years: "5.5" }, { rate: 85, years: "4" }, { rate: 90, years: "Under 3" },
  { rate: 95, years: "Under 2" }, { rate: 100, years: "Zero" },
];

function MmmTable({ savings }: { savings: number }) {
  const nearest = MMM_TABLE.reduce((a, b) => (Math.abs(b.rate - savings) < Math.abs(a.rate - savings) ? b : a));
  return (
    <table className="mmm-table">
      <thead>
        <tr><th>Savings rate</th><th>Years to retirement</th></tr>
      </thead>
      <tbody>
        {MMM_TABLE.map((r) => (
          <tr key={r.rate} className={r.rate === nearest.rate ? "mmm-row--active" : undefined}>
            <td>{r.rate}%</td>
            <td>{r.years}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SavingsCurve({ curve, savings, years }: { curve: { s: number; years: number }[]; savings: number; years: number }) {
  const width = 760;
  const height = 380;
  const pad = { top: 18, right: 18, bottom: 44, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const yMax = MAX_YEARS;
  const x = (s: number) => pad.left + (s / 100) * plotW;
  const y = (v: number) => pad.top + plotH - (Math.min(v, yMax) / yMax) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  const line = curve.map((c, i) => `${i === 0 ? "M" : "L"}${x(c.s)},${y(c.years)}`).join(" ");
  const curY = Math.min(years, yMax);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Years to financial independence as a function of savings rate">
      {[0, 15, 30, 45, 60].map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{v === 60 ? "60+" : v}</text>
        </g>
      ))}
      {[10, 25, 50, 75, 90].map((s) => (
        <text key={s} x={x(s)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>{s}%</text>
      ))}

      <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth={2.8} />

      {Number.isFinite(years) && (
        <>
          <line x1={x(savings)} x2={x(savings)} y1={pad.top} y2={pad.top + plotH} stroke="var(--color-muted)" strokeDasharray="3 3" />
          <line x1={pad.left} x2={x(savings)} y1={y(curY)} y2={y(curY)} stroke="var(--pl-c3)" strokeDasharray="3 3" />
          <circle cx={x(savings)} cy={y(curY)} r={5} fill="var(--pl-c3)" />
        </>
      )}

      <text x={pad.left + plotW / 2} y={height - 6} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Savings rate (% of take-home pay) → years to financial independence
      </text>
    </svg>
  );
}
