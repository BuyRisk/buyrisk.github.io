import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { formatMoney, useCurrencyCode } from "../lib/currency";
import { activeShare } from "../data/generated/active-share";
import { fundOverlap } from "../data/generated/fund-overlap";

/**
 * "Closet Indexing: Are You Overpaying?" — a fund's Active Share is the fraction
 * of its holdings that differ from its benchmark index (Cremers & Petajisto
 * 2009). The rest is an index clone you could buy for a few basis points.
 *
 * The punchline is Petajisto's "fee on active share": if a fund charges expense
 * ratio E and only a fraction AS of it is genuinely active, the fee on the part
 * that's actually doing something is (E − indexCost) / AS. A 1% fund that's only
 * 30% active is charging ~3% on its real stock-picking — for holdings you could
 * index for ~0.05%. Low Active Share + active fees = a closet indexer, the worst
 * value in funds.
 *
 * The calculator is exact arithmetic (no data needed); the backdrop chart is real
 * reduced data from Petajisto's Active Share dataset. Educational only, not advice.
 */

const DEFAULTS = { expense: 0.75, active: 55, indexCost: 0.05, amount: 25_000 };
const pct = (x: number, dp = 2) => `${x.toFixed(dp)}%`;

type Category = { key: string; label: string; color: string; note: string };
function categorize(asFrac: number): Category {
  if (asFrac < 0.2)
    return { key: "index", label: "Index fund territory", color: "var(--color-muted)",
      note: "Barely differs from the benchmark — fine if it's priced like an index fund, alarming if it isn't." };
  if (asFrac < 0.6)
    return { key: "closet", label: "Closet indexer", color: "var(--color-warn)",
      note: "The danger zone: active fees for near-index holdings. Most of what you pay for buys index exposure you could get for pennies." };
  if (asFrac < 0.8)
    return { key: "moderate", label: "Moderately active", color: "var(--color-link)",
      note: "Meaningfully different from the index — the fee is buying real, if measured, active management." };
  return { key: "active", label: "Truly active — a stock picker", color: "var(--color-accent)",
    note: "Genuinely different from the benchmark. Whether it's worth it is the active-vs-passive question, but at least you're paying for real bets." };
}

type CiMode = "fee" | "overlap";

function CiModeTabs({ mode, setMode }: { mode: CiMode; setMode: (m: CiMode) => void }) {
  return (
    <div className="wl-simmode" role="group" aria-label="View" style={{ marginBottom: "var(--space-sm)" }}>
      <button type="button" className={mode === "fee" ? "active" : ""} aria-pressed={mode === "fee"} onClick={() => setMode("fee")}>
        The fee X-ray
      </button>
      <button type="button" className={mode === "overlap" ? "active" : ""} aria-pressed={mode === "overlap"} onClick={() => setMode("overlap")}>
        The overlap X-ray
      </button>
    </div>
  );
}

