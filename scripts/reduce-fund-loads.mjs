/**
 * Reduce CRSP Mutual Fund data → src/data/generated/fund-loads.ts
 *
 * "The fees you don't see" for the Fees tab: the charges an expense-ratio
 * slider never shows.
 *
 *  • 12b-1: a marketing/distribution fee charged INSIDE the expense ratio —
 *    you pay the fund to advertise itself to other people. From the Fund
 *    Summary panel's actual_12b1. Units are mixed across CRSP eras (fraction
 *    vs basis points); normalized here — the SEC cap is 1%/yr, a hard sanity
 *    bound.
 *  • BACK-END (deferred) LOAD / CDSC: a percentage skimmed when you SELL,
 *    typically declining the longer you hold (the classic B/C-share design).
 *    From the Rear Loads schedule file (full coverage 1961→), load types C/D
 *    only (R = short-term redemption fees, a different animal, excluded). Per
 *    class we take the schedule's worst (first-year) rate.
 *
 * NOTE: the library's Front Loads.csv is currently a 2004–2012 partial slice
 * (12k rows / 2,612 classes — a truncated WRDS pull), so no front-load time
 * series is built yet; the tool covers front loads with the canonical 5.75%
 * worked example instead. Re-pull queued; extend this reducer when it lands.
 *
 * Per calendar year, across US equity share classes: the share charging each
 * fee and the typical size when charged. Both are dying out; the chart shows
 * the rise-and-fall. Aggregates only ship (CRSP licence firewall).
 *
 * Run:  npm run data:fund-loads
 */
import { createReadStream, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { srcDir } from "./lib/data-paths.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MF = srcDir("crsp_mf");
const SUMMARY = join(MF, "Fund Summary.csv");
const REAR = join(MF, "Rear Loads.csv");
const OUT = join(root, "src", "data", "generated", "fund-loads.ts");

const MIN_CLASSES = 500; // only emit years with a solid equity cross-section

const round = (x, dp) => {
  if (!Number.isFinite(x)) return null;
  const f = 10 ** dp;
  return Math.round(x * f) / f;
};
const num = (s) => (s === "" || s == null || Number.isNaN(+s) ? NaN : +s);
const median = (arr) => (arr.length ? arr.slice().sort((a, b) => a - b)[arr.length >> 1] : NaN);

function headerIndex(line) {
  const idx = {};
  line.split(",").forEach((h, i) => (idx[h.trim()] = i));
  return idx;
}

/** actual_12b1 arrives as a fraction, percent, or basis points depending on the
 *  era. Normalize to a fraction; the SEC's 1% cap is the sanity bound. */
function norm12b1(v) {
  if (!Number.isFinite(v) || v <= 0) return NaN;
  if (v <= 0.011) return v; // fraction (0.0025 = 0.25%)
  if (v <= 1.01) return v / 100; // percent written as 0.25–1.00? no: 0.011–1.01 → percent
  return v / 10000; // basis points (25, 100)
}

/** rear_load is a fraction; a stray percent-unit value gets scaled down. */
function normRear(v) {
  if (!Number.isFinite(v) || v <= 0) return NaN;
  return v > 1 ? v / 100 : v;
}

/**
 * Rear-load schedules → per share class, intervals where a deferred sales
 * charge (types C/D) was in force, at the schedule's WORST (first-year) rate.
 * Returns fundno -> [{y0, y1, load}].
 */
function loadRearSchedules() {
  const text = readFileSync(REAR, "utf8");
  const lines = text.split(/\r?\n/);
  const H = headerIndex(lines[0]);
  const bySched = new Map(); // fundno|group|beg|end -> max load
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const c = lines[i].split(",");
    const fundno = c[H.crsp_fundno];
    const beg = c[H.begdt];
    const end = c[H.enddt];
    const type = (c[H.load_type] ?? "").trim();
    if (!fundno || !beg || (type !== "C" && type !== "D")) continue;
    const load = normRear(num(c[H.rear_load]));
    if (!Number.isFinite(load)) continue;
    const key = `${fundno}|${c[H.rear_group_no]}|${beg}|${end}`;
    const prev = bySched.get(key);
    if (!prev || load > prev.load) bySched.set(key, { fundno, beg, end, load });
  }
  const byFund = new Map();
  for (const s of bySched.values()) {
    const y0 = +s.beg.slice(0, 4);
    const y1 = +s.end.slice(0, 4);
    if (!byFund.has(s.fundno)) byFund.set(s.fundno, []);
    byFund.get(s.fundno).push({ y0, y1, load: s.load });
  }
  return byFund;
}

