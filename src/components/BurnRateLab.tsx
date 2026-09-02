import { useEffect, useMemo, useRef, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { bootstrapReturns, bandsOverTime, quantile, mean, HISTORY } from "../lib/bootstrap";
import { mulberry32 } from "../lib/portfolio";
import { formatMoney, useCurrencyCode } from "../lib/currency";

/**
 * Retirement burn-rate calculator, two ways:
 *
 *  • "Simple plan", the flip side of Bengen's rule: annual spend / withdrawal
 *    rate = the nest egg you'd need (25× spending at 4%). Clean, deterministic.
 *  • "Historical stress test": the honest version. Runs your plan through a
 *    block-bootstrap Monte Carlo over real US market history (1928–), so you see
 *    the SPREAD of outcomes and the sequence-of-returns risk.
 *
 * Guaranteed income (pension, Social Security, annuities) is subtracted from
 * spending first: only the REMAINING gap has to come from the portfolio. Because
 * of the 25× multiplier, even a modest pension slashes the nest egg you need and
 * dramatically raises the odds your money lasts. Guaranteed income is assumed to
 * keep pace with inflation (Social Security does; many private pensions do NOT).
 */

const currency = (n: number) => (!Number.isFinite(n) ? "∞" : formatMoney(n));
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
  bands: { p: number; series: number[] }[]; // portfolio balance over time
  // Guardrails strategy only: spending flexes, so the story shifts to income.
  spendBands?: { p: number; series: number[] }[]; // total annual spending over time
  /** ~140 individual histories (balances; spending under guardrails), spread across
   *  the outcome spectrum — the animated "spaghetti" behind the fan chart. */
  samplePaths?: number[][];
  avgRate?: number; // mean realized withdrawal rate across all histories
  startRate?: number; // initial withdrawal rate
  medianSpend?: number; // median per-history average annual spending
  p10Spend?: number; // unlucky 10% average annual spending
  p90Spend?: number; // lucky 10% average annual spending
}

type Strategy = "fixed" | "guardrails";

// --- "Same returns, shuffled" (pure sequence-of-returns demo) --------------

interface OrderPath {
  balances: number[]; // year 0..n
  ending: number;
  failYear: number | null; // 1-based year the money ran out, if it did
}

interface OrderSim {
  window: number[]; // the real annual returns, as they happened
  years: [number, number];
  meanReturn: number; // arithmetic mean — identical across every ordering
  cagr: number; // geometric — also identical
  asIs: OrderPath;
  bestFirst: OrderPath;
  worstFirst: OrderPath;
  shuffles: OrderPath[];
  shuffleFails: number;
  noWithdrawEnding: number; // the single ending EVERY ordering shares at $0 draw
}

/** Real portfolio return for one historical year at a stock/bond mix. */
const realReturn = (y: (typeof HISTORY.series)[number], stockPct: number) => {
  const nominal = stockPct * y.stocks + (1 - stockPct) * y.tbonds;
  return (1 + nominal) / (1 + y.inflation) - 1;
};

/** Withdraw-then-grow, constant real spending; the standard sequence sim. */
function runOrder(returns: number[], start: number, spend: number): OrderPath {
  const balances = [start];
  let bal = start;
  let failYear: number | null = null;
  for (let i = 0; i < returns.length; i++) {
    if (failYear === null) {
      bal -= spend;
      if (bal <= 0) {
        bal = 0;
        failYear = i + 1;
      } else {
        bal *= 1 + returns[i];
      }
    }
    balances.push(bal);
  }
  return { balances, ending: bal, failYear };
}

