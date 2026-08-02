import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { housing } from "../data/generated/housing";

/**
 * "Rent or Buy?": a fair, opportunity-cost-aware comparison. Instead of pitting
 * a mortgage payment against rent, it runs two parallel lives: a buyer and a
 * renter who spend the SAME amount each month, with the cheaper one investing the
 * difference and the renter keeping the down payment invested. It then tracks each
 * one's net worth over time and finds the break-even year. Real mortgage and
 * Case-Shiller data set the defaults, and show that the appreciation assumption
 * the answer hinges on most is also the most uncertain. Educational only.
 */

const HIST_APPRECIATION = +(housing.homePrices.cagr * 100).toFixed(1); // ~4.3%

const DEFAULTS = {
  price: 400_000,
  downPct: 20,
  rate: housing.mortgage.latest, // latest 30-yr fixed
  term: 30,
  rent: 2_200,
  years: 7,
  appreciation: HIST_APPRECIATION,
  rentGrowth: 3,
  investReturn: 7,
  propTax: 1.1,
  maintenance: 1,
  insurance: 0.5,
  buyClosing: 2,
  sellClosing: 6,
  hoa: 0,
};

type Inputs = typeof DEFAULTS;

const dollars = (n: number) =>
  (n < 0 ? "-" : "") +
  Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = (n: number, dp = 1) => `${n.toFixed(dp)}%`;

interface SimPoint { year: number; buyer: number; renter: number; }
interface SimResult {
  path: SimPoint[];
  buyerFinal: number;
  renterFinal: number;
  diff: number; // buyer - renter at horizon
  breakevenYear: number | null; // first year buyer NW >= renter NW
  totalRent: number;
  totalOwnerCost: number;
  buyerEquity: number;
  renterPortfolio: number;
  priceToRent: number;
}

function simulate(inp: Inputs): SimResult {
  const months = Math.round(inp.years * 12);
  const loan = inp.price * (1 - inp.downPct / 100);
  const upfront = inp.price * (inp.downPct / 100) + inp.price * (inp.buyClosing / 100);
  const mr = inp.rate / 100 / 12;
  const T = inp.term * 12;
  const payment = mr > 0 ? (loan * mr) / (1 - Math.pow(1 + mr, -T)) : loan / T;
  const invM = Math.pow(1 + inp.investReturn / 100, 1 / 12) - 1;
  const appM = Math.pow(1 + inp.appreciation / 100, 1 / 12) - 1;

  let balance = loan;
  let homeValue = inp.price;
  let rent = inp.rent;
  let renterPort = upfront; // renter keeps the buyer's upfront cash invested
  let buyerSide = 0; // buyer invests any month where owning is cheaper than renting
  let totalRent = 0;
  let totalOwnerCost = 0;

  // At t=0 both have committed `upfront` cash: the buyer's is home equity (just the
  // down payment, since closing costs are sunk), the renter's is invested. So the buyer
  // starts behind by the closing costs, which is exactly right.
  const path: SimPoint[] = [{ year: 0, buyer: inp.price * (inp.downPct / 100), renter: upfront }];

  let breakevenMonth: number | null = null;

  for (let m = 1; m <= months; m++) {
    const interest = balance * mr;
    let principal = payment - interest;
    let pi = payment;
    if (principal >= balance) {
      // final payment: only what's left
      principal = balance;
      pi = balance + interest;
    }
    balance = Math.max(0, balance - principal);
    if (balance === 0 && principal <= 0) pi = 0; // loan already paid off

    const propTax = (homeValue * (inp.propTax / 100)) / 12;
    const maint = (homeValue * (inp.maintenance / 100)) / 12;
    const ins = (homeValue * (inp.insurance / 100)) / 12;
    const ownerCost = pi + propTax + maint + ins + inp.hoa;

    totalRent += rent;
    totalOwnerCost += ownerCost;

    // Equalize monthly cash outflow: the cheaper party invests the difference.
    const diff = ownerCost - rent;
    if (diff > 0) renterPort += diff;
    else buyerSide += -diff;

    // Grow investments, appreciate home.
    renterPort *= 1 + invM;
    buyerSide *= 1 + invM;
    homeValue *= 1 + appM;
    if (m % 12 === 0) rent *= 1 + inp.rentGrowth / 100;

    const buyerNW = homeValue * (1 - inp.sellClosing / 100) - balance + buyerSide;
    const renterNW = renterPort;
    if (breakevenMonth === null && buyerNW >= renterNW) breakevenMonth = m;

    if (m % 12 === 0) path.push({ year: m / 12, buyer: buyerNW, renter: renterNW });
  }
  // Ensure the final (possibly fractional) year is represented.
  if (path[path.length - 1].year !== inp.years) {
    const buyerNW = homeValue * (1 - inp.sellClosing / 100) - balance + buyerSide;
    path.push({ year: inp.years, buyer: buyerNW, renter: renterPort });
  }

  const last = path[path.length - 1];
  return {
    path,
    buyerFinal: last.buyer,
    renterFinal: last.renter,
    diff: last.buyer - last.renter,
    breakevenYear: breakevenMonth === null ? null : +(breakevenMonth / 12).toFixed(1),
    totalRent,
    totalOwnerCost,
    buyerEquity: homeValue * (1 - inp.sellClosing / 100) - balance,
    renterPortfolio: renterPort,
    priceToRent: inp.price / (inp.rent * 12),
  };
}

