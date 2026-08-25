import { useEffect, useId, useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import ConcentrationTreemap from "./ConcentrationTreemap";
import {
  CONCENTRATION,
  EW_VS_CW,
  TOP10_SNAPSHOTS,
  TREEMAP_SNAPSHOTS,
  crossCheck,
  type ConcentrationPoint,
} from "../data/generated/sp500-concentration";

/**
 * "How top-heavy is the market?" — the S&P 500 says "500 stocks", but a
 * cap-weighted index can be dominated by a handful. Scrub across the decades to
 * watch the top-10 share and the effective number of stocks (1/HHI) swing, land
 * on the Magnificent-Seven spike, and compare equal-weight vs cap-weight growth.
 * Concentration reads as a hidden, undiversified RISK — the flip side of the
 * diversification lesson in this module.
 *
 * Real CRSP S&P 500 daily-constituent data, reduced to index-level aggregates.
 * Educational only, not investment advice.
 */

const pct0 = (x: number) => `${(x * 100).toFixed(0)}%`;
const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`;
const yearOf = (date: string) => date.slice(0, 4);

// One shared timeline for the whole lab: every year-end we shipped holdings for.
// The scrubber, the treemap (including its play button), the headline stats and
// the holdings list all read this single index, so every control moves together.
const YEAR_KEYS = Object.keys(TREEMAP_SNAPSHOTS).sort();
// Decade shortcuts under the slider, mapped onto the annual timeline.
const DECADE_TICKS = Object.keys(TOP10_SNAPSHOTS)
  .sort()
  .map((k) => ({ key: k, i: YEAR_KEYS.indexOf(k) }))
  .filter((t) => t.i >= 0);
const byDate = new Map(CONCENTRATION.map((d) => [d.date, d]));

type ChartView = "concentration" | "treemap" | "growth";

export default function IndexConcentrationLab() {
  const [sel, setSel] = useState(YEAR_KEYS.length - 1); // default: today (Mag-7)
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState<ChartView>("concentration");
  const clipId = useId();

  const selDate = YEAR_KEYS[sel];
  const selYear = yearOf(selDate);
  const point = byDate.get(selDate) ?? CONCENTRATION[CONCENTRATION.length - 1];
  // Top 10 for any year, from the treemap's top-30 snapshot.
  const holdings = (TREEMAP_SNAPSHOTS[selDate]?.holdings ?? TOP10_SNAPSHOTS[selDate] ?? []).slice(0, 10);

  // Play: advance a year at a time; stop at the end of the record.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setSel((i) => Math.min(i + 1, YEAR_KEYS.length - 1)), 550);
    return () => clearInterval(id);
  }, [playing]);
  useEffect(() => {
    if (playing && sel >= YEAR_KEYS.length - 1) setPlaying(false);
  }, [playing, sel]);

  /** Any manual scrub takes over from the animation. */
  const scrubTo = (i: number) => { setPlaying(false); setSel(i); };
  const togglePlay = () => {
    if (!playing && sel >= YEAR_KEYS.length - 1) setSel(0); // replay from the start
    setPlaying((p) => !p);
  };

  // Peak, trough and latest concentration across the whole record, for context.
  const { peak, trough, recent } = useMemo(() => {
    let p = CONCENTRATION[0];
    let t = CONCENTRATION[0];
    for (const d of CONCENTRATION) {
      if (d.top10 > p.top10) p = d;
      if (d.top10 < t.top10) t = d;
    }
    return { peak: p, trough: t, recent: CONCENTRATION[CONCENTRATION.length - 1] };
  }, []);

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={() => { setSel(YEAR_KEYS.length - 1); setPlaying(false); setView("concentration"); }} />

        <label className="wl-slider ic-scrub">
          <span>
            Scrub the years
            <InfoTip text="Slide through the years to see how top-heavy the S&P 500 was at each point, and which giants sat at the top. Every view on this page — the chart, the treemap, and the holdings list — follows this year." />{" "}
            <strong>{selYear}</strong>
          </span>
          <input
            type="range"
            min={0}
            max={YEAR_KEYS.length - 1}
            step={1}
            value={sel}
            aria-label="Year"
            onChange={(e) => scrubTo(Number(e.target.value))}
          />
          <span className="ic-scrub-ticks" aria-hidden="true">
            {DECADE_TICKS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={t.i === sel ? "active" : ""}
                onClick={() => scrubTo(t.i)}
                tabIndex={-1}
              >
                {`'${yearOf(t.key).slice(2)}`}
              </button>
            ))}
          </span>
        </label>

        <button type="button" className="wl-btn ic-playbtn" onClick={togglePlay} aria-pressed={playing}>
          {playing ? "⏸ Pause" : "▶ Play the years"}
        </button>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">In {selYear}, the S&amp;P 500's top 10 stocks were</span>
          <span className="ss-headline-value">{pct0(point.top10)} of the index</span>
          <span className="ss-headline-sub">
            — so despite holding <strong>{point.n}</strong> names it behaved like only about{" "}
            <strong>{Math.round(point.effN)}</strong> equally-weighted stocks.
          </span>
        </div>

        <dl className="ss-stats ic-stats">
          <div><dt>Biggest single stock</dt><dd>{pct1(point.top1)}</dd></div>
          <div><dt>Top 5</dt><dd>{pct1(point.top5)}</dd></div>
          <div><dt>Top 10</dt><dd>{pct1(point.top10)}</dd></div>
          <div><dt>Effective # of stocks</dt><dd>{Math.round(point.effN)}</dd></div>
        </dl>

        <p className="wl-note">
          <strong>Method:</strong> month-end cap weights from CRSP S&amp;P 500 daily constituents
          ({CONCENTRATION[0].date.slice(0, 4)}–{CONCENTRATION[CONCENTRATION.length - 1].date.slice(0, 4)}).
          "Effective number of stocks" is 1/HHI, where HHI = Σ wᵢ²: it's how many
          equal-weight stocks would give the same concentration. Our cap-weight
          index return matches CRSP's official value-weighted series with a
          correlation of {crossCheck.corrWithCrspVw.toFixed(2)}. Educational only,
          not advice.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <div className="ic-chart-head">
            <h3>{view === "concentration" ? "A “500-stock” index, dominated by a few" : view === "treemap" ? "The index as a map — every tile a stock" : "Equal weight vs cap weight"}</h3>
            <div className="wl-simmode ic-viewtabs" role="group" aria-label="Chart view">
              <button type="button" className={view === "concentration" ? "active" : ""} aria-pressed={view === "concentration"} onClick={() => setView("concentration")}>Concentration</button>
              <button type="button" className={view === "treemap" ? "active" : ""} aria-pressed={view === "treemap"} onClick={() => setView("treemap")}>Treemap</button>
              <button type="button" className={view === "growth" ? "active" : ""} aria-pressed={view === "growth"} onClick={() => setView("growth")}>Equal vs cap weight</button>
            </div>
          </div>

          {view === "treemap" ? (
            <ConcentrationTreemap yi={sel} onScrub={scrubTo} playing={playing} onTogglePlay={togglePlay} />
          ) : view === "concentration" ? (
            <>
              <ConcentrationChart data={CONCENTRATION} selDate={selDate} clipId={clipId} />
              <p className="wl-fnote">
                The top-10 share of the whole index, month by month. Concentration
                was actually <em>highest</em> in the {peak.date.slice(0, 3)}0s
                — about <strong>{pct0(peak.top10)}</strong> in {peak.date.slice(0, 4)},
                when a few giants like AT&amp;T and General Motors towered over
                everything. It then fell for decades as the market broadened, bottoming
                near <strong>{pct0(trough.top10)}</strong> around {trough.date.slice(0, 4)},
                before the Magnificent-Seven surge drove it back up to{" "}
                <strong>{pct0(recent.top10)}</strong>. A rising line means more of your
                "500 stocks" is really just a few.
              </p>
            </>
          ) : (
            <>
              <GrowthChart data={EW_VS_CW} clipId={clipId} />
              <div className="wl-flegend">
                <span><span className="wl-fdot" style={{ background: "var(--color-link)" }} /> Equal weight (every stock the same)</span>
                <span><span className="wl-fdot" style={{ background: "var(--color-accent)" }} /> Cap weight (the actual index)</span>
              </div>
              <p className="wl-fnote">
                Growth of $1, log scale. Weighting every stock equally tilts toward
                smaller companies and historically grew faster over the long run —
                but it lags badly when a few giants lead, as in the late-1990s and
                the recent mega-cap surge. Concentration is a bet: it pays when the
                giants win and hurts when they don't.
              </p>
            </>
          )}
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <h3 className="ic-hold-title">Top 10 in {selYear}</h3>
            <ol className="ic-holds">
              {holdings.map((h, i) => (
                <li key={i} className="ic-hold">
                  <span className="ic-hold-rank">{i + 1}</span>
                  <span className="ic-hold-tik">{h.ticker || "—"}</span>
                  <span className="ic-hold-bar">
                    <span
                      className="ic-hold-fill"
                      style={{ width: `${holdings[0] ? (h.weight / holdings[0].weight) * 100 : 0}%` }}
                    />
                  </span>
                  <span className="ic-hold-w">{pct1(h.weight)}</span>
                </li>
              ))}
            </ol>
            <p className="wl-saved">
              A cap-weighted index quietly hands the biggest companies the biggest
              vote. That's not a flaw — it's how the market itself is weighted — but
              it means "owning the S&amp;P 500" is not the same as owning 500 things
              equally. When the top 10 swell to a fifth or a third of the whole, your
              diversification is thinner than the number 500 suggests, and your
              returns ride on a handful of names. Concentration is a hidden risk.{" "}
              <a href="/tools/portfolio">See how mixing assets lowers risk →</a>{" "}
              Educational only, not advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Top-10 share of the index over the full record, with a marker at the selected month. */