export default function ClosetIndexingLab() {
  useCurrencyCode(); // re-render when the header currency picker changes
  const [mode, setMode] = useState<CiMode>("fee");
  const [expense, setExpense] = useState(DEFAULTS.expense);
  const [active, setActive] = useState(DEFAULTS.active);
  const [indexCost, setIndexCost] = useState(DEFAULTS.indexCost);
  const [amount, setAmount] = useState(DEFAULTS.amount);

  const calc = useMemo(() => {
    const asFrac = Math.max(0.001, active / 100);
    const premium = Math.max(0, expense - indexCost); // fee above a cheap index fund
    const activeFee = premium / asFrac; // Petajisto's fee on active share
    const clone = 1 - asFrac; // the index-like slice
    // What the index-like slice costs you above simply indexing it, per year:
    const wasteRate = (clone * premium) / 100; // fraction of the whole portfolio
    const wasteDollars = amount * wasteRate;
    const totalFeeDollars = (amount * expense) / 100;
    const cat = categorize(asFrac);
    return { asFrac, premium, activeFee, clone, wasteRate, wasteDollars, totalFeeDollars, cat };
  }, [expense, active, indexCost, amount]);

  const reset = () => {
    setExpense(DEFAULTS.expense);
    setActive(DEFAULTS.active);
    setIndexCost(DEFAULTS.indexCost);
    setAmount(DEFAULTS.amount);
  };

  const asPct = Math.round(calc.asFrac * 100);
  const clonePct = 100 - asPct;

  if (mode === "overlap") return <OverlapView mode={mode} setMode={setMode} />;

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={reset} />
        <CiModeTabs mode={mode} setMode={setMode} />

        <label className="wl-slider">
          <span>
            Fund's expense ratio
            <InfoTip text="The fund's annual fee, as a percent of assets. Active US equity funds commonly charge 0.5–1.2%; a broad index fund charges roughly 0.03–0.10%." />{" "}
            <strong>{pct(expense)}</strong>
          </span>
          <input type="range" min={0.1} max={2} step={0.05} value={expense} onChange={(e) => setExpense(+e.target.value)} />
        </label>

        <label className="wl-slider">
          <span>
            Active Share
            <InfoTip text="The fraction of the fund's holdings that differ from its benchmark index (Cremers & Petajisto 2009). 0% = a perfect index clone; 100% = shares nothing with the index. Below ~60% for a diversified large-cap fund is closet-indexing territory." />{" "}
            <strong>{asPct}%</strong>
          </span>
          <input type="range" min={5} max={100} step={1} value={active} onChange={(e) => setActive(+e.target.value)} />
        </label>

        <label className="wl-slider">
          <span>
            Cost of the index alternative
            <InfoTip text="What the same broad-market exposure costs in a cheap index fund. The index-like part of your active fund could be bought for about this much." />{" "}
            <strong>{pct(indexCost)}</strong>
          </span>
          <input type="range" min={0.01} max={0.3} step={0.01} value={indexCost} onChange={(e) => setIndexCost(+e.target.value)} />
        </label>

        <label className="wl-slider">
          <span>
            Amount invested <InfoTip text="Used only to translate the fee percentages into dollars per year. Scales linearly." /> <strong>{formatMoney(amount)}</strong>
          </span>
          <input type="range" min={1000} max={500000} step={1000} value={amount} onChange={(e) => setAmount(+e.target.value)} />
        </label>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">On the part of this fund that's actually active, you're paying</span>
          <span className="ss-headline-value">{calc.activeFee >= 100 ? "∞" : pct(calc.activeFee, calc.activeFee >= 10 ? 1 : 2)}</span>
          <span className="ss-headline-sub">
            per year — vs. its <strong>{pct(expense)}</strong> headline fee. {calc.asFrac < 0.2 && <>Almost none of it is active, so the effective active fee explodes. </>}
            The lower the Active Share, the more the real fee balloons.
          </span>
        </div>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          <strong>Method:</strong> fee on active share = (expense ratio − index cost) ÷ Active Share (Petajisto 2013).
          The index-like slice (1 − Active Share) is charged {pct(expense)} but could be indexed for {pct(indexCost)}.
          Exact arithmetic; no market forecast. Educational only, not advice.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>What your fee actually buys</h3>
          <SplitBar clonePct={clonePct} asPct={asPct} activeColor={calc.cat.color} />
          <div className="wl-flegend">
            <span><span className="wl-fdot" style={{ background: "var(--color-muted)" }} /> Index clone ({clonePct}%) — buyable for {pct(indexCost)}</span>
            <span><span className="wl-fdot" style={{ background: calc.cat.color }} /> Truly active ({asPct}%) — what you're really paying for</span>
          </div>
          <p className="wl-fnote">
            You pay the full <strong>{pct(expense)}</strong> on the whole fund, but{" "}
            <strong>{clonePct}%</strong> of it just tracks the index. Strip that out and the fee lands entirely on the{" "}
            <strong>{asPct}%</strong> that's genuinely active — which is why the effective active fee is so much larger
            than the sticker price.
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <dl className="ss-stats">
              <div><dt>Headline expense ratio</dt><dd>{pct(expense)}</dd></div>
              <div><dt>Fee on the active part</dt><dd>{calc.activeFee >= 100 ? "∞" : pct(calc.activeFee, 1)}</dd></div>
              <div><dt>Total fee / yr</dt><dd>{formatMoney(calc.totalFeeDollars)}</dd></div>
              <div><dt>Overpaid on the index part / yr</dt><dd>{formatMoney(calc.wasteDollars)}</dd></div>
            </dl>
            <p className="cl-verdict" style={{ color: calc.cat.color }}>
              <strong>{calc.cat.label}.</strong> {calc.cat.note}
            </p>
            <p className="wl-saved">
              Of your {formatMoney(calc.totalFeeDollars)} annual fee, about{" "}
              <strong>{formatMoney(calc.wasteDollars)}</strong> is buying index exposure you could get for{" "}
              {pct(indexCost)} — a pure overpayment on the {clonePct}% of the fund that hugs the benchmark. The active
              management you're actually paying for costs an effective{" "}
              <strong>{calc.activeFee >= 100 ? "essentially unlimited" : pct(calc.activeFee, 1)}</strong>. A genuine
              stock-picker's active fee looks a lot like its sticker price; a closet indexer's is a multiple of it. That's
              the tell. Educational only, not advice.
            </p>
          </div>
        </div>
      </div>

      <EvidencePanel />
    </div>
  );
}

