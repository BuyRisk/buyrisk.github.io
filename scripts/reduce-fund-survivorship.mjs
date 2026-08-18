/**
 * Reduce CRSP Mutual Fund data → src/data/generated/fund-survivorship.ts
 *
 * Two companion lessons for the "Beat it with active funds" tab:
 *
 *  1. THE GRAVEYARD (survivorship bias). Mutual funds die constantly — bad ones
 *     are closed or quietly merged away. Average only the funds alive TODAY and
 *     the record looks better than what investors actually lived through,
 *     because the losers were deleted from the sample. We measure it: the mean
 *     annualized lifetime return of surviving equity funds minus that of ALL
 *     equity funds (dead included) = the survivorship overstatement, plus the
 *     share of funds that survive 5/10/15/20 years.
 *
 *  2. DO WINNERS REPEAT? (performance persistence). Rank active equity funds
 *     into quartiles by one 5-year window's return, then see where each lands
 *     in the NEXT 5-year window (SPIVA Persistence Scorecard method). If skill
 *     drove the ranking, top-quartile funds should repeat far more than the
 *     25% chance level. They don't.
 *
 * Universe: equity share classes (crsp_obj_cd E*; blank code + policy CS also
 * counts), CRSP survivor-bias-free MF database, 1991+ (matching the behavior-
 * gap tool's window; returns exist earlier but the modern fund era starts
 * here). Persistence additionally EXCLUDES index funds (index_fund_flag = Y) —
 * the question is whether active winners repeat. "Share classes" not "funds"
 * (crsp_fundno is a share-class id), stated in the copy.
 *
 * Only universe-level aggregates ship — no per-fund rows (CRSP licence
 * firewall).
 *
 * Run:  npm run data:fund-survivorship
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
const OUT = join(root, "src", "data", "generated", "fund-survivorship.ts");

const START_YEAR = 1991;
const START_MONTH = START_YEAR * 12;
const MIN_MONTHS = 12; // graveyard universe: at least a year of returns
// Non-overlapping 5-year persistence windows (calendar years, inclusive).
const WINDOWS = [
  [1991, 1995], [1996, 2000], [2001, 2005], [2006, 2010],
  [2011, 2015], [2016, 2020], [2021, 2025],
];
const WIN_MIN_MONTHS = 54; // ≥54 of 60 months to qualify in a window

const round = (x, dp) => {
  if (!Number.isFinite(x)) return null;
  const f = 10 ** dp;
  return Math.round(x * f) / f;
};
const monthIndex = (d) => +d.slice(0, 4) * 12 + (+d.slice(5, 7) - 1);
const num = (s) => (s === "" || s == null || Number.isNaN(+s) ? NaN : +s);
const median = (arr) => (arr.length ? arr.slice().sort((a, b) => a - b)[arr.length >> 1] : NaN);
const mean = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : NaN);

function headerIndex(line) {
  const idx = {};
  line.split(",").forEach((h, i) => (idx[h.trim()] = i));
  return idx;
}

/** Pass 1 — per share class: equity?, index fund?, dead? (last non-blank wins). */
function classifyFunds() {
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input: createReadStream(SUMMARY, { encoding: "utf8" }), crlfDelay: Infinity });
    const info = new Map();
    let H = null;
    rl.on("line", (line) => {
      if (!H) { H = headerIndex(line); return; }
      if (line === "") return;
      const c = line.split(",");
      const fundno = c[H.crsp_fundno];
      if (!fundno) return;
      const obj = (c[H.crsp_obj_cd] ?? "").trim();
      const policy = (c[H.policy] ?? "").trim();
      const isEq = obj.startsWith("E") || (obj === "" && policy === "CS");
      const idx = (c[H.index_fund_flag] ?? "").trim();
      const dead = (c[H.dead_flag] ?? "").trim();
      const prev = info.get(fundno);
      if (!prev) info.set(fundno, { equity: isEq, index: idx === "Y" || idx === "B" || idx === "D" || idx === "E", dead: dead === "Y" });
      else {
        if (isEq) prev.equity = true;
        if (idx) prev.index = idx === "Y" || idx === "B" || idx === "D" || idx === "E";
        if (dead) prev.dead = dead === "Y";
      }
    });
    rl.on("close", () => resolve(info));
    rl.on("error", reject);
  });
}

/** Which persistence window (index) a month belongs to, or -1. */
function windowOf(mi) {
  const y = Math.floor(mi / 12);
  for (let w = 0; w < WINDOWS.length; w++) {
    if (y >= WINDOWS[w][0] && y <= WINDOWS[w][1]) return w;
  }
  return -1;
}