export default function BurnRateLab() {
  useCurrencyCode(); // re-render when the header currency picker changes
  const [mode, setMode] = useState<"plan" | "stress" | "order">("plan");
  const [strategy, setStrategy] = useState<Strategy>("fixed");
  const [cats, setCats] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [withdrawalRate, setWithdrawalRate] = useState(4);
  const [portfolio, setPortfolio] = useState(1_000_000);
  const [guaranteed, setGuaranteed] = useState(0); // $/month, real (inflation-adjusted)
  const [stockPct, setStockPct] = useState(60);
  const [horizon, setHorizon] = useState(30);
  const [guardWidth, setGuardWidth] = useState(20); // guardrail band, ± % of the start rate
  const [guardAdjust, setGuardAdjust] = useState(10); // spending cut/raise when a rail is hit, %
  // "Same returns, shuffled" mode
  const [retireYear, setRetireYear] = useState(1965); // the classic worst 4%-rule cohort
  const [orderSpend, setOrderSpend] = useState(40_000); // annual real withdrawal
  const [orderNoDraw, setOrderNoDraw] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(1);

  const monthlyTotal = cats.reduce((s, c) => s + c.amount, 0);
  const annualTotal = monthlyTotal * 12;
  const guaranteedAnnual = guaranteed * 12;

  // What the portfolio actually has to fund: spending net of guaranteed income.
  const portfolioDrawAnnual = Math.max(0, annualTotal - guaranteedAnnual);
  const portfolioDrawMonthly = portfolioDrawAnnual / 12;

  // --- Simple plan (deterministic 4%-rule) ---------------------------------
  const nestEgg = withdrawalRate > 0 ? portfolioDrawAnnual / (withdrawalRate / 100) : portfolioDrawAnnual > 0 ? Infinity : 0;
  const nestEggNoIncome = withdrawalRate > 0 ? annualTotal / (withdrawalRate / 100) : Infinity;
  const nestEggSaved = Math.max(0, nestEggNoIncome - nestEgg);

  const sustainableAnnual = portfolio * (withdrawalRate / 100); // portfolio-funded only
  const sustainableMonthly = sustainableAnnual / 12;
  const totalMonthlyIncome = sustainableMonthly + guaranteed; // portfolio + guaranteed
  const coverage = annualTotal > 0 ? (sustainableAnnual + guaranteedAnnual) / annualTotal : 1;
  const surplusMonthly = totalMonthlyIncome - monthlyTotal;
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
      real: true,
      seed: SEED,
    });
    const balances: number[][] = new Array(PATHS);
    const terminal: number[] = new Array(PATHS);
    const depletionYears: number[] = [];
    let successes = 0;

    // Guardrails (simplified Guyton-Klinger): each year, if the withdrawal rate
    // drifts a band above/below its start, cut/raise spending. Only meaningful
    // when the portfolio actually funds a draw.
    const guard = strategy === "guardrails" && portfolioDrawAnnual > 0;
    const startRate = portfolio > 0 ? portfolioDrawAnnual / portfolio : 0;
    const upper = startRate * (1 + guardWidth / 100);
    const lower = startRate * (1 - guardWidth / 100);
    const adj = guardAdjust / 100;
    const spendPaths: number[][] | null = guard ? new Array(PATHS) : null;
    const avgSpendPer = new Array<number>(PATHS);
    let rateSum = 0, rateN = 0;

    for (let p = 0; p < PATHS; p++) {
      const row = new Array<number>(horizon + 1);
      row[0] = portfolio;
      const srow = spendPaths ? new Array<number>(horizon + 1) : null;
      if (srow) srow[0] = portfolioDrawAnnual + guaranteedAnnual;
      let bal = portfolio;
      let spend = portfolioDrawAnnual; // real portfolio-funded draw, may flex
      let failed = false;
      let spendSum = 0;
      for (let y = 0; y < horizon; y++) {
        if (!failed) {
          if (guard) {
            const rate = bal > 0 ? spend / bal : Infinity;
            if (rate > upper) spend *= 1 - adj; // capital-preservation rail
            else if (rate < lower) spend *= 1 + adj; // prosperity rail
          }
          const draw = guard ? spend : portfolioDrawAnnual;
          rateSum += bal > 0 ? draw / bal : 0;
          rateN++;
          bal -= draw;
          spendSum += draw + guaranteedAnnual;
          if (bal <= 0) {
            bal = 0;
            failed = true;
            depletionYears.push(y + 1);
          } else {
            bal *= 1 + paths[p][y];
          }
        } else {
          spendSum += guaranteedAnnual; // portfolio gone: only guaranteed income left
        }
        row[y + 1] = bal;
        if (srow) srow[y + 1] = failed ? guaranteedAnnual : spend + guaranteedAnnual;
      }
      balances[p] = row;
      if (spendPaths && srow) spendPaths[p] = srow;
      terminal[p] = bal;
      avgSpendPer[p] = spendSum / horizon;
      if (!failed) successes++;
    }
    const bands = bandsOverTime(balances, [0.1, 0.25, 0.5, 0.75, 0.9]);
    // Sample ~140 whole histories, strided across the sorted-by-ending spectrum so
    // the spaghetti shows the full range from busted to jackpot, not a random blob.
    const samplePathsFrom = (all: number[][]): number[][] => {
      const order = all
        .map((row, i) => [row[row.length - 1], i] as const)
        .sort((a, b) => a[0] - b[0])
        .map(([, i]) => i);
      const k = 140;
      const step = Math.max(1, Math.floor(order.length / k));
      const out: number[][] = [];
      for (let i = 0; i < order.length && out.length < k; i += step) out.push(all[order[i]]);
      return out;
    };
    const result: StressResult = {
      successRate: successes / PATHS,
      failRate: 1 - successes / PATHS,
      medianTerminal: quantile(terminal, 0.5),
      meanTerminal: mean(terminal),
      p10Terminal: quantile(terminal, 0.1),
      p90Terminal: quantile(terminal, 0.9),
      medianDepletion: depletionYears.length ? quantile(depletionYears, 0.5) : null,
      bands,
      // Spaghetti sample matches whichever series each view fans out:
      // balances for the fixed strategy, spending under guardrails.
      samplePaths: guard && spendPaths ? samplePathsFrom(spendPaths) : samplePathsFrom(balances),
    };
    if (guard && spendPaths) {
      result.spendBands = bandsOverTime(spendPaths, [0.1, 0.25, 0.5, 0.75, 0.9]);
      result.avgRate = rateN ? rateSum / rateN : 0;
      result.startRate = startRate;
      result.medianSpend = quantile(avgSpendPer, 0.5);
      result.p10Spend = quantile(avgSpendPer, 0.1);
      result.p90Spend = quantile(avgSpendPer, 0.9);
    }
    return result;
  }, [mode, horizon, stockPct, portfolio, portfolioDrawAnnual, guaranteedAnnual, strategy, guardWidth, guardAdjust]);

  // --- Same returns, shuffled (one real window, every ordering) ------------
  const firstYear = HISTORY.series[0].year;
  const lastRetireYear = HISTORY.series[HISTORY.series.length - 1].year - horizon + 1;
  const retireYearClamped = Math.min(retireYear, lastRetireYear);
  const orderSim = useMemo<OrderSim | null>(() => {
    if (mode !== "order") return null;
    const i0 = retireYearClamped - firstYear;
    const window = HISTORY.series.slice(i0, i0 + horizon).map((y) => realReturn(y, stockPct / 100));
    const spend = orderNoDraw ? 0 : orderSpend;
    const growth = window.reduce((g, r) => g * (1 + r), 1);
    const shuffles: OrderPath[] = [];
    const rng = mulberry32(shuffleSeed * 7919 + 17);
    for (let s = 0; s < 40; s++) {
      const arr = [...window];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = (rng() * (i + 1)) | 0;
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      shuffles.push(runOrder(arr, portfolio, spend));
    }
    return {
      window,
      years: [retireYearClamped, retireYearClamped + horizon - 1],
      meanReturn: mean(window),
      cagr: Math.pow(growth, 1 / window.length) - 1,
      asIs: runOrder(window, portfolio, spend),
      bestFirst: runOrder([...window].sort((a, b) => b - a), portfolio, spend),
      worstFirst: runOrder([...window].sort((a, b) => a - b), portfolio, spend),
      shuffles,
      shuffleFails: shuffles.filter((p) => p.failYear !== null).length,
      noWithdrawEnding: portfolio * growth,
    };
  }, [mode, retireYearClamped, horizon, stockPct, portfolio, orderSpend, orderNoDraw, shuffleSeed, firstYear]);

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton
          onReset={() => {
            setMode("plan"); setStrategy("fixed"); setCats(DEFAULT_CATEGORIES); setWithdrawalRate(4);
            setPortfolio(1_000_000); setGuaranteed(0); setStockPct(60); setHorizon(30);
            setGuardWidth(20); setGuardAdjust(10);
            setRetireYear(1965); setOrderSpend(40_000); setOrderNoDraw(false); setShuffleSeed(1);
          }}
        />
        <div className="wl-simmode" role="group" aria-label="Mode">
          <button type="button" className={mode === "plan" ? "active" : ""} aria-pressed={mode === "plan"} onClick={() => setMode("plan")}>
            Simple plan
          </button>
          <button
            type="button"
            className={mode === "stress" ? "active" : ""}
            aria-pressed={mode === "stress"}
            onClick={() => setMode("stress")}
            title={`Block-bootstrap Monte Carlo: ${PATHS.toLocaleString()} alternate retirements stitched from real ${BLOCK}-year blocks of US return history (${HISTORY.span[0]}–${HISTORY.span[1]}, inflation-adjusted). Data: Aswath Damodaran.`}
          >
            Historical stress test
          </button>
          <button
            type="button"
            className={mode === "order" ? "active" : ""}
            aria-pressed={mode === "order"}
            onClick={() => setMode("order")}
            title="One real stretch of market history, replayed in every order: as it happened, best years first, worst years first, and 40 random shuffles. Same average — wildly different retirements."
          >
            Same returns, shuffled
          </button>
        </div>

        {mode === "order" ? (
          <>
            <p className="br-group">The experiment</p>
            <label className="wl-slider">
              <span>
                Nest egg at retirement
                <InfoTip text="The starting portfolio. Every ordering starts from the same pile." /> <strong>{currency(portfolio)}</strong>
              </span>
              <input type="range" min={0} max={5_000_000} step={25_000} value={portfolio} onChange={(e) => setPortfolio(Number(e.target.value))} />
            </label>
            <label className="wl-slider">
              <span>
                Annual spending (today's dollars)
                <InfoTip text="Withdrawn at the start of each year, constant in real terms — the Bengen setup. Set it to zero (or flip the switch below) and watch order stop mattering." />{" "}
                <strong>{currency(orderSpend)}</strong>
              </span>
              <input type="range" min={0} max={400_000} step={2_500} value={orderSpend} onChange={(e) => setOrderSpend(Number(e.target.value))} />
            </label>
            <label className="wl-slider">
              <span>
                Retire in
                <InfoTip text="Picks the real historical window the returns come from. 1965–66 are the classic worst cohorts of the past century: mediocre returns up front, inflation on top." />{" "}
                <strong>{retireYearClamped}</strong>
              </span>
              <input type="range" min={firstYear} max={lastRetireYear} step={1} value={retireYearClamped} onChange={(e) => setRetireYear(Number(e.target.value))} />
            </label>
            <label className="wl-slider">
              <span>
                Stocks in portfolio <strong>{stockPct}%</strong>
              </span>
              <input type="range" min={0} max={100} step={5} value={stockPct} onChange={(e) => setStockPct(Number(e.target.value))} />
            </label>
            <label className="wl-slider">
              <span>
                Years in retirement <strong>{horizon}</strong>
              </span>
              <input type="range" min={10} max={50} step={1} value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} />
            </label>
            <label className="wl-check" style={{ display: "flex", gap: "0.5rem", alignItems: "baseline", fontFamily: "var(--font-sans)", fontSize: "var(--step--1)" }}>
              <input type="checkbox" checked={orderNoDraw} onChange={(e) => setOrderNoDraw(e.target.checked)} />
              <span>
                Turn withdrawals off
                <InfoTip text="With no money moving out, ending balance = start × (1+r₁) × (1+r₂) × … — and multiplication doesn't care about order. Every shuffle lands on exactly the same number. Sequence risk is created by the withdrawals." />
              </span>
            </label>
            <button type="button" className="wl-chip" style={{ alignSelf: "flex-start" }} onClick={() => setShuffleSeed((s) => s + 1)}>
              🎲 Shuffle the years again
            </button>
            <p className="wl-note" style={{ marginTop: "0.4rem" }}>
              One real window of US market history ({retireYearClamped}–{retireYearClamped + horizon - 1},
              inflation-adjusted, {stockPct}% stocks / {100 - stockPct}% 10-yr Treasuries) — replayed in
              every order. Every line uses exactly the same {horizon} annual returns.
            </p>
          </>
        ) : (
          <>
        <p className="br-group">Monthly costs in retirement</p>
        {cats.map((c, i) => (
          <label className="wl-slider" key={c.key}>
            <span>
              <span className="br-dot" style={{ background: paletteColor(i) }} /> {c.label}{" "}
              <strong>{currency(c.amount)}</strong>
            </span>
            <input type="range" min={0} max={15000} step={50} value={c.amount} onChange={(e) => setCat(c.key, Number(e.target.value))} />
          </label>
        ))}

        <p className="br-group">Guaranteed income</p>
        <label className="wl-slider">
          <span>
            Pension, Social Security, annuities
            <InfoTip text="Income that arrives every month no matter what markets do: a pension, Social Security, or an annuity. It covers part of your spending, so your portfolio only has to fund the rest. Assumed here to rise with inflation; Social Security does, but many private pensions are fixed and lose value over time." />{" "}
            <strong>{currency(guaranteed)}/mo</strong>
          </span>
          <input type="range" min={0} max={20000} step={100} value={guaranteed} onChange={(e) => setGuaranteed(Number(e.target.value))} />
        </label>

        <p className="br-group">Your plan</p>
        <label className="wl-slider">
          <span>
            Your nest egg
            <InfoTip text="The invested savings you'd retire with: the liquid portfolio, separate from guaranteed income." /> <strong>{currency(portfolio)}</strong>
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
            <p className="br-group">Withdrawal strategy</p>
            <div className="wl-simmode wl-simmode--wrap" role="group" aria-label="Withdrawal strategy">
              <button type="button" className={strategy === "fixed" ? "active" : ""} aria-pressed={strategy === "fixed"} onClick={() => setStrategy("fixed")}
                title="Bengen's 4% rule: pick a first-year amount and spend that same sum (inflation-adjusted) every year, regardless of markets.">
                Fixed (Bengen)
              </button>
              <button type="button" className={strategy === "guardrails" ? "active" : ""} aria-pressed={strategy === "guardrails"} onClick={() => setStrategy("guardrails")}
                title="Guyton-Klinger guardrails: flex spending each year — cut it after bad markets, raise it after good ones — to keep the money from running out.">
                Guardrails
              </button>
            </div>

            {strategy === "guardrails" && (
              <>
                <label className="wl-slider">
                  <span>
                    Guardrail width
                    <InfoTip text="How far your withdrawal rate can drift from its starting point before you adjust. At ±20%, a start of 5% triggers a cut once the rate climbs past 6%, or a raise once it drops below 4%. Wider = steadier spending but more depletion risk; narrower = safer but choppier income." />{" "}
                    <strong>±{guardWidth}%</strong>
                  </span>
                  <input type="range" min={5} max={40} step={5} value={guardWidth} onChange={(e) => setGuardWidth(Number(e.target.value))} />
                </label>
                <label className="wl-slider">
                  <span>
                    Spending adjustment
                    <InfoTip text="How much you cut or raise spending when a guardrail is hit. Bigger adjustments defend the portfolio faster but make your income bumpier." />{" "}
                    <strong>{guardAdjust}%</strong>
                  </span>
                  <input type="range" min={5} max={20} step={5} value={guardAdjust} onChange={(e) => setGuardAdjust(Number(e.target.value))} />
                </label>
              </>
            )}

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
              blocks.{" "}
              {strategy === "fixed"
                ? "Withdrawals are constant in today's dollars."
                : "Withdrawals flex within the guardrails — cut after bad markets, raised after good ones."}
            </p>
          </>
        )}
          </>
        )}
      </div>

      <div className="wl-stage">
        {mode !== "order" && (
        <div className="wl-readout">
          <div className="br-stats">
            <div>
              <dt>Monthly burn rate</dt>
              <dd>{currency(monthlyTotal)}</dd>
            </div>
            <div>
              <dt>{guaranteed > 0 ? "Portfolio must fund" : "Per year"}</dt>
              <dd>{guaranteed > 0 ? `${currency(portfolioDrawMonthly)}/mo` : currency(annualTotal)}</dd>
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
        )}

        {mode === "order" ? (
          orderSim && <OrderView sim={orderSim} portfolio={portfolio} spend={orderNoDraw ? 0 : orderSpend} horizon={horizon} />
        ) : mode === "plan" ? (
          <PlanView
            withdrawalRate={withdrawalRate}
            nestEgg={nestEgg}
            nestEggSaved={nestEggSaved}
            nestEggNoIncome={nestEggNoIncome}
            portfolio={portfolio}
            guaranteed={guaranteed}
            portfolioDrawMonthly={portfolioDrawMonthly}
            sustainableMonthly={sustainableMonthly}
            totalMonthlyIncome={totalMonthlyIncome}
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
              strategy={strategy}
              horizon={horizon}
              portfolio={portfolio}
              guaranteed={guaranteed}
              portfolioDrawAnnual={portfolioDrawAnnual}
              firstYearSpend={portfolioDrawAnnual + guaranteed * 12}
              withdrawalPct={portfolio > 0 ? portfolioDrawAnnual / portfolio : 0}
            />
          )
        )}

        <p className="wl-note">
          {mode === "plan"
            ? "A rough planning sketch: costs are steady in today's dollars and the withdrawal rate is a historical rule of thumb, not a guarantee. Guaranteed income is assumed to rise with inflation."
            : mode === "stress"
              ? "History is one sample of how markets can behave, not a promise. Taxes, fees, changing spending, and longevity are left out; guaranteed income is treated as inflation-adjusted. Data: Aswath Damodaran, historical US returns."
              : "A controlled experiment, not a forecast: the returns are real history, the reorderings are not. Taxes, fees, and changing spending are left out. Data: Aswath Damodaran, historical US returns."}
        </p>
      </div>
    </div>
  );
}

