import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { debt } from "../data/generated/debt";

/**
 * "The Cost of Debt": the mirror image of the Compound Growth Explorer. Here
 * compounding works against you: at a credit card's APR, paying only the minimum
 * stretches a modest balance into decades and doubles it in interest. The tool
 * contrasts the minimum-payment trap with a fixed payment you choose, and frames
 * the payoff as what it is: a guaranteed, tax-free return equal to the APR, one
 * no risky investment can promise. Educational only, not advice.
 */

const CC = debt.creditCard.latest; // ~20.9%
const AUTO = debt.autoLoan.latest; // ~7.5%

const DEFAULTS = { balance: 6_000, apr: CC, payment: 250 };

const dollars = (n: number) =>
  (n < 0 ? "-" : "") + Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = (n: number, dp = 1) => `${n.toFixed(dp)}%`;
const yearsLabel = (months: number) => {
  if (!Number.isFinite(months)) return "never";
  const y = Math.floor(months / 12);
  const m = Math.round(months - y * 12);
  if (y === 0) return `${m} mo`;
  return m === 0 ? `${y} yr` : `${y} yr ${m} mo`;
};

interface Plan {
  path: { month: number; balance: number }[];
  months: number;
  totalInterest: number;
  totalPaid: number;
  neverPaysOff: boolean;
}

const CAP = 1200; // 100-year simulation ceiling

/** Amortize a balance at a monthly payment given by paymentFn(balance, interest). */
function amortize(balance: number, aprPct: number, paymentFn: (bal: number, interest: number) => number): Plan {
  const mr = aprPct / 100 / 12;
  let bal = balance;
  let totalInterest = 0;
  let m = 0;
  const path = [{ month: 0, balance }];
  while (bal > 0.005 && m < CAP) {
    m++;
    const interest = bal * mr;
    let pay = paymentFn(bal, interest);
    if (pay <= interest + 1e-9) {
      // Payment doesn't even cover interest. The balance never falls.
      return { path, months: Infinity, totalInterest: Infinity, totalPaid: Infinity, neverPaysOff: true };
    }
    pay = Math.min(pay, bal + interest);
    bal = bal + interest - pay;
    totalInterest += interest;
    if (m % 3 === 0 || bal <= 0.005) path.push({ month: m, balance: Math.max(0, bal) });
  }
  return { path, months: m, totalInterest, totalPaid: balance + totalInterest, neverPaysOff: bal > 0.005 };
}

// Typical credit-card minimum: interest plus 1% of principal, with a $25 floor.
const minPaymentFn = (bal: number, interest: number) => Math.max(interest + 0.01 * bal, 25);

const APR_PRESETS = [
  { label: `Credit card · ${pct(CC)}`, v: CC },
  { label: `Auto loan · ${pct(AUTO)}`, v: AUTO },
  { label: "Student loan · 6.5%", v: 6.5 },
  { label: "Personal loan · 12%", v: 12 },
];