const APPR_PRESETS = [
  { label: `Historical avg · ${pct(HIST_APPRECIATION)}`, v: HIST_APPRECIATION },
  { label: "Conservative · 2.0%", v: 2 },
  { label: "Flat · 0.0%", v: 0 },
];

export default function RentVsBuyLab() {
  const [inp, setInp] = useState<Inputs>(DEFAULTS);
  const [showCosts, setShowCosts] = useState(true);
  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) => setInp((s) => ({ ...s, [k]: v }));

  const r = useMemo(() => simulate(inp), [inp]);
  const buyingWins = r.diff >= 0;

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={() => { setInp(DEFAULTS); setShowCosts(true); }} />

        <p className="br-group">The home</p>
        <Slider label="Home price" tip="The purchase price of the home you're considering." value={inp.price} min={100_000} max={1_500_000} step={10_000} fmt={dollars} onChange={(v) => set("price", v)} />
        <Slider label="Down payment" tip="The cash you put down up front. The rest is borrowed. A renter would instead keep this money invested. Its lost growth is the hidden cost of buying." value={inp.downPct} min={0} max={100} step={1} fmt={(v) => pct(v, 0)} onChange={(v) => set("downPct", v)} sub={dollars(inp.price * inp.downPct / 100)} />
        <Slider label="Mortgage rate" tip={`The 30-year fixed rate. Today's average is about ${pct(housing.mortgage.latest, 2)} (Freddie Mac via FRED).`} value={inp.rate} min={2} max={12} step={0.05} fmt={(v) => pct(v, 2)} onChange={(v) => set("rate", v)} />
        <div className="wl-field">
          <span className="wl-field-label">Loan term</span>
          <div className="wl-simmode wl-simmode--wrap" role="group" aria-label="Loan term">
            {[30, 15].map((t) => (
              <button key={t} type="button" className={inp.term === t ? "active" : ""} aria-pressed={inp.term === t} onClick={() => set("term", t)}>{t}-year</button>
            ))}
          </div>
        </div>

        <p className="br-group">Renting instead</p>
        <Slider label="Monthly rent" tip="What it would cost to rent a comparable place today. This is the number to vary. The tool shows whether buying beats renting at this rent." value={inp.rent} min={500} max={8_000} step={50} fmt={dollars} onChange={(v) => set("rent", v)} />

        <p className="br-group">Your assumptions</p>
        <Slider label="Years you'll stay" tip="How long before you'd sell and move. Buying has big upfront and selling costs, so the longer you stay, the more likely buying wins." value={inp.years} min={1} max={30} step={1} fmt={(v) => `${v} yr`} onChange={(v) => set("years", v)} />
        <Slider label="Home appreciation / yr" tip={`How fast the home's value grows. Nationally, prices rose ${pct(HIST_APPRECIATION)}/yr since ${housing.homePrices.startYear}, but this is the single most uncertain input.`} value={inp.appreciation} min={-2} max={10} step={0.1} fmt={pct} onChange={(v) => set("appreciation", v)} />
        <div className="wl-presets">
          <span className="wl-presets-label">Set appreciation to:</span>
          {APPR_PRESETS.map((p) => (
            <button key={p.label} type="button" className="wl-chip" aria-pressed={Math.abs(inp.appreciation - p.v) < 0.05} onClick={() => set("appreciation", p.v)}>{p.label}</button>
          ))}
        </div>
        <Slider label="Rent growth / yr" tip="How fast rent rises each year. Historically rents track inflation, roughly 3%." value={inp.rentGrowth} min={0} max={8} step={0.1} fmt={pct} onChange={(v) => set("rentGrowth", v)} />
        <Slider label="Investment return / yr" tip="What the renter earns by investing the down payment and any monthly savings. A diversified stock/bond portfolio has historically returned around 7%." value={inp.investReturn} min={0} max={12} step={0.1} fmt={pct} onChange={(v) => set("investReturn", v)} />

        <button type="button" className="wl-disclose" aria-expanded={showCosts} onClick={() => setShowCosts((s) => !s)}>
          {showCosts ? "▾" : "▸"} Ownership costs {showCosts ? "" : "(tax, upkeep, closing…)"}
        </button>
        {showCosts && (
          <div className="wl-disclose-body">
            <Slider label="Property tax / yr" tip="Annual property tax as a percent of the home's value. Varies a lot by state. The U.S. average is around 1.1%." value={inp.propTax} min={0} max={3} step={0.05} fmt={(v) => pct(v, 2)} onChange={(v) => set("propTax", v)} />
            <Slider label="Maintenance / yr" tip="Upkeep and repairs, as a percent of home value per year. A common rule of thumb is about 1%." value={inp.maintenance} min={0} max={3} step={0.05} fmt={(v) => pct(v, 2)} onChange={(v) => set("maintenance", v)} />
            <Slider label="Home insurance / yr" tip="Homeowner's insurance as a percent of home value per year, roughly 0.5%." value={inp.insurance} min={0} max={2} step={0.05} fmt={(v) => pct(v, 2)} onChange={(v) => set("insurance", v)} />
            <Slider label="Buying closing costs" tip="One-time costs to purchase (loan fees, title, inspection), as a percent of price, usually 2–4%." value={inp.buyClosing} min={0} max={6} step={0.5} fmt={(v) => pct(v, 1)} onChange={(v) => set("buyClosing", v)} />
            <Slider label="Selling costs" tip="Agent commissions and fees when you sell, as a percent of the sale price, commonly around 6%." value={inp.sellClosing} min={0} max={10} step={0.5} fmt={(v) => pct(v, 1)} onChange={(v) => set("sellClosing", v)} />
            <Slider label="HOA / month" tip="Homeowners-association dues, if any (common for condos). Enter 0 if none." value={inp.hoa} min={0} max={1500} step={25} fmt={dollars} onChange={(v) => set("hoa", v)} />
          </div>
        )}

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">After {inp.years} years, {buyingWins ? "buying" : "renting"} leaves you</span>
          <span className="ss-headline-value">{dollars(Math.abs(r.diff))} ahead</span>
          <span className="ss-headline-sub">
            in net worth vs {buyingWins ? "renting" : "buying"}
            {r.breakevenYear != null ? <> · buying breaks even at ~{r.breakevenYear} yr</> : <> · buying doesn't break even within {inp.years} yr</>}
          </span>
        </div>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>Net worth: buyer vs renter</h3>
          <NetWorthChart path={r.path} breakevenYear={r.breakevenYear} years={inp.years} />
          <p className="wl-fnote">
            Both people spend the same each month; whoever's housing is cheaper invests the
            difference, and the renter keeps the down payment invested. The lines cross at the{" "}
            <strong>break-even</strong>: before it, renting is ahead; after it, buying is.
            {r.breakevenYear != null ? <> Here that's about <strong>{r.breakevenYear} years</strong>.</> : <> Here buying never catches up within your {inp.years}-year stay.</>}
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <dl className="ss-stats">
              <div><dt>Buyer's net worth</dt><dd>{dollars(r.buyerFinal)}</dd></div>
              <div><dt>Renter's net worth</dt><dd>{dollars(r.renterFinal)}</dd></div>
              <div><dt>Price-to-rent ratio</dt><dd>{r.priceToRent.toFixed(1)}</dd></div>
              <div><dt>Break-even</dt><dd>{r.breakevenYear != null ? `~${r.breakevenYear} yr` : `> ${inp.years} yr`}</dd></div>
            </dl>
            <p className="wl-saved">
              The <strong>price-to-rent ratio</strong> ({r.priceToRent.toFixed(1)}) is a quick gut check:
              below about 15, buying tends to win; above ~21, renting usually does. But the answer
              depends most on one guess: <strong>home appreciation</strong>. Nationally prices rose{" "}
              {pct(HIST_APPRECIATION)}/yr since {housing.homePrices.startYear}, yet they fell{" "}
              <strong>{pct(Math.abs(housing.homePrices.worstDrawdown.pct * 100), 0)}</strong> from{" "}
              {housing.homePrices.worstDrawdown.peakYear}–{housing.homePrices.worstDrawdown.troughYear},
              and even over rolling 10-year spans they ranged from{" "}
              {pct(housing.homePrices.rolling10yr.min * 100)} to {pct(housing.homePrices.rolling10yr.max * 100)} a
              year. A home is a leveraged, undiversified bet. Try the "Flat" and downturn cases above
              and watch the break-even move. Educational only, not advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, tip, value, min, max, step, fmt, sub, onChange }: {
  label: string; tip?: string; value: number; min: number; max: number; step: number;
  fmt: (v: number) => string; sub?: string; onChange: (v: number) => void;
}) {
  return (
    <label className="wl-slider">
      <span>
        {label}
        {tip ? <InfoTip text={tip} /> : null} <strong>{fmt(value)}</strong>
        {sub ? <span className="wl-slider-sub"> {sub}</span> : null}
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </label>
  );
}

