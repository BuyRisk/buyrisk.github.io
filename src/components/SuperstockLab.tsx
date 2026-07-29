import { useMemo, useState } from "react";
import { mulberry32, percentile } from "../lib/portfolio";
import { crspSuperstock } from "../data/generated/crsp-superstock";
import InfoTip from "./InfoTip";

/**
 * Bessembinder's skewness, made interactive. Individual stock lifetime returns
 * are wildly right-skewed: most stocks lose to T-bills, and a tiny sliver of
 * "superstocks" create essentially all the market's wealth. So a small hand-
 * picked portfolio is statistically likely to UNDERPERFORM the market — you
 * probably miss the winners.
 *
 * The simulated universe is drawn straight from the real CRSP lifetime-return
 * histogram we ship (src/data/generated/crsp-superstock.ts, every US common
 * stock 1925–2026): each stock is an inverse-CDF sample of that empirical
 * distribution. So the shape the reader plays with — ~51% losing money, a median
 * near break-even, and a mean of ~650× dragged up by a handful of monsters — is
 * the *real* one, not the milder lognormal this tool used to fake. Educational
 * only; not financial advice.
 *
 * Design note: we sample the empirical histogram directly (option 2 of the two
 * calibration paths) rather than refitting a parametric law. A single lognormal
 * can match the median or the mean but not both together with the % beaten and
 * the extreme concentration; the empirical draw reproduces all of them at once.
 */

const M = 3000; // stocks in the simulated universe
const K = 2000; // portfolios per Monte Carlo
const PORT_SEED = 909090;

// The extreme right tail (stocks above the histogram's 200× top bin) is modelled
// as a bounded Pareto capped at TAIL_MAX — a representative best-case lifetime
// multiple for a stock compounded across the ~century-long sample. The cap keeps
// one lucky draw from making the displayed "market average" swing between
// reseeds; TAIL_ALPHA (below) is then solved so the reconstructed mean equals the
// real mean multiple. Everything below 200× is sampled log-uniformly *inside* the
// shipped histogram bins, so all but this last bucket reproduces CRSP exactly.
const TAIL_MAX = 2_500_000;

// --- Empirical inverse CDF, built once from the shipped CRSP histogram --------

const HIST = crspSuperstock.histogram;
const LOG_LO = Math.log10(HIST.min);
const LOG_HI = Math.log10(HIST.max);
const BIN_W = (LOG_HI - LOG_LO) / HIST.bins;
// The underflow bucket (v < 0.1×) collects near-total losses; spread it
// log-uniformly from a 98%-loss floor up to the histogram's low edge.
const UNDER_FLOOR = 0.02;

// Bucket weights in CDF order: [underflow, ...36 log bins, overflow].
const BUCKETS = [HIST.underflow, ...HIST.counts, HIST.overflow];
const BUCKET_TOTAL = BUCKETS.reduce((s, c) => s + c, 0);
// Cumulative fraction at each bucket edge (length BUCKETS.length + 1).
const CUM = BUCKETS.reduce<number[]>(
  (acc, w) => [...acc, acc[acc.length - 1] + w / BUCKET_TOTAL],
  [0]
);
// Fraction of the distribution below the overflow (superstock) bucket.
const OVERFLOW_FROM = CUM[CUM.length - 2];

/** Bounded-Pareto inverse CDF on [lo, hi] with tail index a, for p in [0, 1). */
function paretoInv(p: number, a: number, lo: number, hi: number): number {
  const r = Math.pow(lo / hi, a);
  return lo * Math.pow(1 - p * (1 - r), -1 / a);
}

/** Inverse CDF of the shipped empirical distribution, given a tail index. */
function invCDF(u: number, alpha: number): number {
  let b = 0;
  while (b < CUM.length - 1 && u >= CUM[b + 1]) b++;
  const local = (u - CUM[b]) / (CUM[b + 1] - CUM[b]);
  if (b === 0) {
    // underflow — log-uniform across the near-total-loss floor up to HIST.min
    const lo = Math.log10(UNDER_FLOOR);
    return Math.pow(10, lo + local * (LOG_LO - lo));
  }
  if (b === BUCKETS.length - 1) return paretoInv(local, alpha, HIST.max, TAIL_MAX);
  const lo = LOG_LO + (b - 1) * BIN_W; // b - 1 is the histogram bin index
  return Math.pow(10, lo + local * BIN_W);
}

