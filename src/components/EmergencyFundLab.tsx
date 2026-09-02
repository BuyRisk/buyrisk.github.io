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
  // Optional "Advanced" lumpy-risk buffer, added on top of the months-based fund.
  const [advanced, setAdvanced] = useState(false);
  const [health, setHealth] = useState<"low" | "hdhp" | "high">("low");
  const [housing, setHousing] = useState<"rent" | "own">("rent");
  const [pets, setPets] = useState(0);
  const [otherRisk, setOtherRisk] = useState(0);

  const reset = () => {
    setEssentials(3200); setStability("steady"); setEarners("two"); setDeps("no"); setSaved(4000); setContribution(400);
    setAdvanced(false); setHealth("low"); setHousing("rent"); setPets(0); setOtherRisk(0);
  };

  // Months of essentials to hold: start at the common 3-month floor and add for
  // each risk factor. The bump sizes are judgment calls in the spirit of standard
  // guidance (3–6 months typical, more for volatile income), capped at 12 —
  // beyond a year, extra cash usually costs more in lost growth than it protects.
  const months = Math.min(12, Math.max(3,
    3 + ({ riskless: 0, steady: 1, variable: 2.5, veryVariable: 4 }[stability])
      + (earners === "one" ? 1.5 : 0)
      + (deps === "yes" ? 1.5 : 0)));
  const baseFund = months * essentials;

  // Lumpy-risk buffers are rough US-typical orders of magnitude, not quotes:
  // health ≈ a deductible / out-of-pocket max, home ≈ one major repair,
  // pets ≈ one emergency vet visit each. The InfoTips say so to the reader.
  const healthBuf = advanced ? ({ low: 2500, hdhp: 6000, high: 12000 }[health]) : 0;
  const homeBuf = advanced && housing === "own" ? 5000 : 0;
  const petBuf = advanced ? pets * 1500 : 0;
  const otherBuf = advanced ? otherRisk : 0;
  const buffer = healthBuf + homeBuf + petBuf + otherBuf;

  const target = baseFund + buffer;
  const funded = target > 0 ? Math.min(1, saved / target) : 1;
  const gap = Math.max(0, target - saved);
  const monthsToFill = contribution > 0 ? Math.ceil(gap / contribution) : Infinity;
  const done = gap <= 0;
  const monthsStr = months.toFixed(1).replace(/\.0$/, "");
  const bufferParts = [
    healthBuf ? `health ${money(healthBuf)}` : "",
    homeBuf ? `home ${money(homeBuf)}` : "",
    petBuf ? `pets ${money(petBuf)}` : "",
    otherBuf ? `other ${money(otherBuf)}` : "",
  ].filter(Boolean).join(", ");

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

        <div className="wl-field" style={{ marginTop: "0.6rem" }}>
          <span className="wl-field-label">
            One-off risks
            <InfoTip text="An emergency fund also covers lumpy surprises, not just lost income — a health deductible, a home repair, a big vet bill. Even a rock-solid job can carry these. Add a buffer for the ones you're exposed to, or skip it for a quick estimate." />
          </span>
          <div className="wl-simmode wl-simmode--wrap" role="group" aria-label="One-off risks">
            <button type="button" className={!advanced ? "active" : ""} aria-pressed={!advanced} onClick={() => setAdvanced(false)}>Skip</button>
            <button type="button" className={advanced ? "active" : ""} aria-pressed={advanced} onClick={() => setAdvanced(true)}>Add a buffer</button>
          </div>
        </div>
        {advanced && (
          <>
            <Seg label="Health coverage" value={health} onChange={setHealth}
              info="A high-deductible plan can leave you owing several thousand before insurance helps, so hold more. Rough buffers, not your exact plan — check your deductible and out-of-pocket max."
              options={[{ value: "low", label: "Low deductible" }, { value: "hdhp", label: "High-deductible" }, { value: "high", label: "Very high / limited" }]} />
            <Seg label="Home" value={housing} onChange={setHousing}
              info="Owning brings surprise repairs — HVAC, roof, plumbing, appliances. Renting shifts most of that to the landlord."
              options={[{ value: "rent", label: "Rent" }, { value: "own", label: "Own" }]} />
            <label className="wl-slider">
              <span>Pets<InfoTip text="A single emergency vet visit can run into the thousands. Adds a rough reserve of about $1,500 per pet." /> <strong>{pets}</strong></span>
              <input type="range" min={0} max={5} step={1} value={pets} onChange={(e) => setPets(Number(e.target.value))} />
            </label>
            <label className="wl-slider">
              <span>Other one-off risks<InfoTip text="Anything else lumpy you'd cover from savings: an aging car, a high auto or home insurance deductible, an older appliance, family obligations." /> <strong>{money(otherRisk)}</strong></span>
              <input type="range" min={0} max={20000} step={500} value={otherRisk} onChange={(e) => setOtherRisk(Number(e.target.value))} />
            </label>
          </>
        )}

        <label className="wl-slider" style={{ marginTop: "var(--space-sm)" }}>
          <span>Already saved <strong>{money(saved)}</strong></span>
          <input type="range" min={0} max={250000} step={1000} value={saved} onChange={(e) => setSaved(Number(e.target.value))} />
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
            <span className="ss-headline-sub">{monthsStr} months of essentials{buffer > 0 ? ` + ${money(buffer)} for one-off risks` : ""}</span>
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
            {buffer > 0 && (
              <p className="wl-fnote" style={{ marginTop: "calc(-1 * var(--space-sm))" }}>
                Target = <strong>{money(baseFund)}</strong> ({monthsStr} months of expenses) +{" "}
                <strong>{money(buffer)}</strong> buffer{bufferParts ? ` (${bufferParts})` : ""}.
              </p>
            )}
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
