/**
 * Portfolio math for the Modern Portfolio Theory lab.
 *
 * Everything here is pure and deterministic given a seed, so the UI can
 * reproduce and pause simulations. The correlation structure uses a single
 * common "market" factor: each asset has a correlation rho_i to that factor,
 * and the correlation between two assets is rho_i * rho_j. This keeps the
 * covariance matrix positive-semidefinite by construction — students can add
 * any mix of assets and the math never breaks.
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

/** Covariance between two assets under the single-factor model. */
export function covariance(a: Asset, b: Asset): number {
  if (a.id === b.id) return a.sigma * a.sigma;
  return a.marketCorr * b.marketCorr * a.sigma * b.sigma;
}

/** Expected annual return of a weighted portfolio. */
export function portfolioReturn(weights: number[], assets: Asset[]): number {
  return weights.reduce((sum, w, i) => sum + w * assets[i].mu, 0);
}

/** Annual variance of a weighted portfolio (full double sum). */
export function portfolioVariance(weights: number[], assets: Asset[]): number {
  let v = 0;
  for (let i = 0; i < assets.length; i++) {
    for (let j = 0; j < assets.length; j++) {
      v += weights[i] * weights[j] * covariance(assets[i], assets[j]);
    }
  }
  return Math.max(v, 0);
}

export function portfolioVol(weights: number[], assets: Asset[]): number {
  return Math.sqrt(portfolioVariance(weights, assets));
}

/**
 * The volatility a portfolio would have if there were NO diversification —
 * the weighted average of the individual volatilities. The gap between this
 * and the true portfolio vol is the diversification benefit.
 */
export function weightedAverageVol(weights: number[], assets: Asset[]): number {
  return weights.reduce((sum, w, i) => sum + w * assets[i].sigma, 0);
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
// Randomness — a small seeded PRNG so runs are reproducible and pausable.
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

export type PortfolioPoint = {
  weights: number[];
  mu: number;
  vol: number;
  sharpe: number;
};

/** Sample a weight vector uniformly from the simplex (Dirichlet(1,...,1)). */
function randomSimplex(n: number, rng: () => number): number[] {
  // Exponential(1) via -ln(U), then normalize -> uniform on the simplex.
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
  assets: Asset[],
  count: number,
  riskFree: number,
  seed: number
): PortfolioPoint[] {
  const rng = mulberry32(seed);
  const points: PortfolioPoint[] = [];
  for (let k = 0; k < count; k++) {
    const weights = randomSimplex(assets.length, rng);
    const mu = portfolioReturn(weights, assets);
    const vol = portfolioVol(weights, assets);
    points.push({ weights, mu, vol, sharpe: sharpe(mu, vol, riskFree) });
  }
  return points;
}

export function minVariance(points: PortfolioPoint[]): PortfolioPoint {
  return points.reduce((best, p) => (p.vol < best.vol ? p : best), points[0]);
}

export function maxSharpe(points: PortfolioPoint[]): PortfolioPoint {
  return points.reduce((best, p) => (p.sharpe > best.sharpe ? p : best), points[0]);
}

// ---------------------------------------------------------------------------
// Monte Carlo simulation of correlated asset price paths + portfolio value.
// ---------------------------------------------------------------------------

export type SimPaths = {
  steps: number;
  stepsPerYear: number;
  /** One price path per asset, indexed [asset][step], starting at `start`. */
  assetPaths: number[][];
  /** Continuously-rebalanced portfolio value path, length steps + 1. */
  portfolioPath: number[];
};

/**
 * Simulate correlated geometric-Brownian price paths for each asset only.
 * Kept independent of weights so the UI can redraw a new portfolio mix
 * without disturbing (or re-randomizing) the underlying asset waveforms.
 */
export function simulateAssetPaths(
  assets: Asset[],
  years: number,
  stepsPerYear: number,
  seed: number,
  start = 100
): { steps: number; stepsPerYear: number; assetPaths: number[][] } {
  const rng = mulberry32(seed);
  const normal = makeNormal(rng);
  const steps = Math.round(years * stepsPerYear);
  const dt = 1 / stepsPerYear;
  const sqrtDt = Math.sqrt(dt);
  const assetPaths = assets.map(() => new Array(steps + 1).fill(start));
  const drift = assets.map((a) => (a.mu - 0.5 * a.sigma * a.sigma) * dt);

  for (let t = 1; t <= steps; t++) {
    const f = normal(); // shared market factor shock
    for (let i = 0; i < assets.length; i++) {
      const a = assets[i];
      const idio = normal();
      const z = a.marketCorr * f + Math.sqrt(1 - a.marketCorr * a.marketCorr) * idio;
      const logRet = drift[i] + a.sigma * sqrtDt * z;
      assetPaths[i][t] = assetPaths[i][t - 1] * Math.exp(logRet);
    }
  }
  return { steps, stepsPerYear, assetPaths };
}

/**
 * Value path of a continuously-rebalanced portfolio, derived from existing
 * asset price paths. Recomputing this on a weight change is cheap and leaves
 * the asset waveforms untouched.
 */
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

/**
 * Simulate correlated geometric-Brownian price paths for each asset and the
 * value of a continuously-rebalanced portfolio of them.
 */
export function simulatePaths(
  assets: Asset[],
  weights: number[],
  years: number,
  stepsPerYear: number,
  seed: number,
  start = 100
): SimPaths {
  const rng = mulberry32(seed);
  const normal = makeNormal(rng);
  const steps = Math.round(years * stepsPerYear);
  const dt = 1 / stepsPerYear;
  const sqrtDt = Math.sqrt(dt);

  const assetPaths = assets.map(() => new Array(steps + 1).fill(start));
  const portfolioPath = new Array(steps + 1).fill(start);

  const drift = assets.map((a) => (a.mu - 0.5 * a.sigma * a.sigma) * dt);

  for (let t = 1; t <= steps; t++) {
    const f = normal(); // shared market factor shock
    let portfolioReturnStep = 0;
    for (let i = 0; i < assets.length; i++) {
      const a = assets[i];
      const idio = normal();
      const z = a.marketCorr * f + Math.sqrt(1 - a.marketCorr * a.marketCorr) * idio;
      const logRet = drift[i] + a.sigma * sqrtDt * z;
      const simpleRet = Math.exp(logRet) - 1;
      assetPaths[i][t] = assetPaths[i][t - 1] * (1 + simpleRet);
      portfolioReturnStep += weights[i] * simpleRet;
    }
    portfolioPath[t] = portfolioPath[t - 1] * (1 + portfolioReturnStep);
  }

  return { steps, stepsPerYear, assetPaths, portfolioPath };
}

/**
 * Simulate many independent portfolio value paths (the "fan"), to show the
 * distribution of outcomes rather than a single lucky run.
 */
export function simulatePortfolioFan(
  assets: Asset[],
  weights: number[],
  years: number,
  stepsPerYear: number,
  runs: number,
  seed: number,
  start = 100
): number[][] {
  const paths: number[][] = [];
  for (let r = 0; r < runs; r++) {
    paths.push(simulatePaths(assets, weights, years, stepsPerYear, seed + r * 7919, start).portfolioPath);
  }
  return paths;
}
