import { useId, useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { globalEquity } from "../data/generated/global-equity";

/**
 * "US vs. the World: the leadership cycle" — the rolling-return spread between US
 * and international equity, which swings through long, alternating cycles: years
 * where US leads, then years where international leads, then back. The point:
 * leadership rotates on a multi-year clock nobody can time in advance, so the
 * humble move is to own both — the dynamic companion to the Home-Bias tool.
 *
 * Data: monthly market total returns (Mkt-RF + RF) from the Fama–French regional
 * files, 1990-07 to 2026-06. Educational only, not advice.
 */

const M = globalEquity.monthly;
const pct = (x: number, dp = 1) => `${x >= 0 ? "" : "−"}${Math.abs(x * 100).toFixed(dp)}%`;
const WINDOWS = [
  { key: 12, label: "1-year" },
  { key: 36, label: "3-year" },
  { key: 60, label: "5-year" },
];

/** Rolling annualized return of a monthly-decimal series over a w-month window. */
function rollingAnn(r: number[], w: number): number[] {
  const out: number[] = [];
  for (let t = w - 1; t < r.length; t++) {
    let g = 1;
    for (let i = t - w + 1; i <= t; i++) g *= 1 + r[i];
    out.push(g ** (12 / w) - 1);
  }
  return out;
}

export default function RollingReturnsLab() {
  const [win, setWin] = useState(36);
  const [rival, setRival] = useState<"devExUs" | "emerging">("devExUs");
  const clipId = useId();

  const rivalLabel = rival === "devExUs" ? "Developed ex-US" : "Emerging markets";

  const data = useMemo(() => {
    const us = rollingAnn(M.us, win);
    const other = rollingAnn(M[rival], win);
    const dates = M.dates.slice(win - 1);
    const spread = us.map((u, i) => u - other[i]);

    let usLed = 0;
    let curSign = 0, curRun = 0, maxUs = 0, maxOther = 0, flips = 0;
    for (const s of spread) {
      const sign = s > 0 ? 1 : -1;
      if (s > 0) usLed++;
      if (sign === curSign) curRun++;
      else {
        if (curSign !== 0) flips++;
        curSign = sign; curRun = 1;
      }
      if (sign > 0) maxUs = Math.max(maxUs, curRun);
      else maxOther = Math.max(maxOther, curRun);
    }
    return {
      dates, spread, us, other,
      pctUsLed: usLed / spread.length,
      maxUsYrs: maxUs / 12,
      maxOtherYrs: maxOther / 12,
      flips,
      current: spread[spread.length - 1],
    };
  }, [win, rival]);

  const leaderNow = data.current >= 0 ? "US" : rivalLabel;

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={() => { setWin(36); setRival("devExUs"); }} />

        <div className="wl-field">
          <span className="wl-field-label">
            Compare US against
            <InfoTip text="Which international market to race the US against. Developed ex-US is Europe, Japan, Canada, Australia; Emerging is China, India, Taiwan, Brazil and others." />
          </span>
          <div className="wl-simmode" role="group" aria-label="Comparison market">
            <button type="button" className={rival === "devExUs" ? "active" : ""} aria-pressed={rival === "devExUs"} onClick={() => setRival("devExUs")}>Developed ex-US</button>
            <button type="button" className={rival === "emerging" ? "active" : ""} aria-pressed={rival === "emerging"} onClick={() => setRival("emerging")}>Emerging</button>
          </div>
        </div>

        <div className="wl-field">
          <span className="wl-field-label">
            Rolling window
            <InfoTip text="Each point is the annualized return over the prior N years. Longer windows smooth out noise and show the big leadership cycles; shorter windows flip more often." />
          </span>
          <div className="wl-simmode" role="group" aria-label="Rolling window">
            {WINDOWS.map((w) => (
              <button key={w.key} type="button" className={win === w.key ? "active" : ""} aria-pressed={win === w.key} onClick={() => setWin(w.key)}>{w.label}</button>
            ))}
          </div>
        </div>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">Right now, over the trailing {win / 12} years,</span>
          <span className="ss-headline-value">{leaderNow} leads</span>
          <span className="ss-headline-sub">by <strong>{pct(Math.abs(data.current))}/yr</strong> — but that lead has flipped <strong>{data.flips}</strong> times since {data.dates[0].slice(0, 4)}</span>
        </div>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          <strong>Method:</strong> rolling {win / 12}-year annualized market total return, US minus {rivalLabel.toLowerCase()},
          from Fama–French regional data ({M.dates[0].slice(0, 4)}–{M.dates[M.dates.length - 1].slice(0, 4)}, nominal USD).
          Educational only, not advice.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>Who's winning? It keeps changing</h3>
          <SpreadChart dates={data.dates} spread={data.spread} clipId={clipId} rivalLabel={rivalLabel} win={win} />
          <div className="wl-flegend">
            <span><span className="wl-fdot" style={{ background: "var(--color-accent)" }} /> US ahead</span>
            <span><span className="wl-fdot" style={{ background: "var(--color-link)" }} /> {rivalLabel} ahead</span>
          </div>
          <p className="wl-fnote">
            Above the line, US stocks led over the trailing {win / 12} years; below it, {rivalLabel.toLowerCase()} led. The
            swings are long — whole stretches of the 2000s belonged to international and emerging markets, the 2010s and
            early 2020s to the US.
          </p>
        </div>

        <div className="wl-lower">
          <div className="wl-readout">
            <dl className="ss-stats">
              <div><dt>US led</dt><dd>{Math.round(data.pctUsLed * 100)}% of the time</dd></div>
              <div><dt>Longest US-led streak</dt><dd>{data.maxUsYrs.toFixed(1)} yrs</dd></div>
              <div><dt>Longest {rivalLabel.split(" ")[0]}-led streak</dt><dd>{data.maxOtherYrs.toFixed(1)} yrs</dd></div>
              <div><dt>Leadership flips</dt><dd>{data.flips}</dd></div>
            </dl>
            <p className="wl-saved">
              Neither side wins forever. Leadership rotates on a <strong>multi-year clock</strong> — long enough that a bad
              stretch feels permanent, which is exactly when people give up on the laggard right before it turns. Since
              this window can't be timed in advance, the humble move is to <strong>own both in proportion</strong> and
              rebalance as the tide shifts. The recent US dominance is real, but it's a phase, not a law — international
              led the decade before it. <a href="/tools/global">See Home Bias →</a> Educational only, not advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpreadChart({ dates, spread, clipId, rivalLabel, win }: { dates: string[]; spread: number[]; clipId: string; rivalLabel: string; win: number }) {
  const width = 760, height = 380;
  const pad = { top: 20, right: 18, bottom: 40, left: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const n = spread.length;
  const mag = Math.max(0.05, Math.max(...spread.map(Math.abs)) * 1.08);
  const x = (i: number) => pad.left + (i / (n - 1)) * plotW;
  const y = (v: number) => pad.top + plotH / 2 - (v / mag) * (plotH / 2);
  const zeroY = y(0);
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  const line = spread.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `M${x(0).toFixed(1)},${zeroY.toFixed(1)} ${spread.map((v, i) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} L${x(n - 1).toFixed(1)},${zeroY.toFixed(1)} Z`;

  // Year gridlines on the x-axis.
  const years = dates.map((d) => +d.slice(0, 4));
  const firstYear = Math.ceil(years[0] / 5) * 5;
  const yearTicks: { yr: number; i: number }[] = [];
  for (let yr = firstYear; yr <= years[years.length - 1]; yr += 5) {
    const i = years.indexOf(yr);
    if (i >= 0) yearTicks.push({ yr, i });
  }
  const magTicks = [mag, mag / 2, -mag / 2, -mag];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label={`Rolling ${win / 12}-year return spread, US minus ${rivalLabel}`}>
      <defs>
        <clipPath id={`${clipId}-above`}><rect x={pad.left} y={pad.top} width={plotW} height={Math.max(0, zeroY - pad.top)} /></clipPath>
        <clipPath id={`${clipId}-below`}><rect x={pad.left} y={zeroY} width={plotW} height={Math.max(0, pad.top + plotH - zeroY)} /></clipPath>
      </defs>
      {magTicks.map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--color-border)" />
          <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" style={axisText}>{v >= 0 ? "+" : "−"}{Math.abs(v * 100).toFixed(0)}%</text>
        </g>
      ))}
      <path d={area} fill="var(--color-accent)" opacity={0.5} clipPath={`url(#${clipId}-above)`} />
      <path d={area} fill="var(--color-link)" opacity={0.5} clipPath={`url(#${clipId}-below)`} />
      <line x1={pad.left} x2={width - pad.right} y1={zeroY} y2={zeroY} stroke="var(--color-text-soft)" strokeWidth={1.2} />
      <path d={line} fill="none" stroke="var(--color-text)" strokeWidth={1.6} strokeLinejoin="round" />
      {yearTicks.map(({ yr, i }) => (
        <text key={yr} x={x(i)} y={height - pad.bottom + 18} textAnchor="middle" style={axisText}>{yr}</text>
      ))}
      <text x={pad.left + 4} y={pad.top + 12} style={{ ...axisText, fill: "var(--color-accent)", fontWeight: 700 }}>US ahead ▲</text>
      <text x={pad.left + 4} y={pad.top + plotH - 6} style={{ ...axisText, fill: "var(--color-link)", fontWeight: 700 }}>{rivalLabel} ahead ▼</text>
      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Trailing {win / 12}-year return gap (US − {rivalLabel})
      </text>
    </svg>
  );
}
