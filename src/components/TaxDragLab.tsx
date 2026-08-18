import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { formatMoney, useCurrencyCode } from "../lib/currency";

/**
 * "The Tax Drag" — a single lump sum, held in a tax-sheltered account vs. a
 * taxable brokerage, watched over TIME. The gap between them isn't a one-off
 * haircut; it's a leak that compounds, widening every year. This tool makes
 * that trajectory visible and then decomposes the leak into its three sources:
 * tax on dividends, tax on the gains a fund is forced to distribute as it
 * trades (turnover), and the capital-gains tax finally due at sale.
 *
 * Complements the Roth-vs-Traditional tool (which compares end-state account
 * choices as bars); here the focus is the shape of the drag over time and what
 * actually causes it. Educational only, not advice.
 */

const money = (n: number) => formatMoney(n);
const moneyC = (n: number) => formatMoney(n, { compact: true });

type FundType = "index" | "active" | "high";
const FUNDS: Record<FundType, { label: string; turnover: number; stFrac: number }> = {
  index: { label: "Index fund", turnover: 0.04, stFrac: 0.05 },
  active: { label: "Active fund", turnover: 0.6, stFrac: 0.3 },
  high: { label: "High-turnover", turnover: 1.2, stFrac: 0.55 },
};

/** Simulate the taxable account year by year, tracking the liquidation value
 *  (what you'd keep after selling) and the running taxes paid, split by source. */
function simulate(P: number, r: number, divY: number, fund: { turnover: number; stFrac: number }, cg: number, ord: number, n: number) {
  let V = P, B = P;
  const shelt: number[] = [P];
  const taxLiq: number[] = [P];
  let taxDiv = 0, taxDist = 0;
  for (let y = 0; y < n; y++) {
    const div = V * divY;
    const priceApp = V * (r - divY);
    // Model of forced distributions: the fund realizes (and passes to you) a
    // slice of its unrealized gains proportional to its turnover. Short-term
    // slices are taxed at your ordinary rate, long-term at the capital-gains
    // rate; qualified dividends also get the capital-gains rate.
    const unreal = Math.max(0, V - B + priceApp);
    const cgDist = fund.turnover * unreal;
    const divTax = div * cg;
    const distTax = cgDist * fund.stFrac * ord + cgDist * (1 - fund.stFrac) * cg;
    V = V * (1 + r) - divTax - distTax;
    // Cost basis rises with reinvested (after-tax) dividends and with the
    // distributed gains — you already paid tax on those, so they aren't taxed
    // again at sale. Capped at V so basis can never exceed the account value.
    B = Math.min(V, B + (div - divTax) + cgDist);
    taxDiv += divTax;
    taxDist += distTax;
    shelt.push(P * (1 + r) ** (y + 1));
    taxLiq.push(V - Math.max(0, V - B) * cg); // value if sold this year (embeds latent CG)
  }
  const saleTax = Math.max(0, V - B) * cg;
  const afterTax = V - saleTax;
  return { shelt, taxLiq, afterTax, endShelt: shelt[n], taxDiv, taxDist, saleTax };
}

