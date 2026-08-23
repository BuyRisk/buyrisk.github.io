/**
 * Hand-computed unit checks for src/lib/usTax.ts (2026 params unless noted).
 * Run:  node scripts/verify-tax-engine.mjs
 * Exits non-zero on any failure. The CSS oracle comparison (Excel COM) is a
 * separate, local-only step — see docs/future-work.md spec.
 *
 * 2026 anchors (from tax-params.ts): S std ded 16,100; brackets 10% @0,
 * 12% @12,400, 22% @50,400, 24% @105,700; LTCG 0% until 49,450 (S) / 98,900
 * (MFJ); senior deduction 6,000 (65+), 6% phaseout over 75k (S) / 150k (MFJ);
 * age-65 adder 2,050 (S) / 1,650 each (MFJ).
 * v2 anchors: EIC (2 kids) phase-in 40% to 18,290, max 7,316, phase-out
 * 21.06% past 23,890 (S) / 31,160 (MFJ), investment-income cap 12,200;
 * saver's tiers S 24,250/26,250/40,250, MFJ 48,500/52,500/80,500; CTC 2,200
 * per child (1,700 refundable, 15% phase-in over 2,500 earned, 5% phase-out
 * past 200k/400k); IRMAA base Part B 238.70, tier-1 MAGI 113k (S) / 226k
 * (MFJ), factor 1.4 + Part D adder 16.10.
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
const { federalTax, marginalRate, taxableSocialSecurity, irmaa, findCliffs } = await import(
  pathToFileURL(bundlePath).href
);

let fails = 0;
const near = (got, want, tol, name) => {
  const ok = Math.abs(got - want) <= tol;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: got ${got.toFixed(2)}, want ${want.toFixed(2)} ±${tol}`);
  if (!ok) fails++;
};

const H = (o) => ({
  year: 2026, status: "single", age65: 0,
  wages: 0, otherOrdinary: 0, ssBenefit: 0, qdivLtcg: 0,
  kids: 0, saverContrib: 0,
  ...o,
});

// ============================ v1 checks ====================================
// (unchanged math; "ordinary" income modeled as otherOrdinary — pension/IRA —
// so the childless EIC can't contaminate the original expectations)

// 1. Plain ordinary income, single, under-65: 60,000 → TI 43,900.
//    Tax = 12,400×10% + (43,900−12,400)×12% = 1,240 + 3,780 = 5,020.
near(federalTax(H({ otherOrdinary: 60_000 })).tax, 5_020, 0.01, "single ordinary 60k");

// 2. Bracket edge: TI exactly 50,400 (ordinary 66,500) → next dollar 22%.
near(marginalRate(H({ otherOrdinary: 66_500 }), "otherOrdinary"), 0.22, 0.001, "marginal at 22% floor");
near(marginalRate(H({ otherOrdinary: 66_480 }), "otherOrdinary"), 0.12, 0.001, "marginal just below floor");

// 3. SS taxability worksheet, single: SS 24,000, ordinary 20,000.
//    Provisional = 20,000+12,000 = 32,000 → between 25k and 34k:
//    taxable = min(0.5×(32,000−25,000), 12,000) = 3,500.
near(taxableSocialSecurity(H({ otherOrdinary: 20_000, ssBenefit: 24_000 })), 3_500, 0.01, "SS 50% zone");

// 4. Torpedo: same retiree, 65+, in the 85% conversion zone.
//    SS 24,000, ordinary 40,000 → prov 52,000 > 34k:
//    taxable = min(0.85×24,000, 0.85×18,000 + min(4,500, 12,000)) = min(20,400, 19,800) = 19,800.
near(taxableSocialSecurity(H({ otherOrdinary: 40_000, ssBenefit: 24_000 })), 19_800, 0.01, "SS 85% zone");
//    Marginal on the next ordinary dollar: +$1 ordinary → +$0.85 taxable SS
//    → 1.85 × 12% = 22.2% (retiree still inside the 12% bracket; senior
//    deduction NOT phasing out at AGI ≈ 59.8k < 75k).
near(marginalRate(H({ otherOrdinary: 40_000, ssBenefit: 24_000, age65: 1 }), "otherOrdinary"), 0.222, 0.002, "torpedo 1.85×12%");

// 5. Phantom LTCG bump: ordinary near the 0% LTCG edge with gains on top.
//    ordinary 60,000, LTCG 20,000, single under 65: TI = 63,900,
//    taxableOrdinary = 43,900 (< 49,450). Next ORDINARY dollar: +12% ordinary
//    AND pushes $1 of gain from 0% → 15% ⇒ 27%.
near(marginalRate(H({ otherOrdinary: 60_000, qdivLtcg: 20_000 }), "otherOrdinary"), 0.27, 0.002, "phantom 27% bump");
//    While the next GAIN dollar there stacks into the 15% zone (TI 63,900 > 49,450):
near(marginalRate(H({ otherOrdinary: 60_000, qdivLtcg: 20_000 }), "qdivLtcg"), 0.15, 0.002, "gain dollar at 15%");
//    But with small gains fully inside 0% (ordinary 30,000, gains 5,000; TI 18,900):
near(marginalRate(H({ otherOrdinary: 30_000, qdivLtcg: 5_000 }), "qdivLtcg"), 0.0, 0.002, "gain dollar at 0%");

// 6. NIIT: single, ordinary 210,000, gains 30,000 → AGI 240,000, over 200k by 40,000.
//    NIIT = 3.8% × min(30,000, 40,000) = 1,140.
near(federalTax(H({ otherOrdinary: 210_000, qdivLtcg: 30_000 })).niit, 1_140, 0.01, "NIIT amount");

// 7. Senior deduction phase-out: single 65+, ordinary 80,000 (AGI 80,000).
//    Deduction = 16,100 + 2,050 + max(0, 6,000 − 6%×5,000) = 16,100+2,050+5,700 = 23,850.
near(federalTax(H({ otherOrdinary: 80_000, age65: 1 })).deduction, 23_850, 0.01, "senior phaseout");
//    Its marginal effect: next dollar = 22% × (1 + 0.06) = 23.32%.
near(marginalRate(H({ otherOrdinary: 80_000, age65: 1 }), "otherOrdinary"), 0.2332, 0.002, "senior phaseout marginal");

// 8. MFJ sanity: both 65+, ordinary 100,000 (2026).
//    Deduction = 32,200 + 2×1,650 + max(0, 12,000 − 0) = 47,500 (AGI < 150k). TI = 52,500.
//    Tax = 24,800×10% + (52,500−24,800)×12% = 2,480 + 3,324 = 5,804.
near(federalTax({ ...H({ otherOrdinary: 100_000, age65: 2 }), status: "mfj" }).tax, 5_804, 0.01, "MFJ 65+ couple");

// 8b. Senior phase-out is PER PERSON (caught by the CSS oracle): both 65+,
//     AGI 229,750 → each keeps max(0, 6,000 − 6%×79,750) = 1,215.
//     Deduction = 32,200 + 3,300 + 2×1,215 = 37,930; TI = 191,820 →
//     tax = 2,480 + 9,120 + 22%×91,020 = 31,624.40.
{
  const r = federalTax({ ...H({ otherOrdinary: 200_000, ssBenefit: 35_000, age65: 2 }), status: "mfj" });
  near(r.deduction, 37_930, 0.01, "senior phaseout per person");
  near(r.tax, 31_624.40, 0.01, "CSS-oracle couple tax");
}
//     Marginal for the couple inside the window: 22% × (1 + 2×0.06) = 24.64%.
near(
  marginalRate({ ...H({ otherOrdinary: 200_000, ssBenefit: 35_000, age65: 2 }), status: "mfj" }, "otherOrdinary"),
  0.2464, 0.002, "couple senior phaseout marginal",
);

// ============================ v2 checks ====================================

// 9. EIC phase-in: single, 2 kids, wages 10,000.
//    EIC = min(40%×10,000, 7,316) = 4,000 (AGI 10,000 < phase-out start).
//    TI = 0 → no tax. ACTC = min(4,400, 2×1,700, 15%×(10,000−2,500)) = 1,125.
//    Net tax = −4,000 − 1,125 = −5,125 (a refund).
{
  const r = federalTax(H({ wages: 10_000, kids: 2 }));
  near(r.eic, 4_000, 0.01, "EIC phase-in amount");
  near(r.actc, 1_125, 0.01, "ACTC 15% phase-in");
  near(r.tax, -5_125, 0.01, "refundable credits net tax");
}
//    Marginal on the next wage dollar: −40% EIC phase-in − 15% ACTC = −55%.
near(marginalRate(H({ wages: 10_000, kids: 2 }), "wages"), -0.55, 0.002, "EIC+ACTC −55% marginal");

// 10. EIC phase-out: single, 2 kids, wages 30,000.
//     EIC = 7,316 − 21.06%×(30,000−23,890) = 7,316 − 1,286.77 = 6,029.23.
//     TI = 13,900 → tax 1,420; CTC uses 1,420 nonrefundable + 2,980 ACTC.
{
  const r = federalTax(H({ wages: 30_000, kids: 2 }));
  near(r.eic, 6_029.23, 0.05, "EIC phase-out amount");
  near(r.ctc + r.actc, 4_400, 0.01, "CTC nonref+ACTC total");
  near(r.tax, -9_009.23, 0.05, "working-family net tax");
}
//     Marginal: 12% bracket + 21.06% EIC phase-out = 33.06% on a $30k income.
near(marginalRate(H({ wages: 30_000, kids: 2 }), "wages"), 0.3306, 0.002, "EIC phase-out 33% marginal");

// 11. EIC investment-income cliff: same family + $12,200 of gains is still
//     eligible; $1 more disqualifies the whole credit.
//     At qdiv 12,200: AGI 42,200 → EIC = 7,316 − 21.06%×18,310 = 3,459.91.
{
  near(federalTax(H({ wages: 30_000, kids: 2, qdivLtcg: 12_200 })).eic, 3_459.91, 0.05, "EIC at inv-income cap");
  near(federalTax(H({ wages: 30_000, kids: 2, qdivLtcg: 12_201 })).eic, 0, 0.01, "EIC beyond cap = 0");
  const cliffs = findCliffs(H({ wages: 30_000, kids: 2, qdivLtcg: 10_000 }), "qdivLtcg", 5_000);
  near(cliffs.length, 1, 0, "one inv-income cliff found");
  near(cliffs[0]?.x ?? -1, 2_201, 3, "inv-income cliff location");
  near(cliffs[0]?.jump ?? -1, 3_459.9, 5, "inv-income cliff size");
}

// 12. Childless EIC: single, wages 8,000 → min(7.65%×8,000, 664) = 612;
//     the 65+ age gate zeroes it.
near(federalTax(H({ wages: 8_000 })).eic, 612, 0.01, "childless EIC");
near(federalTax(H({ wages: 8_000, age65: 1 })).eic, 0, 0.01, "childless EIC ends at 65");

// 13. Saver's credit, 50% tier + nonrefundable limit: MFJ, wages 48,000,
//     contributions 4,000. AGI 48,000 ≤ 48,500 → 50% × 4,000 = 2,000 raw,
//     but tax = 10%×(48,000−32,200) = 1,580 caps it. Net tax 0.
{
  const r = federalTax({ ...H({ wages: 48_000, saverContrib: 4_000 }), status: "mfj" });
  near(r.saversCredit, 1_580, 0.01, "saver's credit tax-limited");
  near(r.tax, 0, 0.01, "saver zeroes the tax");
}
//     All three tier cliffs on one sweep (from wages 47,000, +$40k):
//     @48,500: 50%→20% = min(2,000, 1,630) − 800 = 830;
//     @52,500: 20%→10% = 800 − 400 = 400;  @80,500: 10%→0 = 400.
{
  const cliffs = findCliffs({ ...H({ wages: 47_000, saverContrib: 4_000 }), status: "mfj" }, "wages", 40_000);
  near(cliffs.length, 3, 0, "three saver tier cliffs");
  near(cliffs[0]?.x ?? -1, 1_501, 3, "50→20 cliff at 48,500");
  near(cliffs[0]?.jump ?? -1, 830, 5, "50→20 cliff size");
  near(cliffs[1]?.x ?? -1, 5_501, 3, "20→10 cliff at 52,500");
  near(cliffs[1]?.jump ?? -1, 400, 5, "20→10 cliff size");
  near(cliffs[2]?.x ?? -1, 33_501, 3, "10→0 cliff at 80,500");
  near(cliffs[2]?.jump ?? -1, 400, 5, "10→0 cliff size");
}

// 14. Credit ordering (8880 before 8812): single, 1 kid, wages 25,000,
//     contributions 2,000. AGI 25,000 → saver 20% × 2,000 = 400.
//     Tax = 10%×8,900 = 890 → saver 400, CTC nonref min(2,200, 490) = 490,
//     ACTC = min(1,710, 1,700, 15%×22,500) = 1,700 (refundable cap binds).
//     EIC = 4,427 − 15.98%×(25,000−23,890) = 4,249.62.
{
  const r = federalTax(H({ wages: 25_000, kids: 1, saverContrib: 2_000 }));
  near(r.saversCredit, 400, 0.01, "saver 20% tier");
  near(r.ctc, 490, 0.01, "CTC nonrefundable remainder");
  near(r.actc, 1_700, 0.01, "ACTC refundable cap binds");
  near(r.eic, 4_249.62, 0.05, "EIC with saver+CTC present");
  near(r.tax, -(400 + 490 + 1_700 + 4_249.62 - 890), 0.05, "ordering net tax");
}

// 15. CTC phase-out: single, 2 kids, wages 250,000.
//     CTC = 4,400 − 5%×50,000 = 1,900; marginal = 32% bracket + 5% = 37%.
{
  const r = federalTax(H({ wages: 250_000, kids: 2 }));
  near(r.ctc + r.actc, 1_900, 0.01, "CTC phased down");
  near(marginalRate(H({ wages: 250_000, kids: 2 }), "wages"), 0.37, 0.002, "32% + 5% CTC phase-out");
}

// 16. IRMAA: MFJ couple both 65+, pension/IRA 185,000, SS 35,000 (2026).
//     Taxable SS = 29,750 (85% cap) → MAGI 214,750 < 226,000 → tier 0.
//     +15,000 more ordinary → MAGI 229,750 → tier 1:
//     surcharge = 2×12×(238.70×0.4 + 16.10) = 24 × 111.58 = 2,677.92/yr.
{
  const base = { ...H({ otherOrdinary: 185_000, ssBenefit: 35_000, age65: 2 }), status: "mfj" };
  near(irmaa(base).tier, 0, 0, "IRMAA below tier 1");
  near(irmaa(base).annualTotal, 2 * 12 * 238.7, 0.01, "base Part B premiums");
  const up = { ...base, otherOrdinary: 200_000 };
  near(irmaa(up).tier, 1, 0, "IRMAA tier 1");
  near(irmaa(up).annualSurcharge, 2_677.92, 0.05, "IRMAA tier-1 surcharge");
  //   The cliff on the sweep: taxable SS is maxed, so MAGI = ordinary+29,750
  //   crosses 226,000 at ordinary 196,250 → x = 11,250.
  const cliffs = findCliffs(base, "otherOrdinary", 30_000, true);
  near(cliffs.length, 1, 0, "one IRMAA cliff in range");
  near(cliffs[0]?.x ?? -1, 11_251, 3, "IRMAA cliff location");
  near(cliffs[0]?.jump ?? -1, 2_677.92, 5, "IRMAA cliff size");
  //   Top tier sanity: MAGI 800k → tier 5, per-person 238.70×3.4 + 101.40.
  near(irmaa({ ...base, otherOrdinary: 800_000 }).perPersonMonthly, 912.98, 0.01, "IRMAA tier 5 monthly");
}

// 17. No Medicare, no IRMAA: under-65 high earner pays zero surcharge.
near(irmaa(H({ wages: 300_000 })).annualSurcharge, 0, 0.001, "no IRMAA before 65");

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
