import { useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { formatMoney, useCurrencyCode } from "../lib/currency";

/**
 * 50/30/20 budget framework. Enter take-home pay and what you spend on needs and
 * wants; savings is whatever's left. Compare your split to the 50/30/20 guideline
 * (50% needs, 30% wants, 20% saving/debt). Educational, stateless.
 */

const NEEDS = "var(--pl-c3)";
const WANTS = "var(--pl-c1)";
const SAVE = "var(--color-accent)";

export default function BudgetLab() {
  useCurrencyCode();
  const money = (n: number) => formatMoney(n);
  const [income, setIncome] = useState(5000);
  const [needs, setNeeds] = useState(2600);
  const [wants, setWants] = useState(1200);

  const reset = () => { setIncome(5000); setNeeds(2600); setWants(1200); };

  const savings = income - needs - wants;
  const overspend = savings < 0;
  const pct = (x: number) => (income > 0 ? (x / income) * 100 : 0);
  const savingsRate = pct(savings);

  // "Your plan" bar widths.
  let yN = pct(needs), yW = pct(wants), yS = Math.max(0, pct(savings));
  if (overspend) {
    const tot = needs + wants || 1;
    yN = (needs / tot) * 100;
    yW = (wants / tot) * 100;
    yS = 0;
  }

  const target = { needs: income * 0.5, wants: income * 0.3, savings: income * 0.2 };

  const verdict = overspend
    ? `You're spending ${money(-savings)} a month more than you make.`
    : savingsRate >= 20
      ? `You're saving ${savingsRate.toFixed(0)}% — at or above the 20% guideline.`
      : `You're saving ${savingsRate.toFixed(0)}%. The guideline is 20%.`;

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={reset} />
        <p className="wl-note" style={{ marginTop: 0 }}>
          A simple starting framework: aim for roughly <strong>50%</strong> of
          take-home pay on needs, <strong>30%</strong> on wants, and{" "}
          <strong>20%</strong> to saving and extra debt payoff. Enter your numbers to
          see how your split compares.
        </p>

        <label className="wl-slider">
          <span>
            Monthly take-home pay
            <InfoTip text="Your income after taxes and payroll deductions — what actually hits your account." />{" "}
            <strong>{money(income)}</strong>
          </span>
          <input type="range" min={1000} max={15000} step={100} value={income} onChange={(e) => setIncome(Number(e.target.value))} />
        </label>
        <label className="wl-slider">
          <span>
            Needs <span style={{ color: "var(--color-muted)" }}>· housing, food, utilities, transport, minimum debt</span>
            <InfoTip text="Things you truly can't skip: rent/mortgage, groceries, utilities, insurance, minimum loan payments, basic transportation." />{" "}
            <strong>{money(needs)} · {pct(needs).toFixed(0)}%</strong>
          </span>
          <input type="range" min={0} max={15000} step={50} value={needs} onChange={(e) => setNeeds(Number(e.target.value))} />
        </label>
        <label className="wl-slider">
          <span>
            Wants <span style={{ color: "var(--color-muted)" }}>· dining out, subscriptions, travel, hobbies</span>
            <InfoTip text="The nice-to-haves: restaurants, streaming, travel, hobbies, upgrades. Easy to trim when you need to." />{" "}
            <strong>{money(wants)} · {pct(wants).toFixed(0)}%</strong>
          </span>
          <input type="range" min={0} max={15000} step={50} value={wants} onChange={(e) => setWants(Number(e.target.value))} />
        </label>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">Left to save &amp; invest</span>
          <span className="ss-headline-value" style={overspend ? { color: "var(--color-error)" } : undefined}>
            {money(savings)}{!overspend && <span style={{ fontSize: "var(--step-0)" }}> · {savingsRate.toFixed(0)}%</span>}
          </span>
          <span className="ss-headline-sub">{verdict}</span>
        </div>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>Your plan vs. 50/30/20</h3>

          <p className="bl-baraboveL">Your plan</p>
          <div className="bl-bar" role="img" aria-label={`Your plan: needs ${pct(needs).toFixed(0)}%, wants ${pct(wants).toFixed(0)}%, savings ${savingsRate.toFixed(0)}%`}>
            {yN > 0 && <div style={{ width: `${yN}%`, background: NEEDS }} title={`Needs ${money(needs)}`} />}
            {yW > 0 && <div style={{ width: `${yW}%`, background: WANTS }} title={`Wants ${money(wants)}`} />}
            {yS > 0 && <div style={{ width: `${yS}%`, background: SAVE }} title={`Savings ${money(savings)}`} />}
          </div>

          <p className="bl-baraboveL">50/30/20 target</p>
          <div className="bl-bar" role="img" aria-label="Target: 50% needs, 30% wants, 20% savings">
            <div style={{ width: "50%", background: NEEDS }} />
            <div style={{ width: "30%", background: WANTS }} />
            <div style={{ width: "20%", background: SAVE }} />
          </div>

          <ul className="bl-legend">
            <li><span className="sw" style={{ background: NEEDS }} />Needs</li>
            <li><span className="sw" style={{ background: WANTS }} />Wants</li>
            <li><span className="sw" style={{ background: SAVE }} />Save &amp; invest</li>
          </ul>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <div className="bl-table">
              <div className="bl-trow bl-thead"><span>Category</span><span>You</span><span>Target</span><span>Gap</span></div>
              <Row label="Needs" you={needs} target={target.needs} money={money} good="low" />
              <Row label="Wants" you={wants} target={target.wants} money={money} good="low" />
              <Row label="Save & invest" you={Math.max(0, savings)} target={target.savings} money={money} good="high" />
            </div>
            <p className="wl-saved">
              {overspend ? (
                <>First priority: close the gap so you're not going backwards each month — trim wants, then look hard at the big needs (housing and transport are usually the levers). </>
              ) : savingsRate >= 20 ? (
                <>You're clearing the 20% bar — that surplus is exactly what funds investing. Send it somewhere automatic so it never sits idle. </>
              ) : (
                <>To reach 20%, you'd need about <strong>{money(Math.max(0, target.savings - Math.max(0, savings)))}</strong> more per month. Wants are the easiest place to find it; big needs (rent, car) move the needle most. </>
              )}
              The 50/30/20 split is a starting guideline, not a rule — adjust it to your life.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, you, target, money, good }: { label: string; you: number; target: number; money: (n: number) => string; good: "low" | "high" }) {
  const diff = you - target;
  const ok = good === "low" ? diff <= 1 : diff >= -1;
  return (
    <div className="bl-trow">
      <span>{label}</span>
      <span className="bl-num">{money(you)}</span>
      <span className="bl-num bl-muted">{money(target)}</span>
      <span className="bl-num" style={{ color: ok ? "var(--color-accent)" : "var(--color-warn)" }}>
        {diff === 0 ? "—" : `${diff > 0 ? "+" : "−"}${money(Math.abs(diff))}`}
      </span>
    </div>
  );
}
