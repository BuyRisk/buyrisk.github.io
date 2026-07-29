/**
 * Reduce crsp_monthly.csv → src/data/generated/crsp-superstock.ts
 *
 * The real-data anchor behind /tools/superstocks (SuperstockLab). Replicates
 * Bessembinder (2018, "Do Stocks Outperform Treasury Bills?") at the STOCK
 * level: each stock counts once (equal weight across stocks), summarised by its
 * lifetime buy-and-hold return.
 *
 * For each stock, over every month it appears in the sample:
 *   v_i = Π(1 + ret)         terminal value of $1, delisting-adjusted (CIZ mthret)
 *   b_i = Π(1 + rf)          terminal value of $1 in one-month T-bills, SAME months
 * with a missing monthly return treated as 0% (keeps the stock alive across the
 * gap). "Beat T-bills" ⟺ v_i > b_i; "lost money" ⟺ v_i < 1.
 *
 * Everything emitted is a universe-level aggregate (shares, mean/median, bucket
 * counts, top-k concentration) — no per-permno row ever leaves this script, so
 * the CRSP licence firewall holds. See data/sources/crsp/README.md.
 *
 * Run:  npm run data:crsp:superstock
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { streamStocks, loadTbillMonthly, monthIndex } from "./lib/parse-crsp.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSV = join(root, "data", "sources", "crsp", "crsp_monthly.csv");
const MANIFEST = join(root, "data", "sources", "crsp", "crsp_monthly.manifest.json");
const FRENCH = join(root, "data", "sources", "french", "F-F_Research_Data_Factors.csv");
const OUT = join(root, "src", "data", "generated", "crsp-superstock.ts");

// Log-multiple histogram grid — matches SuperstockLab's display axis (0.1×–200×).
const HIST_MIN = 0.1;
const HIST_MAX = 200;
const HIST_BINS = 36;
const LOG_LO = Math.log10(HIST_MIN);
const LOG_HI = Math.log10(HIST_MAX);

function median(sortedAsc) {
  const n = sortedAsc.length;
  if (n === 0) return NaN;
  const mid = n >> 1;
  return n % 2 ? sortedAsc[mid] : (sortedAsc[mid - 1] + sortedAsc[mid]) / 2;
}

const round = (x, dp) => {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
};

async function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const rf = loadTbillMonthly(FRENCH);

  // T-bill growth index across the whole sample, so a dollar of wealth created in
  // any month can be carried to a COMMON end date (present-value-neutral, the way
  // Bessembinder compares eras). fvToEnd(m) = value at sample-end of $1 held in
  // T-bills from end-of-month m onward.
  const [startStr, endStr] = manifest.date_span;
  const minM = monthIndex(startStr);
  const maxM = monthIndex(endStr);
  const G = new Float64Array(maxM - minM + 1); // cumulative (1+rf) product to month m
  let g = 1;
  for (let m = minM; m <= maxM; m++) {
    const rfm = rf.get(m);
    g *= 1 + (rfm === undefined ? 0 : rfm);
    G[m - minM] = g;
  }
  const gEnd = G[maxM - minM];
  const fvToEnd = (m) => (m < minM || m > maxM ? 1 : gEnd / G[m - minM]);

  const V = []; // lifetime terminal value of $1 (buy & hold), per stock
  const WC1 = []; // equal-$1 net wealth vs T-bills: v_i - b_i (rewards longevity)
  const WCD = []; // market-cap-weighted $ wealth creation vs T-bills, end-$ (Bessembinder)
  let nLost = 0;
  let nBeat = 0;

  const counts = new Array(HIST_BINS).fill(0);
  let underflow = 0; // v < 0.1×  (near-total losses)
  let overflow = 0; // v > 200×  (the superstocks)

  const t0 = Date.now();
  const { stocks, rows } = await streamStocks(CSV, ({ mon, ret, me }) => {
    let v = 1;
    let b = 1;
    let wcDollar = 0;
    for (let i = 0; i < ret.length; i++) {
      const r = Number.isFinite(ret[i]) ? ret[i] : 0; // missing month → flat
      v *= 1 + r;
      const rfm = rf.get(mon[i]) ?? 0; // pre-192607 months: rf≈0
      b *= 1 + rfm;
      // Dollar wealth creation: capital at risk during month i is last month's
      // market equity; the excess return it earns is carried to the sample end.
      if (i > 0 && Number.isFinite(ret[i]) && Number.isFinite(me[i - 1])) {
        wcDollar += me[i - 1] * (ret[i] - rfm) * fvToEnd(mon[i]);
      }
    }
    V.push(v);
    WC1.push(v - b);
    WCD.push(wcDollar);
    if (v < 1) nLost++;
    if (v > b) nBeat++;

    if (v < HIST_MIN) underflow++;
    else if (v > HIST_MAX) overflow++;
    else {
      const t = (Math.log10(v) - LOG_LO) / (LOG_HI - LOG_LO);
      const bin = Math.min(HIST_BINS - 1, Math.max(0, Math.floor(t * HIST_BINS)));
      counts[bin]++;
    }
  });

  const n = V.length;
  const total = V.reduce((s, x) => s + x, 0);
  const meanMultiple = total / n;
  const sortedV = [...V].sort((a, b) => a - b);
  const medianMultiple = median(sortedV);

  // Share of aggregate GROSS positive wealth creation from the top k% of stocks
  // (denominator excludes wealth-destroyers): "of all wealth created, the top k%
  // produced X% of it." Works for any per-stock creation vector.
  const concentration = (vec) => {
    const desc = [...vec].sort((a, b) => b - a);
    const grossPos = desc.reduce((s, x) => (x > 0 ? s + x : s), 0);
    const net = desc.reduce((s, x) => s + x, 0);
    const share = (frac) => {
      const k = Math.max(1, Math.round(n * frac));
      let s = 0;
      for (let i = 0; i < k; i++) s += desc[i];
      return s / grossPos;
    };
    // Smallest count of top firms whose cumulative creation reaches the NET total
    // — i.e. the firms beyond it collectively cancel out. Bessembinder's headline.
    let acc = 0;
    let kAll = n;
    for (let i = 0; i < n; i++) {
      acc += desc[i];
      if (acc >= net) {
        kAll = i + 1;
        break;
      }
    }
    let pos = 0;
    for (const x of vec) if (x > 0) pos++;
    return {
      top1: round(share(0.01), 4),
      top5: round(share(0.05), 4),
      top10: round(share(0.1), 4),
      pctFirmsPositive: round(pos / n, 4),
      pctFirmsForAllNetCreation: round(kAll / n, 4),
    };
  };

  const out = {
    asOf: manifest.pulled_at,
    source: "Calculated from CRSP data, © Center for Research in Security Prices, LLC, via WRDS.",
    method:
      "Bessembinder (2018) stock-level lifetime buy-and-hold; equal weight across stocks; " +
      "delisting-adjusted; beat-T-bills vs matched one-month T-bill (French RF) accumulation. " +
      "Dollar wealth creation is market-cap-weighted excess-over-T-bill return, carried to the " +
      "sample end at the T-bill rate.",
    universe: manifest.universe,
    dateSpan: manifest.date_span,
    nStocks: n,
    pctLostMoney: round(nLost / n, 4),
    pctBeatTbills: round(nBeat / n, 4),
    meanLifetimeMultiple: round(meanMultiple, 3),
    medianLifetimeMultiple: round(medianMultiple, 3),
    meanLifetimeReturn: round(meanMultiple - 1, 3),
    medianLifetimeReturn: round(medianMultiple - 1, 3),
    histogram: {
      scale: "log10-multiple",
      min: HIST_MIN,
      max: HIST_MAX,
      bins: HIST_BINS,
      counts,
      underflow,
      overflow,
    },
    concentration: {
      // PRIMARY: Bessembinder's dollar wealth creation vs T-bills (size-weighted,
      // era-neutralised). This is the citeable "few stocks make all the wealth".
      dollarWealthCreation: concentration(WCD),
      // SECONDARY: equal $1 bet on each stock at its first month, net of T-bills.
      // Mirrors the tool's equal-weight model but also rewards sheer longevity.
      equalDollarBuyAndHold: concentration(WC1),
    },
  };

  writeFileSync(OUT, renderTs(out));
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const dwc = out.concentration.dollarWealthCreation;
  console.log(
    `crsp-superstock: ${stocks.toLocaleString()} stocks / ${rows.toLocaleString()} rows in ${secs}s\n` +
      `  lost money: ${(out.pctLostMoney * 100).toFixed(1)}%   ` +
      `beat T-bills: ${(out.pctBeatTbills * 100).toFixed(1)}%\n` +
      `  mean multiple ${out.meanLifetimeMultiple}× vs median ${out.medianLifetimeMultiple}×\n` +
      `  $-wealth creation: top 1% = ${(dwc.top1 * 100).toFixed(1)}%   ` +
      `${(dwc.pctFirmsForAllNetCreation * 100).toFixed(1)}% of firms made 100% of net wealth\n` +
      `  → ${OUT}`
  );
}

function renderTs(o) {
  return `// AUTO-GENERATED by scripts/reduce-crsp-superstock.mjs — DO NOT EDIT.
// Re-run: npm run data:crsp:superstock
//
// Aggregate, licence-safe statistics derived from CRSP monthly US common-stock
// returns (via WRDS). No per-stock rows are shipped — see data/sources/crsp/README.md.
// Returns are lifetime buy-and-hold multiples ("2.5" = $1 grew to $2.50 = +150%).

export interface CrspSuperstockHistogram {
  /** Bucketing scheme for \`counts\`: log10 of the lifetime value multiple. */
  scale: "log10-multiple";
  /** Low edge of the first bin, as a value multiple (e.g. 0.1 = 0.1×). */
  min: number;
  /** High edge of the last bin, as a value multiple. */
  max: number;
  bins: number;
  /** Stock counts per log-spaced bin, from \`min\` to \`max\`. */
  counts: number[];
  /** Stocks below \`min\` (near-total losses). */
  underflow: number;
  /** Stocks above \`max\` (the superstocks). */
  overflow: number;
}

