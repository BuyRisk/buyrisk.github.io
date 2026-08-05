/**
 * Reduce crsp_monthly.csv → src/data/generated/crsp-diversification.ts
 *
 * The real-data anchor behind /tools/how-many-stocks (StockCountLab), which
 * models portfolio volatility as  σ·√(ρ + (1−ρ)/N)  falling to a floor of σ·√ρ.
 * This measures the three inputs empirically from CRSP monthly returns:
 *   • σ  — typical single-stock annualised volatility
 *   • ρ  — average pairwise correlation between stocks
 *   • the volatility-vs-N curve — realised vol of random equal-weight portfolios
 *
 * Method (documented so every number is reproducible):
 *   History is cut into non-overlapping 60-month (5-year) windows. In each window
 *   we keep only stocks with a full 60 months of returns (so realised vol and
 *   correlation are well defined), then:
 *     – σ per stock = sample SD of its 60 monthly returns, ×√12 to annualise;
 *     – ρ = mean pairwise correlation over a random sample of those stocks;
 *     – curve[N] = mean realised annualised vol of many random equal-weight
 *       N-stock portfolios drawn from the window.
 *   Results are averaged across windows (each window = one 5-year regime, equal
 *   weight) so no single era or the survivors of one long window dominate.
 *
 * Everything emitted is universe-level — averages and a curve, never a per-stock
 * series. See data/sources/crsp/README.md for the licence firewall.
 *
 * Run:  npm run data:crsp:diversification
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { streamStocks } from "./lib/parse-crsp.mjs";
import { srcDir } from "./lib/data-paths.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSV = join(srcDir("crsp"), "crsp_monthly.csv"); // shared library (licensed/large)
const MANIFEST = join(root, "data", "sources", "crsp", "crsp_monthly.manifest.json"); // stays in-repo
const OUT = join(root, "src", "data", "generated", "crsp-diversification.ts");

const WINDOW = 60; // months per estimation window (5 years)
const MIN_ELIGIBLE = 100; // skip windows too thin to be representative (σ, ρ)
const CORR_SAMPLE = 600; // stocks sampled for the average pairwise correlation
const DRAWS_PER_N = 250; // random portfolios averaged at each N
const N_GRID = [1, 2, 3, 4, 5, 7, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 300, 400, 500];
// The curve is built only from windows with at least this many eligible stocks,
// so EVERY N on the grid is averaged over the SAME window set — otherwise the
// large-N points (drawable only in stock-rich recent windows) kink away from the
// rest. σ and ρ still use all windows ≥ MIN_ELIGIBLE.
const CURVE_MIN_ELIGIBLE = N_GRID[N_GRID.length - 1];
const SEED = 0x5eed1234;
const ANN = Math.sqrt(12); // monthly SD → annualised

// --- small deterministic helpers (seeded so re-runs are byte-identical) -------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const n = s.length;
  if (!n) return NaN;
  const m = n >> 1;
  return n % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const round = (x, dp) => {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
};

/** Sample SD (÷ n−1) of a length-L slice. */
function sd(v) {
  const n = v.length;
  let m = 0;
  for (let i = 0; i < n; i++) m += v[i];
  m /= n;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const d = v[i] - m;
    s += d * d;
  }
  return Math.sqrt(s / (n - 1));
}

