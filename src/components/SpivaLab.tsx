import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { spiva } from "../data/generated/spiva";

/**
 * "Can Active Managers Beat the Market?" — the SPIVA scorecard made interactive.
 * Pick a fund category and a time horizon and see the share of professional,
 * actively managed funds that FAILED to beat their benchmark. The signature
 * result: the longer the horizon, the higher the failure rate.
 *
 * SPIVA only reports out to 20 years. Beyond that we EXTRAPOLATE (30–70y) by
 * fitting the decay of the out-performing share and projecting it — always
 * clearly flagged as a model, never presented as reported data. Educational
 * only, not advice.
 */

const DEFAULT_CAT = "large-cap";
const DEFAULT_HORIZON = 10;

/** Horizons SPIVA actually reports vs. the ones we extrapolate. */
const EXTRA_HORIZONS = [30, 40, 50, 60, 70];
const isExtrapolated = (h: number) => EXTRA_HORIZONS.includes(h);

const groupColor = (id: string) =>
  ({ "us-equity": "var(--pl-c1)", "intl-equity": "var(--pl-c3)", "fixed-income": "var(--pl-c5)" }[id] ?? "var(--color-accent)");

const ALL = spiva.groups.flatMap((g) => g.categories.map((c) => ({ ...c, groupId: g.id, groupLabel: g.label })));
type Cat = (typeof ALL)[number];
const findCat = (id: string) => ALL.find((c) => c.id === id)!;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/**
 * Full staircase for a category: the reported points, then the extrapolated
 * ones. Extrapolation fits ln(out-performing share) = a + b·horizon by least
 * squares on the reported points and projects it, holding the curve monotonic
 * (failure can't fall at a longer horizon) and capped below 100%.
 */
function extendedStair(cat: Cat): { h: number; rate: number; extrapolated: boolean }[] {
  const reported = spiva.horizons
    .map((h, i) => ({ h, rate: cat.rates[i], extrapolated: false }))
    .filter((p) => p.rate != null) as { h: number; rate: number; extrapolated: boolean }[];
  if (reported.length < 2) return reported;

  const xs = reported.map((p) => p.h);
  const ys = reported.map((p) => Math.log(clamp(1 - p.rate / 100, 0.002, 0.999))); // ln(outperform share)
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
  const b = sxx === 0 ? 0 : sxy / sxx;
  const a = my - b * mx;

  let prev = reported[reported.length - 1].rate;
  const extra = EXTRA_HORIZONS.map((h) => {
    const outperform = Math.exp(a + b * h);
    const rate = clamp((1 - outperform) * 100, prev, 99.5); // monotone, capped
    prev = rate;
    return { h, rate, extrapolated: true };
  });
  return [...reported, ...extra];
}

