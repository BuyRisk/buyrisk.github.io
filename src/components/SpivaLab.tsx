import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { spiva } from "../data/generated/spiva";

/**
 * "Can Active Managers Beat the Market?" — the SPIVA scorecard made interactive.
 * Pick a fund category and a time horizon and see the share of professional,
 * actively managed funds that FAILED to beat their benchmark. The signature
 * result: the longer the horizon, the higher the failure rate — and it's
 * pervasive across stocks and bonds, US and abroad. Educational only, not advice.
 */

const DEFAULT_CAT = "large-cap";
const DEFAULT_HORIZON = 10;

const groupColor = (id: string) =>
  ({ "us-equity": "var(--pl-c1)", "intl-equity": "var(--pl-c3)", "fixed-income": "var(--pl-c5)" }[id] ?? "var(--color-accent)");

/** Flatten every category with a reference back to its group. */
const ALL = spiva.groups.flatMap((g) => g.categories.map((c) => ({ ...c, groupId: g.id, groupLabel: g.label })));
const findCat = (id: string) => ALL.find((c) => c.id === id)!;
const rateAt = (c: (typeof ALL)[number], horizon: number) => c.rates[spiva.horizons.indexOf(horizon)];

export default function SpivaLab() {
  const [catId, setCatId] = useState(DEFAULT_CAT);
  const [horizon, setHorizon] = useState(DEFAULT_HORIZON);

  const cat = findCat(catId);
  const view = useMemo(() => {
    const rate = rateAt(cat, horizon);
    // Staircase: horizons this category actually reports.
    const stair = spiva.horizons.map((h) => ({ h, rate: rateAt(cat, h) })).filter((p) => p.rate != null) as { h: number; rate: number }[];
    const oneYr = rateAt(cat, 1);
    const longest = [...stair].reverse()[0];
    // Ranked comparison of all categories at the selected horizon.
    const ranked = ALL.map((c) => ({ id: c.id, name: c.name, groupId: c.groupId, rate: rateAt(c, horizon) }))
      .filter((c) => c.rate != null)
      .sort((a, b) => (b.rate as number) - (a.rate as number)) as { id: string; name: string; groupId: string; rate: number }[];
    return { rate, stair, oneYr, longest, ranked };
  }, [catId, horizon]);

  // If the chosen horizon isn't reported for this category, fall back gracefully.
  const rateShown = view.rate;

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={() => { setCatId(DEFAULT_CAT); setHorizon(DEFAULT_HORIZON); }} />

        <label className="wl-slider" style={{ gap: "0.4rem" }}>
          <span>
            Fund category
            <InfoTip text="A group of actively managed mutual funds, each compared against the index that best matches its investing style." />
          </span>
          <select className="wl-select" value={catId} onChange={(e) => setCatId(e.target.value)}>
            {spiva.groups.map((g) => (
              <optgroup key={g.id} label={g.label}>
                {g.categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <div className="wl-field">
          <span className="wl-field-label">
            Time horizon
            <InfoTip text="How long the funds are measured over. Longer horizons are the real test: beating the market for one lucky year is easy; doing it for 20 is not." />
          </span>
          <div className="wl-simmode wl-simmode--wrap" role="group" aria-label="Time horizon">
            {spiva.horizons.map((h) => (
              <button key={h} type="button" className={horizon === h ? "active" : ""} aria-pressed={horizon === h} onClick={() => setHorizon(h)}>
                {h}y
              </button>
            ))}
          </div>
        </div>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">Over {horizon} years, this share of {cat.name.toLowerCase()}</span>
          <span className="ss-headline-value">{rateShown == null ? "—" : `${rateShown.toFixed(1)}%`}</span>
          <span className="ss-headline-sub">
            {rateShown == null ? "not reported at this horizon" : <>failed to beat the <strong>{cat.benchmark}</strong></>}
          </span>
        </div>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          These are professional, full-time managers. The longer the clock runs, the more of
          them fall behind a simple index — the core reason low-cost index funds are so hard
          to beat. Data: S&P Dow Jones Indices SPIVA U.S. Scorecard, {spiva.asOf}.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>{cat.name}: failure rate grows with the horizon</h3>
          <HorizonChart stair={view.stair} horizon={horizon} color={groupColor(cat.groupId)} />
          <p className="wl-fnote">
            Each bar is the percent of <strong>{cat.name.toLowerCase()}</strong> that trailed the{" "}
            <strong>{cat.benchmark}</strong> over that span. Above the dashed 50% line, a
            coin-flip would have beaten most active managers. {view.oneYr != null && view.longest ? (
              <>Over one year, {view.oneYr.toFixed(0)}% lagged; over {view.longest.h} years, {view.longest.rate.toFixed(0)}% did.</>
            ) : null}
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <h3 style={{ marginTop: 0 }}>Every category at {horizon} years</h3>
            <RankedList ranked={view.ranked} selectedId={catId} onPick={setCatId} />
            <p className="wl-saved">
              It isn't one corner of the market. Across US and international stocks and bonds,
              most active funds underperform their benchmark over {horizon} years — and the gap
              widens the longer you look. This is the evidence behind indexing: you can't
              reliably pick the rare winners in advance, so owning the whole market cheaply is
              the durable bet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HorizonChart({ stair, horizon, color }: { stair: { h: number; rate: number }[]; horizon: number; color: string }) {
  const width = 760;
  const height = 360;
  const pad = { top: 26, right: 18, bottom: 40, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const n = stair.length;
  const bandW = plotW / n;
  const barW = Math.min(74, bandW * 0.6);
  const y = (v: number) => pad.top + plotH - (v / 100) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Percent of funds underperforming their benchmark by time horizon">
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeDasharray={v === 50 ? "5 4" : undefined} />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{v}%</text>
        </g>
      ))}
      <text x={width - pad.right} y={y(50) - 6} textAnchor="end" style={{ ...axisText, fontStyle: "italic" }}>
        coin-flip line
      </text>

      {stair.map((p, i) => {
        const cx = pad.left + bandW * i + bandW / 2;
        const sel = p.h === horizon;
        return (
          <g key={p.h}>
            <rect
              x={cx - barW / 2}
              y={y(p.rate)}
              width={barW}
              height={pad.top + plotH - y(p.rate)}
              rx={4}
              fill={color}
              opacity={sel ? 1 : 0.42}
            />
            <text x={cx} y={y(p.rate) - 7} textAnchor="middle" style={{ ...axisText, fill: "var(--color-text)", fontWeight: sel ? 700 : 600, fontSize: sel ? 14 : 12 }}>
              {p.rate.toFixed(0)}%
            </text>
            <text x={cx} y={height - pad.bottom + 18} textAnchor="middle" style={{ ...axisText, fontWeight: sel ? 700 : 400, fill: sel ? "var(--color-text)" : "var(--color-muted)" }}>
              {p.h} yr
            </text>
          </g>
        );
      })}
      <text x={pad.left + plotW / 2} y={height - 6} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Percent of active funds that underperformed · longer horizon → worse
      </text>
    </svg>
  );
}

function RankedList({ ranked, selectedId, onPick }: { ranked: { id: string; name: string; groupId: string; rate: number }[]; selectedId: string; onPick: (id: string) => void }) {
  const max = 100;
  return (
    <div className="spv-rank">
      {ranked.map((c) => {
        const sel = c.id === selectedId;
        return (
          <button key={c.id} type="button" className={`spv-row${sel ? " spv-row--sel" : ""}`} onClick={() => onPick(c.id)} aria-pressed={sel}>
            <span className="spv-row-name">{c.name}</span>
            <span className="spv-row-track">
              <span className="spv-row-fill" style={{ width: `${(c.rate / max) * 100}%`, background: groupColor(c.groupId), opacity: sel ? 1 : 0.55 }} />
            </span>
            <span className="spv-row-val">{c.rate.toFixed(0)}%</span>
          </button>
        );
      })}
    </div>
  );
}