/** Lower-bound binary search for the first index in [lo,hi) with mon[i] >= target. */
function lowerBound(mon, lo, hi, target) {
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (mon[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

async function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));

  // --- Load into compact global arrays + per-stock row ranges ----------------
  const monA = [];
  const retA = [];
  const stockStart = [];
  const stockLen = [];
  const t0 = Date.now();
  const { rows } = await streamStocks(CSV, ({ mon, ret }) => {
    stockStart.push(monA.length);
    stockLen.push(mon.length);
    for (let i = 0; i < mon.length; i++) {
      monA.push(mon[i]);
      retA.push(ret[i]);
    }
  });
  const mon = Int32Array.from(monA);
  const ret = Float64Array.from(retA);
  const nStocks = stockStart.length;

  let minM = Infinity;
  let maxM = -Infinity;
  for (let i = 0; i < mon.length; i++) {
    if (mon[i] < minM) minM = mon[i];
    if (mon[i] > maxM) maxM = mon[i];
  }

  // --- Build non-overlapping 60-month windows, newest first ------------------
  const windows = [];
  for (let hi = maxM; hi - WINDOW + 1 >= minM; hi -= WINDOW) {
    windows.push([hi - WINDOW + 1, hi]);
  }

  const rng = mulberry32(SEED);
  const sigmaMeans = [];
  const sigmaMedians = [];
  const rhos = [];
  const curveSum = new Array(N_GRID.length).fill(0);
  const curveCnt = new Array(N_GRID.length).fill(0);
  let usedWindows = 0;
  let curveWindows = 0;
  let eligibleTotal = 0;

  for (const [a, b] of windows) {
    // Eligible = full WINDOW months of finite returns. Collect their vectors.
    const vecs = [];
    for (let s = 0; s < nStocks; s++) {
      const start = stockStart[s];
      const end = start + stockLen[s];
      if (mon[start] > a || mon[end - 1] < b) continue; // can't span the window
      let i = lowerBound(mon, start, end, a);
      const v = new Float64Array(WINDOW);
      let ok = true;
      for (let k = 0; k < WINDOW; k++, i++) {
        if (i >= end || mon[i] !== a + k || !Number.isFinite(ret[i])) {
          ok = false;
          break;
        }
        v[k] = ret[i];
      }
      if (ok) vecs.push(v);
    }
    const E = vecs.length;
    if (E < MIN_ELIGIBLE) continue;
    usedWindows++;
    eligibleTotal += E;

    // Draw k distinct stock indices from [0,E) via partial Fisher–Yates, then
    // undo the swaps so `pool` is identity again for the next draw (O(k), no
    // per-draw O(E) reset).
    const pool = new Int32Array(E);
    for (let i = 0; i < E; i++) pool[i] = i;
    const sample = (k) => {
      const out = new Array(k);
      const js = new Array(k);
      for (let i = 0; i < k; i++) {
        const j = i + Math.floor(rng() * (E - i));
        js[i] = j;
        const tmp = pool[i];
        pool[i] = pool[j];
        pool[j] = tmp;
        out[i] = pool[i];
      }
      for (let i = k - 1; i >= 0; i--) {
        const j = js[i];
        const tmp = pool[i];
        pool[i] = pool[j];
        pool[j] = tmp;
      }
      return out;
    };

    // σ: per-stock annualised vol.
    const sig = vecs.map((v) => sd(v) * ANN);
    sigmaMeans.push(mean(sig));
    sigmaMedians.push(median(sig));

    // ρ: mean pairwise correlation over a random sample (demean → unit-norm →
    // correlation is just the dot product).
    const sampleIdx = sample(Math.min(CORR_SAMPLE, E));
    const norm = [];
    for (const idx of sampleIdx) {
      const v = vecs[idx];
      let m = 0;
      for (let k = 0; k < WINDOW; k++) m += v[k];
      m /= WINDOW;
      const d = new Float64Array(WINDOW);
      let nn = 0;
      for (let k = 0; k < WINDOW; k++) {
        d[k] = v[k] - m;
        nn += d[k] * d[k];
      }
      if (nn > 0) {
        const inv = 1 / Math.sqrt(nn);
        for (let k = 0; k < WINDOW; k++) d[k] *= inv;
        norm.push(d);
      }
    }
    let corrSum = 0;
    let corrPairs = 0;
    for (let i = 0; i < norm.length; i++) {
      for (let j = i + 1; j < norm.length; j++) {
        let dot = 0;
        const di = norm[i];
        const dj = norm[j];
        for (let k = 0; k < WINDOW; k++) dot += di[k] * dj[k];
        corrSum += dot;
        corrPairs++;
      }
    }
    if (corrPairs) rhos.push(corrSum / corrPairs);

    // curve[N]: realised annualised vol of random equal-weight N-stock portfolios.
    // Only stock-rich windows contribute, so all N share one window set (no kink).
    if (E < CURVE_MIN_ELIGIBLE) continue;
    curveWindows++;
    for (let gi = 0; gi < N_GRID.length; gi++) {
      const N = N_GRID[gi];
      if (N > E) continue;
      let acc = 0;
      const port = new Float64Array(WINDOW);
      for (let d = 0; d < DRAWS_PER_N; d++) {
        const pick = sample(N);
        port.fill(0);
        for (const idx of pick) {
          const v = vecs[idx];
          for (let k = 0; k < WINDOW; k++) port[k] += v[k];
        }
        for (let k = 0; k < WINDOW; k++) port[k] /= N;
        acc += sd(port) * ANN;
      }
      curveSum[gi] += acc / DRAWS_PER_N;
      curveCnt[gi] += 1;
    }
  }

  const sigmaAnnualMean = mean(sigmaMeans);
  const sigmaAnnualMedian = mean(sigmaMedians); // avg of window medians
  const avgPairwiseCorr = mean(rhos);
  const floorAnnual = sigmaAnnualMean * Math.sqrt(avgPairwiseCorr);

  const curve = [];
  for (let gi = 0; gi < N_GRID.length; gi++) {
    if (curveCnt[gi] === 0) continue;
    curve.push({ n: N_GRID[gi], volAnnual: round(curveSum[gi] / curveCnt[gi], 4) });
  }
  const empiricalFloor = curve[curve.length - 1]?.volAnnual ?? null;

  const out = {
    asOf: manifest.pulled_at,
    source: "Calculated from CRSP data, © Center for Research in Security Prices, LLC, via WRDS.",
    method:
      `Non-overlapping ${WINDOW}-month windows, full-data stocks only; σ = annualised sample SD ` +
      `of monthly returns; ρ = mean pairwise correlation over ${CORR_SAMPLE} sampled stocks; ` +
      `curve = ${DRAWS_PER_N} random equal-weight portfolios per N. Averaged across windows.`,
    universe: manifest.universe,
    dateSpan: manifest.date_span,
    nStocks,
    nObs: rows,
    windowMonths: WINDOW,
    nWindows: usedWindows,
    nCurveWindows: curveWindows,
    avgEligiblePerWindow: Math.round(eligibleTotal / usedWindows),
    sigmaAnnualMean: round(sigmaAnnualMean, 4),
    sigmaAnnualMedian: round(sigmaAnnualMedian, 4),
    avgPairwiseCorr: round(avgPairwiseCorr, 4),
    floorAnnual: round(floorAnnual, 4),
    empiricalFloorAnnual: empiricalFloor,
    curve,
  };

  writeFileSync(OUT, renderTs(out));
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `crsp-diversification: ${nStocks.toLocaleString()} stocks / ${rows.toLocaleString()} rows, ` +
      `${usedWindows} windows in ${secs}s\n` +
      `  σ (median stock) ${(out.sigmaAnnualMedian * 100).toFixed(1)}%   ` +
      `σ (mean) ${(out.sigmaAnnualMean * 100).toFixed(1)}%   ` +
      `ρ ${out.avgPairwiseCorr.toFixed(3)}\n` +
      `  floor σ√ρ ${(out.floorAnnual * 100).toFixed(1)}%   ` +
      `empirical (N=${curve[curve.length - 1].n}) ${(empiricalFloor * 100).toFixed(1)}%\n` +
      `  → ${OUT}`
  );
}