export default function TaxDragLab() {
  useCurrencyCode();
  const [amount, setAmount] = useState(100_000);
  const [years, setYears] = useState(30);
  const [ret, setRet] = useState(7);
  const [divYield, setDivYield] = useState(1.8);
  const [fund, setFund] = useState<FundType>("index");
  const [ordRate, setOrdRate] = useState(32);
  const [cgRate, setCgRate] = useState(15);

  const sim = useMemo(() => {
    const rd = ret / 100, dv = Math.min(divYield / 100, ret / 100), cg = cgRate / 100, ord = ordRate / 100;
    const s = simulate(amount, rd, dv, FUNDS[fund], cg, ord, years);
    const lost = s.endShelt - s.afterTax;
    const taxableCagr = amount > 0 ? (s.afterTax / amount) ** (1 / years) - 1 : 0;
    const drag = rd - taxableCagr; // annualized drag, incl. the final sale tax
    const totalTax = s.taxDiv + s.taxDist + s.saleTax;
    return { ...s, lost, drag, taxableCagr, totalTax };
  }, [amount, years, ret, divYield, fund, ordRate, cgRate]);

  const reset = () => { setAmount(100_000); setYears(30); setRet(7); setDivYield(1.8); setFund("index"); setOrdRate(32); setCgRate(15); };
  const pctBar = (part: number) => (sim.totalTax > 0 ? (part / sim.totalTax) * 100 : 0);

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={reset} />

        <label className="wl-slider">
          <span>
            Lump sum invested <InfoTip text="A one-time investment, held without adding more, so the tax drag is easy to isolate." /> <strong>{money(amount)}</strong>
          </span>
          <input type="range" min={10_000} max={1_000_000} step={10_000} value={amount} onChange={(e) => setAmount(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>
            Years held <InfoTip text="Longer holding lets the drag compound, but also lets more gains defer untaxed until sale — the tool shows both effects." /> <strong>{years}</strong>
          </span>
          <input type="range" min={5} max={40} step={1} value={years} onChange={(e) => setYears(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>
            Annual return <InfoTip text="Total return including dividends." /> <strong>{ret}%</strong>
          </span>
          <input type="range" min={3} max={10} step={0.5} value={ret} onChange={(e) => setRet(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>
            …of which dividends <InfoTip text="The share paid as (qualified) dividends, taxed each year even if you reinvest. The rest is price growth, which defers until you sell." /> <strong>{divYield}%</strong>
          </span>
          <input type="range" min={0} max={4} step={0.1} value={divYield} onChange={(e) => setDivYield(+e.target.value)} />
        </label>

        <div className="wl-field">
          <span className="wl-field-label">
            Fund type <InfoTip text="Turnover is how much a fund buys and sells each year, forcing it to hand you taxable gains — much of it short-term (taxed at your ordinary rate). Index funds barely turn over; active funds churn." />
          </span>
          <div className="wl-simmode wl-simmode--wrap" role="group" aria-label="Fund type">
            {(Object.keys(FUNDS) as FundType[]).map((k) => (
              <button key={k} type="button" className={fund === k ? "active" : ""} aria-pressed={fund === k} onClick={() => setFund(k)}>{FUNDS[k].label}</button>
            ))}
          </div>
          <p className="wl-note" style={{ marginTop: "0.3rem" }}>{(FUNDS[fund].turnover * 100).toFixed(0)}% turnover · {(FUNDS[fund].stFrac * 100).toFixed(0)}% of it short-term</p>
        </div>

        <label className="wl-slider">
          <span>
            Ordinary income rate <InfoTip text="Hits short-term distributions from a churning fund." /> <strong>{ordRate}%</strong>
          </span>
          <input type="range" min={0} max={50} step={1} value={ordRate} onChange={(e) => setOrdRate(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>
            Cap-gains / dividend rate <InfoTip text="Your long-term capital-gains and qualified-dividend rate (often 15%), applied to dividends, long-term distributions, and the final sale." /> <strong>{cgRate}%</strong>
          </span>
          <input type="range" min={0} max={30} step={1} value={cgRate} onChange={(e) => setCgRate(+e.target.value)} />
        </label>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">A taxable account gives up, over {years} years</span>
          <span className="ss-headline-value">{money(sim.lost)}</span>
          <span className="ss-headline-sub">
            a drag of about <strong>{(sim.drag * 100).toFixed(2)}%/yr</strong> — {ret}% becomes {(sim.taxableCagr * 100).toFixed(2)}% after tax
          </span>
        </div>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          <strong>Method:</strong> the sheltered line grows tax-free; the taxable line is its liquidation value each year
          (dividends and fund distributions taxed as incurred, the remaining gain taxed at sale). A transparent
          approximation — no state taxes or tax-loss harvesting. Educational only, not advice.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>The gap widens every year</h3>
          <DragChart shelt={sim.shelt} tax={sim.taxLiq} />
          <div className="wl-flegend">
            <span><span className="wl-fdot" style={{ background: "var(--color-accent)" }} /> Tax-sheltered</span>
            <span><span className="wl-fdot" style={{ background: "var(--color-warn)" }} /> Taxable (after tax)</span>
            <span><span className="wl-fdot" style={{ background: "var(--color-warn)", opacity: 0.25 }} /> Cumulative drag</span>
          </div>
          <p className="wl-fnote">
            Both start at the same {money(amount)}. The shaded wedge is money lost to tax that then never compounds for you
            — which is why the gap doesn't just grow, it accelerates.
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <p className="wl-diversify-title" style={{ marginBottom: "var(--space-sm)" }}>Where the {money(sim.totalTax)} of tax goes</p>
            <div className="wl-bar">
              <span className="wl-bar-label">Tax on dividends (every year)</span>
              <span className="wl-bar-value">{money(sim.taxDiv)}</span>
              <div className="wl-bar-track"><div className="wl-bar-fill wl-bar-fill--avg" style={{ width: `${pctBar(sim.taxDiv)}%` }} /></div>
            </div>
            <div className="wl-bar">
              <span className="wl-bar-label">Tax on fund distributions (turnover)</span>
              <span className="wl-bar-value">{money(sim.taxDist)}</span>
              <div className="wl-bar-track"><div className="wl-bar-fill wl-bar-fill--realized" style={{ width: `${pctBar(sim.taxDist)}%` }} /></div>
            </div>
            <div className="wl-bar">
              <span className="wl-bar-label">Capital-gains tax at final sale</span>
              <span className="wl-bar-value">{money(sim.saleTax)}</span>
              <div className="wl-bar-track"><div className="wl-bar-fill wl-bar-fill--port" style={{ width: `${pctBar(sim.saleTax)}%` }} /></div>
            </div>
            <p className="wl-saved">
              Two things drive the drag. First, <strong>anything taxed along the way</strong> — dividends, and the gains a
              churning fund is forced to distribute — is money pulled out to pay tax that then can't compound. This is why a
              low-turnover <strong>index fund</strong> is so tax-efficient and a high-turnover fund so costly: switch the
              fund type and watch the middle bar explode. Second, even a perfectly tax-efficient fund owes{" "}
              <strong>capital-gains tax at sale</strong> — but that's deferred for decades and often the smallest piece,
              which is the quiet superpower of buy-and-hold. Educational only, not advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DragChart({ shelt, tax }: { shelt: number[]; tax: number[] }) {
  const width = 760, height = 380;
  const pad = { top: 22, right: 18, bottom: 42, left: 58 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const steps = shelt.length;
  const yMax = Math.max(...shelt) * 1.06 || 1;
  const x = (i: number) => pad.left + (i / (steps - 1)) * plotW;
  const y = (v: number) => pad.top + plotH - (v / yMax) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;
  const lineOf = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const gap = `${shelt.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} ` +
    [...tax].map((v, i) => ({ v, i })).reverse().map(({ v, i }) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ") + " Z";
  const ticks = 4;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Tax-sheltered vs. taxable value over time">
      {Array.from({ length: ticks + 1 }, (_, k) => (yMax * k) / ticks).map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{moneyC(v)}</text>
        </g>
      ))}
      <path d={gap} fill="var(--color-warn)" opacity={0.16} stroke="none" />
      <path d={lineOf(tax)} fill="none" stroke="var(--color-warn)" strokeWidth={2.4} strokeLinejoin="round" />
      <path d={lineOf(shelt)} fill="none" stroke="var(--color-accent)" strokeWidth={2.8} strokeLinejoin="round" />
      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Years → · value if you sold that year
      </text>
    </svg>
  );
}
