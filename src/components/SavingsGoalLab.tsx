import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { formatMoney, useCurrencyCode } from "../lib/currency";
import { NOMINAL_TIP } from "../lib/returnBasis";

/**
 * Savings-goal planner. Given a goal, what you've saved, a timeframe, and an
 * expected return, solve for the monthly contribution needed — and show the
 * growth path (contributions vs. investment growth). Stateless, educational.
 */
export default function SavingsGoalLab() {
  useCurrencyCode();
  const money = (n: number) => formatMoney(n);
  const [goal, setGoal] = useState(30000);
  const [current, setCurrent] = useState(5000);
  const [months, setMonths] = useState(36);
  const [ret, setRet] = useState(4);

  const reset = () => { setGoal(30000); setCurrent(5000); setMonths(36); setRet(4); };

  const { required, history, contributed, growth } = useMemo(() => {
    const rm = ret / 100 / 12;
    const n = months;
    // Solve the future-value formula for the payment: what you already have
    // grows to fvCurrent; each monthly deposit grows by the annuity factor
    // ((1+r)^n − 1)/r; the required deposit covers whatever gap remains.
    const fvCurrent = current * Math.pow(1 + rm, n);
    const factor = rm === 0 ? n : (Math.pow(1 + rm, n) - 1) / rm;
    const req = Math.max(0, (goal - fvCurrent) / factor);
    // Build the balance path with that contribution.
    const hist: number[] = [current];
    let bal = current;
    for (let m = 1; m <= n; m++) { bal = bal * (1 + rm) + req; hist.push(bal); }
    const contributed = current + req * n;
    return { required: req, history: hist, contributed, growth: Math.max(0, (hist[hist.length - 1] || 0) - contributed) };
  }, [goal, current, months, ret]);

  const alreadyThere = current >= goal;
  const yrs = (months / 12);
  const timeLabel = months % 12 === 0 ? `${yrs} yr` : `${Math.floor(yrs)} yr ${months % 12} mo`;

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={reset} />
        <p className="wl-note" style={{ marginTop: 0 }}>
          Down payment, a wedding, a car, a sabbatical — put a number and a date on
          the goal and this finds the monthly amount that gets you there, letting any
          investment growth do part of the work.
        </p>

        <label className="wl-slider">
          <span>Goal amount<InfoTip text="The total you want to have saved by your target date." /> <strong>{money(goal)}</strong></span>
          <input type="range" min={1000} max={1000000} step={1000} value={goal} onChange={(e) => setGoal(Number(e.target.value))} />
        </label>
        <label className="wl-slider">
          <span>Already saved <strong>{money(current)}</strong></span>
          <input type="range" min={0} max={1000000} step={1000} value={current} onChange={(e) => setCurrent(Number(e.target.value))} />
        </label>
        <label className="wl-slider">
          <span>Target timeframe <strong>{timeLabel}</strong></span>
          <input type="range" min={3} max={240} step={1} value={months} onChange={(e) => setMonths(Number(e.target.value))} />
        </label>
        <label className="wl-slider">
          <span>
            Expected return (nominal)
            <InfoTip text={`For a goal within a few years, keep money safe (a savings account or money-market fund, ~4%). For distant goals you can invest more aggressively — and take on more risk. Returns are never guaranteed. ${NOMINAL_TIP} For a goal years away, raise the target too: the thing you are saving for gets pricier as well.`} />{" "}
            <strong>{ret}%</strong>
          </span>
          <input type="range" min={0} max={10} step={0.5} value={ret} onChange={(e) => setRet(Number(e.target.value))} />
        </label>
        <p className="wl-note">
          Short goals belong in safe cash, not stocks — a market dip right before you
          need the money can wreck the plan. The further off the goal, the more of the
          work returns can do.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <div className="ss-headline">
            <span className="ss-headline-label">{alreadyThere ? "You're already there" : "Save each month"}</span>
            <span className="ss-headline-value">{alreadyThere ? money(current) : `${money(required)}`}</span>
            <span className="ss-headline-sub">
              {alreadyThere ? "Your current savings already meet the goal." : `to reach ${money(goal)} in ${timeLabel}`}
            </span>
          </div>
          <h3 style={{ marginTop: "var(--space-md)" }}>Path to the goal</h3>
          <GoalChart history={history} goal={goal} money={money} />
          <p className="wl-fnote">
            The gap between the line and what you put in is investment growth — small
            on short, low-return goals, and larger the longer and more aggressively you
            invest.
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <dl className="ss-stats">
              <div><dt>Monthly needed</dt><dd>{alreadyThere ? money(0) : money(required)}</dd></div>
              <div><dt>You'll contribute</dt><dd>{money(contributed)}</dd></div>
              <div><dt>Growth earns</dt><dd>{money(growth)}</dd></div>
              <div><dt>Timeframe</dt><dd>{timeLabel}</dd></div>
            </dl>
            <p className="wl-saved">
              {alreadyThere ? (
                <>Nothing more needed for this goal — you could redirect new savings toward the next one, or invest it. </>
              ) : (
                <>Growth covers <strong>{money(growth)}</strong> of the total, so you only have to
                  supply <strong>{money(contributed)}</strong> yourself. Stretch the timeframe or lift the
                  return (by taking more risk, for a distant goal) and the monthly number drops. </>
              )}
              Automate the transfer on payday so it happens before you can spend it. Educational only, not advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoalChart({ history, goal, money }: { history: number[]; goal: number; money: (n: number) => string }) {
  const width = 720, height = 280;
  const pad = { top: 16, right: 16, bottom: 30, left: 60 };
  const plotW = width - pad.left - pad.right, plotH = height - pad.top - pad.bottom;
  const n = history.length - 1 || 1;
  const maxV = Math.max(goal, history[history.length - 1] || goal) * 1.05;
  const x = (m: number) => pad.left + (m / n) * plotW;
  const y = (v: number) => pad.top + plotH - (v / maxV) * plotH;
  const path = history.map((v, m) => `${m === 0 ? "M" : "L"}${x(m).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${path} L${x(n).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  const axis = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Savings balance growing toward the goal">
      {[0, 0.5, 1].map((f) => (
        <g key={f}><line x1={pad.left} x2={width - pad.right} y1={y(maxV * f)} y2={y(maxV * f)} stroke="var(--color-border)" /><text x={pad.left - 6} y={y(maxV * f) + 4} textAnchor="end" style={axis}>{money(maxV * f)}</text></g>
      ))}
      <line x1={pad.left} x2={width - pad.right} y1={y(goal)} y2={y(goal)} stroke="var(--color-accent)" strokeDasharray="5 4" />
      <text x={width - pad.right} y={y(goal) - 5} textAnchor="end" style={{ ...axis, fill: "var(--color-accent)", fontWeight: 700 }}>goal {money(goal)}</text>
      <path d={area} fill="var(--color-accent-soft)" />
      <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
      <text x={pad.left} y={height - 10} textAnchor="start" style={axis}>now</text>
      <text x={width - pad.right} y={height - 10} textAnchor="end" style={axis}>{Math.round(n / 12)}y</text>
    </svg>
  );
}