function renderTs(o) {
  return `// AUTO-GENERATED by scripts/reduce-crsp-diversification.mjs — DO NOT EDIT.
// Re-run: npm run data:crsp:diversification
//
// Aggregate, licence-safe statistics derived from CRSP monthly US common-stock
// returns (via WRDS). No per-stock series is shipped — see data/sources/crsp/README.md.
// Volatilities and the floor are ANNUALISED decimals (0.45 = 45% per year).

export interface CrspDiversificationCurvePoint {
  /** Number of equally-weighted stocks in the portfolio. */
  n: number;
  /** Mean realised annualised volatility of random N-stock portfolios. */
  volAnnual: number;
}

export interface CrspDiversification {
  asOf: string;
  source: string;
  method: string;
  universe: string;
  dateSpan: [string, string];
  nStocks: number;
  nObs: number;
  windowMonths: number;
  /** Windows used for σ and ρ (≥100 eligible stocks). */
  nWindows: number;
  /** Windows used for the vol-vs-N curve (≥500 eligible, so every N is comparable). */
  nCurveWindows: number;
  avgEligiblePerWindow: number;
  /** Mean single-stock annualised vol (σ), across windows. */
  sigmaAnnualMean: number;
  /** Median single-stock annualised vol — the "typical" stock, robust to microcaps. */
  sigmaAnnualMedian: number;
  /** Average pairwise correlation (ρ) between stocks. */
  avgPairwiseCorr: number;
  /** Undiversifiable floor implied by the model, σ·√ρ. */
  floorAnnual: number;
  /** Realised vol at the largest N on the curve — the empirical floor. */
  empiricalFloorAnnual: number | null;
  /** Empirical volatility-vs-number-of-stocks curve. */
  curve: CrspDiversificationCurvePoint[];
}

export const crspDiversification: CrspDiversification = ${JSON.stringify(o, null, 2)};
`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
