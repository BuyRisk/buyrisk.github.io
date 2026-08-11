/**
 * Reduce CRSP Mutual Fund monthly data → src/data/generated/behavior-gap.ts
 *
 * The empirical "behavior gap" behind BehavioralLab: the difference between the
 * return a fund earned (TIME-weighted, buy-and-hold) and the return the average
 * invested dollar actually earned (DOLLAR-weighted / IRR of investor cash
 * flows). The gap is the cost of buying after run-ups and selling after drops.
 *
 * Method (matches Morningstar "Mind the Gap" / Dichev 2007): compute the gap at
 * the FUND level, then asset-weight across funds. Doing it fund-by-fund avoids
 * the fund entry/exit bias you get from naively summing TNA across the industry.
 *
 * For each US-equity fund with enough history:
 *   TW_i = (Π(1+mret))^(12/n) − 1                     what the fund earned
 *   flow_t = mtna_t − mtna_{t-1}·(1+mret_t)           investor net cash flow
 *   DW_i   = annualized IRR of { −mtna_0, −flow_t…, +mtna_N }   what $ earned
 *   gap_i  = TW_i − DW_i
 * Headline = Σ wᵢ·(·) / Σ wᵢ, weight wᵢ = mean TNA (the "average dollar").
 *
 * Only universe-level aggregates + a few illustrative fund gaps are emitted —
 * no full per-fund panel leaves this script (CRSP licence firewall).
 *
 * Data source: crsp_mf/Fund Summary.csv (classification), crsp_mf/Monthly
 * Returns.csv (caldt, crsp_fundno, mtna [$millions], mret, mnav), sorted by
 * (crsp_fundno, caldt). mret occasionally carries a letter code → treat as
 * missing. mtna reliable from ~1991.  N-SAR gross flows are a future refresh.
 *
 * Run:  npm run data:behavior-gap
 */
import { createReadStream, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { srcDir } from "./lib/data-paths.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MF = srcDir("crsp_mf");
const SUMMARY = join(MF, "Fund Summary.csv");
const RETURNS = join(MF, "Monthly Returns.csv");
const OUT = join(root, "src", "data", "generated", "behavior-gap.ts");

const MIN_MONTHS = 60; // ≥5y of history so the IRR is meaningful
const START_MONTH = 1991 * 12; // mtna reliable from ~1991; earlier rows are sparse
const round = (x, dp) => {
  if (!Number.isFinite(x)) return null;
  const f = 10 ** dp;
  return Math.round(x * f) / f;
};
const monthIndex = (d) => +d.slice(0, 4) * 12 + (+d.slice(5, 7) - 1);
const monthLabel = (i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
const num = (s) => (s === "" || s == null || Number.isNaN(+s) ? NaN : +s);

/** Build a header-name → column-index map from a CSV header line. */
function headerIndex(line) {
  const idx = {};
  line.split(",").forEach((h, i) => (idx[h.trim()] = i));
  return idx;
}

/**
 * Pass 1 — classify funds. Keep, per crsp_fundno, whether it is a US-equity
 * fund and a display name. CRSP objective codes beginning with "E" are equity;
 * fall back to the older `policy = CS` (common stock) when the code is blank.
 * Names/objective can change over a fund's life → take the last non-blank seen.
 */
function classifyFunds() {
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input: createReadStream(SUMMARY, { encoding: "utf8" }), crlfDelay: Infinity });
    const info = new Map(); // fundno -> { equity, name }
    let H = null;
    rl.on("line", (line) => {
      if (!H) { H = headerIndex(line); return; }
      if (line === "") return;
      const c = line.split(",");
      const fundno = c[H.crsp_fundno];
      if (!fundno) return;
      const obj = (c[H.crsp_obj_cd] ?? "").trim();
      const policy = (c[H.policy] ?? "").trim();
      const name = (c[H.fund_name] ?? "").trim();
      const isEq = obj.startsWith("E") || (obj === "" && policy === "CS");
      const prev = info.get(fundno);
      if (!prev) info.set(fundno, { equity: isEq, name });
      else {
        if (isEq) prev.equity = true; // ever-equity ⇒ equity
        if (name) prev.name = name; // last non-blank name
      }
    });
    rl.on("close", () => resolve(info));
    rl.on("error", reject);
  });
}

