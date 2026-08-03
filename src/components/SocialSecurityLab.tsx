import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import {
  optimize,
  optimizeCouple,
  optimizeWidow,
  fraMonths,
  monthsToLabel,
  type Sex,
  type Smoking,
  type Exercise,
  type Condition,
  type OptimizeResult,
  type CoupleResult,
  type WidowResult,
} from "../lib/socialSecurity";
import { formatMoney, currencySymbol, useCurrencyCode } from "../lib/currency";
import { IRMAA, type FilingStatus } from "../data/tax-irmaa";

/**
 * A survival-weighted Social Security claiming optimizer, our take on Mike
 * Piper's Open Social Security, with two extra levers: a health-based mortality
 * adjustment (the longevity "premium" of not smoking / staying active) and a
 * discount rate you can tie to paying down debt. Educational, single-earner; for
 * a real filing strategy we point to Open Social Security.
 */

const currency = (n: number) => formatMoney(n);

function Segmented<T extends string>({
  label,
  info,
  value,
  options,
  onChange,
}: {
  label: string;
  info?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="wl-field">
      <span className="wl-field-label">
        {label}
        {info && <InfoTip text={info} />}
      </span>
      <div className="wl-simmode wl-simmode--wrap" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" className={value === o.value ? "active" : ""} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SocialSecurityLab() {
  const symbol = currencySymbol(useCurrencyCode()); // re-render + dynamic symbol
  const [mode, setMode] = useState<"single" | "couple" | "widow">("single");
  const [deceasedBenefit, setDeceasedBenefit] = useState(2200);
  // Person A (also "you" in single mode).
  const [pia, setPia] = useState(2400);
  const [birthYear, setBirthYear] = useState(1965);
  const [currentAge, setCurrentAge] = useState(62);
  const [sex, setSex] = useState<Sex>("male");
  const [smoking, setSmoking] = useState<Smoking>("former");
  const [exercise, setExercise] = useState<Exercise>("moderate");
  const [condition, setCondition] = useState<Condition>("none");
  // Person B (spouse).
  const [piaB, setPiaB] = useState(1200);
  const [birthYearB, setBirthYearB] = useState(1967);
  const [currentAgeB, setCurrentAgeB] = useState(60);
  const [sexB, setSexB] = useState<Sex>("female");
  const [smokingB, setSmokingB] = useState<Smoking>("never");
  const [exerciseB, setExerciseB] = useState<Exercise>("moderate");
  const [conditionB, setConditionB] = useState<Condition>("none");
  const [discountRate, setDiscountRate] = useState(2);
  // A disabled adult child drawing on the (higher) record — reshapes the timing.
  const [disabledChild, setDisabledChild] = useState(false);
  // Advanced tax + IRMAA layer.
  const [advanced, setAdvanced] = useState(false);
  const [filing, setFiling] = useState<FilingStatus>("single");
  const [otherIncome, setOtherIncome] = useState(30000);
  const [marginalRate, setMarginalRate] = useState(22);
  const [survivorIncome, setSurvivorIncome] = useState(30000);
  const singleTax =
    advanced && mode === "single" ? { filing, otherIncome, marginalRate } : undefined;
  const coupleTax =
    advanced && mode === "couple"
      ? { otherIncome, marginalRate, survivorOtherIncome: survivorIncome }
      : undefined;

  const health = { sex, smoking, exercise, condition };
  const result = useMemo(
    () => optimize({ pia, birthYear, currentAge, discountRate, health, tax: singleTax, disabledChild }),
    [pia, birthYear, currentAge, discountRate, sex, smoking, exercise, condition, disabledChild, advanced, mode, filing, otherIncome, marginalRate]
  );
  // Population-average reference (former/moderate/no-condition ⇒ hazard 1.0), to
  // isolate the health "premium".
  const ref = useMemo(
    () => optimize({ pia, birthYear, currentAge, discountRate, health: { sex, smoking: "former", exercise: "moderate" }, tax: singleTax, disabledChild }),
    [pia, birthYear, currentAge, discountRate, sex, disabledChild, advanced, mode, filing, otherIncome, marginalRate]
  );
  const couple = useMemo(
    () =>
      optimizeCouple({
        a: { pia, birthYear, currentAge, health: { sex, smoking, exercise, condition } },
        b: { pia: piaB, birthYear: birthYearB, currentAge: currentAgeB, health: { sex: sexB, smoking: smokingB, exercise: exerciseB, condition: conditionB } },
        discountRate,
        tax: coupleTax,
        disabledChild,
      }),
    [pia, birthYear, currentAge, sex, smoking, exercise, condition, piaB, birthYearB, currentAgeB, sexB, smokingB, exerciseB, conditionB, disabledChild, discountRate, advanced, mode, otherIncome, marginalRate, survivorIncome]
  );
  const widow = useMemo(
    () => optimizeWidow({ ownPia: pia, survivorFull: deceasedBenefit, birthYear, currentAge, discountRate, health }),
    [pia, deceasedBenefit, birthYear, currentAge, discountRate, sex, smoking, exercise, condition]
  );

  const bestAgeLabel = monthsToLabel(result.best.ageMonths);
  const leDelta = result.lifeExpectancy - ref.lifeExpectancy;
  const valueDelta = result.best.npv - ref.best.npv;
  const at62 = result.points.find((p) => p.age === 62)!;
  const at70 = result.points.find((p) => p.age === 70)!;

  const resetAll = () => {
    setMode("single");
    setPia(2400); setBirthYear(1965); setCurrentAge(62); setSex("male"); setSmoking("former"); setExercise("moderate"); setCondition("none");
    setPiaB(1200); setBirthYearB(1967); setCurrentAgeB(60); setSexB("female"); setSmokingB("never"); setExerciseB("moderate"); setConditionB("none");
    setDiscountRate(2); setDisabledChild(false); setDeceasedBenefit(2200);
    setAdvanced(false); setFiling("single"); setOtherIncome(30000); setMarginalRate(22); setSurvivorIncome(30000);
  };

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={resetAll} />
        <div className="ss-credit">
          Inspired by <a href="https://opensocialsecurity.com" target="_blank" rel="noopener noreferrer">Open Social Security</a> by
          Mike Piper, the free, open-source gold standard. Use his for a real
          filing strategy; ours adds health, debt &amp; survivor levers for intuition.
        </div>

        <div className="wl-simmode wl-simmode--wrap" role="group" aria-label="Who's claiming">
          <button type="button" className={mode === "single" ? "active" : ""} aria-pressed={mode === "single"} onClick={() => setMode("single")}>Just me</button>
          <button type="button" className={mode === "couple" ? "active" : ""} aria-pressed={mode === "couple"} onClick={() => setMode("couple")}>Married couple</button>
          <button type="button" className={mode === "widow" ? "active" : ""} aria-pressed={mode === "widow"} onClick={() => setMode("widow")}>Surviving spouse</button>
        </div>

        {mode === "widow" ? (
          <>
            <p className="wl-note" style={{ marginTop: 0 }}>
              As a surviving spouse you can draw a <strong>survivor benefit</strong> (from your late
              spouse's record) and your <strong>own</strong> retirement benefit — taking one first and
              switching to the other, once, before 70. Enter both below.
            </p>
            <PersonFields
              pia={pia} setPia={setPia} birthYear={birthYear} setBirthYear={setBirthYear} age={currentAge} setAge={setCurrentAge}
              sex={sex} setSex={setSex} smoking={smoking} setSmoking={setSmoking} exercise={exercise} setExercise={setExercise}
              condition={condition} setCondition={setCondition}
            />
            <label className="wl-slider">
              <span>
                Late spouse's benefit
                <InfoTip text="The monthly benefit your late spouse was receiving, or would have received — the basis for your survivor benefit (its full amount at your full retirement age). If they claimed early it may be capped; if late it includes their delayed credits." />{" "}
                <strong>{currency(deceasedBenefit)}/mo</strong>
              </span>
              <input type="range" min={800} max={4500} step={50} value={deceasedBenefit} onChange={(e) => setDeceasedBenefit(Number(e.target.value))} />
            </label>
          </>
        ) : mode === "single" ? (
          <PersonFields
            pia={pia} setPia={setPia} birthYear={birthYear} setBirthYear={setBirthYear} age={currentAge} setAge={setCurrentAge}
            sex={sex} setSex={setSex} smoking={smoking} setSmoking={setSmoking} exercise={exercise} setExercise={setExercise}
            condition={condition} setCondition={setCondition}
          />
        ) : (
          <>
            <PersonFields title="You" pia={pia} setPia={setPia} birthYear={birthYear} setBirthYear={setBirthYear} age={currentAge} setAge={setCurrentAge}
              sex={sex} setSex={setSex} smoking={smoking} setSmoking={setSmoking} exercise={exercise} setExercise={setExercise}
              condition={condition} setCondition={setCondition} />
            <PersonFields title="Your spouse" pia={piaB} setPia={setPiaB} birthYear={birthYearB} setBirthYear={setBirthYearB} age={currentAgeB} setAge={setCurrentAgeB}
              sex={sexB} setSex={setSexB} smoking={smokingB} setSmoking={setSmokingB} exercise={exerciseB} setExercise={setExerciseB}
              condition={conditionB} setCondition={setConditionB} />
          </>
        )}

        <label className="wl-slider">
          <span>
            Discount rate (real)
            <InfoTip text="How much you value a dollar today vs. later. If you'd use early benefits to pay off debt, set this near that debt's rate. Retiring a 6% mortgage IS a 6% return, and it favors claiming earlier." />{" "}
            <strong>{discountRate}%</strong>
          </span>
          <input type="range" min={0} max={8} step={0.5} value={discountRate} onChange={(e) => setDiscountRate(Number(e.target.value))} />
        </label>

        {mode !== "widow" && (
        <div className="wl-field" style={{ marginTop: "0.6rem" }}>
          <span className="wl-field-label">
            {mode === "couple" ? "Disabled adult child (on the higher earner's record)?" : "Disabled adult child on your record?"}
            <InfoTip text="A child disabled before age 22 can draw on your Social Security record: about 50% of your full benefit while you're claiming, then 75% as a survivor benefit for their life after you're gone. Because that 50% only starts once you claim, it tends to favor claiming earlier. Educational — the family-maximum cap and the child's own eligibility/income rules aren't modeled." />
          </span>
          <div className="wl-simmode wl-simmode--wrap" role="group" aria-label="Disabled adult child on record">
            <button type="button" className={!disabledChild ? "active" : ""} aria-pressed={!disabledChild} onClick={() => setDisabledChild(false)}>No</button>
            <button type="button" className={disabledChild ? "active" : ""} aria-pressed={disabledChild} onClick={() => setDisabledChild(true)}>Yes</button>
          </div>
        </div>
        )}

        {mode !== "widow" && (
          <div style={{ marginTop: "0.8rem", paddingTop: "0.8rem", borderTop: "var(--border)" }}>
            <div className="wl-field">
              <span className="wl-field-label">
                Detail level
                <InfoTip text="Advanced adds federal taxation of your benefits and Medicare IRMAA surcharges. It needs a few more inputs and is only a rough estimate to inform a conversation with a professional." />
              </span>
              <div className="wl-simmode wl-simmode--wrap" role="group" aria-label="Detail level">
                <button type="button" className={!advanced ? "active" : ""} aria-pressed={!advanced} onClick={() => setAdvanced(false)}>Simple</button>
                <button type="button" className={advanced ? "active" : ""} aria-pressed={advanced} onClick={() => setAdvanced(true)}>Advanced: tax &amp; IRMAA</button>
              </div>
            </div>

            {advanced && (
              <div style={{ marginTop: "0.7rem" }}>
                {mode === "single" && (
                  <Segmented
                    label="Tax filing status"
                    value={filing}
                    onChange={setFiling}
                    options={[{ value: "single", label: "Single" }, { value: "married", label: "Married (joint)" }]}
                  />
                )}
                <label className="wl-slider">
                  <span>
                    {mode === "couple" ? "Other household income" : "Other annual income"}
                    <InfoTip text="Non-Social-Security taxable income in today's dollars (the household's, in couple mode): pensions, IRA/401(k) withdrawals, wages, interest, dividends, plus any tax-exempt interest. Assumed constant. It drives how much of the benefit is taxed and your IRMAA tier." />{" "}
                    <strong>{currency(otherIncome)}</strong>
                  </span>
                  <input type="range" min={0} max={300000} step={5000} value={otherIncome} onChange={(e) => setOtherIncome(Number(e.target.value))} />
                </label>
                {mode === "couple" && (
                  <label className="wl-slider">
                    <span>
                      Survivor's other income
                      <InfoTip text="The household's non-SS income once only one of you is left. A widow(er) often has less — a pension may drop, and they file as single (lower tax thresholds). Defaults to the same as while you're both alive; lower it to reflect a drop." />{" "}
                      <strong>{currency(survivorIncome)}</strong>
                    </span>
                    <input type="range" min={0} max={300000} step={5000} value={survivorIncome} onChange={(e) => setSurvivorIncome(Number(e.target.value))} />
                  </label>
                )}
                <label className="wl-slider">
                  <span>
                    Marginal tax rate
                    <InfoTip text="The rate applied to the taxable portion of your benefits. Use your combined federal (and, if you wish, state) marginal bracket." />{" "}
                    <strong>{marginalRate}%</strong>
                  </span>
                  <input type="range" min={0} max={45} step={1} value={marginalRate} onChange={(e) => setMarginalRate(Number(e.target.value))} />
                </label>
                <div style={{ marginTop: "0.6rem", padding: "0.6rem 0.85rem", borderLeft: "3px solid var(--color-warn)", background: "color-mix(in srgb, var(--color-warn) 10%, transparent)", borderRadius: "0 8px 8px 0", fontSize: "var(--step--1)", color: "var(--color-text-soft)", lineHeight: 1.5 }}>
                  <strong style={{ color: "var(--color-text)" }}>A best guess, not a filing recommendation.</strong>{" "}
                  This adds taxes and IRMAA with real simplifications: constant income, {IRMAA.year} brackets, no RMDs, ACA, state specifics, or the two-year IRMAA lookback. Claiming is an <strong style={{ color: "var(--color-text)" }}>irreversible, once-in-a-lifetime decision</strong>. Please consult a qualified tax or financial professional, and cross-check with{" "}
                  <a href="https://opensocialsecurity.com" target="_blank" rel="noopener noreferrer">Open Social Security</a>, before you claim.
                </div>
                <details style={{ marginTop: "0.6rem", fontSize: "var(--step--1)", color: "var(--color-text-soft)" }}>
                  <summary style={{ cursor: "pointer", fontFamily: "var(--font-sans)", fontWeight: 600, color: "var(--color-text)" }}>What Advanced assumes</summary>
                  <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.1rem", lineHeight: 1.5 }}>
                    <li>Your other income stays constant in today's dollars — no future raises, and no required minimum distributions (RMDs) at 73+ that would push it (and your taxes) up.</li>
                    <li>It applies this year's ({IRMAA.year}) IRMAA tiers and the fixed benefit-taxation thresholds to every year, rather than modeling how those unindexed thresholds pull more of your benefit into tax over time.</li>
                    <li>IRMAA uses your current income (not the real two-year MAGI lookback) from age 65, and charges only the surcharge your benefit itself triggers.</li>
                    <li>Taxes use the single marginal rate you enter — not a full return with deductions, credits, state rules, ACA subsidies before 65, or the net investment income tax.</li>
                    <li>Couple mode files jointly while both live and single as a survivor; you can set the survivor's income separately, but it's still assumed constant after that.</li>
                    <li>A disabled child is modeled on the higher earner's record at 50% (while claimed) then 75% (survivor), assumed to outlive you, and ignoring the family-maximum cap and the child's own eligibility/income rules.</li>
                    <li>It still omits spousal top-ups and the earnings test if you work before full retirement age. (The old WEP and GPO benefit reductions were repealed by the Social Security Fairness Act in 2025, so they no longer apply.)</li>
                  </ul>
                </details>
              </div>
            )}
          </div>
        )}

        <p className="wl-note" style={{ marginTop: "0.4rem" }}>
          {mode === "single" ? (
            <>Single-earner teaching model: no spousal, survivor, tax, or earnings-test rules.</>
          ) : mode === "widow" ? (
            <>Surviving-spouse model: your own retirement vs. the survivor benefit with a one-time switch; omits taxes, the earnings test, and the survivor "widow limit" (RIB-LIM) cap.</>
          ) : (
            <>Couple model: retirement + survivor benefits over joint mortality; omits spousal top-ups, taxes, and the earnings test.</>
          )}{" "}
          Benefits are in today's dollars. Data: SSA period life table, AWI, bend points, COLA.
        </p>

        <details style={{ marginTop: "var(--space-md)", fontSize: "var(--step--1)", color: "var(--color-text-soft)" }}>
          <summary style={{ cursor: "pointer", fontFamily: "var(--font-sans)", fontWeight: 600, color: "var(--color-text)" }}>Common claiming mistakes to avoid</summary>
          <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.1rem", lineHeight: 1.5, display: "grid", gap: "0.4rem" }}>
            <li><strong style={{ color: "var(--color-text)" }}>"I get the greater of my own or a spousal/survivor benefit."</strong> You actually get your own benefit <em>plus</em> the amount a spousal or survivor benefit exceeds it — so both matter.</li>
            <li><strong style={{ color: "var(--color-text)" }}>"A spousal benefit is half of what my spouse gets."</strong> It's half their <em>PIA</em> (full-retirement-age amount), regardless of when they claimed.</li>
            <li><strong style={{ color: "var(--color-text)" }}>"Benefits lost to the earnings test are gone."</strong> If you claim before full retirement age and keep working, withheld benefits aren't lost — they're added back as a higher check at your full retirement age.</li>
            <li><strong style={{ color: "var(--color-text)" }}>Surviving spouses can switch.</strong> You can take a survivor benefit and your own retirement benefit at <em>different</em> times, taking one while the other grows — use the "Surviving spouse" mode above.</li>
            <li><strong style={{ color: "var(--color-text)" }}>The higher earner's early claim is permanent for the survivor.</strong> It doesn't just cut your own check — it lowers the survivor benefit your spouse may collect for life.</li>
            <li><strong style={{ color: "var(--color-text)" }}>You can sometimes undo it.</strong> Withdraw an application within 12 months (and repay), or voluntarily suspend at full retirement age to earn delayed credits.</li>
            <li><strong style={{ color: "var(--color-text)" }}>Remarrying before 60</strong> can forfeit survivor benefits from a late spouse; remarrying after 60 doesn't.</li>
          </ul>
        </details>
      </div>

      {mode === "widow" ? (
        <WidowOutput widow={widow} money={currency} />
      ) : mode === "single" ? (
        <div className="wl-stage">
          <div className="wl-frontier">
            <h3>Lifetime value by claiming age</h3>
            <ValueChart result={result} />
            <p className="wl-fnote">
              Each bar is the expected lifetime benefit (survival-weighted, discounted
              to today) if you first claim at that age. The tallest is your optimum.
              Delaying trades smaller-but-sooner checks for bigger-but-later ones, and
              wins only if you're likely to live to collect them.
              {(() => {
                const s = valueScale(result.points);
                return s.zoomed ? (
                  <>
                    {" "}The vertical axis is <strong>zoomed in</strong>: it starts at {symbol}
                    {Math.round(s.floor / 1000)}k, not {symbol}0 (note the break mark at its base), so
                    these close-together values are easier to compare.
                  </>
                ) : null;
              })()}
            </p>
          </div>

          <div className="wl-lower">
            <div className="wl-readout">
              <div className="ss-headline">
                <span className="ss-headline-label">Your optimal age to claim</span>
                <span className="ss-headline-value">{bestAgeLabel}</span>
              </div>
              <dl className="ss-stats">
                <div><dt>Monthly check then</dt><dd>{currency(result.best.monthly)}</dd></div>
                <div><dt>vs. claiming at 62</dt><dd>{currency(at62.monthly)}</dd></div>
                <div><dt>vs. claiming at 70</dt><dd>{currency(at70.monthly)}</dd></div>
              </dl>
              <p className="wl-saved">
                At a {discountRate}% discount and your longevity, claiming at{" "}
                <strong>{bestAgeLabel}</strong> maximizes expected lifetime benefits
                ({currency(result.best.npv)} in today's dollars). Breakeven for
                delaying to 70 is about age <strong>{result.breakevenAge.toFixed(0)}</strong>.
              </p>
              {result.tax && (
                <p className="wl-fnote" style={{ marginTop: "0.5rem" }}>
                  <strong>After tax &amp; IRMAA:</strong> about{" "}
                  <strong>{(result.tax.taxablePct * 100).toFixed(0)}%</strong> of the
                  benefit is federally taxable, trimming your benefit's value from{" "}
                  {currency(result.tax.grossNpv)} before tax to {currency(result.tax.netWorkerNpv)}.{" "}
                  {result.tax.annualIrmaa > 0 ? (
                    <>
                      Claiming at the optimum also lands you in <strong>IRMAA tier{" "}
                      {result.tax.irmaaTier}</strong>, about{" "}
                      <strong>{currency(result.tax.annualIrmaa)}/yr</strong> in extra
                      Medicare surcharges from age 65.
                    </>
                  ) : (
                    <>At this income, claiming doesn't trigger an added Medicare (IRMAA)
                      surcharge (you're in tier {result.tax.irmaaTier}).</>
                  )}
                </p>
              )}
              {result.childNpv != null && (
                <p className="wl-fnote" style={{ marginTop: "0.5rem" }}>
                  <strong>Disabled child:</strong> their benefits add about{" "}
                  <strong>{currency(result.childNpv)}</strong> of expected lifetime value
                  (≈50% of your PIA while you claim, 75% after you're gone). Because that 50%
                  starts only once you claim, it pulls the best age <em>earlier</em>; the value
                  above already includes it.
                </p>
              )}
            </div>

            <div className="wl-readout ss-health">
              <h3>The health premium</h3>
              <p>
                Your habits imply a life expectancy of{" "}
                <strong>{result.lifeExpectancy.toFixed(1)}</strong>: {" "}
                {Math.abs(leDelta) < 0.1 ? (
                  <>right around the population average.</>
                ) : leDelta > 0 ? (
                  <>
                    <strong>{leDelta.toFixed(1)} years longer</strong> than an average
                    profile, worth about{" "}
                    <strong>{currency(Math.abs(valueDelta))}</strong> more in lifetime
                    benefits (and it pushes your optimal claim age later).
                  </>
                ) : (
                  <>
                    <strong>{Math.abs(leDelta).toFixed(1)} years shorter</strong> than
                    average, about {currency(Math.abs(valueDelta))} less in lifetime
                    benefits, and a reason to claim earlier.
                  </>
                )}
              </p>
              <p className="wl-fnote">
                Fitness and not smoking buy longevity no portfolio can guarantee, an
                under-priced return that also happens to reshape this very decision.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <CoupleOutput couple={couple} piaA={pia} piaB={piaB} />
      )}
    </div>
  );
}

function PersonFields(props: {
  title?: string;
  pia: number; setPia: (n: number) => void;
  birthYear: number; setBirthYear: (n: number) => void;
  age: number; setAge: (n: number) => void;
  sex: Sex; setSex: (v: Sex) => void;
  smoking: Smoking; setSmoking: (v: Smoking) => void;
  exercise: Exercise; setExercise: (v: Exercise) => void;
  condition: Condition; setCondition: (v: Condition) => void;
}) {
  const fra = fraMonths(props.birthYear);
  return (
    <div className="ss-person">
      {props.title && <p className="br-group">{props.title}</p>}
      <label className="wl-slider">
        <span>
          Benefit at full retirement
          <InfoTip text="Their Primary Insurance Amount, the monthly check at full retirement age. The real figure is on the Social Security statement (ssa.gov)." />{" "}
          <strong>{currency(props.pia)}/mo</strong>
        </span>
        <input type="range" min={800} max={4000} step={50} value={props.pia} onChange={(e) => props.setPia(Number(e.target.value))} />
      </label>
      <label className="wl-slider">
        <span>
          Birth year
          <InfoTip text="Sets full retirement age (66 for 1943–1954, sliding up to 67 for 1960 and later)." />{" "}
          <strong>{props.birthYear}</strong> · FRA {monthsToLabel(fra)}
        </span>
        <input type="range" min={1943} max={1975} step={1} value={props.birthYear} onChange={(e) => props.setBirthYear(Number(e.target.value))} />
      </label>
      <label className="wl-slider">
        <span>
          Age now
          <InfoTip text="The age at the decision point. Survival is conditioned on being alive today." />{" "}
          <strong>{props.age}</strong>
        </span>
        <input type="range" min={50} max={69} step={1} value={props.age} onChange={(e) => props.setAge(Number(e.target.value))} />
      </label>
      <Segmented label="Sex (for life table)" value={props.sex} onChange={props.setSex} options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]} />
      <Segmented label="Smoking" info="Current smoking roughly doubles all-cause mortality; quitting recovers most of the gap over time. Illustrative hazard multipliers, not a medical model." value={props.smoking} onChange={props.setSmoking} options={[{ value: "never", label: "Never" }, { value: "former", label: "Former" }, { value: "current", label: "Current" }]} />
      <Segmented label="Exercise" info="Regular activity is associated with ~20–30% lower mortality. Illustrative." value={props.exercise} onChange={props.setExercise} options={[{ value: "sedentary", label: "Little" }, { value: "moderate", label: "Some" }, { value: "active", label: "Active" }, { value: "daily", label: "Daily" }]} />
      <Segmented label="Serious health condition" info="A diagnosed chronic or serious illness shortens life expectancy in the model, which tends to favor claiming earlier. Coarse, illustrative multipliers — a teaching device, not a medical prognosis." value={props.condition} onChange={props.setCondition} options={[{ value: "none", label: "None" }, { value: "chronic", label: "Chronic" }, { value: "serious", label: "Serious" }]} />
    </div>
  );
}

function CoupleOutput({ couple, piaA, piaB }: { couple: CoupleResult; piaA: number; piaB: number }) {
  const aAge = monthsToLabel(couple.best.aMonths);
  const bAge = monthsToLabel(couple.best.bMonths);
  const higherIsA = piaA >= piaB;
  const hi = higherIsA
    ? { name: "you", couple: couple.best.aMonths, solo: couple.a.soloBestMonths }
    : { name: "your spouse", couple: couple.best.bMonths, solo: couple.b.soloBestMonths };
  const coordValue = Math.max(0, couple.best.npv - couple.jointIndependentNpv);

  return (
    <div className="wl-stage">
      <div className="wl-frontier">
        <h3>Household value by claim-age pair</h3>
        <CoupleHeatmap result={couple} />
        <p className="wl-fnote">
          Each square is the household's expected lifetime benefit (survival-weighted,
          discounted to today) for one combination of claim ages: <strong>you</strong> across
          the bottom, <strong>your spouse</strong> up the side. The brightest square, outlined,
          is the pair that together collects the most.
        </p>
      </div>

      <div className="wl-lower">
        <div className="wl-readout">
          <div className="ss-headline">
            <span className="ss-headline-label">Claim ages that maximize your household</span>
            <span className="ss-headline-value">You {aAge} · Spouse {bAge}</span>
          </div>
          <dl className="ss-stats">
            <div><dt>Household lifetime value</dt><dd>{currency(couple.best.npv)}</dd></div>
            <div><dt>vs. each claiming solo</dt><dd>{currency(couple.jointIndependentNpv)}</dd></div>
            <div><dt>You: solo → couple</dt><dd>{monthsToLabel(couple.a.soloBestMonths)} → {aAge}</dd></div>
            <div><dt>Spouse: solo → couple</dt><dd>{monthsToLabel(couple.b.soloBestMonths)} → {bAge}</dd></div>
          </dl>
          <p className="wl-saved">
            The <strong>higher earner</strong> ({hi.name}) should claim at{" "}
            <strong>{monthsToLabel(hi.couple)}</strong>
            {hi.couple > hi.solo + 1 ? (
              <>, later than the {monthsToLabel(hi.solo)} that would be optimal claiming alone</>
            ) : null}
            . That larger check becomes the survivor's income for as long as <em>either</em> of you
            is alive, so delaying it insures the longer of two lifetimes. Coordinating this way is
            worth about <strong>{currency(coordValue)}</strong> more than each of you optimizing
            separately.
          </p>
          {couple.tax && (
            <p className="wl-fnote" style={{ marginTop: "0.5rem" }}>
              <strong>After tax &amp; IRMAA:</strong> household lifetime value is about{" "}
              {currency(couple.tax.netNpv)}, down from {currency(couple.tax.grossNpv)} before tax
              ({Math.round((couple.tax.netNpv / couple.tax.grossNpv) * 100)}% kept). While you're
              both on Medicare, the household sits in <strong>IRMAA tier {couple.tax.irmaaTierBoth}</strong>
              {couple.tax.irmaaTierBoth > 1
                ? " — each of you pays an income surcharge on Medicare premiums."
                : " (no income surcharge)."}
            </p>
          )}
          {couple.childNpv != null && (
            <p className="wl-fnote" style={{ marginTop: "0.5rem" }}>
              <strong>Disabled child:</strong> a child on the higher earner's record adds about{" "}
              <strong>{currency(couple.childNpv)}</strong> of expected value (≈50% of that PIA while
              they claim, 75% for the child's life after). It's included above, and because the 50%
              starts at claim, it nudges the higher earner's timing earlier.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function WidowOutput({ widow, money }: { widow: WidowResult; money: (n: number) => string }) {
  const b = widow.best;
  const cap = (t: "own" | "survivor") => (t === "own" ? "Own" : "Survivor");
  const phrase = (t: "own" | "survivor") => (t === "own" ? "your own retirement benefit" : "the survivor benefit");
  const firstAge = monthsToLabel(b.firstAgeMonths);
  const switchAge = monthsToLabel(b.switchAgeMonths);
  const hasSwitch = b.secondType != null;
  const switchGain = Math.max(0, b.npv - widow.naive.npv);

  return (
    <div className="wl-stage">
      <div className="wl-frontier">
        <div className="ss-headline">
          <span className="ss-headline-label">Your best claiming plan</span>
          <span className="ss-headline-value" style={{ fontSize: "var(--step-1)", lineHeight: 1.25 }}>
            {hasSwitch
              ? `${cap(b.firstType)} at ${firstAge} → ${cap(b.secondType!)} at ${switchAge}`
              : `${cap(b.firstType)} benefit at ${firstAge}`}
          </span>
          <span className="ss-headline-sub">
            {hasSwitch
              ? <>Take {phrase(b.firstType)} first (~{money(b.firstMonthly)}/mo), then switch to {phrase(b.secondType!)} (~{money(b.secondMonthly)}/mo)</>
              : <>~{money(b.firstMonthly)}/mo</>}
          </span>
        </div>
        <p className="wl-fnote" style={{ marginTop: "var(--space-md)" }}>
          A surviving spouse can take one benefit while the other keeps growing — your own retirement earns
          delayed credits to 70, while the survivor benefit stops growing at your full retirement age. Taking
          the right one first, then switching, is often worth a great deal.
        </p>
      </div>
      <div className="wl-lower">
        <div className="wl-readout">
          <dl className="ss-stats">
            <div><dt>First benefit</dt><dd>{cap(b.firstType)} · {firstAge}</dd></div>
            <div><dt>First check</dt><dd>{money(b.firstMonthly)}/mo</dd></div>
            {hasSwitch && <div><dt>Switch to</dt><dd>{cap(b.secondType!)} · {switchAge}</dd></div>}
            {hasSwitch && <div><dt>After switch</dt><dd>{money(b.secondMonthly)}/mo</dd></div>}
          </dl>
          <p className="wl-saved">
            {switchGain > 1 ? (
              <>Sequencing this way is worth about <strong>{money(switchGain)}</strong> more (survival-weighted,
                in today's dollars) than just claiming the larger benefit alone — the costly mistake many
                surviving spouses make. </>
            ) : (
              <>Here one benefit dominates, so switching adds little; claiming it directly is fine. </>
            )}
            Survivor benefits start at 60 (50 if disabled) and don't grow past your full retirement age, while
            your own retirement grows to 70. Remarrying before 60 can forfeit survivor benefits. This is
            educational, not advice — a survivor claim can't be filed online and the rules are unforgiving, so
            confirm with the SSA or a professional, and cross-check with{" "}
            <a href="https://opensocialsecurity.com" target="_blank" rel="noopener noreferrer">Open Social Security</a>.
          </p>
        </div>
      </div>
    </div>
  );
}

function CoupleHeatmap({ result }: { result: CoupleResult }) {
  const { agesA, agesB, grid } = result;
  const nA = agesA.length;
  const nB = agesB.length;
  const pad = { top: 14, right: 16, bottom: 44, left: 58 };
  const cell = Math.min(56, Math.floor(560 / Math.max(nA, 1)));
  const plotW = cell * nA;
  const plotH = cell * nB;
  const width = pad.left + plotW + pad.right;
  const height = pad.top + plotH + pad.bottom;

  const vals = grid.map((g) => g.npv);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const bestA = Math.round(result.best.aMonths / 12);
  const bestB = Math.round(result.best.bMonths / 12);
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  // A on x (left→right), B on y (bottom→top).
  const cx = (ageA: number) => pad.left + agesA.indexOf(ageA) * cell;
  const cy = (ageB: number) => pad.top + (nB - 1 - agesB.indexOf(ageB)) * cell;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block", maxWidth: width }} role="img" aria-label="Household lifetime Social Security value for each pair of claim ages">
      {grid.map((g) => {
        const isBest = g.ageA === bestA && g.ageB === bestB;
        const t = max > min ? (g.npv - min) / (max - min) : 1;
        return (
          <g key={`${g.ageA}-${g.ageB}`}>
            <rect x={cx(g.ageA)} y={cy(g.ageB)} width={cell - 2} height={cell - 2} rx={3}
              fill="var(--color-accent)" opacity={0.12 + 0.88 * t}
              stroke={isBest ? "var(--color-text)" : "none"} strokeWidth={isBest ? 2.5 : 0}>
              <title>You {g.ageA}, spouse {g.ageB}: {currency(g.npv)}</title>
            </rect>
            {isBest && (
              <circle cx={cx(g.ageA) + (cell - 2) / 2} cy={cy(g.ageB) + (cell - 2) / 2} r={3.5} fill="var(--color-text)" />
            )}
          </g>
        );
      })}
      {agesA.map((a) => (
        <text key={a} x={cx(a) + (cell - 2) / 2} y={pad.top + plotH + 16} textAnchor="middle" style={{ ...axisText, fontWeight: a === bestA ? 700 : 400, fill: a === bestA ? "var(--color-text)" : "var(--color-muted)" }}>{a}</text>
      ))}
      {agesB.map((b) => (
        <text key={b} x={pad.left - 8} y={cy(b) + (cell - 2) / 2 + 4} textAnchor="end" style={{ ...axisText, fontWeight: b === bestB ? 700 : 400, fill: b === bestB ? "var(--color-text)" : "var(--color-muted)" }}>{b}</text>
      ))}
      <text x={pad.left + plotW / 2} y={height - 6} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>You claim at →</text>
      <text transform={`rotate(-90 12 ${pad.top + plotH / 2})`} x={12} y={pad.top + plotH / 2} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>Spouse claims at →</text>
    </svg>
  );
}

/** "Nice" axis step (1, 2, 2.5, 5 × 10ⁿ) at or above a rough target. */
function niceStep(rough: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const n = rough / pow;
  const s = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return s * pow;
}

interface ValueScale { zoomed: boolean; floor: number; ceil: number; ticks: number[]; }

/**
 * Choose the y-axis range for the lifetime-value bars. Survival-weighted NPVs for
 * adjacent claiming ages are usually within a few percent of each other, so a
 * zero-based axis squashes them into near-identical bars. When that's the case we
 * "break" the axis (start it above zero) to make the real differences visible,
 * and flag that we've done so (a break mark on the axis + a note in the caption).
 */
function valueScale(pts: { npv: number }[]): ValueScale {
  const vals = pts.map((p) => p.npv);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals, 1);
  const spread = maxV - minV;
  // Only break the axis when a zero base would genuinely flatten the bars.
  if (!(minV > 0 && spread / maxV > 0.004)) {
    return { zoomed: false, floor: 0, ceil: maxV * 1.02, ticks: [0, 0.25, 0.5, 0.75, 1].map((f) => maxV * f) };
  }
  const step = niceStep(spread / 3);
  const floor = Math.max(0, Math.floor((minV - spread * 0.35) / step) * step);
  const ceil = Math.ceil((maxV + spread * 0.12) / step) * step;
  const ticks: number[] = [];
  for (let v = floor; v <= ceil + step * 1e-6; v += step) ticks.push(v);
  return { zoomed: true, floor, ceil, ticks };
}

function ValueChart({ result }: { result: OptimizeResult }) {
  const width = 720;
  const height = 300;
  const pad = { top: 18, right: 16, bottom: 40, left: 64 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const pts = result.points;
  const bestAge = Math.round(result.best.ageMonths / 12);
  const scale = valueScale(pts);
  const bw = plotW / pts.length;
  const baseY = pad.top + plotH;
  const y = (v: number) => pad.top + plotH - ((v - scale.floor) / (scale.ceil - scale.floor)) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;
  const fmt = (v: number) => formatMoney(v, { compact: true });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Expected lifetime Social Security value by claiming age">
      {scale.ticks.map((v, i) => (
        <g key={i}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" />
          <text x={pad.left - 8} y={y(v) + 4} textAnchor="end" style={axisText}>{fmt(v)}</text>
        </g>
      ))}
      {pts.map((p, i) => {
        const isBest = p.age === bestAge;
        const bx = pad.left + i * bw + bw * 0.15;
        const bwFill = bw * 0.7;
        return (
          <g key={p.age}>
            <rect x={bx} y={y(p.npv)} width={bwFill} height={baseY - y(p.npv)} rx={3} fill={isBest ? "var(--color-accent)" : "var(--color-accent-soft)"} stroke={isBest ? "var(--color-accent)" : "var(--color-border)"} />
            <text x={bx + bwFill / 2} y={height - pad.bottom + 16} textAnchor="middle" style={{ ...axisText, fontWeight: isBest ? 700 : 400, fill: isBest ? "var(--color-accent)" : "var(--color-muted)" }}>{p.age}</text>
          </g>
        );
      })}

      {scale.zoomed && (
        // Broken-axis mark: two short parallel slashes crossing the axis base,
        // the standard signal that the scale doesn't start at zero.
        <g stroke="var(--color-text-soft)" strokeWidth={1.5} aria-hidden="true">
          <line x1={pad.left - 5} y1={baseY + 5} x2={pad.left + 5} y2={baseY - 2} />
          <line x1={pad.left - 5} y1={baseY + 9} x2={pad.left + 5} y2={baseY + 2} />
        </g>
      )}

      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>Claiming age →</text>
    </svg>
  );
}
