import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { formatUsd } from "../lib/currency";
import { NOMINAL_TIP } from "../lib/returnBasis";

/**
 * "Asset Location" — same portfolio, same total tax rates, but WHERE you hold
 * each asset changes your after-tax wealth. And the honest twist most guides
 * skip: the right answer depends on the KIND of shelter.
 *
 *  • Traditional (tax-deferred): the classic rule holds. Bond interest is taxed
 *    every year at your ordinary rate, so shelter the bonds and keep the
 *    tax-efficient stock index (deferred gains, light dividends) in taxable.
 *  • Roth (tax-free): the wrapper's value scales with growth, so sheltering the
 *    HIGHER-returning asset (stocks) usually wins instead — the opposite call.
 *
 * The tool computes both, so the flip is visible rather than asserted.
 * Educational only, not advice.
 */

const money = (n: number) => formatUsd(n);
const moneyC = (n: number) => formatUsd(n, { compact: true });

type Strat = "bonds" | "even" | "stocks";
const STRATS: { key: Strat; label: string; short: string; color: string }[] = [
  { key: "bonds", label: "Bonds in the shelter", short: "Bonds", color: "var(--color-link)" },
  { key: "even", label: "Same mix in both", short: "Even", color: "var(--color-muted)" },
  { key: "stocks", label: "Stocks in the shelter", short: "Stocks", color: "var(--pl-c3)" },
];

/** Taxable stock: qualified dividend taxed yearly at cap-gains rate, price
 *  appreciation deferred and taxed at sale. A broad index barely distributes
 *  gains, so we ignore turnover. */
function taxableStock(amt: number, r: number, divY: number, cg: number, n: number) {
  let V = amt, B = amt;
  for (let y = 0; y < n; y++) {
    const div = V * divY;
    const app = V * (r - divY);
    V = V + app + div - div * cg; // reinvest net dividend; appreciation deferred
    B += div * (1 - cg);
  }
  return V - Math.max(0, V - B) * cg; // pay LTCG on the remaining gain at sale
}
/** Taxable bond: interest taxed yearly at the ordinary rate; no price gain. */
const taxableBond = (amt: number, r: number, ord: number, n: number) => amt * (1 + r * (1 - ord)) ** n;
type ShelterType = "traditional" | "roth";

