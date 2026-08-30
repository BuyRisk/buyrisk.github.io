/**
 * Thin wrapper around SheetJS for reading the legacy binary `.xls` workbooks
 * shipped by Damodaran and Shiller. Build-time only — `xlsx` is a devDependency
 * and never ships to the browser.
 *
 * Note: under ESM, SheetJS does not expose `XLSX.readFile`, so we read the file
 * ourselves and hand it the buffer.
 */
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

/** Read a workbook. Returns { sheetNames, sheet(name) -> rows[][] }. */
export function readWorkbook(path) {
  const wb = XLSX.read(readFileSync(path), { type: "buffer" });
  return {
    sheetNames: wb.SheetNames,
    /** Rows as arrays of cell values (numbers stay numbers). */
    sheet(name) {
      const ws = wb.Sheets[name];
      if (!ws) return [];
      return XLSX.utils.sheet_to_json(ws, {
        header: 1,
        blankrows: false,
        defval: null,
      });
    },
  };
}

/**
 * Find the row index of the first row whose cells include ALL of `headers`
 * (case-insensitive substring match). Useful because these sheets prepend a
 * few rows of prose/metadata before the real table header.
 */
export function findHeaderRow(rows, headers) {
  const want = headers.map((h) => h.toLowerCase());
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].map((c) => String(c ?? "").toLowerCase());
    if (want.every((w) => cells.some((c) => c.includes(w)))) return i;
  }
  return -1;
}
