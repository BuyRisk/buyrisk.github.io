/**
 * Parameters for the Social Security claiming tool's tax + IRMAA layer.
 *
 * Two effects that change the after-tax value of a claiming decision:
 *
 *  1. Taxation of benefits. Up to 85% of a Social Security benefit becomes
 *     federally taxable once "provisional income" (other income + half the
 *     benefit) crosses fixed thresholds. Those thresholds were set in 1983/1993
 *     and are NOT inflation-indexed, so they're stable — the values below are the
 *     permanent statutory ones. (IRS Pub. 915.)
 *
 *  2. IRMAA. Above income tiers, Medicare Part B and Part D charge an
 *     income-related surcharge. These tiers ARE inflation-indexed yearly, and use
 *     MAGI from two years prior. Values below are for 2026 (based on 2024 MAGI).
 *
 * ─── Refreshing (yearly) ───────────────────────────────────────────────────
 * SS taxation thresholds: leave them — statutory, unchanged. IRMAA: update
 * `IRMAA.year`, the base premium, and the tier table each year from the CMS
 * Medicare premium announcement (~November).
 */

export type FilingStatus = "single" | "married";

/** Provisional-income thresholds for taxing benefits (IRC §86; not indexed). */
export const SS_TAX_THRESHOLDS: Record<
  FilingStatus,
  { base1: number; base2: number }
> = {
  single: { base1: 25000, base2: 34000 },
  married: { base1: 32000, base2: 44000 },
};

export interface IrmaaTier {
  /** Upper MAGI bound (inclusive) for single filers; Infinity for the top tier. */
  singleUpTo: number;
  /** Upper MAGI bound (inclusive) for married-filing-jointly. */
  marriedUpTo: number;
  /** Monthly Part B surcharge added to the base premium (per person). */
  partB: number;
  /** Monthly Part D surcharge (per person). */
  partD: number;
}

export const IRMAA = {
  year: 2026,
  source:
    "Centers for Medicare & Medicaid Services, 2026 Medicare Parts B & D premium announcement. IRMAA uses MAGI from two years prior (2024).",
  /** Standard 2026 Part B monthly premium, before any surcharge. */
  basePartB: 202.9,
  tiers: [
    { singleUpTo: 109000, marriedUpTo: 218000, partB: 0, partD: 0 },
    { singleUpTo: 137000, marriedUpTo: 274000, partB: 81.2, partD: 14.5 },
    { singleUpTo: 171000, marriedUpTo: 342000, partB: 202.9, partD: 37.5 },
    { singleUpTo: 205000, marriedUpTo: 410000, partB: 324.6, partD: 60.4 },
    { singleUpTo: 500000, marriedUpTo: 750000, partB: 446.3, partD: 83.3 },
    { singleUpTo: Infinity, marriedUpTo: Infinity, partB: 487.0, partD: 91.0 },
  ] as IrmaaTier[],
} as const;

/**
 * Federally taxable portion of an annual Social Security benefit, via the IRS
 * worksheet. `otherIncome` is all non-SS income that counts toward provisional
 * income (including tax-exempt interest).
 */
export function taxableSocialSecurity(
  annualBenefit: number,
  otherIncome: number,
  filing: FilingStatus,
): number {
  if (annualBenefit <= 0) return 0;
  const { base1, base2 } = SS_TAX_THRESHOLDS[filing];
  const provisional = otherIncome + annualBenefit / 2;
  if (provisional <= base1) return 0;
  if (provisional <= base2) {
    return Math.min(0.5 * annualBenefit, 0.5 * (provisional - base1));
  }
  const lower = Math.min(0.5 * annualBenefit, 0.5 * (base2 - base1));
  return Math.min(
    0.85 * annualBenefit,
    0.85 * (provisional - base2) + lower,
  );
}

/** Annual per-person IRMAA surcharge (Part B + Part D) at a given MAGI. */
export function irmaaAnnual(magi: number, filing: FilingStatus): number {
  const tier =
    IRMAA.tiers.find((t) =>
      filing === "single" ? magi <= t.singleUpTo : magi <= t.marriedUpTo,
    ) ?? IRMAA.tiers[IRMAA.tiers.length - 1];
  return (tier.partB + tier.partD) * 12;
}

/** Which 1-based IRMAA tier a MAGI falls in (1 = no surcharge). */
export function irmaaTierIndex(magi: number, filing: FilingStatus): number {
  const i = IRMAA.tiers.findIndex((t) =>
    filing === "single" ? magi <= t.singleUpTo : magi <= t.marriedUpTo,
  );
  return (i === -1 ? IRMAA.tiers.length - 1 : i) + 1;
}
