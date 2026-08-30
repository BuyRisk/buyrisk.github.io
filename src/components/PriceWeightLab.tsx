import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";

/**
 * Price weighting vs cap weighting — the Dow's quirk, as a toy you can poke.
 *
 * A price-weighted index (the Dow Jones Industrial Average, born 1896 when
 * Charles Dow averaged prices by hand) weights each stock by its SHARE PRICE —
 * a number that says nothing about company size, and that a stock split
 * changes at will. A cap-weighted index (the S&P 500, and every mainstream
 * index fund) weights by total company value, which splits can't touch.
 *
 * The toy market makes the distortion tactile: the smallest company can
 * dominate a price-weighted index just by having a high sticker price — and
 * one click of a 2-for-1 split (an economic non-event) reshuffles the whole
 * index. Cap weights don't budge.
 */

interface Company {
  key: string;
  name: string;
  price: number; // $ per share
  shares: number; // millions
}

const START: Company[] = [
  { key: "colossus", name: "Colossus Corp", price: 40, shares: 5_000 },
  { key: "megamart", name: "MegaMart", price: 150, shares: 800 },
  { key: "tinytech", name: "TinyTech", price: 900, shares: 50 },
  { key: "steady", name: "SteadyPower", price: 60, shares: 1_500 },
  { key: "bitparts", name: "BitParts", price: 25, shares: 2_000 },
];

const COLORS = ["var(--pl-c1)", "var(--pl-c2)", "var(--pl-c3)", "var(--pl-c4)", "var(--pl-c5)"];

const capOf = (c: Company) => (c.price * c.shares) / 1_000; // $B
const money = (x: number) => `$${x.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function PriceWeightLab() {
  const [companies, setCompanies] = useState<Company[]>(START);
  const [splits, setSplits] = useState(0);

  const split = (key: string) => {
    setCompanies((prev) => prev.map((c) => (c.key === key ? { ...c, price: c.price / 2, shares: c.shares * 2 } : c)));
    setSplits((s) => s + 1);
  };

  const view = useMemo(() => {
    const priceSum = companies.reduce((s, c) => s + c.price, 0);
    const capSum = companies.reduce((s, c) => s + capOf(c), 0);
    const rows = companies.map((c, i) => ({
      ...c,
      color: COLORS[i],
      cap: capOf(c),
      priceW: c.price / priceSum,
      capW: capOf(c) / capSum,
    }));
    const dominant = [...rows].sort((a, b) => b.priceW - a.priceW)[0];
    const capRank = [...rows].sort((a, b) => b.cap - a.cap).findIndex((r) => r.key === dominant.key) + 1;
    // One day's index move if the price-dominant stock rallies 5%.
    const idxMovePrice = dominant.priceW * 0.05;
    const idxMoveCap = dominant.capW * 0.05;
    return { rows, dominant, capRank, idxMovePrice, idxMoveCap };
  }, [companies]);

  const ord = (n: number) => (n === 1 ? "biggest" : n === 2 ? "2nd-biggest" : n === 3 ? "3rd-biggest" : `${n}th-biggest`);

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={() => { setCompanies(START); setSplits(0); }} />

        <p className="br-group">A five-stock market</p>
        {view.rows.map((c) => (
          <div key={c.key} style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontFamily: "var(--font-sans)", fontSize: "var(--step--1)" }}>
            <span className="br-dot" style={{ background: c.color }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <strong>{c.name}</strong>{" "}
              <span style={{ color: "var(--color-muted)" }}>
                {money(c.price)}/sh · {c.shares.toLocaleString()}M shares · {money(c.cap)}B company
              </span>
            </span>
            <button type="button" className="wl-chip" onClick={() => split(c.key)} title="2-for-1 split: half the price, twice the shares — the company's value doesn't change by a cent.">
              Split 2:1
            </button>
          </div>
        ))}

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">
            {view.dominant.name} — the {ord(view.capRank)} company of five — carries
          </span>
          <span className="ss-headline-value" style={{ color: view.dominant.priceW > view.dominant.capW * 1.5 ? "var(--color-warn)" : "var(--color-accent)" }}>
            {(view.dominant.priceW * 100).toFixed(0)}%
          </span>
          <span className="ss-headline-sub">
            of the price-weighted index (vs {(view.dominant.capW * 100).toFixed(0)}% by company size).
            {splits === 0
              ? " Now click a split — an economic nothing — and watch the top bar lurch while the bottom one holds still."
              : ` After ${splits} split${splits > 1 ? "s" : ""}: the companies are worth exactly what they were, but the price-weighted index has been reshuffled.`}
          </span>
        </div>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          This is why the Dow (price-weighted since 1896, when averaging a few prices by hand was
          the only practical option) is a historical curiosity, while every mainstream index fund
          weights by company value: cap weights adjust themselves, can't be gamed by a split, and
          mirror what the market actually owns. Educational only.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>The same five companies, two indexes</h3>
          <WeightBars title="Price-weighted (the Dow's method)" rows={view.rows} get={(r) => r.priceW} />
          <WeightBars title="Cap-weighted (the S&P's method — and your index fund's)" rows={view.rows} get={(r) => r.capW} />
          <p className="wl-fnote">
            If {view.dominant.name} rallies 5% tomorrow, the price-weighted index jumps{" "}
            {(view.idxMovePrice * 100).toFixed(1)}% — the cap-weighted one moves{" "}
            {(view.idxMoveCap * 100).toFixed(1)}%. Same market, same news; the difference is purely
            which arbitrary number does the weighting. A share price alone tells you nothing about a
            company's size — only price × shares does.
          </p>
        </div>
      </div>
    </div>
  );
}

function WeightBars({ title, rows, get }: {
  title: string;
  rows: { name: string; color: string }[] & any[];
  get: (r: any) => number;
}) {
  return (
    <div style={{ margin: "0.6rem 0" }}>
      <p style={{ margin: "0 0 0.3rem", fontFamily: "var(--font-sans)", fontSize: "var(--step--1)", fontWeight: 600, color: "var(--color-text-soft)" }}>{title}</p>
      <div style={{ display: "flex", width: "100%", height: 42, borderRadius: 8, overflow: "hidden" }} role="img" aria-label={title}>
        {rows.map((r) => (
          <div
            key={r.name}
            title={`${r.name}: ${(get(r) * 100).toFixed(1)}%`}
            style={{
              width: `${get(r) * 100}%`,
              background: r.color,
              transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--color-surface)", fontFamily: "var(--font-sans)", fontSize: "0.72rem", fontWeight: 700,
              whiteSpace: "nowrap", overflow: "hidden",
            }}
          >
            {get(r) > 0.11 ? `${r.name.split(" ")[0]} ${(get(r) * 100).toFixed(0)}%` : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
