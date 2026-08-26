import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { federalTax, TAX_YEARS, type FilingStatus, type Household } from "../lib/usTax";
import { formatUsd } from "../lib/currency";

/**
 * Tax-gain harvesting vs Roth conversion: two good uses for the same cheap
 * tax space, and they compete — realized gains stack ON TOP of ordinary
 * income, so every converted dollar pushes the 0% capital-gains zone away.
 *
 * The tool fills a low-income year's space one dollar at a time, always
 * taking whichever action saves more versus the rates you expect later:
 *   • CONVERT traditional-IRA dollars while the marginal cost now is far
 *     below your expected later ordinary rate (free inside the deduction);
 *   • HARVEST long-term gains while they still land in the 0% zone (worth
 *     your later gains rate, usually 15%);
 *   • STOP when neither action beats just waiting.
 * Because both actions share one tax ladder, the greedy dollar-by-dollar
 * fill is the honest way to see the trade-off (marginal costs only rise as
 * the space fills; benefits only fall).
 *
 * Engine: src/lib/usTax.ts — the same validated federal engine as the
 * Next Dollar tool. Educational only, never tax advice.
 */

const currency = (n: number) => formatUsd(n);
const pct = (x: number, dp = 1) => `${(x * 100).toFixed(dp)}%`;

const STEP = 250;
const MAX_SPACE = 150_000;

type Action = "convert" | "harvest";

interface Tranche {
  action: Action;
  amount: number;
  costNow: number; // dollars of tax paid now for this tranche
  savedLater: number; // dollars of later tax avoided (at assumed rates)
}

