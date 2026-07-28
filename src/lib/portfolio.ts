/**
 * Portfolio math for the Modern Portfolio Theory lab.
 *
 * Pure and deterministic given a seed. Correlations are expressed as a full
 * correlation matrix so the tool can support both a single common "market"
 * factor (N assets) and a directly-set pairwise correlation (2-asset mode).
 * The matrix is turned into a covariance matrix for the mean-variance math and
 * Cholesky-factored to drive correlated Monte Carlo paths.
 */

export type Asset = {
  id: string;
  name: string;
  /** Expected annual return, as a decimal (0.10 = 10%). */
  mu: number;
  /** Annual volatility (standard deviation), as a decimal. */
  sigma: number;
  /** Correlation with the common market factor, in [-1, 1]. */
  marketCorr: number;
  /** Chart color (a CSS custom property or literal). */
  color: string;
  custom?: boolean;
};

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

// ---------------------------------------------------------------------------
// Correlation / covariance
// ---------------------------------------------------------------------------

/**
 * Correlation matrix for the current assets. With exactly two assets and a
 * `pairCorr` supplied, that value is used directly (so students can dial the
 * correlation across the full -1..+1 range). Otherwise correlations come from
 * the single market factor: corr(i, j) = marketCorr_i * marketCorr_j.
 */
export function correlationMatrix(assets: Asset[], pairCorr: number | null): number[][] {
  const n = assets.length;
  const C: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
  if (n === 2 && pairCorr != null) {
    const r = clamp(pairCorr, -0.999, 0.999);
    C[0][1] = C[1][0] = r;
    return C;
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) C[i][j] = clamp(assets[i].marketCorr * assets[j].marketCorr, -0.999, 0.999);
    }
  }
  return C;
}

export function covarianceMatrix(C: number[][], sigmas: number[]): number[][] {
  const n = sigmas.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => C[i][j] * sigmas[i] * sigmas[j])
  );
}

/** Lower-triangular Cholesky factor L with A = L·Lᵀ (A must be PSD). */
export function cholesky(A: number[][]): number[][] {
  const n = A.length;
  const L = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];
      if (i === j) {
        L[i][j] = Math.sqrt(Math.max(1e-12, A[i][i] - sum));
      } else {
        L[i][j] = (A[i][j] - sum) / (L[j][j] || 1e-9);
      }
    }
  }
  return L;
}

// ---------------------------------------------------------------------------
// Portfolio statistics
// ---------------------------------------------------------------------------

export function portfolioReturn(weights: number[], mus: number[]): number {
  return weights.reduce((s, w, i) => s + w * mus[i], 0);
}

export function portfolioVariance(weights: number[], cov: number[][]): number {
  let v = 0;
  for (let i = 0; i < weights.length; i++) {
    for (let j = 0; j < weights.length; j++) v += weights[i] * weights[j] * cov[i][j];
  }
  return Math.max(v, 0);
}

export function portfolioVol(weights: number[], cov: number[][]): number {
  return Math.sqrt(portfolioVariance(weights, cov));
}

/** Weighted average of individual vols — the "no diversification" benchmark. */
export function weightedAverageVol(weights: number[], sigmas: number[]): number {
  return weights.reduce((s, w, i) => s + w * sigmas[i], 0);
}

export function sharpe(mu: number, vol: number, riskFree: number): number {
  return vol <= 1e-9 ? 0 : (mu - riskFree) / vol;
}

/** Normalize raw weights to sum to 1. Falls back to equal weights. */
export function normalizeWeights(raw: number[]): number[] {
  const total = raw.reduce((s, w) => s + Math.max(0, w), 0);
  if (total <= 0) return raw.map(() => 1 / raw.length);
  return raw.map((w) => Math.max(0, w) / total);
}

