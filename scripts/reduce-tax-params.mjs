/**
 * Extract US federal tax parameters → src/data/generated/tax-params.ts
 *
 * Source: the MMM "Case Study Spreadsheet" reference workbook kept at
 * DATA_LIB/cashflow/CashFlow - 2026.xls ('Tax Code' tab), which collates each
 * year's IRS revenue-procedure values (and OBBBA changes) with sources linked
 * in-sheet. The values themselves are public law; the CSS is the maintained
 * collation. Annual refresh: drop the new CSS in cashflow/ and re-run.
 *
 * Layout (verified v26.11): year columns B–E = 2023–2026; label-anchored rows:
 *   12–18  ordinary bracket rates (10..37)
 *   19–25  Single bracket floors      26–32 MFJ bracket floors
 *   42–44  LTCG 15% thresholds (S/MFJ/HOH)   45–47 LTCG 20% thresholds
 *   "Earned Income Credit" block — earned-income plateau ("Min/Max"), max
 *     credit (col F = phase-in rates), S/MFJ phase-out starts + ends (col F on
 *     the ends = phase-out rates), and the investment-income cap ("Max
 *     unearned"); 4 rows each = 0/1/2/3+ qualifying children.
 *   112–116 standard deduction (S/MFJ/HOH) + age-65/blind adders
 *   117–120 OBBBA senior deduction ($6k, 6% phaseout, start S/MFJ; 2025+)
 *   "Savers credit tiers" — AGI limits for the 50/20/10% tiers (MFJ/HOH/S).
 *   "IRMAA" block — base Part B monthly premium, MAGI tiers 1–5 (single;
 *     MFJ = 2× except tier 5), Part B factors and Part D adders per tier.
 *   "Child Tax Credit" — max per child + max refundable (ACTC).
 * Rows are located BY LABEL (column A), not by index, so a re-arranged future
 * version fails loudly instead of silently mis-reading.
 *
 * Feeds the "How it's taxed" marginal-rate mode of the Next Dollar tool.
 *
 * Run:  npm run data:tax-params
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readWorkbook } from "./lib/read-xlsx.mjs";
import { srcDir } from "./lib/data-paths.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const XLS = join(srcDir("cashflow"), "CashFlow - 2026.xls");
const OUT = join(root, "src", "data", "generated", "tax-params.ts");

const wb = readWorkbook(XLS);
const rows = wb.sheet("Tax Code");
if (!rows.length) throw new Error("No 'Tax Code' sheet found");

const label = (r) => String(rows[r]?.[0] ?? "").trim();
/** Find the row index whose col-A label starts with `text` at/after `from`. */
function findRow(text, from = 0) {
  for (let r = from; r < rows.length; r++) {
    if (label(r).toLowerCase().startsWith(text.toLowerCase())) return r;
  }
  throw new Error(`Label not found: "${text}"`);
}
const num = (v) => {
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[$,%\s]/g, ""));
  if (!Number.isFinite(n)) throw new Error(`Non-numeric cell: ${JSON.stringify(v)}`);
  return n;
};

// Year columns: read off the "Year" header row under the intro.
const yearRow = findRow("Year");
const YEARS = [];
const COLS = [];
for (let c = 1; c < rows[yearRow].length; c++) {
  const y = rows[yearRow][c];
  if (typeof y === "number" && y >= 2020 && y <= 2035) { YEARS.push(y); COLS.push(c); }
}
if (!YEARS.length) throw new Error("No year columns found");

// Bracket rates (shared across statuses): 7 rows starting at "Bracket rates".
const ratesRow = findRow("Bracket rates");
const RATES = [];
for (let i = 0; i < 7; i++) RATES.push(num(rows[ratesRow + i][COLS[0]]));

// Bracket floors per status: 7 rows starting at the status label row.
const floorsFrom = (startRow, col) => {
  const out = [];
  for (let i = 0; i < 7; i++) out.push(num(rows[startRow + i][col]));
  return out;
};
const singleRow = findRow("Single", ratesRow);
const mfjRow = findRow("MFJ", singleRow);

// LTCG thresholds: "Capital Gain" block → rows labelled S/MFJ/HOH twice
// (15% start, then 20% start).
const cgRow = findRow("Capital Gain");
const cgS15 = findRow("S", cgRow);
const cgS20 = findRow("S", cgS15 + 1);

