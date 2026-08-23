import { useMemo, useState } from "react";
import InfoTip from "./InfoTip";
import ResetButton from "./ResetButton";
import { marketDaily } from "../data/generated/market-daily";
import { formatMoney, useCurrencyCode } from "../lib/currency";

/**
 * Volatility drag: why a 2× fund doesn't deliver 2× the market.
 *
 * Leveraged ETFs promise a MULTIPLE OF EACH DAY'S return, and daily resetting
 * compounds differently than the long-run return does: +10% then −10% is
 * −1% at 1×, but −4% at 2×. Over choppy stretches the "2×" fund can lose money
 * while the market gains. The sim replays real daily US market history
 * (Fama–French, 1990–) with a frictionless daily-reset fund — no fees, no
 * financing costs — so every dollar of shortfall shown is pure volatility
 * math. Real leveraged funds also pay ~1% expense ratios plus financing on
 * the borrowed exposure, so they do worse than this.
 *
 * The honest counterpoint is shown too: in a smooth trending bull market,
 * daily resetting compounds IN the fund's favor (that's the seduction).
 */

const currency = (n: number) => formatMoney(n);
const pct = (x: number, dp = 0) => `${(x * 100).toFixed(dp)}%`;

const START = 10_000;
const FIRST_YEAR = 1990;
const LAST_YEAR = Number(marketDaily.endDate.slice(0, 4));

interface WindowPreset { name: string; blurb: string; from: number; to: number; lev: number }
const PRESETS: WindowPreset[] = [
  { name: "The lost decade", blurb: "2000–2009: the market chopped sideways-to-down. Leverage compounded the chop.", from: 2000, to: 2009, lev: 2 },
  { name: "The 2008 whipsaw", blurb: "2008–2012: the market round-tripped. The 2× fund did not.", from: 2008, to: 2012, lev: 2 },
  { name: "A smooth bull run", blurb: "2010–2019: low-volatility trend — the one regime where daily resetting flatters leverage.", from: 2010, to: 2019, lev: 2 },
  { name: "Triple-leveraged, full history", blurb: "3× across everything since 1990: three crashes' worth of drag.", from: FIRST_YEAR, to: LAST_YEAR, lev: 3 },
];

export default function LeverageLab() {
  useCurrencyCode();
  const [lev, setLev] = useState(2);
  const [from, setFrom] = useState(2000);
  const [to, setTo] = useState(2009);

  const fromC = Math.min(from, LAST_YEAR - 1);
  const toC = Math.max(to, fromC);

  const view = useMemo(() => {
    const i0 = marketDaily.yearStart[fromC] ?? 0;
    const i1 = toC + 1 <= LAST_YEAR ? (marketDaily.yearStart[toC + 1] ?? marketDaily.returns.length) : marketDaily.returns.length;
    const days = marketDaily.returns.slice(i0, i1);

    let mkt = 1, fund = 1;
    const stride = Math.max(1, Math.floor(days.length / 600));
    const mktPath: number[] = [1];
    const fundPath: number[] = [1];
    const naivePath: number[] = [1];
    let sumR = 0, sumR2 = 0;
    for (let i = 0; i < days.length; i++) {
      const r = days[i];
      mkt *= 1 + r;
      fund *= Math.max(0, 1 + lev * r);
      sumR += r;
      sumR2 += r * r;
      if ((i + 1) % stride === 0 || i === days.length - 1) {
        mktPath.push(mkt);
        fundPath.push(fund);
        naivePath.push(Math.max(0, 1 + lev * (mkt - 1)));
      }
    }
    const naive = 1 + lev * (mkt - 1);
    const n = days.length;
    const dailyVar = sumR2 / n - (sumR / n) ** 2;
    const annVol = Math.sqrt(dailyVar * 252);
    const years = n / 252;
    // Second-order approximation of the annual drag from daily resetting.
    const dragPerYear = 0.5 * lev * (lev - 1) * dailyVar * 252;
    return { mkt, fund, naive, mktPath, fundPath, naivePath, annVol, years, dragPerYear };
  }, [lev, fromC, toC]);

  const fundBeatsNaive = view.fund > view.naive;

  return (
    <div className="wl">
      <div className="wl-controls">
        <ResetButton onReset={() => { setLev(2); setFrom(2000); setTo(2009); }} />

        <div className="wl-presets" style={{ marginBottom: "var(--space-xs)" }}>
          <span className="wl-presets-label">Try a stretch:</span>
          {PRESETS.map((p) => (
            <button key={p.name} type="button" className="wl-chip" title={p.blurb} onClick={() => { setFrom(p.from); setTo(p.to); setLev(p.lev); }}>
              {p.name}
            </button>
          ))}
        </div>

        <label className="wl-slider">
          <span>
            Daily leverage
            <InfoTip text="The fund delivers this multiple of EACH DAY'S market return, resetting every day — exactly how leveraged and inverse ETFs are built. −1× is an inverse fund." />{" "}
            <strong>{lev}×</strong>
          </span>
          <input type="range" min={-1} max={3} step={0.5} value={lev} onChange={(e) => setLev(+e.target.value)} />
        </label>
        <label className="wl-slider">
          <span>From <strong>{fromC}</strong></span>
          <input type="range" min={FIRST_YEAR} max={LAST_YEAR - 1} step={1} value={fromC} onChange={(e) => { const v = +e.target.value; setFrom(v); if (toC < v) setTo(v); }} />
        </label>
        <label className="wl-slider">
          <span>To <strong>{toC}</strong></span>
          <input type="range" min={fromC} max={LAST_YEAR} step={1} value={toC} onChange={(e) => setTo(+e.target.value)} />
        </label>

        <div className="ss-headline" style={{ marginTop: "var(--space-sm)" }}>
          <span className="ss-headline-label">
            The market returned {pct(view.mkt - 1)} over {fromC}–{toC}. "{lev}× that" sounds like {pct(view.naive - 1)}. The daily-reset {lev}× fund actually returned
          </span>
          <span className="ss-headline-value" style={{ color: fundBeatsNaive ? "var(--color-accent)" : "var(--color-warn)" }}>
            {pct(view.fund - 1)}
          </span>
          <span className="ss-headline-sub">
            {fundBeatsNaive
              ? "— ahead of the naive multiple: in a smooth trend, daily compounding works for the fund. That's the seduction; the chop is the trap."
              : `— ${pct(view.naive - view.fund)} of return evaporated in volatility drag alone, with zero fees or financing costs in this sim. Real funds charge both.`}
          </span>
        </div>

        <dl className="ss-stats" style={{ marginTop: "var(--space-sm)" }}>
          <div><dt>{currency(START)} in the market became</dt><dd>{currency(START * view.mkt)}</dd></div>
          <div><dt>In the {lev}× daily fund</dt><dd>{currency(START * view.fund)}</dd></div>
          <div><dt>Market volatility (annualized)</dt><dd>{pct(view.annVol, 1)}</dd></div>
          <div><dt>Drag from daily resetting</dt><dd>≈{pct(view.dragPerYear, 1)}/yr</dd></div>
        </dl>

        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          Frictionless on purpose: no expense ratio, no financing cost, market prices only. Real
          leveraged ETFs charge ~1%/yr and pay interest on the borrowed exposure on top of everything
          shown here. Drag ≈ ½·L(L−1)·σ² per year — it grows with the <em>square</em> of volatility.
          Educational only, not advice.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>Growth of {currency(START)}, daily data</h3>
          <LeverageChart mktPath={view.mktPath} fundPath={view.fundPath} naivePath={view.naivePath} lev={lev} from={fromC} to={toC} />
          <p className="wl-fnote">
            The dashed line is the promise people <em>hear</em> — "{lev}× the market" applied to the
            whole period. The solid {lev}× line is what daily resetting actually delivers. They differ
            because a leveraged fund multiplies each day, and losses compound harder than gains:
            +10% then −10% leaves 1× down 1%, but 2× down 4%. Sideways chop — a market going nowhere,
            violently — is where leveraged funds quietly bleed out.
          </p>
        </div>
      </div>
    </div>
  );
}

