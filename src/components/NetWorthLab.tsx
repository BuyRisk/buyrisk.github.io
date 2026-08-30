import { useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { formatMoney, currencySymbol, useCurrencyCode } from "../lib/currency";

/**
 * Net-worth snapshot: assets minus liabilities, with a composition view and a
 * rough forward projection (invest $X/mo at Y%, holding other assets and debts
 * flat). Stateless, educational.
 */
const ASSET_FIELDS = [
  { key: "cash", label: "Cash & savings" },
  { key: "investments", label: "Investments & retirement" },
  { key: "home", label: "Home / property" },
  { key: "vehicles", label: "Vehicles" },
  { key: "other", label: "Other assets" },
] as const;
const DEBT_FIELDS = [
  { key: "mortgage", label: "Mortgage" },
  { key: "student", label: "Student loans" },
  { key: "auto", label: "Auto loans" },
  { key: "cards", label: "Credit cards" },
  { key: "other", label: "Other debt" },
] as const;

type AssetKey = (typeof ASSET_FIELDS)[number]["key"];
type DebtKey = (typeof DEBT_FIELDS)[number]["key"];

export default function NetWorthLab() {
  useCurrencyCode();
  const money = (n: number) => formatMoney(n);
  const symbol = currencySymbol();

  const [assets, setAssets] = useState<Record<AssetKey, number>>({ cash: 12000, investments: 45000, home: 320000, vehicles: 18000, other: 5000 });
  const [debts, setDebts] = useState<Record<DebtKey, number>>({ mortgage: 240000, student: 22000, auto: 12000, cards: 4000, other: 0 });
  const [years, setYears] = useState(20);
  const [monthly, setMonthly] = useState(600);
  const [ret, setRet] = useState(6);

  const reset = () => {
    setAssets({ cash: 12000, investments: 45000, home: 320000, vehicles: 18000, other: 5000 });
    setDebts({ mortgage: 240000, student: 22000, auto: 12000, cards: 4000, other: 0 });
    setYears(20); setMonthly(600); setRet(6);
  };

  const totalAssets = Object.values(assets).reduce((s, v) => s + v, 0);
  const totalDebt = Object.values(debts).reduce((s, v) => s + v, 0);
  const net = totalAssets - totalDebt;
  const maxSide = Math.max(totalAssets, totalDebt, 1);
  const debtRatio = totalAssets > 0 ? totalDebt / totalAssets : 0;

  // Rough projection: current investments grow, monthly contributions compound,
  // everything else (home, cash, debts) held flat.
  const rm = ret / 100 / 12;
  const nMonths = years * 12;
  const invFuture = assets.investments * Math.pow(1 + rm, nMonths);
  // Future value of a level monthly contribution (annuity formula):
  // monthly × ((1+r)^n − 1)/r — each deposit compounds for its remaining months.
  const contribFuture = rm === 0 ? monthly * nMonths : monthly * ((Math.pow(1 + rm, nMonths) - 1) / rm);
  const futureNet = net - assets.investments + invFuture + contribFuture;

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={reset} />
        <p className="wl-note" style={{ marginTop: 0 }}>
          Net worth is the single truest number in personal finance: everything you
          own minus everything you owe. It doesn't matter what it is today — what
          matters is the direction. Fill in what you can estimate.
        </p>

        <p className="nw-group">Assets — what you own</p>
        {ASSET_FIELDS.map((f) => (
          <label className="nw-input" key={f.key}>
            <span>{f.label}</span>
            <span className="nw-money">{symbol}<input type="number" min={0} value={assets[f.key]} onChange={(e) => setAssets({ ...assets, [f.key]: Math.max(0, Number(e.target.value)) })} aria-label={f.label} /></span>
          </label>
        ))}
        <p className="nw-group">Liabilities — what you owe</p>
        {DEBT_FIELDS.map((f) => (
          <label className="nw-input" key={f.key}>
            <span>{f.label}</span>
            <span className="nw-money">{symbol}<input type="number" min={0} value={debts[f.key]} onChange={(e) => setDebts({ ...debts, [f.key]: Math.max(0, Number(e.target.value)) })} aria-label={f.label} /></span>
          </label>
        ))}
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <div className="ss-headline">
            <span className="ss-headline-label">Net worth today</span>
            <span className="ss-headline-value" style={net < 0 ? { color: "var(--color-error)" } : undefined}>{money(net)}</span>
            <span className="ss-headline-sub">{money(totalAssets)} in assets − {money(totalDebt)} in debt</span>
          </div>

          <p className="nw-barlabel">Assets</p>
          <div className="nw-bar"><div className="nw-fill nw-fill--asset" style={{ width: `${(totalAssets / maxSide) * 100}%` }} /></div>
          <p className="nw-barlabel">Liabilities</p>
          <div className="nw-bar"><div className="nw-fill nw-fill--debt" style={{ width: `${(totalDebt / maxSide) * 100}%` }} /></div>
          <p className="wl-fnote">
            The goal is a rising green bar and a shrinking red one. A
            debt-to-asset ratio of {(debtRatio * 100).toFixed(0)}% today
            {debtRatio > 0.5 ? " — over half — means debt is a big part of the picture; bringing it down lifts net worth directly." : " leaves room; keep the assets side growing."}
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <h3 style={{ marginTop: 0 }}>Where it could go</h3>
            <label className="wl-slider"><span>Invest per month <strong>{money(monthly)}</strong></span>
              <input type="range" min={0} max={5000} step={50} value={monthly} onChange={(e) => setMonthly(Number(e.target.value))} /></label>
            <label className="wl-slider"><span>Investment return<InfoTip text="A long-run assumption for the investing side. Historically a diversified stock/bond mix has returned mid-single digits after inflation — never guaranteed." /> <strong>{ret}%</strong></span>
              <input type="range" min={0} max={10} step={0.5} value={ret} onChange={(e) => setRet(Number(e.target.value))} /></label>
            <label className="wl-slider"><span>Over <strong>{years} years</strong></span>
              <input type="range" min={1} max={40} step={1} value={years} onChange={(e) => setYears(Number(e.target.value))} /></label>

            <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
              <span className="ss-headline-label">Projected net worth in {years} years</span>
              <span className="ss-headline-value">{money(futureNet)}</span>
              <span className="ss-headline-sub">investing {money(monthly)}/mo at {ret}%, other assets &amp; debts held flat</span>
            </div>
            <p className="wl-saved">
              This is a rough sketch, not a forecast: it grows your investments and new contributions
              and holds everything else still. In reality your home may appreciate, your debts fall, and
              markets zig-zag. But the lesson holds — consistent investing is what bends the net-worth curve
              upward over decades. Educational only, not advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
