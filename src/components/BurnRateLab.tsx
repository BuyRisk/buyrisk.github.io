import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { bootstrapReturns, bandsOverTime, quantile, mean, HISTORY } from "../lib/bootstrap";

/**
 * Retirement burn-rate calculator, two ways:
 *
 *  • "Simple plan" — the flip side of Bengen's rule: annual spend / withdrawal
 *    rate = the nest egg you'd need (25× spending at 4%). Clean, deterministic.
 *  • "Historical stress test" — the honest version. Runs your plan through a
 *    block-bootstrap Monte Carlo over real US market history (1928–), so you see
 *    the SPREAD of outcomes and the sequence-of-returns risk that a single
 *    "average return" hides: same 4% rule, wildly different luck depending on
 *    whether the crashes land early or late.
 */

const currency = (n: number) =>
  !Number.isFinite(n)
    ? "∞"
    : n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        notation: Math.abs(n) >= 1e7 ? "compact" : "standard",
        maximumFractionDigits: Math.abs(n) >= 1e7 ? 1 : 0,
      });
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

const PATHS = 1500;
const BLOCK = 5;
const SEED = 424242;

interface StressResult {
  successRate: number;
  failRate: number;
  medianTerminal: number;
  meanTerminal: number;
  p10Terminal: number;
  p90Terminal: number;
  medianDepletion: number | null;
  bands: { p: number; series: number[] }[];
}

