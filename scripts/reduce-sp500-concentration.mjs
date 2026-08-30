/**
 * Reduce crsp_sp500/sp500_constituents_daily.csv → src/data/generated/sp500-concentration.ts
 *
 * The real-data anchor behind DiversificationModule's "How top-heavy is the
 * market?" tab (IndexConcentrationLab). Teaches that an S&P 500 is "500 stocks"
 * in name only: a cap-weighted index can be dominated by a handful of giants, so
 * concentration is a hidden, undiversified RISK (the Magnificent-Seven era).
 *
 * ONE streaming pass over the 2.6 GB daily-constituents file (sorted by
 * DlyCalDt, then PERMNO), with two accumulators:
 *
 *  1. Month-end concentration snapshot — on the LAST trading day of each month,
 *     per-stock weight w_i = DlyCap_i / Σ DlyCap, then top1/top5/top10 share,
 *     HHI = Σ w_i², effective number of stocks effN = 1/HHI, member count, and
 *     that month's top-10 tickers+weights.
 *
 *  2. Monthly index returns — compound daily DlyRet within (PERMNO, YYYYMM):
 *       • EQUAL-WEIGHT   = mean of member monthly returns (rebalanced monthly).
 *       • CAP-WEIGHT     = Σ wᵢ·rᵢ, wᵢ = each stock's cap at the prior month-end
 *                          (value-weighted). Cross-checked against CRSP's own
 *                          "value weighted monthly.csv" MthTotRet.
 *     Emitted as rebased cumulative growth of $1 (EW vs CW) — the divergence IS
 *     the concentration/return trade-off.
 *
 * Everything emitted is an index-level aggregate (per-month shares, HHI, index
 * returns, and the top-10 tickers of a few decade snapshots) — no per-PERMNO
 * time series ever leaves this script, so the CRSP licence firewall holds.
 * See data-library memory / crsp_sp500 is a shared, git-ignored source.
 *
 * Run:  npm run data:sp500-concentration
 */