/** Annualized IRR of a monthly cash-flow array via bisection; null if no root. */
function annualizedIrr(cf) {
  const npv = (d) => {
    let s = 0, disc = 1;
    const g = 1 + d;
    for (let t = 0; t < cf.length; t++) { s += cf[t] / disc; disc *= g; }
    return s;
  };
  let lo = -0.9, hi = 1.0;
  let flo = npv(lo), fhi = npv(hi);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo === 0) return flo === 0 ? (1 + lo) ** 12 - 1 : null;
  if (flo * fhi > 0) return null; // no sign change → can't bracket
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2;
    const fm = npv(mid);
    if (Math.abs(fm) < 1e-9) { lo = hi = mid; break; }
    if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  const monthly = (lo + hi) / 2;
  return (1 + monthly) ** 12 - 1;
}

/**
 * Process one fund's buffered monthly rows. Contributes to (a) the POOLED
 * industry cash-flow stream and per-month asset-weighted return that drive the
 * headline gap, and (b) the "flows chase returns" chart series. Also computes
 * the fund's own time-/dollar-weighted returns for the illustrative `cases`.
 */
function processFund(mon, mtna, mret, info, agg, funds) {
  const meta = info.get(mon.fundno);
  if (!meta || !meta.equity) return;

  // Keep only the reliable window with a real reported TNA; align returns.
  const idx = [], tna = [], ret = [];
  for (let t = 0; t < mon.i.length; t++) {
    if (mon.i[t] < START_MONTH) continue;
    if (!(mtna[t] > 0)) continue; // skip months with no reported assets
    idx.push(mon.i[t]);
    tna.push(mtna[t]);
    ret.push(Number.isFinite(mret[t]) ? mret[t] : 0);
  }
  const M = idx.length;
  if (M < MIN_MONTHS) return;

  // (a) Pooled industry stream + asset-weighted monthly return. A flow between
  // consecutive months is only meaningful when the months are adjacent.
  agg.cf.set(idx[0], (agg.cf.get(idx[0]) ?? 0) - tna[0]); // initial stake in
  for (let t = 1; t < M; t++) {
    if (idx[t] !== idx[t - 1] + 1) continue; // gap — don't fabricate a flow/return
    const flow = tna[t] - tna[t - 1] * (1 + ret[t]); // investor net cash flow
    agg.cf.set(idx[t], (agg.cf.get(idx[t]) ?? 0) - flow);
    let a = agg.mo.get(idx[t]);
    if (!a) { a = { retNum: 0, retDen: 0, flowNum: 0, flowDen: 0, n: 0 }; agg.mo.set(idx[t], a); }
    a.retNum += tna[t - 1] * ret[t];
    a.retDen += tna[t - 1];
    a.flowNum += flow;
    a.flowDen += tna[t - 1];
    a.n++;
  }
  agg.cf.set(idx[M - 1], (agg.cf.get(idx[M - 1]) ?? 0) + tna[M - 1]); // terminal value out
  agg.nFunds++;

  // (b) This fund's own TW vs DW, for the `cases` picker only.
  let grow = 1;
  for (let t = 0; t < M; t++) grow *= 1 + ret[t];
  const tw = grow ** (12 / M) - 1;
  const cf = new Array(M).fill(0);
  cf[0] = -tna[0];
  let meanTna = 0;
  for (let t = 1; t < M; t++) cf[t] = -(tna[t] - tna[t - 1] * (1 + ret[t]));
  for (let t = 0; t < M; t++) meanTna += tna[t];
  cf[M - 1] += tna[M - 1];
  meanTna /= M;
  const dw = annualizedIrr(cf);
  if (dw == null || Math.abs(tw) > 0.6 || Math.abs(dw) > 0.6) return;
  funds.push({
    name: meta.name || `Fund ${mon.fundno}`,
    tw, dw, gap: tw - dw, w: meanTna, months: M,
    startY: Math.floor(idx[0] / 12), endY: Math.floor(idx[M - 1] / 12),
  });
}