export default function BurnRateLab() {
  const [mode, setMode] = useState<"plan" | "stress">("plan");
  const [cats, setCats] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [withdrawalRate, setWithdrawalRate] = useState(4);
  const [portfolio, setPortfolio] = useState(1_000_000);
  const [stockPct, setStockPct] = useState(60);
  const [horizon, setHorizon] = useState(30);

  const monthlyTotal = cats.reduce((s, c) => s + c.amount, 0);
  const annualTotal = monthlyTotal * 12;

  // --- Simple plan (deterministic 4%-rule) ---------------------------------
  const nestEgg = withdrawalRate > 0 ? annualTotal / (withdrawalRate / 100) : Infinity;
  const sustainableAnnual = portfolio * (withdrawalRate / 100);
  const sustainableMonthly = sustainableAnnual / 12;
  const coverage = annualTotal > 0 ? sustainableAnnual / annualTotal : 1;
  const surplusMonthly = sustainableMonthly - monthlyTotal;
  const gap = Math.max(0, nestEgg - portfolio);
  const covered = coverage >= 1;

  const setCat = (key: string, amount: number) =>
    setCats((prev) => prev.map((c) => (c.key === key ? { ...c, amount } : c)));

  // --- Historical stress test (block-bootstrap Monte Carlo) ----------------
  const sim = useMemo<StressResult | null>(() => {
    if (mode !== "stress") return null;
    const paths = bootstrapReturns({
      years: horizon,
      paths: PATHS,
      blockLen: BLOCK,
      stockPct: stockPct / 100,
      real: true, // today's-dollars withdrawals vs real returns
      seed: SEED,
    });
    // Each path: withdraw a constant real amount each year, then grow.
    const balances: number[][] = new Array(PATHS);
    const terminal: number[] = new Array(PATHS);
    const depletionYears: number[] = [];
    let successes = 0;
    for (let p = 0; p < PATHS; p++) {
      const row = new Array<number>(horizon + 1);
      row[0] = portfolio;
      let bal = portfolio;
      let failed = false;
      for (let y = 0; y < horizon; y++) {
        if (!failed) {
          bal -= annualTotal;
          if (bal <= 0) {
            bal = 0;
            failed = true;
            depletionYears.push(y + 1);
          } else {
            bal *= 1 + paths[p][y];
          }
        }
        row[y + 1] = bal;
      }
      balances[p] = row;
      terminal[p] = bal;
      if (!failed) successes++;
    }
    const bands = bandsOverTime(balances, [0.1, 0.25, 0.5, 0.75, 0.9]);
    return {
      successRate: successes / PATHS,
      failRate: 1 - successes / PATHS,
      medianTerminal: quantile(terminal, 0.5),
      meanTerminal: mean(terminal),
      p10Terminal: quantile(terminal, 0.1),
      p90Terminal: quantile(terminal, 0.9),
      medianDepletion: depletionYears.length ? quantile(depletionYears, 0.5) : null,
      bands,
    };
  }, [mode, horizon, stockPct, portfolio, annualTotal]);

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton
          onReset={() => {
            setMode("plan"); setCats(DEFAULT_CATEGORIES); setWithdrawalRate(4);
            setPortfolio(1_000_000); setStockPct(60); setHorizon(30);
          }}
        />
        <div className="wl-simmode" role="group" aria-label="Mode">
          <button type="button" className={mode === "plan" ? "active" : ""} aria-pressed={mode === "plan"} onClick={() => setMode("plan")}>
            Simple plan
          </button>
          <button type="button" className={mode === "stress" ? "active" : ""} aria-pressed={mode === "stress"} onClick={() => setMode("stress")}>
            Historical stress test
          </button>
        </div>

        <p className="br-group">Monthly costs in retirement</p>
        {cats.map((c, i) => (
          <label className="wl-slider" key={c.key}>
            <span>
              <span className="br-dot" style={{ background: paletteColor(i) }} /> {c.label}{" "}
              <strong>{currency(c.amount)}</strong>
            </span>
            <input type="range" min={0} max={8000} step={50} value={c.amount} onChange={(e) => setCat(c.key, Number(e.target.value))} />
          </label>
        ))}

        <p className="br-group">Your plan</p>
        <label className="wl-slider">
          <span>
            Your nest egg
            <InfoTip text="The savings you'd retire with." /> <strong>{currency(portfolio)}</strong>
          </span>
          <input type="range" min={0} max={5_000_000} step={25_000} value={portfolio} onChange={(e) => setPortfolio(Number(e.target.value))} />
        </label>

        {mode === "plan" ? (
          <label className="wl-slider">
            <span>
              Withdrawal rate
              <InfoTip text="The share of your portfolio you spend the first year (then adjust for inflation). Bengen's 4% rule is the classic starting point." />{" "}
              <strong>{withdrawalRate}%</strong>
            </span>
            <input type="range" min={2} max={8} step={0.25} value={withdrawalRate} onChange={(e) => setWithdrawalRate(Number(e.target.value))} />
          </label>
        ) : (
          <>
            <label className="wl-slider">
              <span>
                Stocks in portfolio
                <InfoTip text="Stock share of the retirement portfolio; the rest is 10-year Treasuries. More stocks means a higher average but a wider, scarier range." />{" "}
                <strong>{stockPct}%</strong>
              </span>
              <input type="range" min={0} max={100} step={5} value={stockPct} onChange={(e) => setStockPct(Number(e.target.value))} />
            </label>
            <label className="wl-slider">
              <span>
                Years in retirement
                <InfoTip text="How long the money must last. The longer the horizon, the more sequence-of-returns risk matters." />{" "}
                <strong>{horizon}</strong>
              </span>
              <input type="range" min={10} max={50} step={1} value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} />
            </label>
            <p className="wl-note" style={{ marginTop: "0.4rem" }}>
              {PATHS.toLocaleString()} alternate retirements, each stitched from real
              US return history ({HISTORY.span[0]}–{HISTORY.span[1]}) in {BLOCK}-year
              blocks. Withdrawals are constant in today's dollars.
            </p>
          </>
        )}
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
                <span key={c.key} className="br-seg" style={{ width: `${(c.amount / monthlyTotal) * 100}%`, background: paletteColor(i) }} title={`${c.label}: ${currency(c.amount)}`} />
              ) : null
            )}
          </div>
        </div>

        {mode === "plan" ? (
          <PlanView
            withdrawalRate={withdrawalRate}
            nestEgg={nestEgg}
            portfolio={portfolio}
            sustainableMonthly={sustainableMonthly}
            monthlyTotal={monthlyTotal}
            coverage={coverage}
            covered={covered}
            surplusMonthly={surplusMonthly}
            gap={gap}
          />
        ) : (
          sim && (
            <StressView
              sim={sim}
              horizon={horizon}
              portfolio={portfolio}
              withdrawalPct={portfolio > 0 ? annualTotal / portfolio : 0}
            />
          )
        )}

        <p className="wl-note">
          {mode === "plan"
            ? "A rough planning sketch: costs are steady in today's dollars and the withdrawal rate is a historical rule of thumb, not a guarantee."
            : "History is one sample of how markets can behave, not a promise. Taxes, fees, changing spending, and longevity are left out. Data: Aswath Damodaran, historical US returns."}
        </p>
      </div>
    </div>
  );
}

function PlanView(props: {
  withdrawalRate: number;
  nestEgg: number;
  portfolio: number;
  sustainableMonthly: number;
  monthlyTotal: number;
  coverage: number;
  covered: boolean;
  surplusMonthly: number;
  gap: number;
}) {
  const { withdrawalRate, nestEgg, portfolio, sustainableMonthly, monthlyTotal, coverage, covered, surplusMonthly, gap } = props;
  return (
    <>
      <div className="wl-readout">
        <div className="br-hero">
          <span className="br-hero-label">Nest egg you'd need (at {withdrawalRate}%)</span>
          <span className="br-hero-value">{currency(nestEgg)}</span>
          <span className="br-hero-sub">
            that's {(100 / withdrawalRate).toFixed(0)}× your annual spending — the flip side of the 4% rule
          </span>
        </div>
      </div>
      <div className={`wl-readout br-verdict ${covered ? "br-ok" : "br-short"}`}>
        <h3>Does your nest egg cover it?</h3>
        <p className="br-verdict-line">
          {currency(portfolio)} at {withdrawalRate}% sustainably provides{" "}
          <strong>{currency(sustainableMonthly)}/mo</strong> — about <strong>{pctText(coverage)}</strong> of your {currency(monthlyTotal)}/mo burn rate.
        </p>
        {covered ? (
          <p className="br-verdict-tag">✓ Covered, with about {currency(surplusMonthly)}/mo to spare.</p>
        ) : (
          <p className="br-verdict-tag">Short by {currency(-surplusMonthly)}/mo. You'd need roughly {currency(gap)} more saved.</p>
        )}
        <p className="wl-fnote">
          But an average return hides the risk. Try the <strong>Historical stress test</strong> to see the real spread.
        </p>
      </div>
    </>
  );
}

