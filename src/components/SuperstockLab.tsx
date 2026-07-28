import { useMemo, useState } from "react";
import { mulberry32, makeNormal, percentile } from "../lib/portfolio";
import InfoTip from "./InfoTip";

/**
 * Bessembinder's skewness, made interactive. Individual stock lifetime returns
 * are wildly right-skewed: most stocks lose to T-bills, and a tiny sliver of
 * "superstocks" create essentially all the market's wealth. So a small hand-
 * picked portfolio is statistically likely to UNDERPERFORM the market — you
 * probably miss the winners. Calibrated to illustrate the shape, not precise
 * historical figures.
 */

const M = 3000; // stocks in the universe
const MU = -0.15; // lognormal params -> median < 1, heavy right tail
const SIGMA = 1.7;
const TBILL = 1.8; // reference "safe" lifetime multiple
const K = 2000; // portfolios per Monte Carlo
const PORT_SEED = 909090;

const mult = (m: number) => `${m < 10 ? m.toFixed(1) : Math.round(m)}×`;
const pctText = (x: number) => `${Math.round(x * 100)}%`;

function makeUniverse(seed: number): number[] {
  const rng = mulberry32(seed);
  const norm = makeNormal(rng);
  const arr = new Array(M);
  for (let i = 0; i < M; i++) arr[i] = Math.exp(MU + SIGMA * norm());
  return arr;
}

function portfolioMultiples(universe: number[], n: number, seed: number): number[] {
  const rng = mulberry32(seed);
  const out = new Array(K);
  for (let k = 0; k < K; k++) {
    let sum = 0;
    for (let j = 0; j < n; j++) sum += universe[(rng() * M) | 0];
    out[k] = sum / n;
  }
  return out;
}

export default function SuperstockLab() {
  const [n, setN] = useState(5);
  const [seed, setSeed] = useState(1);

  const universe = useMemo(() => makeUniverse(seed), [seed]);

  const uStats = useMemo(() => {
    const sorted = [...universe].sort((a, b) => a - b);
    const total = sorted.reduce((s, x) => s + x, 0);
    const mean = total / M;
    const median = sorted[Math.floor(M / 2)];
    const lost = sorted.filter((m) => m < 1).length / M;
    const beatTbill = sorted.filter((m) => m > TBILL).length / M;
    const top1 = sorted.slice(Math.floor(M * 0.99)).reduce((s, x) => s + x, 0) / total;
    return { mean, median, lost, beatTbill, top1 };
  }, [universe]);

  const dist = useMemo(() => portfolioMultiples(universe, n, PORT_SEED), [universe, n]);
  const pStats = useMemo(() => {
    const beatMarket = dist.filter((m) => m > uStats.mean).length / K;
    const beatTbill = dist.filter((m) => m > TBILL).length / K;
    return { beatMarket, beatTbill, median: percentile(dist, 0.5) };
  }, [dist, uStats.mean]);

  return (
    <div className="wl">
      <div className="wl-controls">
        <label className="wl-slider">
          <span>
            Stocks you hand-pick
            <InfoTip text="How many stocks you'd hold, chosen at random from the universe. The fewer you pick, the more likely you miss the rare superstocks." />{" "}
            <strong>{n}</strong>
          </span>
          <input type="range" min={1} max={200} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} />
        </label>
        <div className="sk-quicks">
          {[1, 5, 20, 100].map((q) => (
            <button key={q} type="button" className="wl-btn" onClick={() => setN(q)}>
              {q}
            </button>
          ))}
        </div>
        <button type="button" className="wl-btn sk-reseed" onClick={() => setSeed((s) => s + 1)}>
          New universe of stocks
        </button>
        <p className="wl-note" style={{ marginTop: "0.5rem" }}>
          {M.toLocaleString()} simulated stocks, held equal-weight. Illustrative
          shape, calibrated to Bessembinder's findings — not exact history.
        </p>
      </div>

      <div className="wl-stage">
        <div className="wl-frontier">
          <h3>The universe of stocks</h3>
          <UniverseHistogram universe={universe} stats={uStats} />
          <div className="sk-ustats">
            <span><strong>{pctText(uStats.lost)}</strong> lost money</span>
            <span><strong>{pctText(1 - uStats.beatTbill)}</strong> trailed T-bills</span>
            <span>Median stock: <strong>{mult(uStats.median)}</strong></span>
            <span>Market average: <strong>{mult(uStats.mean)}</strong></span>
            <span>Top 1% of stocks hold <strong>{pctText(uStats.top1)}</strong> of the wealth</span>
          </div>
        </div>

        <div className="wl-lower">
          <div className="wl-frontier">
            <h3>Your {n}-stock portfolio, {K.toLocaleString()} ways</h3>
            <PortfolioHistogram dist={dist} market={uStats.mean} />
            <p className="wl-fnote">
              Each run picks {n} stock{n === 1 ? "" : "s"} at random. The bulk of the
              distribution sits <em>left</em> of the market line — most attempts miss
              the superstocks.
            </p>
          </div>

          <div className="wl-readout">
            <div className="sk-headline">
              <span className="sk-headline-label">Chance of beating the market</span>
              <span className="sk-headline-value">{pctText(pStats.beatMarket)}</span>
            </div>
            <dl className="sk-stats">
              <div><dt>Your typical result (median)</dt><dd>{mult(pStats.median)}</dd></div>
              <div><dt>The whole market</dt><dd>{mult(uStats.mean)}</dd></div>
              <div><dt>Chance of beating T-bills</dt><dd>{pctText(pStats.beatTbill)}</dd></div>
            </dl>
            <p className="wl-saved">
              With just {n} stock{n === 1 ? "" : "s"}, your typical outcome{" "}
              <strong>{pStats.median < uStats.mean ? "trails" : "matches"}</strong> the
              market. Drag the count up and your odds climb toward 50/50 as you
              converge on owning everything — that's the case for indexing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function UniverseHistogram({
  universe,
  stats,
}: {
  universe: number[];
  stats: { mean: number; median: number };
}) {
  const width = 720;
  const height = 220;
  const pad = { top: 14, right: 14, bottom: 34, left: 14 };
  const LOG_MIN = -1; // 0.1x
  const LOG_MAX = Math.log10(200);
  const BINS = 36;
  const plotW = width - pad.left - pad.right;

  const tOf = (m: number) =>
    (Math.log10(Math.min(199, Math.max(0.1, m))) - LOG_MIN) / (LOG_MAX - LOG_MIN);
  const x = (m: number) => pad.left + tOf(m) * plotW;

  const counts = new Array(BINS).fill(0);
  for (const m of universe) {
    const b = Math.min(BINS - 1, Math.max(0, Math.floor(tOf(m) * BINS)));
    counts[b]++;
  }
  const maxC = Math.max(...counts, 1);
  const baseY = height - pad.bottom;
  const barH = (c: number) => (c / maxC) * (height - pad.top - pad.bottom);
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Histogram of individual stock lifetime returns, heavily right-skewed">
      {counts.map((c, i) => {
        const bx = pad.left + (i / BINS) * plotW;
        const loss = i / BINS < tOf(1);
        return (
          <rect
            key={i}
            x={bx + 1}
            y={baseY - barH(c)}
            width={plotW / BINS - 1.5}
            height={barH(c)}
            fill={loss ? "var(--color-error)" : "var(--color-accent)"}
            opacity={0.8}
          />
        );
      })}
      {/* reference lines */}
      {[
        { m: 1, label: "break-even", color: "var(--color-muted)" },
        { m: TBILL, label: "T-bills", color: "var(--color-warn)" },
        { m: stats.mean, label: "market avg", color: "var(--color-text)" },
      ].map((r) => (
        <g key={r.label}>
          <line x1={x(r.m)} x2={x(r.m)} y1={pad.top} y2={baseY} stroke={r.color} strokeWidth={1.5} strokeDasharray="4 3" />
          <text x={x(r.m)} y={pad.top - 2} textAnchor="middle" style={{ ...axisText, fill: r.color }}>{r.label}</text>
        </g>
      ))}
      {[0.1, 1, 10, 100].map((m) => (
        <text key={m} x={x(m)} y={baseY + 16} textAnchor="middle" style={axisText}>{mult(m)}</text>
      ))}
      <text x={width / 2} y={height - 2} textAnchor="middle" style={{ ...axisText, fontWeight: 600, fill: "var(--color-text-soft)", fontSize: 12 }}>
        Lifetime return (log scale) — red = lost money
      </text>
    </svg>
  );
}

