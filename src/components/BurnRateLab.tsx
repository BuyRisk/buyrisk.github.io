import { useState } from "react";
import InfoTip from "./InfoTip";

/**
 * Rudimentary retirement burn-rate calculator. The user estimates typical
 * monthly costs in retirement; we total them and, via the flip side of
 * Bengen's rule (annual spend / withdrawal rate = the 25x rule at 4%), show the
 * nest egg required — then check whether a given portfolio can sustain it.
 */

const currency = (n: number) =>
  n === Infinity
    ? "∞"
    : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const paletteColor = (i: number) => `var(--pl-c${(i % 8) + 1})`;
const pctText = (x: number) => `${Math.round(x * 100)}%`;

type Category = { key: string; label: string; amount: number };

const DEFAULT_CATEGORIES: Category[] = [
  { key: "housing", label: "Housing (rent, mortgage, upkeep)", amount: 1800 },
  { key: "food", label: "Food & groceries", amount: 700 },
  { key: "transport", label: "Transportation", amount: 450 },
  { key: "health", label: "Healthcare & insurance", amount: 650 },
  { key: "utilities", label: "Utilities & bills", amount: 350 },
  { key: "leisure", label: "Travel & leisure", amount: 500 },
  { key: "other", label: "Everything else", amount: 400 },
];

export default function BurnRateLab() {
  const [cats, setCats] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [withdrawalRate, setWithdrawalRate] = useState(4);
  const [portfolio, setPortfolio] = useState(1_000_000);

  const monthlyTotal = cats.reduce((s, c) => s + c.amount, 0);
  const annualTotal = monthlyTotal * 12;
  const nestEgg = withdrawalRate > 0 ? annualTotal / (withdrawalRate / 100) : Infinity;
  const sustainableAnnual = portfolio * (withdrawalRate / 100);
  const sustainableMonthly = sustainableAnnual / 12;
  const coverage = annualTotal > 0 ? sustainableAnnual / annualTotal : 1;
  const surplusMonthly = sustainableMonthly - monthlyTotal;
  const gap = Math.max(0, nestEgg - portfolio);
  const covered = coverage >= 1;

  const setCat = (key: string, amount: number) =>
    setCats((prev) => prev.map((c) => (c.key === key ? { ...c, amount } : c)));

  return (
    <div className="wl">
      <div className="wl-controls">
        <p className="br-group">Monthly costs in retirement</p>
        {cats.map((c, i) => (
          <label className="wl-slider" key={c.key}>
            <span>
              <span className="br-dot" style={{ background: paletteColor(i) }} /> {c.label}{" "}
              <strong>{currency(c.amount)}</strong>
            </span>
            <input
              type="range"
              min={0}
              max={8000}
              step={50}
              value={c.amount}
              onChange={(e) => setCat(c.key, Number(e.target.value))}
            />
          </label>
        ))}

        <p className="br-group">Assumptions</p>
        <label className="wl-slider">
          <span>
            Withdrawal rate
            <InfoTip text="The share of your portfolio you spend in the first year (then adjust for inflation). Bengen's 4% rule is the classic starting point." />{" "}
            <strong>{withdrawalRate}%</strong>
          </span>
          <input type="range" min={2} max={8} step={0.25} value={withdrawalRate} onChange={(e) => setWithdrawalRate(Number(e.target.value))} />
        </label>
        <label className="wl-slider">
          <span>
            Your nest egg
            <InfoTip text="The savings you'd retire with. Compare it to the nest egg your spending requires to see if you're covered." />{" "}
            <strong>{currency(portfolio)}</strong>
          </span>
          <input type="range" min={0} max={5_000_000} step={25_000} value={portfolio} onChange={(e) => setPortfolio(Number(e.target.value))} />
        </label>
      </div>

      <div className="wl-stage">
        <div className="wl-readout">
          <div className="br-stats">
            <div>
              <dt>Monthly burn rate</dt>
              <dd>{currency(monthlyTotal)}</dd>
            </div>
            <div>
              <dt>Per year</dt>
              <dd>{currency(annualTotal)}</dd>
            </div>
          </div>

          <div className="br-breakdown" role="img" aria-label="Spending breakdown by category">
            {cats.map((c, i) =>
              c.amount > 0 ? (
                <span
                  key={c.key}
                  className="br-seg"
                  style={{ width: `${(c.amount / monthlyTotal) * 100}%`, background: paletteColor(i) }}
                  title={`${c.label}: ${currency(c.amount)}`}
                />
              ) : null
            )}
          </div>

          <div className="br-hero">
            <span className="br-hero-label">Nest egg you'd need (at {withdrawalRate}%)</span>
            <span className="br-hero-value">{currency(nestEgg)}</span>
            <span className="br-hero-sub">
              that's {(100 / withdrawalRate).toFixed(0)}× your annual spending — the flip
              side of the 4% rule
            </span>
          </div>
        </div>

        <div className={`wl-readout br-verdict ${covered ? "br-ok" : "br-short"}`}>
          <h3>Does your nest egg cover it?</h3>
          <p className="br-verdict-line">
            {currency(portfolio)} at {withdrawalRate}% sustainably provides{" "}
            <strong>{currency(sustainableMonthly)}/mo</strong> — about{" "}
            <strong>{pctText(coverage)}</strong> of your {currency(monthlyTotal)}/mo burn rate.
          </p>
          {covered ? (
            <p className="br-verdict-tag">
              ✓ Covered, with about {currency(surplusMonthly)}/mo to spare.
            </p>
          ) : (
            <p className="br-verdict-tag">
              Short by {currency(-surplusMonthly)}/mo. You'd need roughly{" "}
              {currency(gap)} more saved.
            </p>
          )}
          <p className="wl-fnote">
            Working out how to build that nest egg? Head back to the{" "}
            <a href="/tools/compound-growth">Compound Growth Explorer</a>.
          </p>
        </div>

        <p className="wl-note">
          A rough planning sketch: costs are assumed steady in today's dollars, and
          the withdrawal rate is a historical rule of thumb, not a guarantee.
          Healthcare and long-term care especially can climb faster than the rest.
        </p>
      </div>
    </div>
  );
}