export interface CrspSuperstock {
  asOf: string;
  source: string;
  method: string;
  universe: string;
  dateSpan: [string, string];
  nStocks: number;
  /** Share of stocks whose lifetime buy-and-hold return was negative (v < 1). */
  pctLostMoney: number;
  /** Share of stocks that beat a matched one-month T-bill investment. */
  pctBeatTbills: number;
  meanLifetimeMultiple: number;
  medianLifetimeMultiple: number;
  meanLifetimeReturn: number;
  medianLifetimeReturn: number;
  histogram: CrspSuperstockHistogram;
  concentration: {
    /** Bessembinder dollar wealth creation vs T-bills (market-cap-weighted). */
    dollarWealthCreation: CrspConcentration;
    /** Equal $1 in each stock at inception, net of T-bills (rewards longevity too). */
    equalDollarBuyAndHold: CrspConcentration;
  };
}

export interface CrspConcentration {
  /** Share of aggregate POSITIVE wealth creation from the top 1% of stocks. */
  top1: number;
  top5: number;
  top10: number;
  /** Share of stocks that created any wealth (creation > 0). */
  pctFirmsPositive: number;
  /** Share of top stocks whose cumulative creation equals 100% of the net total. */
  pctFirmsForAllNetCreation: number;
}

export const crspSuperstock: CrspSuperstock = ${JSON.stringify(o, null, 2)};
`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