/** Pass 2 — stream Monthly Returns (fundno-sorted); per-fund aggregates only. */
function streamReturns(info) {
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input: createReadStream(RETURNS, { encoding: "utf8" }), crlfDelay: Infinity });
    const funds = []; // per share class: lifetime + per-window aggregates
    let H = null;
    let cur = null; // rolling per-fund accumulator
    let maxMonth = -Infinity;

    const flush = () => {
      if (cur && cur.months >= MIN_MONTHS) funds.push(cur);
      cur = null;
    };

    rl.on("line", (line) => {
      if (!H) { H = headerIndex(line); return; }
      if (line === "") return;
      const c = line.split(",");
      const fundno = c[H.crsp_fundno];
      if (!fundno) return;
      if (!cur || fundno !== cur.fundno) {
        flush();
        const meta = info.get(fundno);
        cur = meta && meta.equity
          ? { fundno, meta, first: Infinity, last: -Infinity, prod: 1, months: 0, win: WINDOWS.map(() => ({ prod: 1, n: 0 })) }
          : { fundno, meta: null, months: -1 }; // non-equity: skip cheaply
      }
      if (!cur.meta) return;
      const mi = monthIndex(c[H.caldt]);
      if (mi < START_MONTH) return;
      const r = num(c[H.mret]);
      if (!Number.isFinite(r)) return; // letter codes / blanks: not a return month
      if (mi > maxMonth) maxMonth = mi;
      if (mi < cur.first) cur.first = mi;
      if (mi > cur.last) cur.last = mi;
      cur.prod *= 1 + r;
      cur.months++;
      const w = windowOf(mi);
      if (w >= 0) { cur.win[w].prod *= 1 + r; cur.win[w].n++; }
    });
    rl.on("close", () => { flush(); resolve({ funds, maxMonth }); });
    rl.on("error", reject);
  });
}

