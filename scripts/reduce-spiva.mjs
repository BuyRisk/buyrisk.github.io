/**
 * Emit src/data/generated/spiva.ts — the SPIVA active-vs-benchmark scorecard.
 *
 * SPIVA (S&P Indices Versus Active) measures the single most important fact in
 * the active-vs-passive debate: the share of actively managed funds that FAIL to
 * beat their benchmark index over 1, 3, 5, 10, 15, and 20 years. The signature
 * result — underperformance climbs steeply with the horizon — is the empirical
 * backbone of "Can You Beat the Market?".
 *
 * Unlike our other datasets, SPIVA ships only as a copyrighted PDF with no
 * machine-readable release, so the raw report is git-ignored and CANNOT be
 * auto-parsed. The figures below are hand-transcribed from the specific report
 * tables noted, each cross-checked against the report's own narrative where the
 * scorecard quotes a headline number. This script is the provenance record; it
 * simply renders the transcribed table into a typed module.
 *
 * Source: S&P Dow Jones Indices, "SPIVA U.S. Scorecard, Year-End 2025."
 * Data as of Dec. 31, 2025. Reports 1a (U.S. equity), 6a (international equity),
 * 11a (fixed income) — all "based on absolute return." A null = not reported for
 * that horizon (e.g. a benchmark without 20 years of history).
 *
 * Run:  npm run data:spiva
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "src", "data", "generated", "spiva.ts");

const HORIZONS = [1, 3, 5, 10, 15, 20];

// [1y, 3y, 5y, 10y, 15y, 20y] % of active funds underperforming the benchmark.
const GROUPS = [
  {
    id: "us-equity",
    label: "U.S. stock funds",
    report: "SPIVA Report 1a (U.S. equity, absolute return)",
    categories: [
      { id: "all-domestic", name: "All domestic funds", benchmark: "S&P Composite 1500", rates: [79.83, 80.4, 91.47, 90.43, 93.15, 95.01] },
      { id: "large-cap", name: "Large-cap funds", benchmark: "S&P 500", rates: [78.78, 66.84, 88.96, 85.59, 89.93, 92.89] },
      { id: "mid-cap", name: "Mid-cap funds", benchmark: "S&P MidCap 400", rates: [55.41, 62.93, 72.32, 81.14, 84.49, 89.74] },
      { id: "small-cap", name: "Small-cap funds", benchmark: "S&P SmallCap 600", rates: [40.65, 42.18, 62.67, 75.95, 89.9, 90.28] },
      { id: "large-growth", name: "Large-cap growth funds", benchmark: "S&P 500 Growth", rates: [95.51, 56.33, 95.26, 91.67, 97.82, 99.55] },
      { id: "large-value", name: "Large-cap value funds", benchmark: "S&P 500 Value", rates: [41.3, 80.51, 83.03, 88.45, 93.29, 87.01] },
      { id: "real-estate", name: "Real estate funds", benchmark: "S&P United States REIT", rates: [83.58, 88.61, 97.44, 84.04, 90.1, 91.14] },
    ],
  },
  {
    id: "intl-equity",
    label: "International stock funds",
    report: "SPIVA Report 6a (international equity, absolute return)",
    categories: [
      { id: "global", name: "Global funds", benchmark: "S&P World", rates: [75.71, 86.94, 94.81, 93.41, 95.63, null] },
      { id: "international", name: "International funds", benchmark: "S&P World Ex-U.S.", rates: [63.18, 76.38, 80.0, 89.78, 92.7, null] },
      { id: "intl-small", name: "International small-cap funds", benchmark: "S&P Developed Ex-U.S. SmallCap", rates: [70.13, 69.41, 70.0, 73.81, 78.85, 84.78] },
      { id: "emerging", name: "Emerging market funds", benchmark: "S&P Emerging Plus", rates: [53.02, 70.05, 73.5, 87.7, 89.58, 94.37] },
    ],
  },
  {
    id: "fixed-income",
    label: "Bond funds",
    report: "SPIVA Report 11a (fixed income, absolute return)",
    categories: [
      { id: "general-govt", name: "Government funds", benchmark: "iBoxx $ Domestic Sovereign & Sub-Sovereigns", rates: [94.44, 94.87, 91.18, 100.0, 84.71, null] },
      { id: "high-yield", name: "High-yield bond funds", benchmark: "iBoxx $ Liquid High Yield", rates: [76.19, 83.52, 74.1, 86.61, 85.64, 82.35] },
    ],
  },
];

function main() {
  writeFileSync(OUT, render());
  const flat = GROUPS.flatMap((g) => g.categories);
  const at = (c, h) => c.rates[HORIZONS.indexOf(h)];
  const worst20 = flat.filter((c) => at(c, 20) != null).sort((a, b) => at(b, 20) - at(a, 20))[0];
  console.log(
    `spiva: ${GROUPS.length} groups, ${flat.length} categories, horizons ${HORIZONS.join("/")}\n` +
      `  large-cap vs S&P 500: 1yr ${at(flat[1], 1)}% → 20yr ${at(flat[1], 20)}%\n` +
      `  worst 20-yr: ${worst20.name} ${at(worst20, 20)}% underperformed ${worst20.benchmark}\n  → ${OUT}`
  );
}

function render() {
  const groups = GROUPS.map((g) => {
    const cats = g.categories
      .map(
        (c) =>
          `      { id: ${JSON.stringify(c.id)}, name: ${JSON.stringify(c.name)}, benchmark: ${JSON.stringify(
            c.benchmark
          )}, rates: [${c.rates.map((r) => (r == null ? "null" : r)).join(", ")}] },`
      )
      .join("\n");
    return `  {
    id: ${JSON.stringify(g.id)},
    label: ${JSON.stringify(g.label)},
    report: ${JSON.stringify(g.report)},
    categories: [
${cats}
    ],
  },`;
  }).join("\n");

  return `// AUTO-GENERATED by scripts/reduce-spiva.mjs — DO NOT EDIT.
// Re-run: npm run data:spiva
//
// Percentage of actively managed funds that UNDERPERFORMED their benchmark index
// over each horizon, from the SPIVA U.S. Year-End 2025 Scorecard (absolute
// return). rates are aligned to \`horizons\`; null = not reported for that horizon.

export interface SpivaCategory {
  id: string;
  name: string;
  benchmark: string;
  /** % underperforming, aligned to \`horizons\`. null where not reported. */
  rates: (number | null)[];
}
export interface SpivaGroup {
  id: string;
  label: string;
  /** Source report/table these figures were transcribed from. */
  report: string;
  categories: SpivaCategory[];
}
export interface SpivaData {
  asOf: string;
  source: string;
  horizons: number[];
  groups: SpivaGroup[];
}

export const spiva: SpivaData = {
  asOf: "Dec. 31, 2025",
  source: "S&P Dow Jones Indices, “SPIVA U.S. Scorecard, Year-End 2025.”",
  horizons: [${HORIZONS.join(", ")}],
  groups: [
${groups}
  ],
};
`;
}

main();