// ---------------------------------------------------------------------------
// Randomness — a small seeded PRNG so runs are reproducible.
// ---------------------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard-normal generator (Box–Muller) backed by a uniform RNG. */
export function makeNormal(rng: () => number): () => number {
  let spare: number | null = null;
  return function (): number {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u = 0;
    let v = 0;
    let s = 0;
    do {
      u = rng() * 2 - 1;
      v = rng() * 2 - 1;
      s = u * u + v * v;
    } while (s === 0 || s >= 1);
    const mul = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * mul;
    return u * mul;
  };
}

// ---------------------------------------------------------------------------
// Efficient frontier — a cloud of random long-only portfolios.
// ---------------------------------------------------------------------------

export type PortfolioPoint = { weights: number[]; mu: number; vol: number };

/** Sample a weight vector uniformly from the simplex (Dirichlet(1,...,1)). */
function randomSimplex(n: number, rng: () => number): number[] {
  const w = new Array(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const e = -Math.log(1 - rng());
    w[i] = e;
    total += e;
  }
  return w.map((x) => x / total);
}

export function randomPortfolios(
  mus: number[],
  cov: number[][],
  count: number,
  seed: number
): PortfolioPoint[] {
  const rng = mulberry32(seed);
  const points: PortfolioPoint[] = [];
  for (let k = 0; k < count; k++) {
    const weights = randomSimplex(mus.length, rng);
    points.push({
      weights,
      mu: portfolioReturn(weights, mus),
      vol: portfolioVol(weights, cov),
    });
  }
  return points;
}

export function minVariance(points: PortfolioPoint[]): PortfolioPoint {
  return points.reduce((best, p) => (p.vol < best.vol ? p : best), points[0]);
}

export function maxSharpe(points: PortfolioPoint[], riskFree: number): PortfolioPoint {
  return points.reduce(
    (best, p) =>
      sharpe(p.mu, p.vol, riskFree) > sharpe(best.mu, best.vol, riskFree) ? p : best,
    points[0]
  );
}

/**
 * The efficient part of the frontier: the upper-left boundary of the cloud,
 * from the minimum-variance point up-and-right. Returns points sorted by vol.
 */
