/**
 * Shared helpers for the CRSP reducers.
 *
 * The raw file (data/sources/crsp/crsp_monthly.csv) is LICENSED and git-ignored
 * — see data/sources/crsp/README.md. These helpers never emit rows; they only
 * stream the file so the reducers can compute the shippable AGGREGATES in
 * src/data/generated/crsp-*.ts.
 *
 * Canonical columns (post-cleanup, see the manifest):
 *   PERMNO, PrimaryExch, SICCD, MthCalDt, MthPrc, MthRet, MthRetx, ShrOut
 * Returns are CIZ DECIMALS (0.0289 = +2.89%) and already delisting-adjusted.
 * The file is sorted by (PERMNO, MthCalDt), so consecutive rows share a stock —
 * which is what lets streamStocks() group without buffering the whole file.
 */
import { createReadStream } from "node:fs";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { parseFrench, pickBlock, toColumns } from "./parse-french.mjs";

/** 'YYYY-MM-DD' → a consecutive month index (year*12 + month-1), comparable. */
export function monthIndex(dateStr) {
  const y = +dateStr.slice(0, 4);
  const m = +dateStr.slice(5, 7);
  return y * 12 + (m - 1);
}

/** French 'YYYYMM' period key → the same month index scheme as monthIndex(). */
export function ymToMonthIndex(yyyymm) {
  const y = +yyyymm.slice(0, 4);
  const m = +yyyymm.slice(4, 6);
  return y * 12 + (m - 1);
}

/** Turn a month index back into 'YYYY-MM' (for readable provenance/logging). */
export function monthLabel(idx) {
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/**
 * Load the one-month T-bill return series (French `RF`) keyed by month index,
 * as a DECIMAL per month (French ships it as percent). This is the matched
 * risk-free accumulation Bessembinder compares each stock against.
 * @param {string} frenchFactorsPath path to F-F_Research_Data_Factors.csv
 * @returns {Map<number, number>} monthIndex -> rf (decimal)
 */
export function loadTbillMonthly(frenchFactorsPath) {
  const blocks = parseFrench(readFileSync(frenchFactorsPath, "utf8"));
  const monthly = pickBlock(blocks, { frequency: "monthly" });
  if (!monthly) throw new Error("No monthly block in French factors file");
  const { period, series } = toColumns(monthly);
  const rf = series["RF"];
  if (!rf) throw new Error("No RF column in French factors monthly block");
  const map = new Map();
  period.forEach((ym, i) => {
    const v = rf[i];
    if (v !== null) map.set(ymToMonthIndex(ym), v / 100);
  });
  return map;
}

/**
 * Stream the CRSP CSV one stock at a time. Because the file is sorted by
 * (permno, date), we buffer only the current stock's rows, then hand them off
 * and reset — so peak memory is one stock (~a few hundred numbers), not 3.9M.
 *
 * @param {string} csvPath
 * @param {(stock: {permno: number, mon: number[], ret: number[], me: number[]}) => void} onStock
 *   Called once per stock, in date order. `ret` holds NaN for missing months;
 *   `me` is month-end market equity (|price| × shares outstanding, NaN if either
 *   is missing) — units are $-thousands, but only its relative size is ever used.
 * @returns {Promise<{stocks: number, rows: number}>}
 */
export function streamStocks(csvPath, onStock) {
  return new Promise((resolve, reject) => {
    const rl = createInterface({
      input: createReadStream(csvPath, { encoding: "utf8" }),
      crlfDelay: Infinity,
    });

    let header = true;
    let curPermno = -1;
    let mon = [];
    let ret = [];
    let me = [];
    let stocks = 0;
    let rows = 0;

    const flush = () => {
      if (curPermno !== -1 && mon.length) {
        stocks++;
        onStock({ permno: curPermno, mon, ret, me });
      }
      mon = [];
      ret = [];
      me = [];
    };

    rl.on("line", (line) => {
      if (header) {
        header = false;
        return;
      }
      if (line === "") return;
      // Fields: 0 PERMNO,1 PrimaryExch,2 SICCD,3 MthCalDt,4 MthPrc,5 MthRet,6 MthRetx,7 ShrOut
      const c = line.split(",");
      const permno = +c[0];
      if (permno !== curPermno) {
        flush();
        curPermno = permno;
      }
      rows++;
      mon.push(monthIndex(c[3]));
      const r = c[5];
      ret.push(r === "" ? NaN : +r);
      // Market equity = |price| × shares. CRSP prices are negative when they are
      // a bid/ask average (no closing trade), so take the magnitude.
      const prc = c[4] === "" ? NaN : Math.abs(+c[4]);
      const shr = c[7] === "" ? NaN : +c[7];
      me.push(prc * shr);
    });

    rl.on("close", () => {
      flush();
      resolve({ stocks, rows });
    });
    rl.on("error", reject);
  });
}