function SplitBar({ clonePct, asPct, activeColor }: { clonePct: number; asPct: number; activeColor: string }) {
  return (
    <div
      role="img"
      aria-label={`Portfolio split: ${clonePct}% index clone, ${asPct}% truly active`}
      style={{ display: "flex", width: "100%", height: "2.6rem", borderRadius: "var(--radius)", overflow: "hidden", border: "var(--border)" }}
    >
      <div style={{ width: `${clonePct}%`, background: "var(--color-muted)", opacity: 0.35, display: "grid", placeItems: "center" }}>
        {clonePct >= 12 && <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--step--1)", fontWeight: 700, color: "var(--color-text)" }}>{clonePct}%</span>}
      </div>
      <div style={{ width: `${asPct}%`, background: activeColor, display: "grid", placeItems: "center" }}>
        {asPct >= 12 && <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--step--1)", fontWeight: 700, color: "var(--color-surface)" }}>{asPct}%</span>}
      </div>
    </div>
  );
}

/** Real reduced data: asset-weighted Active Share and the closet-indexed share of
 *  assets over time, from Petajisto's dataset. */
function EvidencePanel() {
  const data = activeShare.byYear;
  const width = 760, height = 300;
  const pad = { top: 18, right: 18, bottom: 40, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const [y0, y1] = activeShare.span;
  const x = (yr: number) => pad.left + ((yr - y0) / (y1 - y0)) * plotW;
  const y = (v: number) => pad.top + plotH - v * plotH; // v in [0,1]
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;
  const line = (sel: (d: (typeof data)[number]) => number) =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(d.year).toFixed(1)},${y(sel(d)).toFixed(1)}`).join(" ");
  const closetArea = `${line((d) => d.closetShare)} L${x(y1).toFixed(1)},${y(0).toFixed(1)} L${x(y0).toFixed(1)},${y(0).toFixed(1)} Z`;
  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const xTicks = [1980, 1990, 2000, activeShare.latestYear];
  const first = data[0], last = data[data.length - 1];

  return (
    <div className="wl-evidence" style={{ marginTop: "var(--space-lg)" }}>
      <h3>This really happened: the rise of closet indexing</h3>
      <p className="wl-fnote" style={{ marginTop: 0 }}>
        Not hypothetical. Across US equity mutual funds, the asset-weighted Active Share fell from{" "}
        <strong>{Math.round(first.meanActiveShare * 100)}%</strong> in {first.year} to{" "}
        <strong>{Math.round(last.meanActiveShare * 100)}%</strong> by {last.year}, while the share of assets in closet
        indexers (Active Share under {Math.round(activeShare.closetThreshold * 100)}%) climbed from near zero to{" "}
        <strong>{Math.round(last.closetShare * 100)}%</strong>.
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Asset-weighted Active Share and closet-indexed share of assets, 1980 to 2009">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="var(--color-border)" opacity={0.5} />
            <text x={pad.left - 6} y={y(t) + 3} textAnchor="end" style={axisText}>{Math.round(t * 100)}%</text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={x(t)} y={height - 18} textAnchor="middle" style={axisText}>{t}</text>
        ))}
        <path d={closetArea} fill="var(--color-warn)" opacity={0.14} />
        <path d={line((d) => d.closetShare)} fill="none" stroke="var(--color-warn)" strokeWidth={2.4} />
        <path d={line((d) => d.meanActiveShare)} fill="none" stroke="var(--color-accent)" strokeWidth={2.6} />
        <text x={pad.left + plotW / 2} y={height - 2} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
          US equity mutual funds · {first.year}–{last.year}
        </text>
      </svg>
      <div className="wl-flegend">
        <span><span className="wl-fdot" style={{ background: "var(--color-accent)" }} /> Asset-weighted Active Share</span>
        <span><span className="wl-fdot" style={{ background: "var(--color-warn)" }} /> Share of assets in closet indexers</span>
      </div>
      <p className="wl-note" style={{ marginTop: "0.5rem" }}>
        Source: {activeShare.source} Index funds excluded. {activeShare.citation}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The overlap X-ray: how much of two "different" funds is the same portfolio.
// ---------------------------------------------------------------------------

const FO = fundOverlap;
const pc0 = (x: number | null) => `${Math.round((x ?? 0) * 100)}%`;

function OverlapView({ mode, setMode }: { mode: CiMode; setMode: (m: CiMode) => void }) {
  const [sel, setSel] = useState(0);
  const me = FO.funds[sel];
  const others = FO.funds
    .map((f, i) => ({ ...f, i, overlap: FO.matrix[sel][i] ?? 0 }))
    .filter((f) => f.i !== sel)
    .sort((a, b) => b.overlap - a.overlap);
  const top = others[0];

  return (
    <div className="wl">
      <div className="wl-controls">
        <CiModeTabs mode={mode} setMode={setMode} />
        <label className="wl-slider" style={{ gap: "0.4rem" }}>
          <span>
            Your fund
            <InfoTip text="The twelve largest actively managed US equity mutual funds by reported assets. Pick the one you (hypothetically) own." />
          </span>
          <select className="wl-select" value={sel} onChange={(e) => setSel(+e.target.value)}>
            {FO.funds.map((f, i) => (
              <option key={f.name} value={i}>{f.name}</option>
            ))}
          </select>
        </label>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">Add {top.name} as your "second" fund and</span>
          <span className="ss-headline-value">{pc0(top.overlap)}</span>
          <span className="ss-headline-sub">
            of the two portfolios is the <strong>same stocks at the same weights</strong> — one bet wearing two names.
          </span>
        </div>

        <dl className="ss-stats" style={{ marginTop: "var(--space-sm)" }}>
          <div><dt>{me.name}'s holdings</dt><dd>{me.nHoldings} stocks</dd></div>
          <div><dt>Its overlap with the S&amp;P 500</dt><dd>{pc0(me.spOverlap)}</dd></div>
          <div><dt>Median overlap, any two of the 12</dt><dd>{pc0(FO.medianPairOverlap)}</dd></div>
          <div><dt>Most-similar pair overall</dt><dd>{pc0(FO.maxPairOverlap)}</dd></div>
        </dl>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          <strong>Method:</strong> overlap = Σ min(wᵢ, wⱼ) across every stock — the share of two portfolios
          invested identically. Holdings: Thomson s12 quarterly filings, {FO.asOf}; S&amp;P 500 weights from CRSP
          constituents the same day. Educational only, not advice.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>How much of each big fund is your fund?</h3>
          <div className="spv-rank">
            {others.map((f) => (
              <div key={f.name} className="spv-row" style={{ cursor: "default" }}>
                <span className="spv-row-name">{f.name}</span>
                <span className="spv-row-track">
                  <span className="spv-row-fill" style={{ width: `${(f.overlap / 0.8) * 100}%`, background: "var(--color-accent)", opacity: 0.4 + 0.6 * (f.overlap / (FO.maxPairOverlap ?? 1)) }} />
                </span>
                <span className="spv-row-val">{pc0(f.overlap)}</span>
              </div>
            ))}
            <div className="spv-row" style={{ cursor: "default" }}>
              <span className="spv-row-name" style={{ fontWeight: 700 }}>S&amp;P 500 index</span>
              <span className="spv-row-track">
                <span className="spv-row-fill" style={{ width: `${((me.spOverlap ?? 0) / 0.8) * 100}%`, background: "var(--color-link)" }} />
              </span>
              <span className="spv-row-val">{pc0(me.spOverlap)}</span>
            </div>
          </div>
          <p className="wl-fnote">
            Each bar: the share of {me.name} and that fund that is the <em>same portfolio</em>. The blue bar
            is its overlap with the plain S&amp;P 500 — the part you could own for ~0.03%/yr.
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <p className="wl-saved">
              Buying a second (or third) big active fund feels like diversifying, but any two of these twelve
              giants typically hold <strong>{pc0(FO.medianPairOverlap)}</strong> of the same portfolio — they all
              fish in the same large-cap pond. Owning several doesn't add new bets; it <strong>averages the
              managers into an expensive index fund</strong>, which is the closet-indexing trap the fee X-ray
              prices out. If two funds overlap {pc0(FO.maxPairOverlap)}, the "diversification" between them is
              mostly an illusion — real diversification comes from owning <em>different things</em> (small caps,
              international, bonds), not different names for the same stocks.{" "}
              <a href="/tools/diversification">See what actually diversifies →</a> Educational only, not advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