export default function DebtLab() {
  const [balance, setBalance] = useState(DEFAULTS.balance);
  const [apr, setApr] = useState(DEFAULTS.apr);
  const [payment, setPayment] = useState(DEFAULTS.payment);

  const view = useMemo(() => {
    const min = amortize(balance, apr, minPaymentFn);
    const you = amortize(balance, apr, () => payment);
    const firstMin = Math.max(balance * (apr / 100 / 12) + 0.01 * balance, 25);
    return { min, you, firstMin };
  }, [balance, apr, payment]);

  const { min, you, firstMin } = view;
  const interestSaved = Number.isFinite(you.totalInterest) ? min.totalInterest - you.totalInterest : -Infinity;
  const paysOff = Number.isFinite(you.months);

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={() => { setBalance(DEFAULTS.balance); setApr(DEFAULTS.apr); setPayment(DEFAULTS.payment); }} />

        <label className="wl-slider">
          <span>
            What you owe
            <InfoTip text="The balance on the card or loan today." /> <strong>{dollars(balance)}</strong>
          </span>
          <input type="range" min={500} max={50_000} step={100} value={balance} onChange={(e) => setBalance(+e.target.value)} />
        </label>

        <label className="wl-slider">
          <span>
            Interest rate (APR)
            <InfoTip text={`The annual interest rate. The average US credit card charges about ${pct(CC)} (Federal Reserve, via FRED), far above what markets reliably return.`} />{" "}
            <strong>{pct(apr)}</strong>
          </span>
          <input type="range" min={0} max={30} step={0.1} value={apr} onChange={(e) => setApr(+e.target.value)} />
        </label>
        <div className="wl-presets">
          <span className="wl-presets-label">Typical rates:</span>
          {APR_PRESETS.map((p) => (
            <button key={p.label} type="button" className="wl-chip" aria-pressed={Math.abs(apr - p.v) < 0.05} onClick={() => setApr(p.v)}>{p.label}</button>
          ))}
        </div>

        <label className="wl-slider">
          <span>
            Your monthly payment
            <InfoTip text="A fixed amount you pay every month. Compare it to the shrinking minimum payment. Paying a steady, higher amount is what breaks the trap." />{" "}
            <strong>{dollars(payment)}/mo</strong>
          </span>
          <input type="range" min={25} max={2_000} step={25} value={payment} onChange={(e) => setPayment(+e.target.value)} />
        </label>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          {!paysOff ? (
            <>
              <span className="ss-headline-label">At {dollars(payment)}/mo</span>
              <span className="ss-headline-value">Never paid off</span>
              <span className="ss-headline-sub">that barely covers the {dollars(firstMin)} minimum. The balance won't fall. Pay more.</span>
            </>
          ) : (
            <>
              <span className="ss-headline-label">Paying {dollars(payment)}/mo clears it in</span>
              <span className="ss-headline-value">{yearsLabel(you.months)}</span>
              <span className="ss-headline-sub">
                vs <strong>{yearsLabel(min.months)}</strong> on the minimum, saving{" "}
                <strong>{dollars(interestSaved)}</strong> in interest
              </span>
            </>
          )}
        </div>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          Minimum payment modeled as interest plus 1% of the balance (a $25 floor): the
          industry-standard formula that keeps you in debt for decades. Data: Federal
          Reserve consumer rates via FRED.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>What you owe, over time</h3>
          <BalanceChart min={min} you={you} paysOff={paysOff} />
          <p className="wl-fnote">
            The <span style={{ color: "var(--pl-c3)", fontWeight: 700 }}>orange</span> line pays only
            the minimum. It barely descends, because the payment shrinks as fast as the balance
            does. The <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>green</span> line
            is your fixed payment, which actually gets you out.
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <dl className="ss-stats">
              <div><dt>Minimum: time to clear</dt><dd>{yearsLabel(min.months)}</dd></div>
              <div><dt>Minimum: interest paid</dt><dd>{dollars(min.totalInterest)}</dd></div>
              <div><dt>Your plan: time to clear</dt><dd>{paysOff ? yearsLabel(you.months) : "never"}</dd></div>
              <div><dt>Your plan: interest paid</dt><dd>{paysOff ? dollars(you.totalInterest) : "—"}</dd></div>
            </dl>
            <p className="wl-saved">
              On the minimum, this {dollars(balance)} balance costs{" "}
              <strong>{dollars(min.totalInterest)}</strong> in interest ({(min.totalInterest / balance).toFixed(1)}×
              the amount you borrowed) and takes <strong>{yearsLabel(min.months)}</strong> to clear.
              That's the trap: the minimum falls as the balance does, so you mostly pay interest.
              Flip it around and paying down a <strong>{pct(apr)}</strong> balance is a{" "}
              <strong>guaranteed {pct(apr)} return</strong>, tax-free, higher than the stock
              market's ~10% long-run average, and with none of the risk. When your debt's rate beats
              what you could earn investing, paying it off is the best "investment" available.
              Educational only, not advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BalanceChart({ min, you, paysOff }: { min: Plan; you: Plan; paysOff: boolean }) {
  const width = 760;
  const height = 380;
  const pad = { top: 18, right: 18, bottom: 40, left: 64 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  // X-axis spans the longer payoff (capped so an unpayable plan doesn't blow up).
  const minMonths = Math.min(min.months, CAP);
  const youMonths = paysOff ? you.months : minMonths;
  const maxMonths = Math.max(minMonths, youMonths, 12);
  const maxBal = Math.max(min.path[0].balance, 1);

  const x = (m: number) => pad.left + (m / maxMonths) * plotW;
  const y = (b: number) => pad.top + plotH - (b / maxBal) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;
  const money = (v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`);

  const line = (p: Plan) => p.path.filter((pt) => pt.month <= maxMonths).map((pt, i) => `${i === 0 ? "M" : "L"}${x(pt.month)},${y(pt.balance)}`).join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => maxBal * f);
  const xTickMonths = [0, Math.round(maxMonths / 2), maxMonths];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Loan balance over time, minimum payment versus a fixed payment">
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" />
          <text x={pad.left - 8} y={y(v) + 4} textAnchor="end" style={axisText}>{money(v)}</text>
        </g>
      ))}
      {xTickMonths.map((m) => (
        <text key={m} x={x(m)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>{m === 0 ? "now" : `${Math.round(m / 12)} yr`}</text>
      ))}

      <path d={line(min)} fill="none" stroke="var(--pl-c3)" strokeWidth={2.6} />
      {paysOff && <path d={line(you)} fill="none" stroke="var(--color-accent)" strokeWidth={2.6} />}

      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Years until the balance reaches zero
      </text>
    </svg>
  );
}
