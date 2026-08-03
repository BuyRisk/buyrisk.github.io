import { useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { formatMoney, useCurrencyCode } from "../lib/currency";

/**
 * Emergency fund sizer. A target of N months of essential expenses, where N grows
 * with how risky your income is, whether you're a single earner, and dependents.
 * Compares to what you've saved and how long to close the gap. Stateless.
 */

function Seg<T extends string>({ label, info, value, options, onChange }: {
  label: string; info?: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="wl-field">
      <span className="wl-field-label">{label}{info && <InfoTip text={info} />}</span>
      <div className="wl-simmode wl-simmode--wrap" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" className={value === o.value ? "active" : ""} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

type Stability = "riskless" | "steady" | "variable" | "veryVariable";
type Earners = "two" | "one";
type Deps = "no" | "yes";

export default function EmergencyFundLab() {
  useCurrencyCode();
  const money = (n: number) => formatMoney(n);
  const [essentials, setEssentials] = useState(3200);
  const [stability, setStability] = useState<Stability>("steady");
  const [earners, setEarners] = useState<Earners>("two");
  const [deps, setDeps] = useState<Deps>("no");
  const [saved, setSaved] = useState(4000);
  const [contribution, setContribution] = useState(400);

  const reset = () => { setEssentials(3200); setStability("steady"); setEarners("two"); setDeps("no"); setSaved(4000); setContribution(400); };

  const months = Math.min(12, Math.max(3,
    3 + ({ riskless: 0, steady: 1, variable: 2.5, veryVariable: 4 }[stability])
      + (earners === "one" ? 1.5 : 0)
      + (deps === "yes" ? 1.5 : 0)));
  const target = months * essentials;
  const funded = target > 0 ? Math.min(1, saved / target) : 1;
  const gap = Math.max(0, target - saved);
  const monthsToFill = contribution > 0 ? Math.ceil(gap / contribution) : Infinity;
  const done = gap <= 0;

  const toGoLabel = (m: number) => {
    if (!isFinite(m)) return "never at $0/mo";
    const y = Math.floor(m / 12), mo = m % 12;
    return y === 0 ? `${mo} mo` : mo === 0 ? `${y} yr` : `${y} yr ${mo} mo`;
  };

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={reset} />
        <p className="wl-note" style={{ marginTop: 0 }}>
          An emergency fund is cash you can reach fast — for a job loss, a medical
          bill, a car repair — so a surprise doesn't become high-interest debt or a
          forced sale of your investments. How big it should be depends on how steady
          your income is.
        </p>

        <label className="wl-slider">
          <span>
            Essential expenses / month
            <InfoTip text="What it costs to keep the lights on if you cut everything optional: housing, food, utilities, insurance, minimum debt payments, transportation." />{" "}
            <strong>{money(essentials)}</strong>
          </span>
          <input type="range" min={800} max={12000} step={100} value={essentials} onChange={(e) => setEssentials(Number(e.target.value))} />
        </label>

        <Seg label="Income stability" info="Nearly riskless: tenured or very secure government work, where a layoff is almost unthinkable — you mainly need a cushion for non-job emergencies (medical, car, home). Steady: a typical salaried job (layoffs still happen). Variable: commission, gig, or seasonal. Very variable: self-employed or fully commission." value={stability}
          onChange={setStability} options={[{ value: "riskless", label: "Nearly riskless" }, { value: "steady", label: "Steady" }, { value: "variable", label: "Variable" }, { value: "veryVariable", label: "Very variable" }]} />
        <Seg label="Earners in household" value={earners} onChange={setEarners}
          info="Two incomes cushion each other, so a smaller fund goes further. One income carries all the risk."
          options={[{ value: "two", label: "Two" }, { value: "one", label: "One" }]} />
        <Seg label="Dependents" value={deps} onChange={setDeps}
          info="People who rely on your income raise the cost of an interruption, so the cushion should be larger."
          options={[{ value: "no", label: "None" }, { value: "yes", label: "Yes" }]} />

        <label className="wl-slider" style={{ marginTop: "var(--space-sm)" }}>
          <span>Already saved <strong>{money(saved)}</strong></span>
          <input type="range" min={0} max={60000} step={500} value={saved} onChange={(e) => setSaved(Number(e.target.value))} />
        </label>
        <label className="wl-slider">
          <span>Monthly contribution <strong>{money(contribution)}</strong></span>
          <input type="range" min={0} max={3000} step={25} value={contribution} onChange={(e) => setContribution(Number(e.target.value))} />
        </label>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <div className="ss-headline">
            <span className="ss-headline-label">Target emergency fund</span>
            <span className="ss-headline-value">{money(target)}</span>
            <span className="ss-headline-sub">{months.toFixed(1).replace(/\.0$/, "")} months of essentials</span>
          </div>

          <p className="ef-progresslabel">{done ? "Fully funded 🎉" : `${(funded * 100).toFixed(0)}% there — ${money(gap)} to go`}</p>
          <div className="ef-bar" role="img" aria-label={`${(funded * 100).toFixed(0)} percent funded`}>
            <div className="ef-fill" style={{ width: `${funded * 100}%` }} />
          </div>
          <p className="wl-fnote">
            Keep it somewhere safe and liquid — a high-yield savings account or money-
            market fund, not the stock market. Its job is to be there on a bad day,
            not to grow.
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <dl className="ss-stats">
              <div><dt>Target months</dt><dd>{months.toFixed(1).replace(/\.0$/, "")}</dd></div>
              <div><dt>Target amount</dt><dd>{money(target)}</dd></div>
              <div><dt>Still to save</dt><dd>{money(gap)}</dd></div>
              <div><dt>Time to fund</dt><dd>{done ? "Done" : toGoLabel(monthsToFill)}</dd></div>
            </dl>
            <p className="wl-saved">
              {done ? (
                <>You're covered. Once the fund is full, redirect that monthly contribution toward
                  paying down debt or investing — it's already doing its job just sitting there. </>
              ) : (
                <>At <strong>{money(contribution)}</strong>/mo you'll reach a {months.toFixed(1).replace(/\.0$/, "")}-month
                  fund in about <strong>{toGoLabel(monthsToFill)}</strong>. If that feels far, even one
                  month of expenses saved is a huge buffer against the most common surprises — build to
                  one month first, then keep going. </>
              )}
              Three months is a common floor; steadier situations can lean toward it, riskier ones toward
              six or more. Educational only, not advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