function PlanView(props: {
  withdrawalRate: number;
  nestEgg: number;
  nestEggSaved: number;
  nestEggNoIncome: number;
  portfolio: number;
  guaranteed: number;
  portfolioDrawMonthly: number;
  sustainableMonthly: number;
  totalMonthlyIncome: number;
  monthlyTotal: number;
  coverage: number;
  covered: boolean;
  surplusMonthly: number;
  gap: number;
}) {
  const {
    withdrawalRate, nestEgg, nestEggSaved, nestEggNoIncome, portfolio, guaranteed,
    portfolioDrawMonthly, sustainableMonthly, totalMonthlyIncome, monthlyTotal, coverage, covered, surplusMonthly, gap,
  } = props;
  const hasIncome = guaranteed > 0;
  const fullyCoveredByIncome = portfolioDrawMonthly <= 0;
  return (
    <>
      <div className="wl-readout">
        <div className="br-hero">
          <span className="br-hero-label">Nest egg you'd need (at {withdrawalRate}%)</span>
          <span className="br-hero-value">{currency(nestEgg)}</span>
          <span className="br-hero-sub">
            {fullyCoveredByIncome ? (
              <>your guaranteed income alone covers your spending; no nest egg required for these costs</>
            ) : hasIncome ? (
              <>
                only {(100 / withdrawalRate).toFixed(0)}× the {currency(portfolioDrawMonthly * 12)}/yr your portfolio must
                fund, after {currency(guaranteed)}/mo of guaranteed income
              </>
            ) : (
              <>that's {(100 / withdrawalRate).toFixed(0)}× your annual spending, the flip side of the 4% rule</>
            )}
          </span>
        </div>
        {hasIncome && !fullyCoveredByIncome && (
          <p className="br-verdict-line" style={{ marginTop: "var(--space-sm)" }}>
            Guaranteed income of {currency(guaranteed)}/mo cuts the nest egg you need by{" "}
            <strong>{currency(nestEggSaved)}</strong>, down from {currency(nestEggNoIncome)} if you had to fund every dollar
            from savings.
          </p>
        )}
      </div>
      <div className={`wl-readout br-verdict ${covered ? "br-ok" : "br-short"}`}>
        <h3>Does your income cover it?</h3>
        <p className="br-verdict-line">
          {currency(portfolio)} at {withdrawalRate}% sustainably provides{" "}
          <strong>{currency(sustainableMonthly)}/mo</strong>
          {hasIncome && (
            <>, plus {currency(guaranteed)}/mo guaranteed = <strong>{currency(totalMonthlyIncome)}/mo</strong></>
          )},{" "}
          about <strong>{pctText(coverage)}</strong> of your {currency(monthlyTotal)}/mo burn rate.
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
  strategy,
  horizon,
  portfolio,
  guaranteed,
  portfolioDrawAnnual,
  firstYearSpend,
  withdrawalPct,
}: {
  sim: StressResult;
  strategy: Strategy;
  horizon: number;
  portfolio: number;
  guaranteed: number;
  portfolioDrawAnnual: number;
  firstYearSpend: number;
  withdrawalPct: number;
}) {
  const good = sim.successRate >= 0.9;
  const noDraw = portfolioDrawAnnual <= 0;
  if (strategy === "guardrails" && sim.spendBands && !noDraw) {
    return <GuardrailsView sim={sim} horizon={horizon} firstYearSpend={firstYearSpend} />;
  }
  return (
    <>
      <div className="wl-readout">
        <div className="sk-headline" style={{ background: good ? "var(--color-accent-soft)" : "var(--color-error-soft, var(--color-accent-soft))", borderColor: good ? "var(--color-accent)" : "var(--color-error)" }}>
          <span className="sk-headline-label">
            {noDraw ? `Chance your money lasts ${horizon} years` : `Chance your money lasts ${horizon} years (drawing ${pctText(withdrawalPct)} of it/yr)`}
          </span>
          <span className="sk-headline-value" style={{ color: good ? "var(--color-accent)" : "var(--color-error)" }}>
            {pctText(sim.successRate)}
          </span>
        </div>
        <FanChart bands={sim.bands} horizon={horizon} start={portfolio} paths={sim.samplePaths} />
        {noDraw ? (
          <p className="wl-fnote">
            Your guaranteed income covers <strong>all</strong> of your spending, so the portfolio is never drawn down. It
            only compounds. Every history "succeeds"; the question stops being <em>will it last</em> and becomes <em>how
            much does it grow</em>.
          </p>
        ) : (
          <p className="wl-fnote">
            Each band is a range of alternate histories. The wedge widens because
            luck compounds: two retirees with the identical plan can land worlds
            apart. The top ones caught good years early, the bottom ones hit crashes
            first (<strong>sequence-of-returns risk</strong>).
          </p>
        )}
      </div>

      <div className="wl-readout">
        {guaranteed > 0 && !noDraw && (
          <p className="br-verdict-line" style={{ marginBottom: "var(--space-sm)" }}>
            After {currency(guaranteed)}/mo of guaranteed income, the portfolio only has to supply{" "}
            <strong>{currency(portfolioDrawAnnual)}/yr</strong>, a much gentler draw, which is exactly why the odds above
            hold up even through bad markets.
          </p>
        )}
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
          Notice the <strong>average is pulled far above the typical</strong> outcome:
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

/** Guardrails result: the story is income, not balance, so the lifecycle map
 *  plots annual spending — how it flexes down in bad sequences and up in good. */
function GuardrailsView({ sim, horizon, firstYearSpend }: { sim: StressResult; horizon: number; firstYearSpend: number }) {
  return (
    <>
      <div className="wl-readout">
        <div className="sk-headline" style={{ background: "var(--color-accent-soft)", borderColor: "var(--color-accent)" }}>
          <span className="sk-headline-label">
            Average withdrawal rate across every history (you start at {pctText(sim.startRate ?? 0)})
          </span>
          <span className="sk-headline-value" style={{ color: "var(--color-accent)" }}>
            {pctText(sim.avgRate ?? 0)}
          </span>
        </div>
        <FanChart
          bands={sim.spendBands!}
          horizon={horizon}
          start={firstYearSpend}
          paths={sim.samplePaths}
          color="var(--color-link)"
          ariaLabel="Range of annual retirement spending over time across simulated histories"
        />
        <p className="wl-fnote">
          This wedge is your <strong>spending</strong>, year by year — not your balance.
          Guardrails cut it after bad markets and raise it after good ones, so it fans
          out: the bottom paths had to tighten their belts, the top ones earned a raise.
          Because income flexes, the portfolio itself rarely runs dry.
        </p>
      </div>

      <div className="wl-readout">
        <dl className="sk-stats">
          <div>
            <dt>Chance it lasts {horizon} years</dt>
            <dd>{pctText(sim.successRate)}</dd>
          </div>
          <div>
            <dt>Typical yearly spending</dt>
            <dd>{currency(sim.medianSpend ?? 0)}</dd>
          </div>
          <div>
            <dt>Unlucky 10% average</dt>
            <dd>{currency(sim.p10Spend ?? 0)}</dd>
          </div>
          <div>
            <dt>Lucky 10% average</dt>
            <dd>{currency(sim.p90Spend ?? 0)}</dd>
          </div>
        </dl>
        <p className="wl-saved">
          Guardrails move the risk from your <strong>balance</strong> to your{" "}
          <strong>income</strong>. Fixed withdrawals keep spending flat but can run the
          portfolio to zero; guardrails almost never run out ({pctText(sim.successRate)}{" "}
          here) because a bad sequence just means spending less — the unlucky live on
          about {currency(sim.p10Spend ?? 0)}/yr while the lucky enjoy{" "}
          {currency(sim.p90Spend ?? 0)}/yr. Neither is free; you're choosing which risk
          to carry. Flip back to <strong>Fixed (Bengen)</strong> to see the other side.
        </p>
      </div>
    </>
  );
}

function FanChart({ bands, horizon, start, paths, ariaLabel = "Range of retirement balances over time across simulated histories", color = "var(--color-accent)" }: { bands: { p: number; series: number[] }[]; horizon: number; start: number; paths?: number[][]; ariaLabel?: string; color?: string }) {
  const width = 560;
  const height = 260;
  const pad = { top: 14, right: 14, bottom: 28, left: 58 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [replay, setReplay] = useState(0);

  const byP = (p: number) => bands.find((b) => Math.abs(b.p - p) < 1e-9)!.series;
  const b10 = byP(0.1), b25 = byP(0.25), b50 = byP(0.5), b75 = byP(0.75), b90 = byP(0.9);
  const yMax = Math.max(...b90, start) * 1.05;

  const x = (t: number) => pad.left + (t / horizon) * plotW;
  const y = (v: number) => height - pad.bottom - (Math.max(0, v) / yMax) * plotH;

  // Animated "spaghetti": each sampled history draws in left-to-right, so the
  // reader watches identical plans peel apart year by year — sequence-of-returns
  // risk as motion, with the failures dying visibly at the $0 line.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !paths || paths.length === 0) return;
    const cssW = canvas.clientWidth || width;
    const scale = cssW / width;
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssW * (height / width) * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr * scale, dpr * scale);

    const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || "#888";
    const cAlive = css("--color-accent");
    const cDead = css("--color-error");
    // Death year per path (first year the series is ~0 and stays there).
    const death = paths.map((row) => {
      for (let t = 1; t < row.length; t++) if (row[t] <= 0) return t;
      return Infinity;
    });

    const DUR = 2600;
    const drawAt = (f: number) => {
      const front = f * horizon;
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;
      for (let p = 0; p < paths.length; p++) {
        const row = paths[p];
        const dead = death[p] <= front;
        ctx.strokeStyle = dead ? cDead : cAlive;
        ctx.globalAlpha = dead ? 0.45 : 0.16;
        ctx.beginPath();
        ctx.moveTo(x(0), y(row[0]));
        const last = Math.min(Math.floor(front), row.length - 1);
        for (let t = 1; t <= last; t++) ctx.lineTo(x(t), y(row[t]));
        // fractional tip so the front advances smoothly between year marks
        if (last < row.length - 1 && front > last) {
          const frac = front - last;
          const v = row[last] + (row[last + 1] - row[last]) * frac;
          ctx.lineTo(x(front), y(v));
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    let raf = 0;
    let done = false;
    const t0 = performance.now();
    const frame = (now: number) => {
      const f = Math.min(1, (now - t0) / DUR);
      drawAt(f);
      if (f < 1) raf = requestAnimationFrame(frame);
      else done = true;
    };
    raf = requestAnimationFrame(frame);
    // rAF doesn't fire in hidden/background tabs — guarantee the finished frame.
    const fallback = window.setTimeout(() => { if (!done) { done = true; drawAt(1); } }, DUR + 150);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(fallback); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths, replay, yMax, horizon]);

  const band = (lo: number[], hi: number[]) =>
    "M" + hi.map((v, t) => `${x(t)},${y(v)}`).join(" L") + " L" +
    [...lo].map((v, t) => ({ v, t })).reverse().map(({ v, t }) => `${x(t)},${y(v)}`).join(" L") + " Z";

  const median = "M" + b50.map((v, t) => `${x(t)},${y(v)}`).join(" L");
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;
  const fmt = (v: number) => formatMoney(v, { compact: true });

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label={ariaLabel}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={pad.left} x2={width - pad.right} y1={y(yMax * f)} y2={y(yMax * f)} stroke="var(--color-border)" />
            <text x={pad.left - 6} y={y(yMax * f) + 4} textAnchor="end" style={axisText}>{fmt(yMax * f)}</text>
          </g>
        ))}
        <path d={band(b10, b90)} fill={color} opacity={0.16} />
        <path d={band(b25, b75)} fill={color} opacity={0.28} />
        <path d={median} fill="none" stroke={color} strokeWidth={2.5} />
        {[0, Math.round(horizon / 2), horizon].map((t) => (
          <text key={t} x={x(t)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>{t === 0 ? "retire" : `yr ${t}`}</text>
        ))}
      </svg>
      {paths && paths.length > 0 && (
        <>
          <canvas
            ref={canvasRef}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
            aria-hidden="true"
          />
          <button
            type="button"
            className="wl-btn"
            onClick={() => setReplay((r) => r + 1)}
            style={{ position: "absolute", top: 2, right: 2, fontSize: "0.72rem", padding: "0.1rem 0.55rem", opacity: 0.85 }}
            aria-label={`Replay ${paths.length} simulated histories`}
          >
            ▶ Replay {paths.length} lives
          </button>
        </>
      )}
    </div>
  );
}