function NetWorthChart({ path, breakevenYear, years }: { path: SimPoint[]; breakevenYear: number | null; years: number }) {
  const width = 760;
  const height = 380;
  const pad = { top: 18, right: 96, bottom: 34, left: 58 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const vals = path.flatMap((p) => [p.buyer, p.renter]);
  const maxV = Math.max(...vals) * 1.05;
  const minV = Math.min(0, ...vals);
  const x = (yr: number) => pad.left + (yr / (years || 1)) * plotW;
  const y = (v: number) => pad.top + plotH - ((v - minV) / (maxV - minV || 1)) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;
  const money = (v: number) => (Math.abs(v) >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`);

  const line = (key: "buyer" | "renter") => path.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.year)},${y(p[key])}`).join(" ");
  const ticks = [minV, minV + (maxV - minV) * 0.5, maxV].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Buyer and renter net worth over time">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeDasharray={Math.abs(v) < 1 ? "4 3" : undefined} />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{money(v)}</text>
        </g>
      ))}
      {[0, Math.round(years / 2), years].filter((v, i, a) => a.indexOf(v) === i).map((yr) => (
        <text key={yr} x={x(yr)} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>{yr === 0 ? "now" : `yr ${yr}`}</text>
      ))}

      {breakevenYear != null && breakevenYear <= years && (
        <g>
          <line x1={x(breakevenYear)} x2={x(breakevenYear)} y1={pad.top} y2={pad.top + plotH} stroke="var(--color-muted)" strokeDasharray="3 3" />
          <text x={x(breakevenYear)} y={pad.top - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 700, fill: "var(--color-text-soft)" }}>break-even</text>
        </g>
      )}

      <path d={line("renter")} fill="none" stroke="var(--pl-c3)" strokeWidth={2.6} />
      <path d={line("buyer")} fill="none" stroke="var(--color-accent)" strokeWidth={2.6} />

      {(() => {
        const last = path[path.length - 1];
        const labels = [
          { name: "Buy", v: last.buyer, color: "var(--color-accent)" },
          { name: "Rent", v: last.renter, color: "var(--pl-c3)" },
        ];
        return labels.map((l) => (
          <text key={l.name} x={width - pad.right + 6} y={y(l.v) + 4} style={{ ...axisText, fill: l.color, fontWeight: 700, fontSize: 12 }}>{l.name}</text>
        ));
      })()}
      <text x={pad.left + plotW / 2} y={height - 3} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Net worth if you sold and cashed out at each point
      </text>
    </svg>
  );
}
