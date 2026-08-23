/**
 * Validate src/lib/ssaPia.ts against the SSA's own published worked examples —
 * the roadmap's "QA practice to adopt" for the Social Security tool.
 *
 * Source: ssa.gov/oact/ProgData/retirebenefit1.html + retirebenefit2.html,
 * "Benefit Calculation Examples for Workers Retiring in 2026" (fetched
 * 2026-08-23). Case A: born 1964, steady near-average earner, retires at 62.
 * Case B: born 1959, maximum-taxable earner every year, retires at FRA
 * (66y10m). Nominal earnings 1986–2025 as published.
 *
 * Official expectations:
 *   A: AIME 5,825; bend 1,286/7,749 (2026); PIA 2,609.80; benefit at 62 = 1,826
 *   B: AIME 11,463; bend 996/6,002 (2021); PIA-at-eligibility 3,317.40;
 *      after COLAs 5.9/8.7/3.2/2.5/2.8 → 4,152.40; benefit at FRA = 4,152
 *
 * Run:  node scripts/verify-ssa-pia.mjs
 */
import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = async (entry, name) => {
  const out = join(tmpdir(), `${name}-${Date.now()}.mjs`);
  await build({ entryPoints: [join(root, ...entry)], bundle: true, format: "esm", outfile: out, logLevel: "silent" });
  return import(pathToFileURL(out).href);
};
const { computePia } = await bundle(["src", "lib", "ssaPia.ts"], "ssapia");
const { benefitFactor, fraMonths } = await bundle(["src", "lib", "socialSecurity.ts"], "ssalib");

let fails = 0;
const near = (got, want, tol, name) => {
  const ok = Math.abs(got - want) <= tol;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: got ${got}, want ${want} ±${tol}`);
  if (!ok) fails++;
};

// Nominal earnings 1986–2025 as published on retirebenefit1.html.
const YEARS = Array.from({ length: 40 }, (_, i) => 1986 + i);
const CASE_A = [
  16196, 17283, 18191, 18971, 19909, 20715, 21850, 22107, 22770, 23755,
  24994, 26533, 28007, 29657, 31392, 32238, 32660, 33558, 35224, 36621,
  38419, 40281, 41330, 40826, 41914, 43354, 44839, 45544, 47298, 49085,
  49783, 51651, 53677, 55848, 57590, 62889, 66421, 69560, 73133, 75868,
];
const CASE_B = [
  42000, 43800, 45000, 48000, 51300, 53400, 55500, 57600, 60600, 61200,
  62700, 65400, 68400, 72600, 76200, 80400, 84900, 87000, 87900, 90000,
  94200, 97500, 102000, 106800, 106800, 106800, 110100, 113700, 117000, 118500,
  118500, 127200, 128400, 132900, 137700, 142800, 147000, 160200, 168600, 176100,
];
const hist = (amts) => YEARS.map((year, i) => ({ year, amount: amts[i] }));

// Case A — born 1964, first eligible 2026 (no COLAs yet).
const a = computePia(1964, hist(CASE_A));
near(a.aime, 5_825, 0, "Case A AIME");
near(a.bendPoints.first, 1_286, 0, "Case A bend point 1");
near(a.bendPoints.second, 7_749, 0, "Case A bend point 2");
near(a.piaAtEligibility, 2_609.8, 0.001, "Case A PIA");
near(a.pia, 2_609.8, 0.001, "Case A PIA (no COLAs applicable)");
//   Claimed at 62 with FRA 67: 60 months early → ×0.70, floored to the dollar.
const benefitA = Math.floor(a.pia * benefitFactor(62 * 12, fraMonths(1964)));
near(benefitA, 1_826, 0, "Case A benefit at 62");

// Case B — born 1959, first eligible 2021, COLAs 2021–2025 chain to 2026.
const b = computePia(1959, hist(CASE_B));
near(b.aime, 11_463, 0, "Case B AIME");
near(b.bendPoints.first, 996, 0, "Case B bend point 1");
near(b.bendPoints.second, 6_002, 0, "Case B bend point 2");
near(b.piaAtEligibility, 3_317.4, 0.001, "Case B PIA at eligibility");
near(b.pia, 4_152.4, 0.001, "Case B PIA after COLAs");
//   Claimed exactly at FRA (66y10m): factor 1, floored to the dollar.
const benefitB = Math.floor(b.pia * benefitFactor(fraMonths(1959), fraMonths(1959)));
near(benefitB, 4_152, 0, "Case B benefit at FRA");

console.log(fails === 0 ? "\nALL PASS — PIA engine matches SSA's official examples" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