export default function SpivaLab() {
  const [catId, setCatId] = useState(DEFAULT_CAT);
  const [horizon, setHorizon] = useState(DEFAULT_HORIZON);

  const cat = findCat(catId);
  const view = useMemo(() => {
    const stair = extendedStair(cat);
    const at = (h: number) => stair.find((p) => p.h === h)?.rate ?? null;
    const rate = at(horizon);
    const oneYr = at(1);
    const reportedLongest = [...stair].filter((p) => !p.extrapolated).reverse()[0];
    const ranked = ALL.map((c) => {
      const s = extendedStair(c);
      const r = s.find((p) => p.h === horizon)?.rate ?? null;
      return { id: c.id, name: c.name, groupId: c.groupId, rate: r };
    })
      .filter((c) => c.rate != null)
      .sort((a, b) => (b.rate as number) - (a.rate as number)) as { id: string; name: string; groupId: string; rate: number }[];
    return { stair, rate, oneYr, reportedLongest, ranked };
  }, [catId, horizon]);

  const extrap = isExtrapolated(horizon);

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
            <InfoTip text="How long the funds are measured over. SPIVA reports through 20 years; 30–70 are extrapolated (dashed) — a projection of the trend, not measured data." />
          </span>
          <div className="wl-simmode wl-simmode--wrap" role="group" aria-label="Time horizon">
            {spiva.horizons.map((h) => (
              <button key={h} type="button" className={horizon === h ? "active" : ""} aria-pressed={horizon === h} onClick={() => setHorizon(h)}>
                {h}y
              </button>
            ))}
            {EXTRA_HORIZONS.map((h) => (
              <button
                key={h}
                type="button"
                className={horizon === h ? "active" : ""}
                aria-pressed={horizon === h}
                onClick={() => setHorizon(h)}
                title="Extrapolated — not reported by SPIVA"
                style={{ borderStyle: "dashed" }}
              >
                {h}y*
              </button>
            ))}
          </div>
        </div>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">
            Over {horizon} years, this share of {cat.name.toLowerCase()}
            {extrap ? " (extrapolated)" : ""}
          </span>
          <span className="ss-headline-value">{view.rate == null ? "—" : `${view.rate.toFixed(1)}%`}</span>
          <span className="ss-headline-sub">
            {view.rate == null ? "not reported at this horizon" : <>{extrap ? "are projected to have failed" : "failed"} to beat the <strong>{cat.benchmark}</strong></>}
          </span>
        </div>

        {extrap ? (
          <p className="wl-note" style={{ marginTop: "0.5rem", borderLeft: "3px solid var(--pl-c3)", paddingLeft: "0.6rem" }}>
            <strong>Extrapolation.</strong> SPIVA stops at 20 years. This figure projects the observed
            decay of the out-performing share out to {horizon} years. It assumes the trend simply
            continues and ignores real-world wrinkles (funds close, the surviving pool shrinks) — so
            treat it as "how the odds are trending," not a measured result. The direction is the point:
            over a lifetime, beating the index becomes vanishingly unlikely.
          </p>
        ) : (
          <p className="wl-note" style={{ marginTop: "0.5rem" }}>
            These are professional, full-time managers. The longer the clock runs, the more of
            them fall behind a simple index — the core reason low-cost index funds are so hard
            to beat. Data: S&P Dow Jones Indices SPIVA U.S. Scorecard, {spiva.asOf}.
          </p>
        )}
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>{cat.name}: failure rate grows with the horizon</h3>
          <HorizonChart stair={view.stair} horizon={horizon} color={groupColor(cat.groupId)} />
          <p className="wl-fnote">
            Solid bars are reported by SPIVA; <span style={{ fontWeight: 700 }}>dashed</span> bars (30y+) are
            extrapolated. Above the dashed 50% line, a coin-flip would have beaten most active managers.
            {view.oneYr != null && view.reportedLongest ? (
              <> Over one year, {view.oneYr.toFixed(0)}% lagged; over {view.reportedLongest.h} years, {view.reportedLongest.rate.toFixed(0)}% did.</>
            ) : null}
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <h3 style={{ marginTop: 0 }}>Every category at {horizon} years{extrap ? " (extrapolated)" : ""}</h3>
            <RankedList ranked={view.ranked} selectedId={catId} onPick={setCatId} />
            <p className="wl-saved">
              It isn't one corner of the market. Across US and international stocks and bonds,
              most active funds underperform their benchmark over {horizon} years — and the gap
              widens the longer you look.{" "}
              {extrap
                ? "Extended to a lifetime horizon, the projection points the same way for essentially every category: the index wins almost every time."
                : "This is the evidence behind indexing: you can't reliably pick the rare winners in advance, so owning the whole market cheaply is the durable bet."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HorizonChart({ stair, horizon, color }: { stair: { h: number; rate: number; extrapolated: boolean }[]; horizon: number; color: string }) {
  const width = 760;
  const height = 360;
  const pad = { top: 26, right: 18, bottom: 40, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const n = stair.length;
  const bandW = plotW / n;
  const barW = Math.min(60, bandW * 0.62);
  const y = (v: number) => pad.top + plotH - (v / 100) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  // x of the boundary between reported and extrapolated bars, for a divider.
  const firstExtra = stair.findIndex((p) => p.extrapolated);
  const dividerX = firstExtra > 0 ? pad.left + bandW * firstExtra : null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Percent of funds underperforming their benchmark by time horizon, with extrapolation beyond 20 years">
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeDasharray={v === 50 ? "5 4" : undefined} />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{v}%</text>
        </g>
      ))}
      <text x={width - pad.right} y={y(50) - 6} textAnchor="end" style={{ ...axisText, fontStyle: "italic" }}>
        coin-flip line
      </text>

      {dividerX != null && (
        <g>
          <line x1={dividerX} x2={dividerX} y1={pad.top} y2={pad.top + plotH} stroke="var(--color-muted)" strokeDasharray="2 3" opacity={0.7} />
          <text x={dividerX + 4} y={pad.top + 10} style={{ ...axisText, fontStyle: "italic" }}>extrapolated →</text>
        </g>
      )}

      {stair.map((p, i) => {
        const cx = pad.left + bandW * i + bandW / 2;
        const sel = p.h === horizon;
        const h = pad.top + plotH - y(p.rate);
        return (
          <g key={p.h}>
            <rect
              x={cx - barW / 2}
              y={y(p.rate)}
              width={barW}
              height={h}
              rx={4}
              fill={color}
              opacity={p.extrapolated ? (sel ? 0.55 : 0.28) : sel ? 1 : 0.42}
              stroke={p.extrapolated ? color : "none"}
              strokeWidth={p.extrapolated ? 1.5 : 0}
              strokeDasharray={p.extrapolated ? "3 2" : undefined}
            />
            <text x={cx} y={y(p.rate) - 7} textAnchor="middle" style={{ ...axisText, fill: "var(--color-text)", fontWeight: sel ? 700 : 600, fontSize: sel ? 13 : 11 }}>
              {p.rate.toFixed(0)}%
            </text>
            <text x={cx} y={height - pad.bottom + 17} textAnchor="middle" style={{ ...axisText, fontWeight: sel ? 700 : 400, fill: sel ? "var(--color-text)" : "var(--color-muted)", fontStyle: p.extrapolated ? "italic" : "normal" }}>
              {p.h}{p.extrapolated ? "*" : ""}
            </text>
          </g>
        );
      })}
      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Percent of active funds that underperformed · *30y+ extrapolated
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