/** Mean of the fixed-midpoint reconstruction for a candidate tail index. */
function reconMean(alpha: number): number {
  let s = 0;
  for (let i = 0; i < M; i++) s += invCDF((i + 0.5) / M, alpha);
  return s / M;
}

// Solve the tail index so the reconstructed universe's mean multiple matches the
// real one. The mean falls monotonically as alpha rises, so bisect.
const TAIL_ALPHA = (() => {
  let lo = 0.2;
  let hi = 0.95;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (reconMean(mid) > crspSuperstock.meanLifetimeMultiple) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
})();

// A single fixed reference multiple standing in for "what T-bills did over a
// typical stock's life." Derived — not guessed — so the share of the universe
// that clears it matches CRSP's pctBeatTbills. (The old hard-coded 1.8× predated
// the real data; the calibrated value is ~1.3×.) Read off the (1 - pctBeatTbills)
// quantile of the reconstructed distribution.
const TBILL = (() => {
  const q = 1 - crspSuperstock.pctBeatTbills;
  const sorted = Array.from({ length: M }, (_, i) => invCDF((i + 0.5) / M, TAIL_ALPHA)).sort(
    (a, b) => a - b
  );
  return sorted[Math.floor(q * M)];
})();

// --- Formatting ---------------------------------------------------------------

const mult = (m: number) =>
  m >= 10 ? `${Math.round(m)}×` : m >= 1 ? `${+m.toFixed(1)}×` : `${+m.toFixed(2)}×`;
const pctText = (x: number) => `${Math.round(x * 100)}%`;

// --- Sampling -----------------------------------------------------------------

/**
 * A fresh simulated universe: an inverse-CDF sample of the real CRSP lifetime-
 * return distribution. The dense body of the distribution is jittered within each
 * quantile stratum so every reseed differs, while the ~2.7% "superstock" tail is
 * drawn at fixed quantiles — that pins the mean and concentration to the real
 * anchors instead of letting one lucky monster dominate the average. The array is
 * then shuffled so the winners land in random slots for the portfolio draws.
 */
