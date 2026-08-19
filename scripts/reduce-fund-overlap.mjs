/**
 * Reduce Thomson s12 holdings → src/data/generated/fund-overlap.ts
 *
 * The "Fund X-ray" for the Closet Indexing tab: how much do big, popular,
 * actively managed US equity funds actually overlap — with each other, and
 * with the S&P 500 they're sold as an alternative to?
 *
 * Overlap between funds i and j = Σ_stock min(w_i, w_j): the share of the two
 * portfolios that is the SAME positions at the same weight (0% = nothing in
 * common, 100% = identical). Holding two 60%-overlapped funds is not "two
 * bets" — it's one bet and a half. Same measure against S&P 500 cap weights =
 * the index-hugging score that motivates active share.
 *
 * Pipeline (latest report date, currently 2025-12-31):
 *  1. s12type1 — the largest active US equity funds by reported assets
 *     (ioc 2/3/4 = aggressive growth / growth / growth & income; index/ETF
 *     vehicles excluded by name). Curated to ~12 recognizable names.
 *  2. s12type3 (9 GB, streamed) — those funds' holdings at that fdate.
 *  3. s12type2 — prices per (fdate, cusip) → portfolio weights.
 *  4. crsp_sp500 daily constituents — index cap weights at the same date,
 *     joined on 8-char CUSIP.
 *
 * Only fund names + summary statistics ship (overlap percentages, holding
 * counts, assets) — no positions leave the machine (Thomson/CRSP licences).
 *
 * Run:  npm run data:fund-overlap
 */
import { createReadStream, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { srcDir } from "./lib/data-paths.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const S12 = srcDir("thomson_s12");
const TYPE1 = join(S12, "s12type1.csv");
const TYPE2 = join(S12, "s12type2.csv");
const TYPE3 = join(S12, "s12type3.csv");
const SP500 = join(srcDir("crsp_sp500"), "sp500_constituents_daily.csv");
const OUT = join(root, "src", "data", "generated", "fund-overlap.ts");

const N_FUNDS = 12;
// Vehicles that would make the "active funds overlap" story circular. Thomson
// truncates names, so index funds can end in "IND"/"IN" (e.g. "VANGUARD TOT
// STK MKT IND"); match the truncations and common index-family phrases too.
const EXCLUDE_NAME = /INDEX|\bIDX\b|\bIND\b|\bIN$|ISHARES|SPDR|POWERSHARES|\bETF\b|TOT\s+STK|TOTAL\s+ST|EMG\s+MRKT|EXTD?\s+MKT|S&P|500/i;

const round = (x, dp) => {
  if (!Number.isFinite(x)) return null;
  const f = 10 ** dp;
  return Math.round(x * f) / f;
};
const num = (s) => (s === "" || s == null || Number.isNaN(+s) ? NaN : +s);

function headerIndex(line) {
  const idx = {};
  line.split(",").forEach((h, i) => (idx[h.trim()] = i));
  return idx;
}

/** "FIDELITY CONTRAFUND" → "Fidelity Contrafund" (small display cleanup). */
function prettify(name) {
  const KEEP = new Set(["US", "USA", "SP", "T", "II", "III", "IV"]);
  return name
    .split(/\s+/)
    .map((w) => (KEEP.has(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ")
    .replace(/\bFd\b/g, "Fund")
    .replace(/\bGr\b/g, "Growth")
    .replace(/\bInc\b/g, "Income")
    .replace(/\bCo\b(?!m)/g, "Company");
}

/** Step 1 — the biggest active US equity funds at the latest report date. */
function pickFunds() {
  const text = readFileSync(TYPE1, "utf8");
  const lines = text.split(/\r?\n/);
  const H = headerIndex(lines[0]);
  let maxR = "";
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const r = lines[i].split(",")[H.rdate];
    if (r && r > maxR) maxR = r;
  }
  const cands = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const c = lines[i].split(",");
    if (c[H.rdate] !== maxR) continue;
    const ioc = c[H.ioc];
    if (ioc !== "2" && ioc !== "3" && ioc !== "4") continue;
    const name = (c[H.fundname] ?? "").trim();
    if (!name || EXCLUDE_NAME.test(name)) continue;
    const assets = num(c[H.assets]);
    if (!Number.isFinite(assets) || assets <= 0) continue;
    cands.push({ fundno: c[H.fundno], fdate: c[H.fdate], name, assets });
  }
  cands.sort((a, b) => b.assets - a.assets);
  // One fund per name (Thomson occasionally repeats a name across fundnos).
  const seen = new Set();
  const picked = [];
  for (const f of cands) {
    const key = f.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(f);
    if (picked.length >= N_FUNDS) break;
  }
  return { picked, rdate: maxR };
}

/** Stream a big csv, calling onRow(cols) for rows passing a cheap prefilter. */
function streamCsv(path, onRow) {
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
    let H = null;
    rl.on("line", (line) => {
      if (!H) { H = headerIndex(line); onRow.header?.(H); return; }
      if (line !== "") onRow(line.split(","), H);
    });
    rl.on("close", resolve);
    rl.on("error", reject);
  });
}