function ConcentrationChart({ data, selDate, clipId }: { data: ConcentrationPoint[]; selDate: string; clipId: string }) {
  const width = 760, height = 380;
  const pad = { top: 20, right: 18, bottom: 40, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const n = data.length;
  const yMax = Math.max(0.4, Math.max(...data.map((d) => d.top10)) * 1.08);
  const x = (i: number) => pad.left + (i / (n - 1)) * plotW;
  const y = (v: number) => pad.top + (1 - v / yMax) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.top10).toFixed(1)}`).join(" ");
  const area = `M${x(0).toFixed(1)},${y(0).toFixed(1)} ${data.map((d, i) => `L${x(i).toFixed(1)},${y(d.top10).toFixed(1)}`).join(" ")} L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} Z`;

  const selI = Math.max(0, data.findIndex((d) => d.date === selDate));
  const yTicks = tickStops(0, yMax, 0.1);
  const xTicks = yearTicks(data.map((d) => +d.date.slice(0, 4)), 20);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Top-10 share of the S&P 500 over time">
      <defs>
        <clipPath id={`${clipId}-plot`}><rect x={pad.left} y={pad.top} width={plotW} height={plotH} /></clipPath>
      </defs>
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{(v * 100).toFixed(0)}%</text>
        </g>
      ))}
      <path d={area} fill="var(--color-accent)" opacity={0.16} clipPath={`url(#${clipId}-plot)`} />
      <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth={1.8} strokeLinejoin="round" />
      <line x1={x(selI)} x2={x(selI)} y1={pad.top} y2={pad.top + plotH} stroke="var(--color-link)" strokeWidth={1.4} strokeDasharray="4 3" />
      <circle cx={x(selI)} cy={y(data[selI].top10)} r={4} fill="var(--color-link)" stroke="var(--color-surface)" strokeWidth={1.5} />
      {xTicks.map(({ yr, i }) => (
        <text key={yr} x={x(i)} y={height - pad.bottom + 18} textAnchor="middle" style={axisText}>{yr}</text>
      ))}
      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Top-10 stocks' share of total index value
      </text>
    </svg>
  );
}

