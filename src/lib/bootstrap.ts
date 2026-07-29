import { historicalReturns, type HistoricalYear } from "../data/generated/historical-returns";
import { mulberry32 } from "./portfolio";

/**
 * Block-bootstrap Monte Carlo over real US market history (1928–present, from
 * Damodaran). Instead of a single smooth "average return", each simulated path
 * is stitched together from randomly-placed blocks of *consecutive* historical
 * years — so it keeps the real lumpiness: crashes, multi-year droughts, and the
 * sequence-of-returns pattern that a bell-curve model erases.
 *
 * Why blocks (not one year at a time): drawing years independently destroys the
 * runs — the back-to-back bad years that actually sink retirements. A circular
 * block bootstrap preserves that short-run structure while still reshuffling
 * history into many plausible alternate timelines.
 *
 * Everything is expressed in REAL (inflation-adjusted) terms by default, so a
 * path is in today's purchasing power — the honest way to read a decades-long
 * projection.
 */

export const HISTORY = historicalReturns;

export interface BootstrapOptions {
  /** Horizon in years. */
  years: number;
  /** Number of Monte Carlo paths. */
  paths: number;
  /** Block length in years (preserves runs; ~5 is a common choice). */
  blockLen: number;
  /** Stock share of the portfolio, 0–1 (remainder in 10-yr Treasuries). */
  stockPct: number;
  /** Express returns in real (inflation-adjusted) terms. Default true. */
  real?: boolean;
  seed: number;
}

/** Per-year portfolio return for a stock/bond mix, real or nominal. */
function yearReturn(y: HistoricalYear, stockPct: number, real: boolean): number {
  const nominal = stockPct * y.stocks + (1 - stockPct) * y.tbonds;
  return real ? (1 + nominal) / (1 + y.inflation) - 1 : nominal;
}

/**
 * A `paths × years` matrix of annual portfolio returns (decimals), drawn by
 * circular block bootstrap from history.
 */
export function bootstrapReturns(opts: BootstrapOptions): number[][] {
  const { years, paths, blockLen, stockPct, seed } = opts;
  const real = opts.real ?? true;
  const R = HISTORY.series.map((y) => yearReturn(y, stockPct, real));
  const N = R.length;
  const rng = mulberry32(seed);

  const out: number[][] = new Array(paths);
  for (let p = 0; p < paths; p++) {
    const path = new Array<number>(years);
    let i = 0;
    while (i < years) {
      const start = (rng() * N) | 0;
      for (let b = 0; b < blockLen && i < years; b++, i++) {
        path[i] = R[(start + b) % N];
      }
    }
    out[p] = path;
  }
  return out;
}

/** Linear-interpolated quantile of an unsorted array (p in [0,1]). */
export function quantile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const idx = p * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

export const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;

/**
 * Percentile bands across time for a `paths × (years+1)` matrix of balances.
 * Returns, for each requested probability, the value at every time step — ready
 * to draw as a fan chart.
 */
export function bandsOverTime(
  matrix: number[][],
  ps: number[]
): { p: number; series: number[] }[] {
  const steps = matrix[0]?.length ?? 0;
  const bands = ps.map((p) => ({ p, series: new Array<number>(steps) }));
  const col = new Array<number>(matrix.length);
  for (let t = 0; t < steps; t++) {
    for (let i = 0; i < matrix.length; i++) col[i] = matrix[i][t];
    col.sort((a, b) => a - b);
    for (const band of bands) {
      const idx = band.p * (col.length - 1);
      const lo = Math.floor(idx);
      const hi = Math.ceil(idx);
      band.series[t] = lo === hi ? col[lo] : col[lo] + (col[hi] - col[lo]) * (idx - lo);
    }
  }
  return bands;
}