async function main() {
  console.error("Step 1: picking funds from s12type1…");
  const { picked, rdate } = pickFunds();
  const byFundno = new Map(picked.map((f) => [f.fundno, f]));
  // Funds report holdings at their own fdate (usually the same quarter end).
  const fdates = new Set(picked.map((f) => f.fdate));
  console.error(`  rdate ${rdate}; ${picked.length} funds; fdates: ${[...fdates].join(", ")}`);
  for (const f of picked) console.error(`    ${f.fundno}  $${(f.assets / 1000).toFixed(0)}B  ${f.name}`);

  console.error("Step 2: streaming s12type3 (9 GB) for those funds…");
  const holdings = new Map(); // fundno -> Map(cusip -> shares)
  for (const f of picked) holdings.set(f.fundno, new Map());
  await streamCsv(TYPE3, (c, H) => {
    const f = byFundno.get(c[H.fundno]);
    if (!f || c[H.fdate] !== f.fdate) return;
    const sh = num(c[H.shares]);
    if (!Number.isFinite(sh) || sh <= 0) return;
    const m = holdings.get(c[H.fundno]);
    m.set(c[H.cusip], (m.get(c[H.cusip]) ?? 0) + sh);
  });
  for (const f of picked) console.error(`    ${f.name}: ${holdings.get(f.fundno).size} positions`);

  console.error("Step 3: prices from s12type2 at those fdates…");
  const price = new Map(); // fdate|cusip -> prc
  await streamCsv(TYPE2, (c, H) => {
    if (!fdates.has(c[H.fdate])) return;
    const p = num(c[H.prc]);
    if (Number.isFinite(p) && p > 0) price.set(`${c[H.fdate]}|${c[H.cusip]}`, p);
  });
  console.error(`  ${price.size} (fdate, cusip) prices.`);

  // Portfolio weights (priced positions only; report coverage honestly).
  const weights = new Map(); // fundno -> Map(cusip -> weight)
  const coverage = new Map();
  for (const f of picked) {
    const m = holdings.get(f.fundno);
    let tot = 0, missed = 0;
    const vals = new Map();
    for (const [cusip, sh] of m) {
      const p = price.get(`${f.fdate}|${cusip}`);
      if (p === undefined) { missed++; continue; }
      const v = sh * p;
      vals.set(cusip, v);
      tot += v;
    }
    const w = new Map();
    for (const [cusip, v] of vals) w.set(cusip, v / tot);
    weights.set(f.fundno, w);
    coverage.set(f.fundno, { priced: vals.size, missed });
  }

  console.error("Step 4: S&P 500 cap weights from CRSP constituents…");
  const targetDate = [...fdates].sort().reverse()[0]; // latest quarter end
  const spDays = new Map(); // day -> Map(cusip8 -> cap)
  await streamCsv(SP500, (c) => {
    // Header order verified earlier: 1 MbrStartDt, 2 MbrEndDt, 5 HdrCUSIP, 17 DlyCalDt, 20 DlyCap
    const d = c[17];
    if (!d || d > targetDate || d < "2025-12-15") return;
    const start = c[1], end = c[2];
    if ((start && d < start) || (end && d > end)) return;
    const cap = num(c[20]);
    const cusip = (c[4] ?? "").slice(0, 8);
    if (!Number.isFinite(cap) || cap <= 0 || !cusip) return;
    let m = spDays.get(d);
    if (!m) { m = new Map(); spDays.set(d, m); }
    m.set(cusip, cap);
  });
  const spDay = [...spDays.keys()].sort().reverse()[0];
  const spCaps = spDays.get(spDay) ?? new Map();
  let spTot = 0;
  for (const cap of spCaps.values()) spTot += cap;
  const spW = new Map();
  for (const [cusip, cap] of spCaps) spW.set(cusip, cap / spTot);
  console.error(`  S&P weights at ${spDay}: ${spW.size} members.`);

  // Overlap = Σ min(w_i, w_j) over the union of names.
  const overlapOf = (wa, wb) => {
    let s = 0;
    for (const [cusip, w] of wa) {
      const o = wb.get(cusip);
      if (o !== undefined) s += Math.min(w, o);
    }
    return s;
  };

  const funds = picked.map((f) => ({
    name: prettify(f.name),
    assetsB: round(f.assets / 1000, 0),
    nHoldings: coverage.get(f.fundno).priced,
    spOverlap: round(overlapOf(weights.get(f.fundno), spW), 3),
  }));
  const matrix = picked.map((a) =>
    picked.map((b) =>
      a.fundno === b.fundno ? 1 : round(overlapOf(weights.get(a.fundno), weights.get(b.fundno)), 3),
    ),
  );

  // Cross-fund summary for the copy.
  const pairs = [];
  for (let i = 0; i < picked.length; i++)
    for (let j = i + 1; j < picked.length; j++) pairs.push(matrix[i][j]);
  pairs.sort((a, b) => a - b);
  const medPair = pairs[pairs.length >> 1];
  const maxPair = pairs[pairs.length - 1];
  console.error(
    `  pairwise overlap: median ${(medPair * 100).toFixed(0)}%, max ${(maxPair * 100).toFixed(0)}%; ` +
      `S&P overlap range ${(Math.min(...funds.map((f) => f.spOverlap)) * 100).toFixed(0)}–${(Math.max(...funds.map((f) => f.spOverlap)) * 100).toFixed(0)}%`,
  );

  const o = {
    asOf: targetDate,
    category: "Largest actively managed US equity mutual funds (Thomson s12 holdings)",
    funds,
    matrix,
    medianPairOverlap: round(medPair, 3),
    maxPairOverlap: round(maxPair, 3),
    method:
      "Overlap(i,j) = Σ min(wᵢ, wⱼ) across stocks: the share of two portfolios invested identically (100% = the same portfolio). Weights from Thomson s12 holdings × s12 quarter-end prices; the S&P 500 column uses CRSP constituent cap weights at the same date, joined on CUSIP. Funds: the largest active US equity funds by reported assets (growth / growth-and-income objectives; index vehicles excluded).",
  };
  writeFileSync(OUT, render(o));
  console.error(`Wrote ${OUT}`);
}

function render(o) {
  return `// AUTO-GENERATED by scripts/reduce-fund-overlap.mjs — DO NOT EDIT.
// Re-run: npm run data:fund-overlap
//
// Pairwise portfolio overlap among the largest active US equity mutual funds,
// plus each fund's overlap with the S&P 500, from Thomson s12 holdings.
// Fractions (0.42 = 42%). Summary statistics only — no positions ship.

export interface OverlapFund {
  name: string;
  /** Reported assets, $ billions. */
  assetsB: number | null;
  /** Priced positions used for weights. */
  nHoldings: number;
  /** Overlap with S&P 500 cap weights. */
  spOverlap: number | null;
}

export interface FundOverlap {
  asOf: string;
  category: string;
  funds: OverlapFund[];
  /** matrix[i][j] = overlap between funds i and j (1 on the diagonal). */
  matrix: (number | null)[][];
  medianPairOverlap: number | null;
  maxPairOverlap: number | null;
  method: string;
}

export const fundOverlap: FundOverlap = ${JSON.stringify(o, null, 2)};
`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