/** Pass 2 — stream Monthly Returns one fund at a time (file is fundno-sorted). */
function streamReturns(info) {
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input: createReadStream(RETURNS, { encoding: "utf8" }), crlfDelay: Infinity });
    // cf: monthIndex -> pooled industry net cash flow (investor sign convention).
    // mo: monthIndex -> asset-weighted return + organic-flow accumulators.
    const agg = { cf: new Map(), mo: new Map(), nFunds: 0 };
    const funds = [];
    let H = null;
    let mon = { fundno: null, i: [] }, mtna = [], mret = [];

    const flush = () => {
      if (mon.fundno != null && mon.i.length) processFund(mon, mtna, mret, info, agg, funds);
      mon = { fundno: null, i: [] }; mtna = []; mret = [];
    };

    rl.on("line", (line) => {
      if (!H) { H = headerIndex(line); return; }
      if (line === "") return;
      const c = line.split(",");
      const fundno = c[H.crsp_fundno];
      if (!fundno) return;
      if (fundno !== mon.fundno) { flush(); mon.fundno = fundno; }
      mon.i.push(monthIndex(c[H.caldt]));
      mtna.push(num(c[H.mtna])); // NaN if blank — never fabricated as 0
      mret.push(num(c[H.mret]));
    });
    rl.on("close", () => { flush(); resolve({ agg, funds }); });
    rl.on("error", reject);
  });
}

async function main() {
  console.error("Pass 1/2: classifying funds from Fund Summary…");
  const info = await classifyFunds();
  const nEquity = [...info.values()].filter((v) => v.equity).length;
  console.error(`  ${info.size} funds, ${nEquity} classified US-equity.`);

  console.error("Pass 2/2: streaming Monthly Returns (this is the big file)…");
  const { agg, funds } = await streamReturns(info);
  console.error(`  ${agg.nFunds} equity funds with ≥${MIN_MONTHS} months of usable data.`);

  const months = [...agg.mo.keys()].sort((a, b) => a - b);

  // Headline = per-fund gap, asset-weighted by mean TNA (Morningstar/Dichev method).
  // Aggregating fund-level gaps — not raw industry flows — avoids the share-class
  // birth/death churn that makes a pooled IRR meaningless.
  let wSum = 0, twW = 0, dwW = 0, gapEqual = 0, nPos = 0;
  for (const f of funds) { wSum += f.w; twW += f.w * f.tw; dwW += f.w * f.dw; gapEqual += f.gap; if (f.gap > 0) nPos++; }
  const tw = twW / wSum;
  const dw = dwW / wSum;
  const gapsSorted = funds.map((f) => f.gap).sort((a, b) => a - b);
  const medGap = gapsSorted.length ? gapsSorted[gapsSorted.length >> 1] : NaN;
  console.error(
    `  DIAG: asset-wtd gap ${((tw - dw) * 100).toFixed(2)}pp | equal-wtd ${((gapEqual / funds.length) * 100).toFixed(2)}pp | median ${(medGap * 100).toFixed(2)}pp | ${((nPos / funds.length) * 100).toFixed(0)}% of funds positive`,
  );

  // "Flows chase returns" series (asset-weighted return vs organic net flow%).
  const flows = [];
  for (const k of months) {
    const a = agg.mo.get(k);
    if (!a || a.retDen <= 0 || a.n < 20) continue; // need a stable cross-section
    flows.push({
      date: monthLabel(k),
      ret: round(a.retNum / a.retDen, 4), // asset-weighted monthly fund return
      flowPct: round(a.flowNum / a.flowDen, 4), // net flow as % of prior assets (organic)
    });
  }
  const startY = flows.length ? +flows[0].date.slice(0, 4) : null;
  const endY = flows.length ? +flows[flows.length - 1].date.slice(0, 4) : null;

  // A few illustrative individual funds: big, long-lived, wide gap, real names.
  // Dedupe share classes (A/B/C of one fund) by the name before the ";".
  const seen = new Set();
  const cases = [];
  for (const f of funds.filter((f) => f.months >= 120 && f.w >= 200 && f.gap > 0 && /[a-z]/i.test(f.name)).sort((a, b) => b.gap - a.gap)) {
    const display = f.name.split(";")[0].trim();
    const key = display.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cases.push({ name: display, tw: round(f.tw, 4), dw: round(f.dw, 4), gapPP: round(f.gap, 4), years: `${f.startY}–${f.endY}` });
    if (cases.length >= 6) break;
  }

  const o = {
    window: startY && endY ? `${startY}–${endY}` : "n/a",
    // CRSP crsp_fundno identifies a share CLASS (A/B/C/I), not a distinct fund.
    category: "US-domiciled equity mutual-fund share classes",
    // Count the ANALYZED set (funds.length), so nFunds and pctPositive share a denominator.
    nFunds: funds.length,
    // Headline: the TYPICAL fund. Median is outlier-robust; pctPositive shows how
    // common the gap is; meanGapPP is the equal-weighted average across funds.
    medianGapPP: round(medGap, 4),
    meanGapPP: round(gapEqual / funds.length, 4),
    pctPositive: round(nPos / funds.length, 3),
    // Asset-weighted (by mean TNA) — near zero because huge steady core/index
    // funds dominate the dollars AND our 1991 start left-censors their pre-1991
    // mistiming. Kept for transparency; the gap concentrates in volatile funds.
    assetWeighted: { timeWeighted: round(tw, 4), dollarWeighted: round(dw, 4), gapPP: round(tw - dw, 4) },
    method:
      "Per-fund gap = time-weighted buy-and-hold return minus dollar-weighted IRR of investor cash flows (flows inferred month-end from ΔTNA net of return), 1991+ where TNA is reliable, funds with ≥60 months. Includes dead funds (no survivorship bias). Headline stats are across funds; the asset-weighted figure weights by mean TNA.",
    flows,
    cases,
  };

  writeFileSync(OUT, render(o));
  console.error(
    `Wrote ${OUT}\n  ${o.window}: median fund gap ${(medGap * 100).toFixed(2)}pp/yr, ${(o.pctPositive * 100).toFixed(0)}% of ${o.nFunds} analyzed share classes positive; ${flows.length} months, ${cases.length} cases.`,
  );
}