export default function AssetLocationLab() {
  const [shelterType, setShelterType] = useState<ShelterType>("traditional");
  const [total, setTotal] = useState(400_000);
  const [stockPct, setStockPct] = useState(60);
  const [taxablePct, setTaxablePct] = useState(50); // share of total held in the taxable account
  const [years, setYears] = useState(25);
  const [stockRet, setStockRet] = useState(7);
  const [divYield, setDivYield] = useState(1.8);
  const [bondYield, setBondYield] = useState(4);
  const [ordRate, setOrdRate] = useState(32);
  const [cgRate, setCgRate] = useState(15);
  const [sel, setSel] = useState<Strat>("bonds");

  const calc = useMemo(() => {
    const s = stockPct / 100;
    const rS = stockRet / 100, dS = Math.min(divYield / 100, stockRet / 100), rB = bondYield / 100;
    const ord = ordRate / 100, cg = cgRate / 100, n = years;
    const stockAmt = total * s, bondAmt = total * (1 - s);
    const advCap = total * (1 - taxablePct / 100); // tax-advantaged capacity
    // Roth grows tax-free; Traditional grows untaxed then owes ordinary tax at
    // withdrawal (a flat (1-ord) haircut, applied equally to every strategy).
    const shelter = (amt: number, r: number) => amt * (1 + r) ** n * (shelterType === "roth" ? 1 : 1 - ord);

    const place = (strat: Strat) => {
      let advStocks = 0, advBonds = 0;
      if (strat === "bonds") {
        advBonds = Math.min(bondAmt, advCap);
        advStocks = Math.min(stockAmt, advCap - advBonds);
      } else if (strat === "stocks") {
        advStocks = Math.min(stockAmt, advCap);
        advBonds = Math.min(bondAmt, advCap - advStocks);
      } else {
        advStocks = advCap * s;
        advBonds = advCap * (1 - s);
      }
      const taxStocks = stockAmt - advStocks, taxBonds = bondAmt - advBonds;
      const end =
        shelter(advStocks, rS) + shelter(advBonds, rB) +
        taxableStock(taxStocks, rS, dS, cg, n) + taxableBond(taxBonds, rB, ord, n);
      return { advStocks, advBonds, taxStocks, taxBonds, end };
    };

    const res = { bonds: place("bonds"), even: place("even"), stocks: place("stocks") };
    const locGap = res.bonds.end - res.stocks.end; // >0 → bonds-in-shelter wins
    const winner: Strat = locGap > 1 ? "bonds" : locGap < -1 ? "stocks" : "even";
    return { res, locGap, winner, advCap, taxCap: total - advCap };
  }, [shelterType, total, stockPct, taxablePct, years, stockRet, divYield, bondYield, ordRate, cgRate]);

  const reset = () => {
    setShelterType("traditional"); setTotal(400_000); setStockPct(60); setTaxablePct(50); setYears(25);
    setStockRet(7); setDivYield(1.8); setBondYield(4); setOrdRate(32); setCgRate(15); setSel("bonds");
  };
  const selRes = calc.res[sel];
  const winAsset = calc.winner === "bonds" ? "bonds" : calc.winner === "stocks" ? "stocks" : "either asset";

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={reset} />

        <div className="wl-field">
          <span className="wl-field-label">
            Tax-advantaged account is
            <InfoTip text="Roth grows and withdraws tax-free. Traditional (401k/IRA) grows untaxed but the whole withdrawal is taxed as ordinary income. This choice flips which asset belongs in the shelter." />
          </span>
          <div className="wl-simmode" role="group" aria-label="Shelter type">
            <button type="button" className={shelterType === "traditional" ? "active" : ""} aria-pressed={shelterType === "traditional"} onClick={() => setShelterType("traditional")}>Traditional</button>
            <button type="button" className={shelterType === "roth" ? "active" : ""} aria-pressed={shelterType === "roth"} onClick={() => setShelterType("roth")}>Roth</button>
          </div>
        </div>

        <span className="br-group">Portfolio</span>
        <label className="wl-slider">
          <span>
            Total invested
            <InfoTip text="Your whole portfolio, spread across both accounts. Asset location matters most when a meaningful chunk sits in a taxable account." />{" "}
            <strong>{money(total)}</strong>
          </span>
          <input type="range" min={50_000} max={5_000_000} step={50_000} value={total} onChange={(e) => setTotal(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>
            Stock / bond mix
            <InfoTip text="Your overall allocation. It stays fixed across every strategy here — asset location changes only WHERE each asset sits, never how much you hold." />{" "}
            <strong>{stockPct} / {100 - stockPct}</strong>
          </span>
          <input type="range" min={10} max={90} step={5} value={stockPct} onChange={(e) => setStockPct(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>
            Share in the taxable account
            <InfoTip text="How much of the total sits in a regular taxable brokerage vs. a tax-advantaged account (Roth/IRA). With everything sheltered, location can't matter; the effect peaks when the two are balanced." />{" "}
            <strong>{taxablePct}%</strong>
          </span>
          <input type="range" min={0} max={100} step={5} value={taxablePct} onChange={(e) => setTaxablePct(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>
            Years to grow <InfoTip text="How long the portfolio compounds before you sell. Longer horizons let the annual tax drag on the badly-placed asset build into a bigger gap." /> <strong>{years}</strong>
          </span>
          <input type="range" min={5} max={50} step={1} value={years} onChange={(e) => setYears(+e.target.value)} />
        </label>

        <span className="br-group">Returns</span>
        <label className="wl-slider">
          <span>
            Stock return (nominal) <InfoTip text={`Total annual return on stocks, including dividends. ${NOMINAL_TIP} This tool works in nominal terms because tax is levied on nominal gains.`} /> <strong>{stockRet}%</strong>
          </span>
          <input type="range" min={0} max={10} step={0.5} value={stockRet} onChange={(e) => setStockRet(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>
            …of which dividends <InfoTip text="The portion of the stock return paid as (qualified) dividends, taxed each year at the cap-gains rate in a taxable account. The rest is price growth, taxed only at sale." /> <strong>{divYield}%</strong>
          </span>
          <input type="range" min={0} max={4} step={0.1} value={divYield} onChange={(e) => setDivYield(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>
            Bond yield (nominal) <InfoTip text={`Annual bond return, essentially all interest. In a taxable account this is taxed every year at your full ordinary rate — which is what makes bonds tax-inefficient. ${NOMINAL_TIP}`} /> <strong>{bondYield}%</strong>
          </span>
          <input type="range" min={0} max={8} step={0.25} value={bondYield} onChange={(e) => setBondYield(+e.target.value)} />
        </label>

        <span className="br-group">Taxes</span>
        <label className="wl-slider">
          <span>
            Ordinary income rate <InfoTip text="Your marginal rate on ordinary income — the rate that hits bond interest in a taxable account." /> <strong>{ordRate}%</strong>
          </span>
          <input type="range" min={0} max={50} step={1} value={ordRate} onChange={(e) => setOrdRate(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>
            Cap-gains / dividend rate <InfoTip text="Your long-term capital-gains and qualified-dividend rate (often 15%). This is what stocks pay in a taxable account — usually well below the ordinary rate, which is the whole point." /> <strong>{cgRate}%</strong>
          </span>
          <input type="range" min={0} max={30} step={1} value={cgRate} onChange={(e) => setCgRate(+e.target.value)} />
        </label>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">
            With a <strong>{shelterType === "roth" ? "Roth" : "Traditional"}</strong> shelter, putting{" "}
            {calc.winner === "even" ? "either asset" : winAsset} in it wins by
          </span>
          <span className="ss-headline-value">{calc.winner === "even" ? "~a wash" : money(Math.abs(calc.locGap))}</span>
          <span className="ss-headline-sub">
            over {years} years, same {stockPct}/{100 - stockPct} allocation — purely from <strong>where</strong> each asset sits
          </span>
        </div>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          <strong>Method:</strong> a Roth shelter grows tax-free; a Traditional shelter grows untaxed then owes ordinary
          tax at withdrawal (a flat haircut applied to every strategy alike, so the comparison stays fair). In taxable,
          stocks defer price gains to sale (index-like, no turnover) while bonds are taxed yearly at the ordinary rate.
          Educational only, not advice.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>After-tax wealth by where you put each asset</h3>
          <LocationBars res={calc.res} sel={sel} onSelect={setSel} winner={calc.winner} />
          <div className="wl-flegend">
            {STRATS.map((s) => (
              <button key={s.key} type="button" onClick={() => setSel(s.key)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, opacity: sel === s.key ? 1 : 0.6, fontWeight: sel === s.key ? 700 : 400 }}
                aria-pressed={sel === s.key}>
                <span className="wl-fdot" style={{ background: s.color }} /> {s.label}
              </button>
            ))}
          </div>
          <p className="wl-fnote">
            Every bar holds the identical {stockPct}/{100 - stockPct} portfolio for {years} years and pays the same tax
            rates. The only difference is which account each asset lives in — yet the after-tax finish lines don't match.
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <p className="wl-diversify-title" style={{ marginBottom: "var(--space-sm)" }}>
              {STRATS.find((s) => s.key === sel)!.label}: what sits where
            </p>
            <dl className="ss-stats">
              <div><dt>Tax shelter · bonds</dt><dd>{moneyC(selRes.advBonds)}</dd></div>
              <div><dt>Tax shelter · stocks</dt><dd>{moneyC(selRes.advStocks)}</dd></div>
              <div><dt>Taxable · stocks</dt><dd>{moneyC(selRes.taxStocks)}</dd></div>
              <div><dt>Taxable · bonds</dt><dd>{moneyC(selRes.taxBonds)}</dd></div>
            </dl>
            <p className="wl-saved">
              Same money, same mix, same tax rates — only the <strong>location</strong> changes.{" "}
              {shelterType === "traditional" ? (
                <>
                  With a <strong>Traditional</strong> shelter the classic rule holds: bond interest is taxed every year at
                  your ordinary rate, so a bond dragged through a taxable account bleeds the most — shelter it. The
                  tax-efficient stock index (deferred gains, lightly-taxed dividends) does the least harm left in taxable.
                  So <strong>bonds go in the tax-deferred account first.</strong>
                </>
              ) : (
                <>
                  With a <strong>Roth</strong>, the twist most guides skip: because Roth growth is entirely tax-free, the
                  wrapper is worth most wrapped around the <strong>highest-returning</strong> asset. Sheltering stocks
                  shields more dollars of growth than avoiding the bond tax-drag saves — so here{" "}
                  <strong>stocks in the Roth</strong> usually wins, the opposite call. It can flip back if stock returns
                  are low or bond yields high — try the sliders.
                </>
              )}{" "}
              Either way, the effect shrinks toward zero once everything fits in the shelter, or when ordinary and
              cap-gains rates converge. Educational only, not advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LocationBars({ res, sel, onSelect, winner }: { res: Record<Strat, { end: number }>; sel: Strat; onSelect: (s: Strat) => void; winner: Strat }) {
  const width = 760, height = 360;
  const pad = { top: 28, right: 18, bottom: 52, left: 66 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const bars = STRATS.map((s) => ({ ...s, value: res[s.key].end }));
  const maxV = Math.max(...bars.map((b) => b.value)) * 1.16 || 1;
  const minV = Math.min(...bars.map((b) => b.value));
  const y = (v: number) => pad.top + plotH - (v / maxV) * plotH;
  const bandW = plotW / bars.length;
  const barW = Math.min(150, bandW * 0.5);
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="After-tax wealth by asset-location strategy">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={pad.left} x2={width - pad.right} y1={y(maxV * f)} y2={y(maxV * f)} stroke="var(--color-border)" />
          <text x={pad.left - 6} y={y(maxV * f) + 4} textAnchor="end" style={axisText}>{moneyC(maxV * f)}</text>
        </g>
      ))}
      {bars.map((b, i) => {
        const cx = pad.left + bandW * i + bandW / 2;
        const active = b.key === sel;
        return (
          <g key={b.key} style={{ cursor: "pointer" }} onClick={() => onSelect(b.key)}>
            <rect x={cx - barW / 2} y={y(b.value)} width={barW} height={pad.top + plotH - y(b.value)} rx={6} fill={b.color} opacity={active ? 1 : 0.5} />
            {b.key === winner && winner !== "even" && (
              <text x={cx} y={y(b.value) - 26} textAnchor="middle" style={{ ...axisText, fill: "var(--color-accent)", fontWeight: 700, fontSize: 12 }}>✓ best here</text>
            )}
            <text x={cx} y={y(b.value) - 10} textAnchor="middle" style={{ ...axisText, fill: "var(--color-text)", fontWeight: 700, fontSize: 15 }}>{moneyC(b.value)}</text>
            <text x={cx} y={height - pad.bottom + 20} textAnchor="middle" style={{ ...axisText, fill: active ? "var(--color-text)" : "var(--color-muted)", fontWeight: active ? 700 : 600, fontSize: 13 }}>{b.short}</text>
            <text x={cx} y={height - pad.bottom + 36} textAnchor="middle" style={axisText}>{b.label}</text>
          </g>
        );
      })}
      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        After-tax wealth after the full run · spread {(((Math.max(...bars.map(b=>b.value)) - minV) / (minV||1)) * 100).toFixed(1)}% top to bottom
      </text>
    </svg>
  );
}