export function efficientFrontier(points: PortfolioPoint[]): { vol: number; mu: number }[] {
  const sorted = [...points].sort((a, b) => a.vol - b.vol);
  const out: { vol: number; mu: number }[] = [];
  let maxMu = -Infinity;
  for (const p of sorted) {
    if (p.mu > maxMu + 1e-9) {
      out.push({ vol: p.vol, mu: p.mu });
      maxMu = p.mu;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Monte Carlo simulation of correlated asset price paths + portfolio value.
// ---------------------------------------------------------------------------

/**
 * Correlated geometric-Brownian price paths for each asset. Correlated shocks
 * are produced from independent normals via z = L·ε, where L is the Cholesky
 * factor of the correlation matrix.
 */
export function simulateAssetPaths(
  mus: number[],
  sigmas: number[],
  L: number[][],
  years: number,
  stepsPerYear: number,
  seed: number,
  start = 100
): { steps: number; stepsPerYear: number; assetPaths: number[][] } {
  const n = mus.length;
  const rng = mulberry32(seed);
  const normal = makeNormal(rng);
  const steps = Math.round(years * stepsPerYear);
  const dt = 1 / stepsPerYear;
  const sqrtDt = Math.sqrt(dt);
  const assetPaths = mus.map(() => new Array(steps + 1).fill(start));
  const drift = mus.map((m, i) => (m - 0.5 * sigmas[i] * sigmas[i]) * dt);
  const eps = new Array(n);
  const z = new Array(n);

  for (let t = 1; t <= steps; t++) {
    for (let i = 0; i < n; i++) eps[i] = normal();
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = 0; k <= i; k++) s += L[i][k] * eps[k];
      z[i] = s;
    }
    for (let i = 0; i < n; i++) {
      const logRet = drift[i] + sigmas[i] * sqrtDt * z[i];
      assetPaths[i][t] = assetPaths[i][t - 1] * Math.exp(logRet);
    }
  }
  return { steps, stepsPerYear, assetPaths };
}

/** Value path of a continuously-rebalanced portfolio, from asset price paths. */
export function rebalancedPortfolioPath(
  assetPaths: number[][],
  weights: number[],
  start = 100
): number[] {
  if (assetPaths.length === 0) return [start];
  const steps = assetPaths[0].length - 1;
  const out = new Array(steps + 1).fill(start);
  for (let t = 1; t <= steps; t++) {
    let r = 0;
    for (let i = 0; i < assetPaths.length; i++) {
      r += weights[i] * (assetPaths[i][t] / assetPaths[i][t - 1] - 1);
    }
    out[t] = out[t - 1] * (1 + r);
  }
  return out;
}

/** A few full portfolio paths — the visible "fan" of alternate outcomes. */
export function simulatePortfolioFan(
  mus: number[],
  sigmas: number[],
  L: number[][],
  weights: number[],
  years: number,
  stepsPerYear: number,
  runs: number,
  seed: number,
  start = 100
): number[][] {
  const paths: number[][] = [];
  for (let r = 0; r < runs; r++) {
    const sim = simulateAssetPaths(mus, sigmas, L, years, stepsPerYear, seed + r * 7919, start);
    paths.push(rebalancedPortfolioPath(sim.assetPaths, weights, start));
  }
  return paths;
}

/**
 * Correlated mean-reverting (Ornstein–Uhlenbeck) series, centered at zero — the
 * noisy analog of a wave. Each series has stationary std ≈ sigma_i and the
 * cross-correlations of the correlation matrix behind L. Used to show that with
 * real randomness, diversification never cancels variance perfectly.
 */
export function simulateOU(
  sigmas: number[],
  L: number[][],
  length: number,
  seed: number,
  theta = 0.07,
  warmup = 200
): number[][] {
  const n = sigmas.length;
  const rng = mulberry32(seed);
  const normal = makeNormal(rng);
  const persist = 1 - theta;
  const shock = sigmas.map((s) => s * Math.sqrt(2 * theta - theta * theta));
  const X = new Array(n).fill(0);
  const series = sigmas.map(() => new Array(length).fill(0));
  const eps = new Array(n);
  const z = new Array(n);
  const total = warmup + length;
  for (let t = 0; t < total; t++) {
    for (let i = 0; i < n; i++) eps[i] = normal();
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = 0; k <= i; k++) s += L[i][k] * eps[k];
      z[i] = s;
    }
    for (let i = 0; i < n; i++) {
      X[i] = X[i] * persist + shock[i] * z[i];
      if (t >= warmup) series[i][t - warmup] = X[i];
    }
  }
  return series;
}

export type OutcomeStats = {
  terminals: number[]; // ending portfolio value per run (start = 100)
  drawdowns: number[]; // worst peak-to-trough drop per run, as a fraction
  probLoss: number; // fraction of runs ending below the starting value
};

/**
 * Many portfolio runs, summarized to terminal values and max drawdowns —
 * without keeping every full path in memory.
 */
export function simulateOutcomeStats(
  mus: number[],
  sigmas: number[],
  L: number[][],
  weights: number[],
  years: number,
  stepsPerYear: number,
  runs: number,
  seed: number,
  start = 100
): OutcomeStats {
  const terminals: number[] = [];
  const drawdowns: number[] = [];
  let losses = 0;
  for (let r = 0; r < runs; r++) {
    const sim = simulateAssetPaths(mus, sigmas, L, years, stepsPerYear, seed + r * 6113, start);
    const path = rebalancedPortfolioPath(sim.assetPaths, weights, start);
    const terminal = path[path.length - 1];
    terminals.push(terminal);
    if (terminal < start) losses++;
    let peak = path[0];
    let maxDd = 0;
    for (const v of path) {
      if (v > peak) peak = v;
      const dd = (peak - v) / peak;
      if (dd > maxDd) maxDd = dd;
    }
    drawdowns.push(maxDd);
  }
  return { terminals, drawdowns, probLoss: losses / runs };
}

/** Value at percentile p (0..1) of an array (linear interpolation). */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = clamp(p, 0, 1) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
