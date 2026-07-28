import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";

/**
 * Conceptual "when to claim Social Security" illustrator. Teaches the core
 * trade-off — bigger checks later vs. more checks sooner — via delayed
 * retirement credits, the breakeven age, and longevity risk. It is NOT a
 * precise optimizer (no spousal/survivor/tax/earnings-test rules); for that we
 * point to Mike Piper's Open Social Security.
 */

const FRA = 67; // full retirement age (born 1960+)
const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Benefit as a fraction of the FRA amount (PIA) for a given claiming age. */
function benefitMultiplier(claimAge: number): number {
  const diff = (claimAge - FRA) * 12; // months relative to FRA
  if (diff >= 0) return 1 + (2 / 3 / 100) * diff; // +2/3% per month (8%/yr)
  const early = -diff;
  const first = Math.min(early, 36);
  const rest = Math.max(0, early - 36);
  return 1 - (5 / 9 / 100) * first - (5 / 12 / 100) * rest;
}

const monthlyAt = (pia: number, claimAge: number) => pia * benefitMultiplier(claimAge);
const cumulativeAt = (pia: number, claimAge: number, atAge: number) =>
  Math.max(0, atAge - claimAge) * 12 * monthlyAt(pia, claimAge);

export default function SocialSecurityLab() {
  const [pia, setPia] = useState(2000);
  const [claimAge, setClaimAge] = useState(67);
  const [planningAge, setPlanningAge] = useState(85);

  const monthly = monthlyAt(pia, claimAge);
  const cumChosen = cumulativeAt(pia, claimAge, planningAge);

  // Breakeven age: claim-at-62 vs claim-at-70 cumulative crossover.
  const b62 = benefitMultiplier(62);
  const b70 = benefitMultiplier(70);
  const breakeven = (62 * b62 - 70 * b70) / (b62 - b70);

  // Best integer claim age for the chosen planning age.
  const best = useMemo(() => {
    let bestAge = 62;
    let bestCum = -1;
    for (let c = 62; c <= 70; c++) {
      const cum = cumulativeAt(pia, c, planningAge);
      if (cum > bestCum) {
        bestCum = cum;
        bestAge = c;
      }
    }
    return { age: bestAge, cum: bestCum };
  }, [pia, planningAge]);

  return (
    <div className="wl">
      <div className="wl-controls">
        <label className="wl-slider">
          <span>
            Benefit at full retirement (age {FRA})
            <InfoTip text="Your 'primary insurance amount' — the monthly check you'd get by claiming exactly at full retirement age. Your real figure is on your Social Security statement." />{" "}
            <strong>{currency(pia)}/mo</strong>
          </span>
          <input type="range" min={800} max={4000} step={50} value={pia} onChange={(e) => setPia(Number(e.target.value))} />
        </label>
        <label className="wl-slider">
          <span>
            Age you claim
            <InfoTip text="When you start benefits, from 62 to 70. Earlier means smaller checks; each year you wait past full retirement adds about 8%." />{" "}
            <strong>{claimAge}</strong>
          </span>
          <input type="range" min={62} max={70} step={1} value={claimAge} onChange={(e) => setClaimAge(Number(e.target.value))} />
        </label>
        <label className="wl-slider">
          <span>
            Live until (plan for)
            <InfoTip text="The age you plan to live to. Delaying pays off only if you live past the breakeven age, so longer lifespans favor claiming later." />{" "}
            <strong>{planningAge}</strong>
          </span>
          <input type="range" min={70} max={100} step={1} value={planningAge} onChange={(e) => setPlanningAge(Number(e.target.value))} />
        </label>

        <div className="ss-compare">
          {[62, FRA, 70].map((c) => (
            <div key={c} className={`ss-compare-item ${c === claimAge ? "active" : ""}`}>
              <span className="ss-compare-age">Claim {c}</span>
              <span className="ss-compare-amt">{currency(monthlyAt(pia, c))}/mo</span>
            </div>
          ))}
        </div>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          A teaching model only — no spousal, survivor, tax, or earnings-test rules,
          and benefits are shown in today's dollars.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>Lifetime benefits by claiming age</h3>
          <CumulativeChart pia={pia} claimAge={claimAge} planningAge={planningAge} breakeven={breakeven} />
          <div className="ss-legend">
            <span><span className="ss-key ss-key--c1" /> Claim 62</span>
            <span><span className="ss-key ss-key--c2" /> Claim {FRA}</span>
            <span><span className="ss-key ss-key--c3" /> Claim 70</span>
            <span><span className="ss-key ss-key--sel" /> Your choice ({claimAge})</span>
          </div>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <div className="ss-headline">
              <span className="ss-headline-label">Monthly check if you claim at {claimAge}</span>
              <span className="ss-headline-value">{currency(monthly)}</span>
              <span className="ss-headline-sub">
                {benefitMultiplier(claimAge) >= 1
                  ? `+${Math.round((benefitMultiplier(claimAge) - 1) * 100)}% vs. full retirement`
                  : `−${Math.round((1 - benefitMultiplier(claimAge)) * 100)}% vs. full retirement`}
              </span>
            </div>
            <dl className="ss-stats">
              <div><dt>Collected by age {planningAge}</dt><dd>{currency(cumChosen)}</dd></div>
              <div><dt>Breakeven age (62 vs 70)</dt><dd>{breakeven.toFixed(1)}</dd></div>
            </dl>
            <p className="wl-saved">
              To live to <strong>{planningAge}</strong>, claiming at{" "}
              <strong>{best.age}</strong> collects the most ({currency(best.cum)}).
              Delaying is longevity insurance: it wins only if you live past the
              breakeven — but that's exactly the case you most need to fund.
            </p>
          </div>

          <div className="wl-readout ss-oss">
            <h3>Want the real number?</h3>
            <p>
              This is the intuition. For an actual claiming strategy — spousal and
              survivor benefits, taxes, your real earnings record — use the
              excellent free, open-source calculator:
            </p>
            <p>
              <a href="https://opensocialsecurity.com/" target="_blank" rel="noopener noreferrer" className="ss-oss-link">
                Open Social Security →
              </a>
            </p>
            <p className="wl-fnote">by Mike Piper (MIT-licensed, opensocialsecurity.com).</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function CumulativeChart({
  pia,
  claimAge,
  planningAge,
  breakeven,
}: {
  pia: number;
  claimAge: number;
  planningAge: number;
  breakeven: number;
}) {
  const width = 720;
  const height = 300;
  const pad = { top: 16, right: 16, bottom: 38, left: 60 };
  const ageMin = 62;
  const ageMax = 100;
  const plotW = width - pad.left - pad.right;

  const anchors = [
    { age: 62, color: "var(--pl-c1)" },
    { age: FRA, color: "var(--pl-c2)" },
    { age: 70, color: "var(--pl-c3)" },
  ];
  const maxY = Math.max(...anchors.map((a) => cumulativeAt(pia, a.age, ageMax)), 1);

  const x = (age: number) => pad.left + ((age - ageMin) / (ageMax - ageMin)) * plotW;
  const y = (v: number) => height - pad.bottom - (v / maxY) * (height - pad.top - pad.bottom);

  const linePath = (c: number) => {
    let d = "";
    for (let age = ageMin; age <= ageMax; age += 1) {
      d += `${d ? "L" : "M"}${x(age)},${y(cumulativeAt(pia, c, age))}`;
    }
    return d;
  };
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Cumulative lifetime Social Security benefits versus age, for different claiming ages">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={pad.left} x2={width - pad.right} y1={y(maxY * f)} y2={y(maxY * f)} stroke="var(--color-border)" />
          <text x={pad.left - 8} y={y(maxY * f) + 4} textAnchor="end" style={axisText}>{currency(maxY * f)}</text>
        </g>
      ))}
      {[65, 70, 75, 80, 85, 90, 95, 100].map((age) => (
        <text key={age} x={x(age)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>{age}</text>
      ))}
      {/* breakeven + planning markers */}
      <line x1={x(breakeven)} x2={x(breakeven)} y1={pad.top} y2={height - pad.bottom} stroke="var(--color-muted)" strokeWidth={1} strokeDasharray="3 3" />
      <text x={x(breakeven)} y={pad.top + 2} textAnchor="middle" style={{ ...axisText, fontSize: 10 }}>breakeven {breakeven.toFixed(0)}</text>
      <line x1={x(planningAge)} x2={x(planningAge)} y1={pad.top} y2={height - pad.bottom} stroke="var(--color-accent)" strokeWidth={1.5} />
      {/* anchor strategy lines */}
      {anchors.map((a) => (
        <path key={a.age} d={linePath(a.age)} fill="none" stroke={a.color} strokeWidth={a.age === claimAge ? 1 : 2} opacity={a.age === claimAge ? 0.35 : 0.85} />
      ))}
      {/* chosen strategy (bold) */}
      <path d={linePath(claimAge)} fill="none" stroke="var(--color-accent)" strokeWidth={3.5} strokeLinejoin="round" />
      <text x={width / 2} y={height - 3} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Age →
      </text>
    </svg>
  );
}
