import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import {
  optimize,
  optimizeCouple,
  fraMonths,
  monthsToLabel,
  type Sex,
  type Smoking,
  type Exercise,
  type OptimizeResult,
  type CoupleResult,
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
  const [mode, setMode] = useState<"single" | "couple">("single");
  // Person A (also "you" in single mode).
  const [pia, setPia] = useState(2400);
  const [birthYear, setBirthYear] = useState(1965);
  const [currentAge, setCurrentAge] = useState(62);
  const [sex, setSex] = useState<Sex>("male");
  const [smoking, setSmoking] = useState<Smoking>("former");
  const [exercise, setExercise] = useState<Exercise>("moderate");
  // Person B (spouse).
  const [piaB, setPiaB] = useState(1200);
  const [birthYearB, setBirthYearB] = useState(1967);
  const [currentAgeB, setCurrentAgeB] = useState(60);
  const [sexB, setSexB] = useState<Sex>("female");
  const [smokingB, setSmokingB] = useState<Smoking>("never");
  const [exerciseB, setExerciseB] = useState<Exercise>("moderate");
  const [discountRate, setDiscountRate] = useState(2);
  // Advanced tax + IRMAA layer (single mode only).
  const [advanced, setAdvanced] = useState(false);
  const [filing, setFiling] = useState<FilingStatus>("single");
  const [otherIncome, setOtherIncome] = useState(30000);
  const [marginalRate, setMarginalRate] = useState(22);
  const singleTax =
    advanced && mode === "single" ? { filing, otherIncome, marginalRate } : undefined;
  const coupleTax = advanced && mode === "couple" ? { otherIncome, marginalRate } : undefined;

  const health = { sex, smoking, exercise };
  const result = useMemo(
    () => optimize({ pia, birthYear, currentAge, discountRate, health, tax: singleTax }),
    [pia, birthYear, currentAge, discountRate, sex, smoking, exercise, advanced, mode, filing, otherIncome, marginalRate]
  );
  // Population-average reference (former/moderate ⇒ hazard multiplier 1.0), to
  // isolate the health "premium".
  const ref = useMemo(
    () => optimize({ pia, birthYear, currentAge, discountRate, health: { sex, smoking: "former", exercise: "moderate" }, tax: singleTax }),
    [pia, birthYear, currentAge, discountRate, sex, advanced, mode, filing, otherIncome, marginalRate]
  );
  const couple = useMemo(
    () =>
      optimizeCouple({
        a: { pia, birthYear, currentAge, health: { sex, smoking, exercise } },
        b: { pia: piaB, birthYear: birthYearB, currentAge: currentAgeB, health: { sex: sexB, smoking: smokingB, exercise: exerciseB } },
        discountRate,
        tax: coupleTax,
      }),
    [pia, birthYear, currentAge, sex, smoking, exercise, piaB, birthYearB, currentAgeB, sexB, smokingB, exerciseB, discountRate, advanced, mode, otherIncome, marginalRate]
  );

  const bestAgeLabel = monthsToLabel(result.best.ageMonths);
  const leDelta = result.lifeExpectancy - ref.lifeExpectancy;
  const valueDelta = result.best.npv - ref.best.npv;
  const at62 = result.points.find((p) => p.age === 62)!;
  const at70 = result.points.find((p) => p.age === 70)!;

  const resetAll = () => {
    setMode("single");
    setPia(2400); setBirthYear(1965); setCurrentAge(62); setSex("male"); setSmoking("former"); setExercise("moderate");
    setPiaB(1200); setBirthYearB(1967); setCurrentAgeB(60); setSexB("female"); setSmokingB("never"); setExerciseB("moderate");
    setDiscountRate(2);
    setAdvanced(false); setFiling("single"); setOtherIncome(30000); setMarginalRate(22);
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

        <div className="wl-simmode" role="group" aria-label="Who's claiming">
          <button type="button" className={mode === "single" ? "active" : ""} aria-pressed={mode === "single"} onClick={() => setMode("single")}>Just me</button>
          <button type="button" className={mode === "couple" ? "active" : ""} aria-pressed={mode === "couple"} onClick={() => setMode("couple")}>Married couple</button>
        </div>

        {mode === "single" ? (
          <PersonFields
            pia={pia} setPia={setPia} birthYear={birthYear} setBirthYear={setBirthYear} age={currentAge} setAge={setCurrentAge}
            sex={sex} setSex={setSex} smoking={smoking} setSmoking={setSmoking} exercise={exercise} setExercise={setExercise}
          />
        ) : (
          <>
            <PersonFields title="You" pia={pia} setPia={setPia} birthYear={birthYear} setBirthYear={setBirthYear} age={currentAge} setAge={setCurrentAge}
              sex={sex} setSex={setSex} smoking={smoking} setSmoking={setSmoking} exercise={exercise} setExercise={setExercise} />
            <PersonFields title="Your spouse" pia={piaB} setPia={setPiaB} birthYear={birthYearB} setBirthYear={setBirthYearB} age={currentAgeB} setAge={setCurrentAgeB}
              sex={sexB} setSex={setSexB} smoking={smokingB} setSmoking={setSmokingB} exercise={exerciseB} setExercise={setExerciseB} />
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

        {(
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
                    <li>Couple mode files jointly while both live and single as a survivor, with household income unchanged after a death.</li>
                    <li>It still omits spousal top-ups, the earnings test if you work before full retirement age, and rules like WEP/GPO.</li>
                  </ul>
                </details>
              </div>
            )}
          </div>
        )}

        <p className="wl-note" style={{ marginTop: "0.4rem" }}>
          {mode === "single" ? (
            <>Single-earner teaching model: no spousal, survivor, tax, or earnings-test rules.</>
          ) : (
            <>Couple model: retirement + survivor benefits over joint mortality; omits spousal top-ups, taxes, and the earnings test.</>
          )}{" "}
          Benefits are in today's dollars. Data: SSA period life table, AWI, bend points, COLA.
        </p>
      </div>

      {mode === "single" ? (
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
                  benefit is federally taxable, trimming lifetime value from{" "}
                  {currency(result.tax.grossNpv)} before tax to {currency(result.best.npv)}.{" "}
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
