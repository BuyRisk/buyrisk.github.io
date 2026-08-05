/**
 * Inspect every raw dataset under data/sources/ and print a catalog:
 * for each French file, the blocks it contains, their columns, frequency,
 * date span, row count, and missing-value count.
 *
 * This is the ingestion smoke-test: if a newly downloaded file parses here,
 * it's ready to feed a reducer. Run with:  npm run data:inspect
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseFrench } from "./lib/parse-french.mjs";
import { readWorkbook } from "./lib/read-xlsx.mjs";
import { parseFred } from "./lib/parse-fred.mjs";
import { parseDta } from "./lib/parse-dta.mjs";
import { srcDir } from "./lib/data-paths.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcesDir = join(root, "data", "sources");
const frenchDir = join(sourcesDir, "french");

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function inspectFrench() {
  if (!existsSync(frenchDir)) {
    console.log("(no data/sources/french directory yet)");
    return;
  }
  const files = readdirSync(frenchDir)
    .filter((f) => f.toLowerCase().endsWith(".csv"))
    .sort();

  console.log(`\n=== Kenneth French Data Library — ${files.length} files ===\n`);
  for (const file of files) {
    const path = join(frenchDir, file);
    const bytes = readFileSync(path).length;
    const text = readFileSync(path, "utf8");
    const blocks = parseFrench(text);
    console.log(`▸ ${file}  (${fmtBytes(bytes)})`);
    for (const b of blocks) {
      const label = b.title || "(untitled)";
      const cols =
        b.columns.length <= 8
          ? b.columns.join(", ")
          : `${b.columns.slice(0, 6).join(", ")}, …(+${b.columns.length - 6})`;
      const span = b.span ? `${b.span[0]}–${b.span[1]}` : "—";
      const miss = b.missing ? `  ⚠ ${b.missing} missing` : "";
      console.log(
        `    • ${label} [${b.frequency}]  ${b.rows.length} rows  ${span}  ` +
          `${b.columns.length} cols: ${cols}${miss}`
      );
    }
    console.log("");
  }
}

/** Catalog the .xls workbooks (Damodaran, Shiller). Lists non-empty sheets. */
function inspectXlsProvider(provider, label) {
  const dir = join(sourcesDir, provider);
  if (!existsSync(dir)) return;
  const files = readdirSync(dir)
    .filter((f) => /\.xlsx?$/i.test(f))
    .sort();
  if (!files.length) return;

  console.log(`\n=== ${label} — ${files.length} file(s) ===\n`);
  for (const file of files) {
    const path = join(dir, file);
    const bytes = readFileSync(path).length;
    const wb = readWorkbook(path);
    console.log(`▸ ${file}  (${fmtBytes(bytes)})`);
    for (const name of wb.sheetNames) {
      const rows = wb.sheet(name);
      if (!rows.length) continue; // skip empty helper sheets
      const firstText = (rows[0] || [])
        .slice(0, 6)
        .map((c) => String(c ?? "").trim())
        .filter(Boolean)
        .join(" | ");
      console.log(
        `    • "${name}"  ${rows.length} rows` +
          (firstText ? `  — starts: ${firstText.slice(0, 80)}` : "")
      );
    }
    console.log("");
  }
}

/** Catalog the FRED single-series CSVs. */
function inspectFred() {
  const dir = join(sourcesDir, "fred");
  if (!existsSync(dir)) return;
  const files = readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".csv"))
    .sort();
  if (!files.length) return;

  console.log(`\n=== Federal Reserve Economic Data (FRED) — ${files.length} series ===\n`);
  for (const file of files) {
    const path = join(dir, file);
    const s = parseFred(path);
    const span = s.span ? `${s.span[0]} → ${s.span[1]}` : "—";
    const miss = s.missing ? `  ⚠ ${s.missing} missing` : "";
    console.log(
      `▸ ${s.seriesId.padEnd(9)} [${s.frequency}]  ${String(s.rows.length).padStart(5)} rows  ${span}${miss}`
    );
  }
  console.log("");
}

/** Catalog the Jordà-Schularick-Taylor Macrohistory .dta (formats 117/118). */
function inspectJst() {
  const dir = srcDir("jst"); // moved to the shared library
  if (!existsSync(dir)) return;
  const files = readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".dta"))
    .sort();
  if (!files.length) return;

  console.log(`\n=== Jordà-Schularick-Taylor Macrohistory — ${files.length} file(s) ===\n`);
  for (const file of files) {
    const path = join(dir, file);
    const bytes = readFileSync(path).length;
    const d = parseDta(path);
    const years = d.rows.map((r) => r.year).filter((y) => Number.isFinite(y));
    const countries = [...new Set(d.rows.map((r) => r.country))].filter(Boolean);
    console.log(
      `▸ ${file}  (${fmtBytes(bytes)})  Stata dta v${d.release}, ${d.byteorder}`
    );
    console.log(
      `    • ${d.nobs.toLocaleString()} rows × ${d.nvar} vars  ` +
        `${Math.min(...years)}–${Math.max(...years)}  ${countries.length} countries`
    );
    // Non-missing coverage for the load-bearing return columns.
    const key = ["eq_tr", "housing_tr", "bond_tr", "bill_rate", "cpi"];
    const cov = key
      .filter((k) => d.columns.some((c) => c.name === k))
      .map((k) => {
        const n = d.rows.filter((r) => r[k] !== null && r[k] !== undefined).length;
        return `${k} ${Math.round((n / d.nobs) * 100)}%`;
      });
    console.log(`    • coverage: ${cov.join(", ")}`);
  }
  console.log("");
}

inspectFrench();
inspectXlsProvider("damodaran", "Aswath Damodaran (NYU Stern)");
inspectXlsProvider("shiller", "Robert Shiller (Yale)");
inspectFred();
inspectJst();