// Earned Income Credit: 4 rows per block = 0/1/2/3+ qualifying children.
// Phase-in rates sit in the column after the last year on the Max Credit rows;
// phase-out rates likewise on the "ph/o end" rows.
const eicRow = findRow("Earned Income Credit");
const eicEarnedMaxRow = findRow("Min/Max", eicRow);
const eicMaxCreditRow = findRow("Max. Credit", eicRow);
const eicPoStartSRow = findRow("S ph/o start", eicRow);
const eicPoEndSRow = findRow("S ph/o end", eicRow);
const eicPoStartMRow = findRow("MFJ ph/o start", eicRow);
const eicPoEndMRow = findRow("MFJ ph/o end", eicRow);
const eicInvCapRow = findRow("Max unearned", eicRow);
const rateCol = COLS[COLS.length - 1] + 1;
const four = (startRow, col) => [0, 1, 2, 3].map((i) => num(rows[startRow + i][col]));
const EIC_PHASE_IN = four(eicMaxCreditRow, rateCol);
const EIC_PHASE_OUT = four(eicPoEndSRow, rateCol);

// Standard deductions.
const sdRow = findRow("Standard Deductions");
const sdSingle = findRow("Single", sdRow);
const sdMfj = findRow("MFJ", sdSingle);
const sdAgeS = findRow("Age/blind S", sdRow);
const sdAgeM = findRow("Age/blind M", sdRow);
const srExtra = findRow("Age S extra", sdRow);
const srRate = findRow("Phaseout rate", sdRow);
const srStartS = findRow("Phaseout start S", sdRow);
const srStartM = findRow("Phaseout start M", sdRow);

// Saver's credit AGI tier limits (50/20/10%), per status.
const svRow = findRow("Savers credit tiers");
const svM50 = findRow("MFJ - 50%", svRow);
const svS50 = findRow("S - 50%", svRow);

// IRMAA: base Part B monthly premium, MAGI tier thresholds (single; MFJ = 2×
// except tier 5), Part B multiplier factors, Part D monthly adders.
const irRow = findRow("IRMAA");
const irBase = findRow("Base part B", irRow);
const irT1 = findRow("Tier 1", irRow);
const irT5M = findRow("Tier 5 MFJ", irRow);
const irF2 = findRow("Tier 2 factor", irRow);
const irA2 = findRow("Tier 2 adder", irRow);
const five = (startRow, col) => [0, 1, 2, 3, 4].map((i) => num(rows[startRow + i][col]));

// Child Tax Credit.
const ctcRow = findRow("Child Tax Credit");
const ctcRefund = findRow("Max. refundable", ctcRow);
const ctcPerChild = findRow("Max. per child", ctcRow);

const years = YEARS.map((year, k) => {
  const c = COLS[k];
  return {
    year,
    rates: RATES,
    // Bracket FLOORS (the income at which each rate begins), taxable income.
    bracketFloors: {
      single: floorsFrom(singleRow, c),
      mfj: floorsFrom(mfjRow, c),
    },
    // Taxable income where the 15% and 20% LTCG rates begin.
    ltcg15Start: { single: num(rows[cgS15][c]), mfj: num(rows[cgS15 + 1][c]) },
    ltcg20Start: { single: num(rows[cgS20][c]), mfj: num(rows[cgS20 + 1][c]) },
    stdDeduction: { single: num(rows[sdSingle][c]), mfj: num(rows[sdMfj][c]) },
    age65Adder: { single: num(rows[sdAgeS][c]), mfj: num(rows[sdAgeM][c]) },
    // OBBBA senior deduction (per person 65+), phased out at `seniorPhaseoutRate`
    // of MAGI above the start; zero before 2025.
    seniorDeduction: num(rows[srExtra][c]),
    seniorPhaseoutRate: num(rows[srRate][c]) > 1 ? num(rows[srRate][c]) / 100 : num(rows[srRate][c]),
    seniorPhaseoutStart: { single: num(rows[srStartS][c]), mfj: num(rows[srStartM][c]) },
    // EIC, indexed by qualifying children 0/1/2/3+.
    eic: {
      phaseInRate: EIC_PHASE_IN,
      phaseOutRate: EIC_PHASE_OUT,
      earnedMax: four(eicEarnedMaxRow, c),
      maxCredit: four(eicMaxCreditRow, c),
      phaseOutStart: { single: four(eicPoStartSRow, c), mfj: four(eicPoStartMRow, c) },
      investmentIncomeCap: num(rows[eicInvCapRow][c]),
    },
    // Saver's credit AGI limits for the 50%/20%/10% tiers.
    saverTiers: { single: [0, 1, 2].map((i) => num(rows[svS50 + i][c])), mfj: [0, 1, 2].map((i) => num(rows[svM50 + i][c])) },
    // IRMAA (this year's MAGI sets premiums two years later; CSS projects the
    // corresponding thresholds). Monthly dollars; tiers are single-filer MAGI.
    irmaa: {
      basePartB: num(rows[irBase][c]),
      tiersSingle: five(irT1, c),
      tier5Mfj: num(rows[irT5M][c]),
      partBFactor: five(irF2, c),
      partDAdder: five(irA2, c),
    },
    ctc: { maxPerChild: num(rows[ctcPerChild][c]), maxRefundable: num(rows[ctcRefund][c]) },
  };
});

