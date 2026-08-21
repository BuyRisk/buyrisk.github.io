/**
 * Hand-computed unit checks for src/lib/usTax.ts (2026 params unless noted).
 * Run:  node --experimental-strip-types scripts/verify-tax-engine.mjs
 * Exits non-zero on any failure. The CSS oracle comparison (Excel COM) is a
 * separate, local-only step — see docs/future-work.md spec.
 *
 * 2026 anchors (from tax-params.ts): S std ded 16,100; brackets 10% @0,
 * 12% @12,400, 22% @50,400, 24% @105,700; LTCG 0% until 49,450 (S) / 98,900
 * (MFJ); senior deduction 6,000 (65+), 6% phaseout over 75k (S) / 150k (MFJ);
 * age-65 adder 2,050 (S) / 1,650 each (MFJ).
 */
import { build } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

// Bundle the TS engine (plus its generated params import) so plain node can run it.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundlePath = join(tmpdir(), `ustax-verify-${Date.now()}.mjs`);
await build({
  entryPoints: [join(root, "src", "lib", "usTax.ts")],
  bundle: true,
  format: "esm",
  outfile: bundlePath,
  logLevel: "silent",
});
const { federalTax, marginalRate, taxableSocialSecurity } = await import(pathToFileURL(bundlePath).href);

let fails = 0;
const near = (got, want, tol, name) => {
  const ok = Math.abs(got - want) <= tol;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: got ${got.toFixed(2)}, want ${want.toFixed(2)} ±${tol}`);
  if (!ok) fails++;
};

const H = (o) => ({ year: 2026, status: "single", age65: 0, ordinary: 0, ssBenefit: 0, qdivLtcg: 0, ...o });

// 1. Plain wages, single, under-65: 60,000 wages → TI 43,900.
//    Tax = 12,400×10% + (43,900−12,400)×12% = 1,240 + 3,780 = 5,020.
near(federalTax(H({ ordinary: 60_000 })).tax, 5_020, 0.01, "single wages 60k");

// 2. Bracket edge: TI exactly 50,400 (ordinary 66,500) → next dollar 22%.
near(marginalRate(H({ ordinary: 66_500 }), "ordinary"), 0.22, 0.001, "marginal at 22% floor");
near(marginalRate(H({ ordinary: 66_480 }), "ordinary"), 0.12, 0.001, "marginal just below floor");

// 3. SS taxability worksheet, single: SS 24,000, ordinary 20,000.
//    Provisional = 20,000+12,000 = 32,000 → between 25k and 34k:
//    taxable = min(0.5×(32,000−25,000), 12,000) = 3,500.
near(taxableSocialSecurity(H({ ordinary: 20_000, ssBenefit: 24_000 })), 3_500, 0.01, "SS 50% zone");

// 4. Torpedo: same retiree, 65+, in the 85% conversion zone.
//    SS 24,000, ordinary 40,000 → prov 52,000 > 34k:
//    taxable = min(0.85×24,000, 0.85×18,000 + min(4,500, 12,000)) = min(20,400, 19,800) = 19,800.
near(taxableSocialSecurity(H({ ordinary: 40_000, ssBenefit: 24_000 })), 19_800, 0.01, "SS 85% zone");
//    Marginal on the next ordinary dollar: +$1 ordinary → +$0.85 taxable SS
//    → 1.85 × 12% = 22.2% (retiree still inside the 12% bracket; senior
//    deduction NOT phasing out at AGI ≈ 59.8k < 75k).
near(marginalRate(H({ ordinary: 40_000, ssBenefit: 24_000, age65: 1 }), "ordinary"), 0.222, 0.002, "torpedo 1.85×12%");

// 5. Phantom LTCG bump: ordinary near the 0% LTCG edge with gains on top.
//    ordinary 60,000, LTCG 20,000, single under 65: TI = 63,900,
//    taxableOrdinary = 43,900 (< 49,450). Next ORDINARY dollar: +12% ordinary
//    AND pushes $1 of gain from 0% → 15% ⇒ 27%.
near(marginalRate(H({ ordinary: 60_000, qdivLtcg: 20_000 }), "ordinary"), 0.27, 0.002, "phantom 27% bump");
//    While the next GAIN dollar there stacks into the 15% zone (TI 63,900 > 49,450):
near(marginalRate(H({ ordinary: 60_000, qdivLtcg: 20_000 }), "qdivLtcg"), 0.15, 0.002, "gain dollar at 15%");
//    But with small gains fully inside 0% (ordinary 30,000, gains 5,000; TI 18,900):
near(marginalRate(H({ ordinary: 30_000, qdivLtcg: 5_000 }), "qdivLtcg"), 0.0, 0.002, "gain dollar at 0%");

// 6. NIIT: single, wages 210,000, gains 30,000 → AGI 240,000, over 200k by 40,000.
//    NIIT = 3.8% × min(30,000, 40,000) = 1,140.
near(federalTax(H({ ordinary: 210_000, qdivLtcg: 30_000 })).niit, 1_140, 0.01, "NIIT amount");

// 7. Senior deduction phase-out: single 65+, ordinary 80,000 (AGI 80,000).
//    Deduction = 16,100 + 2,050 + max(0, 6,000 − 6%×5,000) = 16,100+2,050+5,700 = 23,850.
near(federalTax(H({ ordinary: 80_000, age65: 1 })).deduction, 23_850, 0.01, "senior phaseout");
//    Its marginal effect: next dollar = 22% × (1 + 0.06) = 23.32%.
near(marginalRate(H({ ordinary: 80_000, age65: 1 }), "ordinary"), 0.2332, 0.002, "senior phaseout marginal");

// 8. MFJ sanity: both 65+, ordinary 100,000 (2026).
//    Deduction = 32,200 + 2×1,650 + max(0, 12,000 − 0) = 47,500 (AGI < 150k). TI = 52,500.
//    Tax = 24,800×10% + (52,500−24,800)×12% = 2,480 + 3,324 = 5,804.
near(federalTax({ ...H({ ordinary: 100_000, age65: 2 }), status: "mfj" }).tax, 5_804, 0.01, "MFJ 65+ couple");

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