function makeUniverse(seed: number): number[] {
  const rng = mulberry32(seed);
  const arr = new Array<number>(M);
  for (let i = 0; i < M; i++) {
    const mid = (i + 0.5) / M;
    const u = mid >= OVERFLOW_FROM ? mid : (i + rng()) / M;
    arr[i] = invCDF(u, TAIL_ALPHA);
  }
  // Fisher–Yates: scramble slots so a fixed portfolio draw catches different
  // stocks each reseed (multiset is unchanged, so the universe stats hold).
  for (let i = M - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
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
          {M.toLocaleString()} simulated stocks, held equal-weight, drawn from the
          real CRSP lifetime-return distribution (1925–2026). Educational only —
          not financial advice.
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

        <RealRecord />

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
              market: you rarely hold the handful of superstocks that carry it. Own
              more and more of the universe and your odds climb — the limit is owning
              everything, which is the case for indexing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * The real record: aggregate figures computed from every US common stock in CRSP
 * (1925–2026), shown beside the simulation the reader is playing with. These are
 * the actual numbers the model above is drawn from — see
 * src/data/generated/crsp-superstock.ts.
 */
function RealRecord() {
  const d = crspSuperstock;
  const pct0 = (x: number) => `${Math.round(x * 100)}%`;
  const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`;
  const [startYear, endYear] = [d.dateSpan[0].slice(0, 4), d.dateSpan[1].slice(0, 4)];
  return (
    <div className="rd-callout">
      <div className="rd-head">
        <span className="rd-badge">Real data</span>
        <h3>The actual record — every US stock, {startYear}–{endYear}</h3>
      </div>
      <div className="rd-grid">
        <div>
          <strong>{pct0(d.pctLostMoney)}</strong>
          <span>lost money outright</span>
        </div>
        <div>
          <strong>{pct0(1 - d.pctBeatTbills)}</strong>
          <span>trailed one-month T-bills</span>
        </div>
        <div>
          <strong>
            {d.medianLifetimeMultiple.toFixed(2)}× vs {Math.round(d.meanLifetimeMultiple)}×
          </strong>
          <span>median vs mean lifetime</span>
        </div>
        <div>
          <strong>{pct1(d.concentration.dollarWealthCreation.pctFirmsForAllNetCreation)}</strong>
          <span>of stocks made all the net wealth</span>
        </div>
      </div>
      <p className="rd-credit">
        {d.nStocks.toLocaleString()} US common stocks, delisting-adjusted. The
        simulation above samples this exact distribution — these are the figures it's
        drawn from. {d.source}
      </p>
    </div>
  );
}

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
  const LOG_MIN = Math.log10(0.02); // ≈ -1.7 — show the near-total-loss mass
  const LOG_MAX = Math.log10(3000); // ≈ 3.48 — room for the ~650× mean + the tail
  const BINS = 44;
  const plotW = width - pad.left - pad.right;

  const tOf = (m: number) =>
    (Math.log10(Math.min(2999, Math.max(0.02, m))) - LOG_MIN) / (LOG_MAX - LOG_MIN);
  const x = (m: number) => pad.left + tOf(m) * plotW;

  const counts = new Array(BINS).fill(0);
  for (const m of universe) {
    const b = Math.min(BINS - 1, Math.max(0, Math.floor(tOf(m) * BINS)));
    counts[b]++;
  }
  const maxC = Math.max(...counts, 1);
  const baseY = height - pad.bottom;
  const barH = (c: number) => (c / maxC) * (height - pad.top - pad.bottom);
  const breakEvenT = tOf(1);
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Histogram of individual stock lifetime returns, heavily right-skewed">
      {counts.map((c, i) => {
        const bx = pad.left + (i / BINS) * plotW;
        const loss = i / BINS < breakEvenT;
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
      {[0.1, 1, 10, 100, 1000].map((m) => (
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
  // Log axis, matching the universe chart above. Span from below the T-bill line
  // up past whichever is larger — the market mean or the portfolio's own 98th
  // percentile — so the market line stays on-scale as n (and the spread) grows.
  const LOG_MIN = Math.log10(0.3);
  const LOG_MAX = Math.log10(Math.max(market, percentile(dist, 0.98)) * 1.3);
  const BINS = 30;
  const span = LOG_MAX - LOG_MIN;

  const tOf = (m: number) => (Math.log10(Math.min(Math.max(m, 0.3), Math.pow(10, LOG_MAX))) - LOG_MIN) / span;
  const x = (m: number) => pad.left + tOf(m) * plotW;

  const counts = new Array(BINS).fill(0);
  for (const m of dist) {
    const b = Math.min(BINS - 1, Math.max(0, Math.floor(tOf(m) * BINS)));
    counts[b]++;
  }
  const maxC = Math.max(...counts, 1);
  const baseY = height - pad.bottom;
  const barH = (c: number) => (c / maxC) * (height - pad.top - pad.bottom);
  const axisText = { fill: "var(--color-muted)", fontFamily: "var(--font-sans)", fontSize: 11 } as const;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Distribution of your portfolio's outcome across many random draws">
      {counts.map((c, i) => (
        <rect key={i} x={pad.left + (i / BINS) * plotW + 1} y={baseY - barH(c)} width={plotW / BINS - 1.5} height={barH(c)} fill="var(--color-accent)" opacity={0.75} />
      ))}
      <line x1={x(TBILL)} x2={x(TBILL)} y1={pad.top} y2={baseY} stroke="var(--color-warn)" strokeWidth={1.5} strokeDasharray="4 3" />
      <text x={x(TBILL)} y={pad.top - 2} textAnchor="middle" style={{ ...axisText, fill: "var(--color-warn)" }}>T-bills</text>
      <line x1={x(market)} x2={x(market)} y1={pad.top} y2={baseY} stroke="var(--color-text)" strokeWidth={2} />
      <text x={x(market)} y={pad.top - 2} textAnchor="middle" style={{ ...axisText, fill: "var(--color-text)", fontWeight: 600 }}>market</text>
      {[1, 10, 100, 1000].map((m) => (
        <text key={m} x={x(m)} y={baseY + 16} textAnchor="middle" style={axisText}>{mult(m)}</text>
      ))}
    </svg>
  );
}