function PortfolioHistogram({ dist, market }: { dist: number[]; market: number }) {
  const width = 440;
  const height = 220;
  const pad = { top: 14, right: 14, bottom: 30, left: 14 };
  const plotW = width - pad.left - pad.right;
  const cap = Math.max(percentile(dist, 0.95), market, TBILL) * 1.15;
  const BINS = 30;
  const binW = cap / BINS;

  const counts = new Array(BINS).fill(0);
  for (const m of dist) {
    const b = Math.min(BINS - 1, Math.max(0, Math.floor(m / binW)));
    counts[b]++;
  }
  const maxC = Math.max(...counts, 1);
  const x = (m: number) => pad.left + (Math.min(m, cap) / cap) * plotW;
  const baseY = height - pad.bottom;
  const barH = (c: number) => (c / maxC) * (height - pad.top - pad.bottom);
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Distribution of your portfolio's outcome across many random draws">
      {counts.map((c, i) => (
        <rect key={i} x={x(i * binW) + 1} y={baseY - barH(c)} width={plotW / BINS - 1.5} height={barH(c)} fill="var(--color-accent)" opacity={0.75} />
      ))}
      <line x1={x(TBILL)} x2={x(TBILL)} y1={pad.top} y2={baseY} stroke="var(--color-warn)" strokeWidth={1.5} strokeDasharray="4 3" />
      <text x={x(TBILL)} y={pad.top - 2} textAnchor="middle" style={{ ...axisText, fill: "var(--color-warn)" }}>T-bills</text>
      <line x1={x(market)} x2={x(market)} y1={pad.top} y2={baseY} stroke="var(--color-text)" strokeWidth={2} />
      <text x={x(market)} y={pad.top - 2} textAnchor="middle" style={{ ...axisText, fill: "var(--color-text)", fontWeight: 600 }}>market</text>
      {[0, cap / 2, cap].map((m, i) => (
        <text key={i} x={x(m)} y={baseY + 16} textAnchor="middle" style={axisText}>{mult(m)}</text>
      ))}
    </svg>
  );
}
