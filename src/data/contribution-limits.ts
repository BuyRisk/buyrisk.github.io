/**
 * Annual tax-advantaged account contribution limits.
 *
 * ─── Refreshing (once a year, ~November) ───────────────────────────────────
 * Retirement limits: IRS "Cost-of-living adjustments for retirement items"
 * (a Notice released each fall). HSA/HDHP limits: a separate IRS Revenue
 * Procedure released the prior spring (2026 = Rev. Proc. 2025-19). Update
 * `taxYear` and the numbers below. Figures verified for 2026 from those sources.
 */

export const CONTRIBUTION_LIMITS = {
  taxYear: 2026,

  retirement: {
    /** 401(k), 403(b), most 457(b), and the federal TSP. */
    electiveDeferral: 24500,
    /** Standard age-50+ catch-up (added on top of the deferral). */
    catchUp50: 8000,
    /** Special SECURE 2.0 catch-up for ages 60–63 (replaces the age-50 one). */
    catchUp6063: 11250,
    /** IRA (traditional + Roth combined). */
    ira: 7500,
    /** IRA age-50+ catch-up. */
    iraCatchUp: 1100,
  },

  hsa: {
    selfOnly: 4400,
    family: 8750,
    /** Age-55+ catch-up (statutory, not inflation-indexed). */
    catchUp55: 1000,
    hdhpMinDeductibleSelf: 1700,
    hdhpMinDeductibleFamily: 3400,
    hdhpOopMaxSelf: 8500,
    hdhpOopMaxFamily: 17000,
  },

  /** Income phase-out ranges (modified AGI). */
  phaseOuts: {
    rothSingle: [153000, 168000] as [number, number],
    rothMarried: [242000, 252000] as [number, number],
    /** Traditional IRA deduction when the filer is covered by a workplace plan. */
    tradIraDeductionSingle: [81000, 91000] as [number, number],
    tradIraDeductionMarried: [129000, 149000] as [number, number],
  },
} as const;