export default function HarvestConvertLab() {
  const year = TAX_YEARS[TAX_YEARS.length - 1];
  const [status, setStatus] = useState<FilingStatus>("mfj");
  const [age65, setAge65] = useState(0);
  const [otherOrdinary, setOtherOrdinary] = useState(20_000);
  const [ssBenefit, setSsBenefit] = useState(0);
  const [tiraAvail, setTiraAvail] = useState(400_000);
  const [gainsAvail, setGainsAvail] = useState(100_000);
  const [laterOrd, setLaterOrd] = useState(22);
  const [laterCap, setLaterCap] = useState(15);

  const view = useMemo(() => {
    const base: Household = {
      year, status, age65,
      wages: 0, otherOrdinary, ssBenefit,
      qdivLtcg: 0, kids: 0, saverContrib: 0,
    };
    const lo = laterOrd / 100;
    const lc = laterCap / 100;

    let converted = 0;
    let harvested = 0;
    let taxNow0 = federalTax(base).tax;
    const tranches: Tranche[] = [];
    const steps: { action: Action | null; conv: number; harv: number }[] = [];

    const taxAt = (c: number, h: number) =>
      federalTax({ ...base, otherOrdinary: otherOrdinary + c, qdivLtcg: h }).tax;

    let taxCur = taxNow0;
    for (let i = 0; i < MAX_SPACE / STEP; i++) {
      const canConv = converted + STEP <= tiraAvail;
      const canHarv = harvested + STEP <= gainsAvail;
      const costConv = canConv ? (taxAt(converted + STEP, harvested) - taxCur) / STEP : Infinity;
      const costHarv = canHarv ? (taxAt(converted, harvested + STEP) - taxCur) / STEP : Infinity;
      const benConv = lo - costConv;
      const benHarv = lc - costHarv;
      if (benConv <= 0.001 && benHarv <= 0.001) break;
      const action: Action = benConv >= benHarv ? "convert" : "harvest";
      steps.push({ action, conv: costConv, harv: costHarv });
      if (action === "convert") {
        converted += STEP;
        taxCur = taxAt(converted, harvested);
      } else {
        harvested += STEP;
        taxCur = taxAt(converted, harvested);
      }
      const last = tranches[tranches.length - 1];
      const costStep = action === "convert" ? costConv * STEP : costHarv * STEP;
      const savedStep = action === "convert" ? lo * STEP : lc * STEP;
      if (last && last.action === action) {
        last.amount += STEP;
        last.costNow += costStep;
        last.savedLater += savedStep;
      } else {
        tranches.push({ action, amount: STEP, costNow: costStep, savedLater: savedStep });
      }
    }

    const taxNow = taxCur - taxNow0;
    const savedLater = tranches.reduce((s, t) => s + t.savedLater, 0);
    return { tranches, converted, harvested, taxNow, savedLater, net: savedLater - taxNow };
  }, [year, status, age65, otherOrdinary, ssBenefit, tiraAvail, gainsAvail, laterOrd, laterCap]);

  const total = view.converted + view.harvested;

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={() => {
          setStatus("mfj"); setAge65(0); setOtherOrdinary(20_000); setSsBenefit(0);
          setTiraAvail(400_000); setGainsAvail(100_000); setLaterOrd(22); setLaterCap(15);
        }} />

        <div className="wl-simmode" role="group" aria-label="Filing status">
          <button type="button" className={status === "single" ? "active" : ""} aria-pressed={status === "single"} onClick={() => { setStatus("single"); setAge65(Math.min(age65, 1)); }}>Single</button>
          <button type="button" className={status === "mfj" ? "active" : ""} aria-pressed={status === "mfj"} onClick={() => setStatus("mfj")}>Married filing jointly</button>
        </div>

        <p className="br-group">This year (a low-income window)</p>
        <label className="wl-slider">
          <span>
            Income you already have
            <InfoTip text="Pension, part-time work, interest — the ordinary income that's there regardless. The lower it is, the more cheap space the year offers." />{" "}
            <strong>{currency(otherOrdinary)}</strong>
          </span>
          <input type="range" min={0} max={120_000} step={1_000} value={otherOrdinary} onChange={(e) => setOtherOrdinary(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>
            Social Security benefits
            <InfoTip text="If benefits have started, every converted dollar can drag up to 85¢ of them into taxable income — the tax torpedo makes conversions costlier. Gap years BEFORE claiming are the golden window." />{" "}
            <strong>{currency(ssBenefit)}</strong>
          </span>
          <input type="range" min={0} max={72_000} step={1_000} value={ssBenefit} onChange={(e) => setSsBenefit(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>People 65 or older <strong>{age65}</strong></span>
          <input type="range" min={0} max={status === "single" ? 1 : 2} step={1} value={age65} onChange={(e) => setAge65(+e.target.value)} />
        </label>

        <p className="br-group">What you're sitting on</p>
        <label className="wl-slider">
          <span>
            Traditional IRA / 401(k) to convert
            <InfoTip text="Pre-tax money that will be taxed as ordinary income someday — at withdrawal, at RMDs, or by your heirs. Converting moves it to Roth at today's marginal cost." />{" "}
            <strong>{currency(tiraAvail)}</strong>
          </span>
          <input type="range" min={0} max={2_000_000} step={25_000} value={tiraAvail} onChange={(e) => setTiraAvail(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>
            Unrealized long-term gains
            <InfoTip text="Gains in the taxable account you could realize (and immediately rebuy — no wash-sale rule on GAINS). Harvested inside the 0% zone, the basis resets for free." />{" "}
            <strong>{currency(gainsAvail)}</strong>
          </span>
          <input type="range" min={0} max={500_000} step={10_000} value={gainsAvail} onChange={(e) => setGainsAvail(+e.target.value)} />
        </label>

        <p className="br-group">Rates you expect later</p>
        <label className="wl-slider">
          <span>
            On ordinary income (RMD years, heirs)
            <InfoTip text="What withdrawals would be taxed at if you DIDN'T convert: your bracket once RMDs and Social Security stack up, or your heirs' bracket. The higher this is, the more conversions win." />{" "}
            <strong>{laterOrd}%</strong>
          </span>
          <input type="range" min={10} max={37} step={1} value={laterOrd} onChange={(e) => setLaterOrd(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>
            On long-term gains
            <InfoTip text="The rate those gains would face if realized later instead: usually 15%, plus 3.8% NIIT at high income — or 0% if you'd stay in the 0% zone forever, or if the shares get a step-up at death (then harvesting now is worth little)." />{" "}
            <strong>{laterCap}%</strong>
          </span>
          <input type="range" min={0} max={24} step={1} value={laterCap} onChange={(e) => setLaterCap(+e.target.value)} />
        </label>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">
            {total > 0 ? "Filled optimally, this year's cheap space is worth" : "At these settings, neither move beats waiting —"}
          </span>
          <span className="ss-headline-value" style={{ color: "var(--color-accent)" }}>
            {total > 0 ? currency(view.net) : "$0"}
          </span>
          <span className="ss-headline-sub">
            {total > 0
              ? `of later tax avoided, net of ${currency(view.taxNow)} paid now: convert ${currency(view.converted)}, harvest ${currency(view.harvested)}.`
              : "lower this year's income, raise the expected later rates, or check that there's anything left to convert or harvest."}
          </span>
        </div>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          Federal only, standard deduction, same simplifications as the{" "}
          <a href="/personal-finance/next-dollar">Next Dollar tool</a> — plus real-world cliffs this
          ignores: state tax, ACA premium subsidies, and (within 2 years of Medicare){" "}
          <a href="/personal-finance/next-dollar">IRMAA</a>. If heirs would inherit the taxable shares,
          the step-up at death makes harvesting worth little — set the later gains rate to 0 and watch.
          Educational only, <strong>not tax advice</strong>.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>How to spend the cheap space, dollar by dollar</h3>
          <TrancheBar tranches={view.tranches} />
          <div style={{ overflowX: "auto" }}>
            <table className="hc-table">
              <thead>
                <tr><th>Move</th><th>Amount</th><th>Tax now</th><th>Cost now</th><th>Later rate</th><th>Net saved</th></tr>
              </thead>
              <tbody>
                {view.tranches.map((t, i) => (
                  <tr key={i}>
                    <td>{t.action === "convert" ? "Convert to Roth" : "Harvest gains"}</td>
                    <td>{currency(t.amount)}</td>
                    <td>{currency(t.costNow)}</td>
                    <td>{pct(t.costNow / t.amount)}</td>
                    <td>{t.action === "convert" ? `${laterOrd}%` : `${laterCap}%`}</td>
                    <td>{currency(t.savedLater - t.costNow)}</td>
                  </tr>
                ))}
                {view.tranches.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--color-muted)" }}>No space worth using at these settings.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="wl-fnote">
            The two moves compete for one ladder: converted dollars are ordinary income that pushes
            the 0% gains zone out from under your unrealized gains, and (once benefits start) drags
            Social Security into taxability. That's why the answer is a sequence, not a slogan —
            typically: convert through the deduction (free), then whichever of "harvest at 0%" or
            "convert in the low brackets" has the bigger spread against its later rate, then stop.
            Change the expected later rates and watch the sequence reshuffle.
          </p>
        </div>
      </div>
    </div>
  );
}

function TrancheBar({ tranches }: { tranches: Tranche[] }) {
  const total = tranches.reduce((s, t) => s + t.amount, 0);
  if (total === 0) return null;
  return (
    <div style={{ display: "flex", width: "100%", height: 34, borderRadius: 8, overflow: "hidden", margin: "0.4rem 0 0.8rem" }} role="img" aria-label="Allocation of the year's cheap tax space between conversions and harvesting">
      {tranches.map((t, i) => (
        <div
          key={i}
          title={`${t.action === "convert" ? "Convert" : "Harvest"} ${currency(t.amount)} (cost now ${pct(t.costNow / t.amount)})`}
          style={{
            width: `${(t.amount / total) * 100}%`,
            background: t.action === "convert" ? "var(--color-accent)" : "var(--color-link)",
            opacity: 0.55 + 0.45 * (1 - Math.min(1, t.costNow / Math.max(1, t.amount) / 0.25)),
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--color-accent-contrast)", fontFamily: "var(--font-sans)", fontSize: "0.72rem", fontWeight: 700,
            whiteSpace: "nowrap", overflow: "hidden",
          }}
        >
          {t.amount / total > 0.12 ? `${t.action === "convert" ? "convert" : "harvest"} ${currency(t.amount)}` : ""}
        </div>
      ))}
    </div>
  );
}