async function main() {
  console.error("Pass 1/2: classifying share classes…");
  const info = await classifyFunds();
  console.error(`  ${info.size} share classes in Fund Summary.`);

  console.error("Pass 2/2: streaming Monthly Returns…");
  const { funds, maxMonth } = await streamReturns(info);
  console.error(`  ${funds.length} equity share classes with ≥${MIN_MONTHS} months since ${START_YEAR}.`);

  // ---- 1. The graveyard --------------------------------------------------
  // Annualized lifetime return per fund; |ann| > 60%/yr = data glitch, drop.
  const usable = funds
    .map((f) => ({ ...f, ann: f.prod ** (12 / f.months) - 1 }))
    .filter((f) => Number.isFinite(f.ann) && Math.abs(f.ann) <= 0.6);
  const dead = usable.filter((f) => f.meta.dead);
  const alive = usable.filter((f) => !f.meta.dead);

  const survivalByHorizon = [5, 10, 15, 20].map((h) => {
    // Risk set: funds born at least h years before the sample end, so every
    // member had the chance to survive h years. Survived = lifespan ≥ h years
    // (last-first span; still-alive funds run to their last reported month).
    const riskSet = usable.filter((f) => maxMonth - f.first >= h * 12);
    const survived = riskSet.filter((f) => f.last - f.first + 1 >= h * 12);
    return { h, n: riskSet.length, pctSurvived: round(survived.length / riskSet.length, 3) };
  });

  const graveyard = {
    nAll: usable.length,
    nDead: dead.length,
    pctDead: round(dead.length / usable.length, 3),
    meanAnnAll: round(mean(usable.map((f) => f.ann)), 4),
    meanAnnSurvivors: round(mean(alive.map((f) => f.ann)), 4),
    medianAnnAll: round(median(usable.map((f) => f.ann)), 4),
    medianAnnSurvivors: round(median(alive.map((f) => f.ann)), 4),
    survivalByHorizon,
  };
  const overMean = graveyard.meanAnnSurvivors - graveyard.meanAnnAll;
  console.error(
    `  graveyard: ${graveyard.nAll} classes, ${(graveyard.pctDead * 100).toFixed(0)}% dead | ` +
      `survivors ${(graveyard.meanAnnSurvivors * 100).toFixed(2)}%/yr vs all ${(graveyard.meanAnnAll * 100).toFixed(2)}%/yr ` +
      `(overstatement ${(overMean * 100).toFixed(2)}pp)`,
  );

  // ---- 2. Do winners repeat? --------------------------------------------
  // Active (non-index) equity classes; quartile in window w vs outcome in w+1.
  const active = funds.filter((f) => !f.meta.index);
  // matrix[fromQuartile][toQuartile 0..3, 4 = gone]; Q0 = top quartile.
  const matrix = Array.from({ length: 4 }, () => [0, 0, 0, 0, 0]);
  const pairsUsed = [];
  for (let w = 0; w + 1 < WINDOWS.length; w++) {
    const cohort = active
      .filter((f) => f.win[w].n >= WIN_MIN_MONTHS)
      .map((f) => ({
        r1: f.win[w].prod ** (12 / f.win[w].n) - 1,
        q2n: f.win[w + 1].n,
        r2: f.win[w + 1].n >= WIN_MIN_MONTHS ? f.win[w + 1].prod ** (12 / f.win[w + 1].n) - 1 : null,
      }))
      .filter((f) => Number.isFinite(f.r1) && Math.abs(f.r1) <= 0.6 && (f.r2 == null || Math.abs(f.r2) <= 0.6));
    if (cohort.length < 200) continue;
    pairsUsed.push(`${WINDOWS[w][0]}–${WINDOWS[w][1]} → ${WINDOWS[w + 1][0]}–${WINDOWS[w + 1][1]}`);
    // Quartiles by first-window return (descending: Q0 = best).
    const byR1 = [...cohort].sort((a, b) => b.r1 - a.r1);
    const q1of = new Map(byR1.map((f, i) => [f, Math.min(3, Math.floor((i / byR1.length) * 4))]));
    // Second-window quartiles among the survivors of this same cohort.
    const surv = cohort.filter((f) => f.r2 != null).sort((a, b) => b.r2 - a.r2);
    const q2of = new Map(surv.map((f, i) => [f, Math.min(3, Math.floor((i / surv.length) * 4))]));
    for (const f of cohort) {
      const from = q1of.get(f);
      const to = f.r2 == null ? 4 : q2of.get(f);
      matrix[from][to]++;
    }
  }
  const rows = matrix.map((row, i) => {
    const n = row.reduce((s, x) => s + x, 0);
    return { from: `Q${i + 1}`, n, to: row.map((x) => round(x / n, 3)) };
  });
  const persistence = {
    windows: pairsUsed,
    nRanked: matrix.reduce((s, row) => s + row.reduce((a, x) => a + x, 0), 0),
    rows,
    chanceLevel: 0.25,
  };
  console.error(
    `  persistence: ${persistence.nRanked} fund-windows over ${pairsUsed.length} pairs | ` +
      `top-quartile → top again ${(rows[0].to[0] * 100).toFixed(0)}%, gone ${(rows[0].to[4] * 100).toFixed(0)}%`,
  );

  const startLabel = `${START_YEAR}`;
  const endLabel = `${Math.floor(maxMonth / 12)}`;
  const o = {
    window: `${startLabel}–${endLabel}`,
    category: "US equity mutual-fund share classes (CRSP, survivor-bias-free)",
    graveyard,
    persistence,
    method:
      "Graveyard: annualized lifetime return (compounded monthly, 1991+) per equity share class; survivor = not flagged dead in CRSP; survival-by-horizon uses only classes born ≥h years before the sample end. Persistence: active (non-index) equity classes ranked into quartiles by annualized return in one 5-year window, outcome measured in the next window (≥54 of 60 months to qualify; SPIVA Persistence method); 'gone' = closed, merged, or lacking a full record.",
  };

  writeFileSync(OUT, render(o));
  console.error(`Wrote ${OUT}`);
}

function render(o) {
  return `// AUTO-GENERATED by scripts/reduce-fund-survivorship.mjs — DO NOT EDIT.
// Re-run: npm run data:fund-survivorship
//
// Survivorship bias + performance persistence for US equity mutual funds,
// computed from the CRSP survivor-bias-free Mutual Fund Database. Aggregates
// only; no per-fund rows ship.

export interface SurvivalPoint {
  /** Horizon in years. */
  h: number;
  /** Share classes born ≥h years before the sample end (the risk set). */
  n: number;
  /** Share of that risk set that survived at least h years. */
  pctSurvived: number;
}

export interface PersistenceRow {
  /** Starting quartile in the first 5-year window (Q1 = top). */
  from: string;
  /** Fund-windows in this row. */
  n: number;
  /** Fractions landing in [Q1, Q2, Q3, Q4, gone] the next window. */
  to: (number | null)[];
}

export interface FundSurvivorship {
  window: string;
  category: string;
  graveyard: {
    nAll: number;
    nDead: number;
    /** Share of all equity share classes that are dead (closed/merged). */
    pctDead: number;
    /** Equal-weighted mean annualized lifetime return, all funds (dead included). */
    meanAnnAll: number;
    /** Same, but surviving funds only — the flattered number. */
    meanAnnSurvivors: number;
    medianAnnAll: number;
    medianAnnSurvivors: number;
    survivalByHorizon: SurvivalPoint[];
  };
  persistence: {
    windows: string[];
    nRanked: number;
    rows: PersistenceRow[];
    chanceLevel: number;
  };
  method: string;
}

export const fundSurvivorship: FundSurvivorship = ${JSON.stringify(o, null, 2)};
`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