/** Cumulative growth of $1: equal weight vs cap weight, log scale. */
function GrowthChart({ data, clipId }: { data: { date: string; ew: number; cw: number }[]; clipId: string }) {
  const width = 760, height = 380;
  const pad = { top: 20, right: 18, bottom: 40, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const n = data.length;
  const vals = data.flatMap((d) => [d.ew, d.cw]).filter((v) => v > 0);
  const lo = Math.log10(Math.min(...vals));
  const hi = Math.log10(Math.max(...vals));
  const x = (i: number) => pad.left + (i / (n - 1)) * plotW;
  const y = (v: number) => pad.top + (1 - (Math.log10(Math.max(v, 1e-6)) - lo) / (hi - lo)) * plotH;
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  const path = (key: "ew" | "cw") => data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");
  const powLo = Math.ceil(lo);
  const powHi = Math.floor(hi);
  const yTicks: number[] = [];
  for (let p = powLo; p <= powHi; p++) yTicks.push(10 ** p);
  const xTicks = yearTicks(data.map((d) => +d.date.slice(0, 4)), 20);
  const fmtMoney = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v.toFixed(0)}`);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Growth of $1: equal weight vs cap weight, log scale">
      <defs>
        <clipPath id={`${clipId}-gplot`}><rect x={pad.left} y={pad.top} width={plotW} height={plotH} /></clipPath>
      </defs>
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{fmtMoney(v)}</text>
        </g>
      ))}
      <g clipPath={`url(#${clipId}-gplot)`}>
        <path d={path("ew")} fill="none" stroke="var(--color-link)" strokeWidth={1.8} strokeLinejoin="round" />
        <path d={path("cw")} fill="none" stroke="var(--color-accent)" strokeWidth={1.8} strokeLinejoin="round" />
      </g>
      {xTicks.map(({ yr, i }) => (
        <text key={yr} x={x(i)} y={height - pad.bottom + 18} textAnchor="middle" style={axisText}>{yr}</text>
      ))}
      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Growth of $1 (log scale)
      </text>
    </svg>
  );
}

/** Evenly-spaced value stops from `from` to `to` at the given step (inclusive). */
function tickStops(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

/** Year gridline positions ~every `every` years, mapped to array indices. */
function yearTicks(years: number[], every: number): { yr: number; i: number }[] {
  const first = Math.ceil(years[0] / every) * every;
  const out: { yr: number; i: number }[] = [];
  for (let yr = first; yr <= years[years.length - 1]; yr += every) {
    const i = years.indexOf(yr);
    if (i >= 0) out.push({ yr, i });
  }
  return out;
}