// --- Same returns, shuffled ------------------------------------------------

function OrderView({ sim, portfolio, spend, horizon }: { sim: OrderSim; portfolio: number; spend: number; horizon: number }) {
  const fmtEnd = (p: OrderPath) =>
    p.failYear !== null ? `ran out in year ${p.failYear}` : currency(p.ending);
  const spread =
    sim.bestFirst.ending > 0 && sim.worstFirst.ending > 0
      ? `${(sim.bestFirst.ending / sim.worstFirst.ending).toFixed(1)}×`
      : null;

  return (
    <div className="wl-frontier">
      <h3>One history, every order</h3>

      <div className="ss-headline" style={{ marginBottom: "var(--space-xs)" }}>
        {spend > 0 ? (
          <>
            <span className="ss-headline-label">
              Same {horizon} years, same {(sim.meanReturn * 100).toFixed(1)}% average real return — reordered, the endings span
            </span>
            <span className="ss-headline-value">
              {sim.worstFirst.failYear !== null ? "ruin" : currency(sim.worstFirst.ending)} → {currency(sim.bestFirst.ending)}
            </span>
            <span className="ss-headline-sub">
              {sim.worstFirst.failYear !== null
                ? `Bad years first: broke in year ${sim.worstFirst.failYear}. Good years first: ${currency(sim.bestFirst.ending)}. The only difference is the order.`
                : spread
                  ? `A ${spread} gap between the luckiest and unluckiest ordering — from order alone.`
                  : "The only difference between the lines is the order the years arrive in."}
            </span>
          </>
        ) : (
          <>
            <span className="ss-headline-label">With no withdrawals, every ordering of those {horizon} years ends at exactly</span>
            <span className="ss-headline-value" style={{ color: "var(--color-accent)" }}>{currency(sim.noWithdrawEnding)}</span>
            <span className="ss-headline-sub">
              Multiplication doesn't care about order. Sequence risk isn't in the market — it's created the moment money starts moving out (or in).
            </span>
          </>
        )}
      </div>

      <OrderChart sim={sim} portfolio={portfolio} horizon={horizon} />

      <dl className="ss-stats" style={{ marginTop: "var(--space-sm)" }}>
        <div><dt>As it happened ({sim.years[0]}–{sim.years[1]})</dt><dd>{fmtEnd(sim.asIs)}</dd></div>
        <div><dt>Best years first</dt><dd>{fmtEnd(sim.bestFirst)}</dd></div>
        <div><dt>Worst years first</dt><dd>{fmtEnd(sim.worstFirst)}</dd></div>
        <div><dt>40 random shuffles</dt><dd>{spend > 0 ? `${sim.shuffleFails} went broke` : "all identical"}</dd></div>
      </dl>

      <p className="wl-fnote">
        Every line spends the same, holds the same portfolio, and earns the same {horizon} annual
        returns ({(sim.cagr * 100).toFixed(1)}%/yr compounded); only the order differs. Early losses do
        lasting damage because each withdrawal sells more of the portfolio at the bottom — dollars that
        never recover. That's why the first decade of retirement carries most of the risk, and why
        flexible spending (see the stress test's guardrails) is such a powerful defense.
      </p>
    </div>
  );
}

function OrderChart({ sim, portfolio, horizon }: { sim: OrderSim; portfolio: number; horizon: number }) {
  const width = 760, height = 380;
  const pad = { top: 14, right: 18, bottom: 40, left: 56 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const yMax = Math.max(sim.bestFirst.ending, portfolio, ...sim.asIs.balances, ...sim.shuffles.map((s) => s.ending)) * 1.05;
  const x = (yr: number) => pad.left + (yr / horizon) * plotW;
  const y = (b: number) => pad.top + plotH - (Math.min(b, yMax) / yMax) * plotH;
  const path = (p: OrderPath) => p.balances.map((b, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(b)}`).join(" ");
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;
  const gridB: number[] = [];
  for (let g = 0; g <= 4; g++) gridB.push((yMax / 4) * g);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Portfolio balance over retirement for the same returns in different orders">
      {gridB.map((b) => (
        <g key={b}>
          <line x1={pad.left} x2={width - pad.right} y1={y(b)} y2={y(b)} stroke="var(--color-border)" />
          <text x={pad.left - 6} y={y(b) + 4} textAnchor="end" style={axisText}>{currency(b)}</text>
        </g>
      ))}
      {sim.shuffles.map((s, i) => (
        <path key={i} d={path(s)} fill="none" stroke="var(--color-muted)" strokeWidth={0.8} opacity={0.28} />
      ))}
      <path d={path(sim.bestFirst)} fill="none" stroke="var(--color-link)" strokeWidth={2.2} strokeDasharray="6 4" />
      <path d={path(sim.worstFirst)} fill="none" stroke="var(--color-error)" strokeWidth={2.2} strokeDasharray="6 4" />
      <path d={path(sim.asIs)} fill="none" stroke="var(--color-accent)" strokeWidth={2.8} />
      {sim.worstFirst.failYear !== null && (
        <text x={x(sim.worstFirst.failYear)} y={y(0) - 6} textAnchor="middle" style={{ ...axisText, fill: "var(--color-error)", fontWeight: 700 }}>
          ✝ broke, year {sim.worstFirst.failYear}
        </text>
      )}
      {[0, Math.round(horizon / 2), horizon].map((yr) => (
        <text key={yr} x={x(yr)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>year {yr}</text>
      ))}
      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        solid = as history happened · dashed blue = best years first · dashed red = worst years first · gray = 40 shuffles
      </text>
    </svg>
  );
}