// Cross-check the EIC arithmetic against the sheet's own phase-out END columns:
// start + maxCredit/phaseOutRate should land on the printed end (± rounding).
for (const [k, y] of years.entries()) {
  const c = COLS[k];
  for (const [status, endRow] of [["single", eicPoEndSRow], ["mfj", eicPoEndMRow]]) {
    for (let i = 0; i < 4; i++) {
      const derived = y.eic.phaseOutStart[status][i] + y.eic.maxCredit[i] / y.eic.phaseOutRate[i];
      const printed = num(rows[endRow + i][c]);
      if (Math.abs(derived - printed) > 10) {
        throw new Error(`EIC cross-check failed ${y.year} ${status} kids=${i}: derived end ${derived.toFixed(0)} vs sheet ${printed}`);
      }
    }
  }
}

for (const y of years) {
  console.error(
    `  ${y.year}: 22% starts @ ${y.bracketFloors.single[2].toLocaleString()} (S) | ` +
      `LTCG 15% @ ${y.ltcg15Start.single.toLocaleString()} | std ded ${y.stdDeduction.single.toLocaleString()} | ` +
      `senior ${y.seniorDeduction} | EIC max(3) ${y.eic.maxCredit[3].toLocaleString()} ` +
      `inv-cap ${y.eic.investmentIncomeCap.toLocaleString()} | saver 50% ≤ ${y.saverTiers.single[0].toLocaleString()} (S) | ` +
      `IRMAA T1 @ ${y.irmaa.tiersSingle[0].toLocaleString()} base $${y.irmaa.basePartB} | CTC ${y.ctc.maxPerChild}`,
  );
}

const out = {
  source:
    "US federal tax parameters per IRS revenue procedures (and the 2025 OBBBA), collated via the community-maintained Case Study Spreadsheet (Mr. Money Mustache forums).",
  years,
};
writeFileSync(
  OUT,
  `// AUTO-GENERATED by scripts/reduce-tax-params.mjs — DO NOT EDIT.
// Re-run: npm run data:tax-params  (after dropping the new year's Case Study
// Spreadsheet into DATA_LIB/cashflow/)
//
// US federal tax parameters, ${years[0].year}–${years[years.length - 1].year}. Dollar values are
// annual; rates are fractions. Statutory non-indexed thresholds (Social
// Security taxability, NIIT) live in src/lib/usTax.ts, not here.

export interface TaxYearParams {
  year: number;
  /** Ordinary bracket rates, ascending (10%…37%). */
  rates: number[];
  /** Taxable income at which each rate begins, per filing status. */
  bracketFloors: { single: number[]; mfj: number[] };
  /** Taxable income where the 15% / 20% LTCG rates begin. */
  ltcg15Start: { single: number; mfj: number };
  ltcg20Start: { single: number; mfj: number };
  stdDeduction: { single: number; mfj: number };
  /** Additional standard deduction per person 65+ (or blind). */
  age65Adder: { single: number; mfj: number };
  /** OBBBA senior deduction per person 65+ (2025+; 0 earlier). */
  seniorDeduction: number;
  seniorPhaseoutRate: number;
  seniorPhaseoutStart: { single: number; mfj: number };
  /** Earned Income Credit; arrays indexed by qualifying children 0/1/2/3+. */
  eic: {
    phaseInRate: number[];
    phaseOutRate: number[];
    /** Earned income at which the credit plateaus. */
    earnedMax: number[];
    maxCredit: number[];
    /** AGI (or earned income, if greater) where the phase-out begins. */
    phaseOutStart: { single: number[]; mfj: number[] };
    /** Investment income above this DISQUALIFIES the credit entirely. */
    investmentIncomeCap: number;
  };
  /** Saver's credit AGI limits for the 50%/20%/10% tiers (0% above the last). */
  saverTiers: { single: number[]; mfj: number[] };
  /** Medicare IRMAA: monthly $ per person; MAGI tiers are single-filer
   *  (MFJ = 2× tiers 1–4, tier5Mfj for the top). Factors multiply the base
   *  Part B premium; adders are the Part D monthly surcharges. */
  irmaa: {
    basePartB: number;
    tiersSingle: number[];
    tier5Mfj: number;
    partBFactor: number[];
    partDAdder: number[];
  };
  /** Child Tax Credit: per-child maximum and the refundable (ACTC) cap. */
  ctc: { maxPerChild: number; maxRefundable: number };
}

export interface TaxParams { source: string; years: TaxYearParams[]; }

export const taxParams: TaxParams = ${JSON.stringify(out, null, 2)};
`,
);
console.error(`Wrote ${OUT}`);
