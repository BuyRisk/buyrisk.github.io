import { useMemo, useRef, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { formatMoney, currencySymbol, useCurrencyCode } from "../lib/currency";
import { DEBT_TYPES, DEBT_BENCHMARKS_ASOF } from "../data/debt-payoff";

/**
 * Debt payoff: avalanche vs. snowball. Enter your debts and an extra monthly
 * payment; the tool simulates paying minimums on everything and throwing the
 * rest (plus each freed-up minimum, as debts clear) at one target debt at a
 * time — highest APR first (avalanche) or lowest balance first (snowball) — and
 * compares months-to-debt-free and total interest. Also flags any rate sitting
 * well above typical, where refinancing/consolidation might help. Educational,
 * stateless; nothing is stored.
 */

interface Debt {
  id: number;
  name: string;
  typeId: string;
  balance: number;
  apr: number;
  minPayment: number;
}

type Strategy = "avalanche" | "snowball";

interface SimResult {
  months: number; // Infinity if it never clears within the cap
  totalInterest: number;
  history: number[]; // total balance by month
  paidMonth: Record<number, number>;
}

const MAX_MONTHS = 720; // 60 years

function simulate(debts: Debt[], extra: number, strategy: Strategy): SimResult {
  const bal: Record<number, number> = {};
  for (const d of debts) bal[d.id] = Math.max(0, d.balance);
  const totalMin = debts.reduce((s, d) => s + Math.max(0, d.minPayment), 0);
  const budget0 = totalMin + Math.max(0, extra);
  const paidMonth: Record<number, number> = {};
  let totalInterest = 0;
  let months = 0;
  const sum = () => debts.reduce((s, d) => s + Math.max(0, bal[d.id]), 0);
  const history = [sum()];

  while (sum() > 0.5) {
    if (months >= MAX_MONTHS) return { months: Infinity, totalInterest, history, paidMonth };
    months++;
    // Accrue interest on unpaid balances.
    for (const d of debts) {
      if (bal[d.id] > 0.005) {
        const interest = bal[d.id] * (d.apr / 100 / 12);
        totalInterest += interest;
        bal[d.id] += interest;
      }
    }
    let budget = budget0;
    // Minimums on everything still owed.
    for (const d of debts) {
      if (bal[d.id] > 0.005) {
        const pay = Math.min(bal[d.id], Math.max(0, d.minPayment));
        bal[d.id] -= pay;
        budget -= pay;
      }
    }
    if (budget < 0) budget = 0;
    // Throw the remainder at the target order.
    const order = debts
      .filter((d) => bal[d.id] > 0.005)
      .sort((a, b) => (strategy === "avalanche" ? b.apr - a.apr : bal[a.id] - bal[b.id]));
    for (const d of order) {
      if (budget <= 0.005) break;
      const pay = Math.min(bal[d.id], budget);
      bal[d.id] -= pay;
      budget -= pay;
    }
    for (const d of debts) {
      if (paidMonth[d.id] === undefined && bal[d.id] <= 0.005) paidMonth[d.id] = months;
    }
    history.push(sum());
  }
  return { months, totalInterest, history, paidMonth };
}

const monthsLabel = (m: number) => {
  if (!isFinite(m)) return "never";
  const y = Math.floor(m / 12);
  const mo = m % 12;
  if (y === 0) return `${mo} mo`;
  if (mo === 0) return `${y} yr`;
  return `${y} yr ${mo} mo`;
};

let nextId = 100;

export default function DebtPayoffLab() {
  useCurrencyCode(); // re-render on currency change
  const symbol = currencySymbol();
  const money = (n: number) => formatMoney(n);

  const seed = useRef<Debt[]>([
    { id: 1, name: "Credit card", typeId: "credit-card", balance: 6000, apr: 22.9, minPayment: 150 },
    { id: 2, name: "Auto loan", typeId: "auto", balance: 18000, apr: 7.5, minPayment: 360 },
    { id: 3, name: "Student loan", typeId: "student", balance: 11000, apr: 6.5, minPayment: 120 },
  ]);
  const [debts, setDebts] = useState<Debt[]>(seed.current);
  const [extra, setExtra] = useState(250);

  const update = (id: number, patch: Partial<Debt>) =>
    setDebts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const remove = (id: number) => setDebts((ds) => ds.filter((d) => d.id !== id));
  const add = () =>
    setDebts((ds) => [...ds, { id: ++nextId, name: "New debt", typeId: "other", balance: 5000, apr: 15, minPayment: 100 }]);
  const reset = () => {
    setDebts(seed.current.map((d) => ({ ...d })));
    setExtra(250);
  };

  const valid = debts.filter((d) => d.balance > 0);
  const totalBalance = valid.reduce((s, d) => s + d.balance, 0);
  const totalMin = valid.reduce((s, d) => s + d.minPayment, 0);

  const av = useMemo(() => simulate(valid, extra, "avalanche"), [debts, extra]);
  const sn = useMemo(() => simulate(valid, extra, "snowball"), [debts, extra]);

  const neverPaysOff = !isFinite(av.months) || !isFinite(sn.months);
  const interestSaved = sn.totalInterest - av.totalInterest;

  // Refinance flags.
  const flags = valid
    .map((d) => {
      const t = DEBT_TYPES.find((x) => x.id === d.typeId);
      if (!t || t.flagAbove == null || d.apr <= t.flagAbove) return null;
      return { debt: d, type: t };
    })
    .filter(Boolean) as { debt: Debt; type: (typeof DEBT_TYPES)[number] }[];

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={reset} />

        <p className="wl-note" style={{ marginTop: 0 }}>
          List what you owe, then set an extra monthly amount to throw at it. We pay
          the minimum on everything and attack one debt at a time — comparing
          <strong> avalanche</strong> (highest rate first) with
          <strong> snowball</strong> (smallest balance first).
        </p>

        <div className="dp-debts">
          <div className="dp-row dp-head" aria-hidden="true">
            <span>Debt</span><span>Type</span><span>Balance</span><span>APR</span><span>Min/mo</span><span></span>
          </div>
          {debts.map((d) => (
            <div className="dp-row" key={d.id}>
              <input className="dp-in dp-name" value={d.name} onChange={(e) => update(d.id, { name: e.target.value })} aria-label="Debt name" />
              <select className="dp-in" value={d.typeId} onChange={(e) => update(d.id, { typeId: e.target.value })} aria-label="Debt type">
                {DEBT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <label className="dp-money"><span>{symbol}</span>
                <input className="dp-in" type="number" min={0} value={d.balance} onChange={(e) => update(d.id, { balance: Math.max(0, Number(e.target.value)) })} aria-label="Balance" />
              </label>
              <label className="dp-pct">
                <input className="dp-in" type="number" min={0} step={0.1} value={d.apr} onChange={(e) => update(d.id, { apr: Math.max(0, Number(e.target.value)) })} aria-label="APR" /><span>%</span>
              </label>
              <label className="dp-money"><span>{symbol}</span>
                <input className="dp-in" type="number" min={0} value={d.minPayment} onChange={(e) => update(d.id, { minPayment: Math.max(0, Number(e.target.value)) })} aria-label="Minimum payment" />
              </label>
              <button className="dp-del" type="button" onClick={() => remove(d.id)} aria-label={`Remove ${d.name}`} disabled={debts.length <= 1}>×</button>
            </div>
          ))}
          <button className="dp-add" type="button" onClick={add}>+ Add a debt</button>
        </div>

        <label className="wl-slider" style={{ marginTop: "var(--space-sm)" }}>
          <span>
            Extra payment / month
            <InfoTip text="Money you can put toward debt beyond the minimums. As each debt clears, its old minimum rolls into this pile and accelerates the next one." />{" "}
            <strong>{money(extra)}</strong>
          </span>
          <input type="range" min={0} max={10_000} step={25} value={extra} onChange={(e) => setExtra(Number(e.target.value))} />
        </label>
        <p className="wl-note">
          You're putting <strong>{money(totalMin + extra)}</strong>/mo toward{" "}
          <strong>{money(totalBalance)}</strong> across {valid.length} debt{valid.length === 1 ? "" : "s"}
          {" "}({money(totalMin)} in minimums + {money(extra)} extra). For the deeper lesson on
          why a single balance is so expensive to carry, see{" "}
          <a href="/tools/compound-growth#debt">the cost of debt</a>.
        </p>

        {flags.length > 0 && (
          <div className="dp-refis">
            {flags.map(({ debt, type }) => (
              <div className="dp-refi" key={debt.id} role="note">
                <strong>{debt.name} at {debt.apr}% looks high.</strong> Typical {type.label.toLowerCase()} rates
                for average credit run around {type.typicalApr}%. {type.hint}
              </div>
            ))}
            <p className="dp-refi-foot">
              Typical rates are rough {DEBT_BENCHMARKS_ASOF} figures to prompt a question, not a quote —
              and refinancing is never guaranteed to help. Not financial advice.
            </p>
          </div>
        )}
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>Balance over time</h3>
          <BalanceChart av={av} sn={sn} money={money} />
          <p className="wl-fnote">
            Both lines pay the same total each month; they differ only in which debt
            they target first. They usually finish close together — the real gap is
            the <strong>interest paid</strong> and how fast you clear that first debt.
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            {neverPaysOff ? (
              <div className="ss-headline">
                <span className="ss-headline-label">These payments won't clear the debt</span>
                <span className="ss-headline-value">—</span>
                <span className="ss-headline-sub">
                  A minimum is smaller than its monthly interest, so a balance keeps growing.
                  Increase a minimum or your extra payment.
                </span>
              </div>
            ) : (
              <>
                <div className="ss-headline">
                  <span className="ss-headline-label">Debt-free in (avalanche)</span>
                  <span className="ss-headline-value">{monthsLabel(av.months)}</span>
                  <span className="ss-headline-sub">
                    paying {money(av.totalInterest)} in total interest
                  </span>
                </div>
                <div className="dp-compare">
                  <div className={`dp-strat${av.totalInterest <= sn.totalInterest ? " dp-strat--win" : ""}`}>
                    <h4>Avalanche <span>highest rate first</span></h4>
                    <dl>
                      <div><dt>Debt-free</dt><dd>{monthsLabel(av.months)}</dd></div>
                      <div><dt>Total interest</dt><dd>{money(av.totalInterest)}</dd></div>
                    </dl>
                  </div>
                  <div className={`dp-strat${sn.totalInterest < av.totalInterest ? " dp-strat--win" : ""}`}>
                    <h4>Snowball <span>smallest balance first</span></h4>
                    <dl>
                      <div><dt>Debt-free</dt><dd>{monthsLabel(sn.months)}</dd></div>
                      <div><dt>Total interest</dt><dd>{money(sn.totalInterest)}</dd></div>
                    </dl>
                  </div>
                </div>
                <p className="wl-saved">
                  {interestSaved > 1 ? (
                    <>
                      <strong>Avalanche saves {money(interestSaved)}</strong> in interest here — it
                      always pays the least, because it kills your priciest rate first. <strong>Snowball</strong>{" "}
                      clears your first whole debt sooner ({firstPayoffLabel(sn, valid)}), which some people
                      find more motivating. If the gap is small, the best plan is the one you'll stick to.
                    </>
                  ) : (
                    <>Here the two strategies cost about the same in interest, so pick whichever keeps you
                      motivated — often <strong>snowball</strong>, for the early win of clearing a whole debt.</>
                  )}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function firstPayoffLabel(sim: SimResult, debts: Debt[]): string {
  let min = Infinity;
  for (const d of debts) {
    const m = sim.paidMonth[d.id];
    if (m !== undefined && m < min) min = m;
  }
  return isFinite(min) ? `in ${monthsLabel(min)}` : "soon";
}

function BalanceChart({ av, sn, money }: { av: SimResult; sn: SimResult; money: (n: number) => string }) {
  const width = 720, height = 300;
  const pad = { top: 16, right: 16, bottom: 34, left: 60 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const maxM = Math.max(av.history.length, sn.history.length, 2) - 1;
  const maxB = Math.max(av.history[0] || 1, sn.history[0] || 1);
  const x = (m: number) => pad.left + (m / maxM) * plotW;
  const y = (b: number) => pad.top + plotH - (b / maxB) * plotH;
  const path = (h: number[]) => h.map((b, m) => `${m === 0 ? "M" : "L"}${x(m).toFixed(1)},${y(b).toFixed(1)}`).join(" ");
  const axis = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxB);
  const xStep = maxM <= 24 ? 6 : maxM <= 60 ? 12 : maxM <= 120 ? 24 : 60;
  const xTicks: number[] = [];
  for (let m = 0; m <= maxM; m += xStep) xTicks.push(m);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Total debt balance over time, avalanche vs snowball">
      {yTicks.map((b, i) => (
        <g key={i}>
          <line x1={pad.left} x2={width - pad.right} y1={y(b)} y2={y(b)} stroke="var(--color-border)" />
          <text x={pad.left - 6} y={y(b) + 4} textAnchor="end" style={axis}>{money(b)}</text>
        </g>
      ))}
      {xTicks.map((m) => (
        <text key={m} x={x(m)} y={height - 12} textAnchor="middle" style={axis}>{m === 0 ? "now" : `${Math.round(m / 12)}y`}</text>
      ))}
      <path d={path(sn.history)} fill="none" stroke="var(--pl-c1)" strokeWidth={2} strokeDasharray="5 4" />
      <path d={path(av.history)} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
      <g transform={`translate(${pad.left + 8}, ${pad.top + 4})`} style={{ fontFamily: "var(--font-sans)", fontSize: 11 }}>
        <line x1={0} x2={20} y1={0} y2={0} stroke="var(--color-accent)" strokeWidth={2} />
        <text x={26} y={4} fill="var(--color-text-soft)">Avalanche</text>
        <line x1={0} x2={20} y1={16} y2={16} stroke="var(--pl-c1)" strokeWidth={2} strokeDasharray="5 4" />
        <text x={26} y={20} fill="var(--color-text-soft)">Snowball</text>
      </g>
    </svg>
  );
}