function StressView({
  sim,
  horizon,
  portfolio,
  withdrawalPct,
}: {
  sim: StressResult;
  horizon: number;
  portfolio: number;
  withdrawalPct: number;
}) {
  const good = sim.successRate >= 0.9;
  return (
    <>
      <div className="wl-readout">
        <div className="sk-headline" style={{ background: good ? "var(--color-accent-soft)" : "var(--color-error-soft, var(--color-accent-soft))", borderColor: good ? "var(--color-accent)" : "var(--color-error)" }}>
          <span className="sk-headline-label">
            Chance your money lasts {horizon} years (spending {pctText(withdrawalPct)} of it/yr)
          </span>
          <span className="sk-headline-value" style={{ color: good ? "var(--color-accent)" : "var(--color-error)" }}>
            {pctText(sim.successRate)}
          </span>
        </div>
        <FanChart bands={sim.bands} horizon={horizon} start={portfolio} />
        <p className="wl-fnote">
          Each band is a range of alternate histories. The wedge widens because
          luck compounds: two retirees with the identical plan can land worlds
          apart — the top ones caught good years early, the bottom ones hit crashes
          first (<strong>sequence-of-returns risk</strong>).
        </p>
      </div>

      <div className="wl-readout">
        <dl className="sk-stats">
          <div>
            <dt>Typical ending (median)</dt>
            <dd>{currency(sim.medianTerminal)}</dd>
          </div>
          <div>
            <dt>Average ending (mean)</dt>
            <dd>{currency(sim.meanTerminal)}</dd>
          </div>
          <div>
            <dt>Unlucky 10% end below</dt>
            <dd>{currency(sim.p10Terminal)}</dd>
          </div>
          <div>
            <dt>Lucky 10% end above</dt>
            <dd>{currency(sim.p90Terminal)}</dd>
          </div>
        </dl>
        <p className="wl-saved">
          Notice the <strong>average is pulled far above the typical</strong> outcome —
          a few lucky timelines drag the mean up while most people land lower. That
          skew is why a single "average return" projection quietly oversells the
          plan.{" "}
          {sim.failRate > 0.001 && (
            <>
              In the {pctText(sim.failRate)} of histories where it failed, the money
              typically ran out around year {Math.round(sim.medianDepletion ?? horizon)}.
            </>
          )}
        </p>
      </div>
    </>
  );
}

function FanChart({ bands, horizon, start }: { bands: { p: number; series: number[] }[]; horizon: number; start: number }) {
  const width = 560;
  const height = 260;
  const pad = { top: 14, right: 14, bottom: 28, left: 58 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const byP = (p: number) => bands.find((b) => Math.abs(b.p - p) < 1e-9)!.series;
  const b10 = byP(0.1), b25 = byP(0.25), b50 = byP(0.5), b75 = byP(0.75), b90 = byP(0.9);
  const yMax = Math.max(...b90, start) * 1.05;

  const x = (t: number) => pad.left + (t / horizon) * plotW;
  const y = (v: number) => height - pad.bottom - (Math.max(0, v) / yMax) * plotH;

  const band = (lo: number[], hi: number[]) =>
    "M" + hi.map((v, t) => `${x(t)},${y(v)}`).join(" L") + " L" +
    [...lo].map((v, t) => ({ v, t })).reverse().map(({ v, t }) => `${x(t)},${y(v)}`).join(" L") + " Z";

  const median = "M" + b50.map((v, t) => `${x(t)},${y(v)}`).join(" L");
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;
  const fmt = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Range of retirement balances over time across simulated histories">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={pad.left} x2={width - pad.right} y1={y(yMax * f)} y2={y(yMax * f)} stroke="var(--color-border)" />
          <text x={pad.left - 6} y={y(yMax * f) + 4} textAnchor="end" style={axisText}>{fmt(yMax * f)}</text>
        </g>
      ))}
      <path d={band(b10, b90)} fill="var(--color-accent)" opacity={0.16} />
      <path d={band(b25, b75)} fill="var(--color-accent)" opacity={0.28} />
      <path d={median} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} />
      {[0, Math.round(horizon / 2), horizon].map((t) => (
        <text key={t} x={x(t)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>{t === 0 ? "retire" : `yr ${t}`}</text>
      ))}
    </svg>
  );
}