import { createReadStream, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { srcDir } from "./lib/data-paths.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = srcDir("crsp_sp500"); // shared library (licensed / large)
const CSV = join(DIR, "sp500_constituents_daily.csv");
const VW_MONTHLY = join(DIR, "value weighted monthly.csv"); // cross-check
const OUT = join(root, "src", "data", "generated", "sp500-concentration.ts");

// Column indices in the daily-constituents CSV (verified against the header).
const C = { mbrStart: 1, mbrEnd: 2, permno: 3, ticker: 8, date: 17, cap: 20, ret: 22 };

// Decade snapshots whose full top-10 holdings ship (the year/decade scrubber).
const SNAPSHOT_YEARS = [1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
// Only keep month-ends with at least this many priced members (drops the sparse
// pre-index start-up months where a handful of caps would look absurdly concentrated).
const MIN_MEMBERS = 20;

const round = (x, dp) => {
  if (!Number.isFinite(x)) return 0;
  const f = 10 ** dp;
  return Math.round(x * f) / f;
};

/** Concentration stats for one day's cross-section of member caps. */
function snapshot(members) {
  let total = 0;
  for (const m of members) total += m.cap;
  if (total <= 0) return null;
  const w = members.map((m) => ({ permno: m.permno, ticker: m.ticker, weight: m.cap / total }));
  w.sort((a, b) => b.weight - a.weight);
  let hhi = 0;
  for (const x of w) hhi += x.weight * x.weight;
  const share = (k) => {
    let s = 0;
    for (let i = 0; i < Math.min(k, w.length); i++) s += w[i].weight;
    return s;
  };
  return {
    top1: share(1),
    top5: share(5),
    top10: share(10),
    hhi,
    effN: hhi > 0 ? 1 / hhi : 0,
    n: members.length,
    // Top 30 (top-10 derives from this; top-30 feeds the treemap). Keep permno so
    // blank early-era tickers can be backfilled from the stock's later ticker.
    top30List: w.slice(0, 30).map((x) => ({ permno: x.permno, ticker: x.ticker, weight: x.weight })),
  };
}

/** CRSP's own value-weighted monthly total return, keyed 'YYYY-MM', for cross-check. */
function loadCrspVw(path) {
  const map = new Map();
  if (!existsSync(path)) return map;
  const text = readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const c = lines[i].split(",");
    const ym = c[1]; // YYYYMM
    const r = c[3]; // MthTotRet
    if (ym && ym.length === 6 && r !== "" && r !== undefined) {
      map.set(`${ym.slice(0, 4)}-${ym.slice(4, 6)}`, +r);
    }
  }
  return map;
}

async function main() {
  const t0 = Date.now();
  const crspVw = loadCrspVw(VW_MONTHLY);

  // Concentration snapshot per month (last trading day wins, via overwrite).
  const concByMonth = new Map(); // 'YYYY-MM' -> stats (incl. top10List)
  // Monthly index returns per month.
  const ewCwByMonth = new Map(); // 'YYYY-MM' -> { ew, cw }

  // Rolling per-day state (the file is sorted by DlyCalDt).
  let curDay = null;
  let dayMonth = null;
  let dayMembers = []; // { permno, ticker, cap } for the current calendar day
  let lastDayCap = new Map(); // permno -> cap on the most recently completed day

  // Rolling per-month return state.
  let curMonth = null;
  let monthAgg = new Map(); // permno -> { prod, startCap }
  let prevMonthEndCap = new Map(); // permno -> cap at prior month-end (for cap weights)
  // Last ticker ever seen per permno: early CRSP rows often have a blank Ticker,
  // but the same permno carries one later (AT&T's 1950 rows are blank, its later
  // rows say "T"). Used to backfill names in the snapshots after the stream.
  const lastTickerByPermno = new Map();

  const finalizeDay = () => {
    // Refresh the "latest completed day" cap map (used as next month's weights).
    lastDayCap = new Map();
    for (const m of dayMembers) lastDayCap.set(m.permno, m.cap);
    const s = snapshot(dayMembers);
    if (s && s.n >= MIN_MEMBERS) concByMonth.set(dayMonth, s); // overwrite → month-end
  };

  const finalizeMonth = () => {
    // Equal weight: mean of member monthly returns.
    // Cap weight: Σ wᵢ·rᵢ, wᵢ from prior month-end cap (fallback: first-seen cap).
    let sumRet = 0;
    let count = 0;
    let capNum = 0;
    let capDen = 0;
    for (const a of monthAgg.values()) {
      const r = a.prod - 1;
      sumRet += r;
      count++;
      const wcap = a.startCap > 0 ? a.startCap : 0;
      capNum += wcap * r;
      capDen += wcap;
    }
    if (count >= MIN_MEMBERS) {
      const ew = sumRet / count;
      const cw = capDen > 0 ? capNum / capDen : ew; // all-new month → fall back to EW
      ewCwByMonth.set(curMonth, { ew, cw });
    }
  };

  const rl = createInterface({
    input: createReadStream(CSV, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let header = true;
  let rows = 0;
  await new Promise((resolve, reject) => {
    rl.on("line", (line) => {
      if (header) {
        header = false;
        return;
      }
      if (line === "") return;
      const c = line.split(",");
      const date = c[C.date];
      if (!date) return;
      // Membership guard: count a row only on days the stock was actually in the
      // index (YYYY-MM-DD strings compare correctly lexicographically).
      const mbrStart = c[C.mbrStart];
      const mbrEnd = c[C.mbrEnd];
      if (mbrStart && date < mbrStart) return;
      if (mbrEnd && date > mbrEnd) return;

      const ym = `${date.slice(0, 4)}-${date.slice(5, 7)}`;
      const permno = +c[C.permno];
      const capStr = c[C.cap];
      const cap = capStr === "" ? NaN : +capStr;
      const retStr = c[C.ret];
      const ret = retStr === "" || retStr === "NA" ? NaN : +retStr;
      const ticker = c[C.ticker] || "";

      rows++;
      if ((rows & 0x3fffff) === 0) {
        process.stdout.write(
          `  …${(rows / 1e6).toFixed(0)}M rows (${date}, ${concByMonth.size} months)\r`,
        );
      }

      // --- Day boundary: finalize the completed calendar day ---
      if (date !== curDay) {
        if (curDay !== null) finalizeDay();
        curDay = date;
        dayMonth = ym;
        dayMembers = [];
      }

      // --- Month boundary: finalize the completed month's index returns ---
      if (ym !== curMonth) {
        if (curMonth !== null) {
          finalizeMonth();
          // The just-finalized day was the last day of the old month → its caps
          // become the beginning-of-month weights for the new month.
          prevMonthEndCap = lastDayCap;
        }
        curMonth = ym;
        monthAgg = new Map();
      }

      // --- Accumulate the day's cross-section (for concentration) ---
      if (Number.isFinite(cap) && cap > 0) {
        dayMembers.push({ permno, ticker, cap });
      }
      if (ticker) lastTickerByPermno.set(permno, ticker);

      // --- Accumulate the month's per-stock compounded return ---
      let a = monthAgg.get(permno);
      if (!a) {
        const seed = prevMonthEndCap.get(permno);
        a = { prod: 1, startCap: seed !== undefined && seed > 0 ? seed : Number.isFinite(cap) && cap > 0 ? cap : 0 };
        monthAgg.set(permno, a);
      }
      if (Number.isFinite(ret)) a.prod *= 1 + ret;
    });
    rl.on("close", () => {
      // Flush the final in-progress day and month.
      if (curDay !== null) finalizeDay();
      if (curMonth !== null) finalizeMonth();
      resolve();
    });
    rl.on("error", reject);
  });

  // --- Assemble outputs, in chronological order ---
  const months = [...concByMonth.keys()].sort();
  const CONCENTRATION = months.map((date) => {
    const s = concByMonth.get(date);
    return {
      date,
      top1: round(s.top1, 4),
      top5: round(s.top5, 4),
      top10: round(s.top10, 4),
      hhi: round(s.hhi, 5),
      effN: round(s.effN, 1),
      n: s.n,
    };
  });

  const ewMonths = [...ewCwByMonth.keys()].sort();
  const EW_VS_CW = [];
  let ewCum = 1;
  let cwCum = 1;
  for (const date of ewMonths) {
    const { ew, cw } = ewCwByMonth.get(date);
    ewCum *= 1 + ew;
    cwCum *= 1 + cw;
    EW_VS_CW.push({ date, ew: round(ewCum, 4), cw: round(cwCum, 4) });
  }

  // Decade snapshots: for each target year, the latest available month-end that
  // year, plus the most recent month overall.
  const TOP10_SNAPSHOTS = {};
  const pickYear = (year) => {
    const inYear = months.filter((m) => m.startsWith(`${year}-`));
    return inYear.length ? inYear[inYear.length - 1] : null;
  };
  // Resolve a holding's ticker: same-day ticker, else the permno's latest-known
  // ticker (backfills the blank early decades with the stock's eventual symbol).
  const tick = (x) => x.ticker || lastTickerByPermno.get(x.permno) || "—";
  for (const y of SNAPSHOT_YEARS) {
    const key = pickYear(y);
    if (key) TOP10_SNAPSHOTS[key] = concByMonth.get(key).top30List.slice(0, 10).map((x) => ({ ticker: tick(x), weight: round(x.weight, 4) }));
  }
  const latest = months[months.length - 1];
  if (latest && !TOP10_SNAPSHOTS[latest]) {
    TOP10_SNAPSHOTS[latest] = concByMonth.get(latest).top30List.slice(0, 10).map((x) => ({ ticker: tick(x), weight: round(x.weight, 4) }));
  }

  // Treemap snapshots: one per year-end (last month-end of each year with enough
  // breadth), the top-30 holdings + a combined "other" tile for the rest. Feeds
  // the animated concentration treemap's year scrubber.
  // TRIMMED pending the WRDS licence-scope answer (2026-08-27): ship the
  // treemap only at the DECADE snapshots already published as TOP10_SNAPSHOTS,
  // and only the top-10 holdings — the level our public dataset note describes
  // and the level defensible as effectively public knowledge. Restore the
  // annual top-30 panel only if the library answer covers it.
  const TREEMAP_SNAPSHOTS = {};
  for (const key of Object.keys(TOP10_SNAPSHOTS)) {
    const s = concByMonth.get(key);
    if (!s || s.n < 50) continue;
    const holdings = s.top30List.slice(0, 10).map((x) => ({ ticker: tick(x), weight: round(x.weight, 4) }));
    const other = round(Math.max(0, 1 - holdings.reduce((a, h) => a + h.weight, 0)), 4);
    TREEMAP_SNAPSHOTS[key] = { n: s.n, other, holdings };
  }

  // Cross-check our cap-weight monthly return against CRSP's official VW series.
  let n = 0;
  let sd = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const date of ewMonths) {
    const mine = ewCwByMonth.get(date).cw;
    const theirs = crspVw.get(date);
    if (theirs === undefined) continue;
    n++;
    sd += Math.abs(mine - theirs);
    sx += mine;
    sy += theirs;
    sxx += mine * mine;
    syy += theirs * theirs;
    sxy += mine * theirs;
  }
  const corr = n > 1 ? (n * sxy - sx * sy) / Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy)) : 0;
  const crossCheck = {
    monthsCompared: n,
    corrWithCrspVw: round(corr, 4),
    meanAbsMonthlyDiff: n ? round(sd / n, 5) : 0,
  };

  const out = {
    asOf: latest ?? "",
    source: "Calculated from CRSP S&P 500 daily constituents, © Center for Research in Security Prices, LLC, via WRDS.",
    method:
      "Month-end cap weights wᵢ = DlyCap / Σ DlyCap over index members on the last trading day of the month; " +
      "top-k share, HHI = Σ wᵢ², effective number of stocks = 1/HHI. Equal-weight index return = mean of member " +
      "monthly returns (rebalanced monthly); cap-weight = Σ wᵢ·rᵢ with wᵢ from the prior month-end cap. Cumulative " +
      "series are growth of $1. Educational only, not investment advice.",
    dateSpan: [months[0] ?? "", latest ?? ""],
    crossCheck,
    CONCENTRATION,
    EW_VS_CW,
    TOP10_SNAPSHOTS,
    TREEMAP_SNAPSHOTS,
  };

  writeFileSync(OUT, renderTs(out));
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const last = CONCENTRATION[CONCENTRATION.length - 1];
  process.stdout.write("\n");
  console.log(
    `sp500-concentration: ${rows.toLocaleString()} rows in ${secs}s\n` +
      `  ${CONCENTRATION.length} month-ends ${out.dateSpan[0]}→${out.dateSpan[1]}\n` +
      `  latest ${last.date}: top10 = ${(last.top10 * 100).toFixed(1)}%   effN = ${last.effN} stocks   n = ${last.n}\n` +
      `  cap-weight vs CRSP VW: corr ${crossCheck.corrWithCrspVw} over ${crossCheck.monthsCompared} months ` +
      `(mean |Δ| ${(crossCheck.meanAbsMonthlyDiff * 100).toFixed(3)}%)\n` +
      `  snapshots: ${Object.keys(TOP10_SNAPSHOTS).join(", ")}\n` +
      `  → ${OUT}`,
  );
}

function renderTs(o) {
  return `// AUTO-GENERATED by scripts/reduce-sp500-concentration.mjs — DO NOT EDIT.
// Re-run: npm run data:sp500-concentration
//
// Aggregate, licence-safe statistics derived from CRSP S&P 500 daily
// constituents (via WRDS). No per-stock time series is shipped — only
// index-level month-end concentration, index returns, and the top-10 tickers of
// a few decade snapshots. Weights/shares are fractions (0.34 = 34%); effN is the
// "effective number of equally-weighted stocks" 1/HHI; cumulative EW/CW are the
// growth of $1.

export interface ConcentrationPoint {
  /** Month-end, 'YYYY-MM'. */
  date: string;
  /** Largest stock's share of index cap. */
  top1: number;
  /** Top-5 stocks' combined share. */
  top5: number;
  /** Top-10 stocks' combined share. */
  top10: number;
  /** Herfindahl–Hirschman Index, Σ wᵢ². */
  hhi: number;
  /** Effective number of equally-weighted stocks, 1/HHI. */
  effN: number;
  /** Priced index members that month. */
  n: number;
}

export interface GrowthPoint {
  /** Month-end, 'YYYY-MM'. */
  date: string;
  /** Equal-weight index: cumulative growth of $1. */
  ew: number;
  /** Cap-weight index: cumulative growth of $1. */
  cw: number;
}

export interface Holding {
  ticker: string;
  /** Share of index cap (fraction). */
  weight: number;
}

export interface Sp500Concentration {
  asOf: string;
  source: string;
  method: string;
  dateSpan: [string, string];
  /** Sanity check of the reconstructed cap-weight return vs CRSP's official VW. */
  crossCheck: { monthsCompared: number; corrWithCrspVw: number; meanAbsMonthlyDiff: number };
  CONCENTRATION: ConcentrationPoint[];
  EW_VS_CW: GrowthPoint[];
  /** A few decade month-ends → that month's top-10 holdings by weight. */
  TOP10_SNAPSHOTS: Record<string, Holding[]>;
  /** Year-end month → top-30 holdings + an "other" tile, for the treemap scrubber. */
  TREEMAP_SNAPSHOTS: Record<string, TreemapSnapshot>;
}

export interface TreemapSnapshot {
  /** Priced index members that month. */
  n: number;
  /** Combined weight of every stock outside the top 30 (one "other" tile). */
  other: number;
  /** Top-30 holdings by weight. */
  holdings: Holding[];
}

const data: Sp500Concentration = ${JSON.stringify(o, null, 2)};

export const {
  asOf,
  source,
  method,
  dateSpan,
  crossCheck,
  CONCENTRATION,
  EW_VS_CW,
  TOP10_SNAPSHOTS,
  TREEMAP_SNAPSHOTS,
} = data;

export default data;
`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