function LeverageChart({ mktPath, fundPath, naivePath, lev, from, to }: {
  mktPath: number[]; fundPath: number[]; naivePath: number[]; lev: number; from: number; to: number;
}) {
  const width = 760, height = 380;
  const pad = { top: 16, right: 18, bottom: 40, left: 62 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const all = [...mktPath, ...fundPath, ...naivePath];
  const rawMax = Math.max(...all);
  const rawMin = Math.max(1e-3, Math.min(...all));
  const useLog = rawMax / rawMin > 8;
  const yMax = rawMax * 1.05;
  const yMin = useLog ? rawMin / 1.1 : 0;
  const y = (v: number) => {
    const vv = Math.max(v, yMin || 1e-3);
    const t = useLog ? (Math.log(vv) - Math.log(yMin)) / (Math.log(yMax) - Math.log(yMin)) : (vv - yMin) / (yMax - yMin);
    return pad.top + plotH - t * plotH;
  };
  const x = (i: number, n: number) => pad.left + (i / Math.max(1, n - 1)) * plotW;
  const path = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i, arr.length)},${y(v)}`).join(" ");
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  const grid: number[] = [];
  if (useLog) {
    for (let g = Math.pow(10, Math.floor(Math.log10(Math.max(yMin, 1e-3)))); g <= yMax; g *= 10) {
      if (g >= yMin) grid.push(g);
      if (g * 3 >= yMin && g * 3 <= yMax) grid.push(g * 3);
    }
  } else {
    for (let g = 1; g <= 4; g++) grid.push(yMin + ((yMax - yMin) / 4) * g);
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Growth of the market, the leveraged fund, and the naive multiple">
      {grid.map((g) => (
        <g key={g}>
          <line x1={pad.left} x2={width - pad.right} y1={y(g)} y2={y(g)} stroke="var(--color-border)" />
          <text x={pad.left - 6} y={y(g) + 4} textAnchor="end" style={axisText}>{currency(START * g)}</text>
        </g>
      ))}
      <line x1={pad.left} x2={width - pad.right} y1={y(1)} y2={y(1)} stroke="var(--color-muted)" strokeWidth={1.1} strokeDasharray="1 3" />
      <path d={path(naivePath)} fill="none" stroke="var(--color-muted)" strokeWidth={1.6} strokeDasharray="6 4" />
      <path d={path(mktPath)} fill="none" stroke="var(--color-accent)" strokeWidth={2.2} />
      <path d={path(fundPath)} fill="none" stroke="var(--color-warn)" strokeWidth={2.6} />
      {[from, Math.round((from + to) / 2), to].map((yr, i) => (
        <text key={i} x={pad.left + (plotW * i) / 2} y={height - pad.bottom + 16} textAnchor="middle" style={axisText}>{yr}</text>
      ))}
      <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        green = market (1×) · orange = {lev}× daily-reset fund · dashed = "{lev}× the period return" (the naive promise)
      </text>
    </svg>
  );
}