function render(o) {
  return `// AUTO-GENERATED by scripts/reduce-behavior-gap.mjs — DO NOT EDIT.
// Re-run: npm run data:behavior-gap
//
// The empirical behavior gap: what US-equity mutual FUNDS returned (time-weighted,
// buy-and-hold) vs. what the average invested DOLLAR earned (dollar-weighted IRR
// of investor cash flows). The shortfall is the cost of mistimed buying/selling.
// Fund-level gaps, asset-weighted; includes dead funds. Source: CRSP MF database.

export interface BehaviorGapCase {
  name: string;
  /** Fund time-weighted (buy-and-hold) annualized return. */
  tw: number;
  /** Investor dollar-weighted (IRR) annualized return. */
  dw: number;
  /** Gap in return points per year (tw − dw). */
  gapPP: number;
  years: string;
}
export interface BehaviorGapFlow {
  date: string; // YYYY-MM
  /** Asset-weighted monthly fund return that month. */
  ret: number;
  /** Investor net flow as a share of prior-month assets (organic growth). */
  flowPct: number;
}
export interface BehaviorGap {
  window: string;
  category: string;
  nFunds: number;
  /** Median per-fund gap (points/yr) — the typical fund. */
  medianGapPP: number;
  /** Equal-weighted mean per-fund gap (points/yr). */
  meanGapPP: number;
  /** Share of funds whose investors trailed the fund (gap > 0). */
  pctPositive: number;
  /** Asset-weighted view (weights by mean TNA); ~0, see note in the reducer. */
  assetWeighted: { timeWeighted: number; dollarWeighted: number; gapPP: number };
  method: string;
  flows: BehaviorGapFlow[];
  cases: BehaviorGapCase[];
}

export const behaviorGap: BehaviorGap = ${JSON.stringify(o, null, 2)};
`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