/** Stream the Fund Summary panel → per (equity class, year), last FINITE 12b-1. */
function streamSummary() {
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input: createReadStream(SUMMARY, { encoding: "utf8" }), crlfDelay: Infinity });
    const years = new Map(); // year -> Map(fundno -> { b12 })
    let H = null;
    rl.on("line", (line) => {
      if (!H) { H = headerIndex(line); return; }
      if (line === "") return;
      const c = line.split(",");
      const fundno = c[H.crsp_fundno];
      const caldt = c[H.caldt];
      if (!fundno || !caldt) return;
      const obj = (c[H.crsp_obj_cd] ?? "").trim();
      const policy = (c[H.policy] ?? "").trim();
      const isEq = obj.startsWith("E") || (obj === "" && policy === "CS");
      if (!isEq) return;
      const y = +caldt.slice(0, 4);
      let m = years.get(y);
      if (!m) { m = new Map(); years.set(y, m); }
      let rec = m.get(fundno);
      if (!rec) { rec = { b12: NaN }; m.set(fundno, rec); }
      // Merge, don't overwrite: many panel rows carry blank fee fields, and a
      // blank later row must not clobber a populated earlier one.
      const b12 = num(c[H.actual_12b1]);
      if (Number.isFinite(b12)) rec.b12 = b12;
    });
    rl.on("close", () => resolve(years));
    rl.on("error", reject);
  });
}

async function main() {
  console.error("Loading rear-load (CDSC) schedules…");
  const rear = loadRearSchedules();
  console.error(`  schedules for ${rear.size} share classes.`);

  console.error("Streaming Fund Summary panel (1.5 GB)…");
  const years = await streamSummary();

  // Solid window: actual_12b1 reporting starts ~1992, and both the panel's fee
  // fields and the load schedules truncate at the recent edge (2024+ shows a
  // 6%→0% rear-load cliff and a 29%→4% 12b-1 cliff that are data artifacts,
  // not markets). Trim to years where both series are trustworthy.
  const Y0 = 1992, Y1 = 2022;
  const SERIES = [];
  for (const y of [...years.keys()].sort((a, b) => a - b)) {
    if (y < Y0 || y > Y1) continue;
    const classes = years.get(y);
    if (classes.size < MIN_CLASSES) continue;
    let n = 0, n12 = 0, nRear = 0;
    const chg12 = [], rears = [];
    for (const [fundno, r] of classes) {
      n++;
      const b12 = norm12b1(r.b12);
      if (Number.isFinite(b12)) { n12++; chg12.push(b12); }
      const scheds = rear.get(fundno);
      if (scheds) {
        let worst = 0;
        for (const s of scheds) if (y >= s.y0 && y <= s.y1 && s.load > worst) worst = s.load;
        if (worst > 0) { nRear++; rears.push(worst); }
      }
    }
    SERIES.push({
      year: y,
      n,
      pct12b1: round(n12 / n, 3),
      med12b1: chg12.length >= 30 ? round(median(chg12), 4) : null,
      pctRearLoad: round(nRear / n, 3),
      medRearLoad: rears.length >= 30 ? round(median(rears), 4) : null,
    });
  }

  const first = SERIES[0];
  const last = SERIES[SERIES.length - 1];
  const peak = SERIES.reduce((a, b) => (b.pct12b1 > a.pct12b1 ? b : a));
  console.error(
    `  ${SERIES.length} years ${first.year}→${last.year}\n` +
      `  peak 12b-1: ${peak.year} ${(peak.pct12b1 * 100).toFixed(0)}% of classes (med ${((peak.med12b1 ?? 0) * 100).toFixed(2)}%)\n` +
      `  ${last.year}: ${(last.pct12b1 * 100).toFixed(0)}% with 12b-1 (med ${((last.med12b1 ?? 0) * 100).toFixed(2)}%), ` +
      `${(last.pctRearLoad * 100).toFixed(0)}% with a back-end load (med ${((last.medRearLoad ?? 0) * 100).toFixed(2)}%)`,
  );

  const o = {
    window: `${first.year}–${last.year}`,
    category: "US equity mutual-fund share classes (CRSP)",
    series: SERIES,
    method:
      "Per calendar year, across US equity share classes in the CRSP Fund Summary panel: the share reporting a positive 12b-1 fee (actual_12b1, unit-normalized; SEC cap 1%/yr) and the share with a deferred-sales-charge schedule in force (Rear Loads, types C/D, worst first-year rate), plus the median charge among classes that charge. 12b-1 is annual; a back-end load is charged once, on the way out.",
  };
  writeFileSync(OUT, render(o));
  console.error(`Wrote ${OUT}`);
}

function render(o) {
  return `// AUTO-GENERATED by scripts/reduce-fund-loads.mjs — DO NOT EDIT.
// Re-run: npm run data:fund-loads
//
// 12b-1 marketing fees and back-end (deferred) sales loads across US equity
// mutual-fund share classes, by year, from the CRSP MF database. Fractions
// (0.01 = 1%). Aggregates only; no per-fund rows ship.

export interface FundLoadYear {
  year: number;
  /** Equity share classes in the panel that year. */
  n: number;
  /** Share of classes charging a 12b-1 fee. */
  pct12b1: number;
  /** Median annual 12b-1 among the classes that charge one. */
  med12b1: number | null;
  /** Share of classes with a deferred sales charge (CDSC) in force. */
  pctRearLoad: number;
  /** Median worst-year CDSC among those classes. */
  medRearLoad: number | null;
}

export interface FundLoads {
  window: string;
  category: string;
  series: FundLoadYear[];
  method: string;
}

export const fundLoads: FundLoads = ${JSON.stringify(o, null, 2)};
`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
