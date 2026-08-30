import { socialSecurity } from "../data/generated/social-security";

/**
 * Social Security PIA (primary insurance amount) computation from an earnings
 * history — the SSA's actual method, validated against the agency's own
 * published worked examples (Cases A and B for workers retiring in 2026; see
 * scripts/verify-ssa-pia.mjs):
 *
 *  1. Index each year's covered earnings by AWI(age-60 year) / AWI(year);
 *     years at age 60+ are taken at face value (factor 1).
 *  2. AIME = the top 35 indexed years, summed, ÷ 420 months, truncated to $1.
 *  3. Apply the eligibility-year (age 62) bend-point formula:
 *     90% of the first slice + 32% of the second + 15% above the second,
 *     truncated to the next lower dime.
 *  4. Chain COLAs from the eligibility year forward, truncating to the dime
 *     each year (SSA rounding).
 *  Actual payments round down to the whole dollar after any early/delayed
 *  adjustment (see benefitFactor in socialSecurity.ts).
 */

export interface YearEarnings {
  year: number;
  amount: number;
}

export interface PiaResult {
  /** Average indexed monthly earnings (dollar-truncated, per SSA). */
  aime: number;
  /** Year of first eligibility (age 62). */
  eligibilityYear: number;
  bendPoints: { first: number; second: number };
  /** PIA at eligibility, before COLAs (dime-truncated). */
  piaAtEligibility: number;
  /** PIA after chaining COLAs from eligibility through the latest on record. */
  pia: number;
}

const dimeFloor = (x: number) => Math.floor(x * 10 + 1e-9) / 10;

function awiFor(year: number): number | undefined {
  return socialSecurity.awi.find((a) => a.year === year)?.value;
}

/** Bend-point formula (90/32/15), dime-truncated. */
export function piaFromAime(aime: number, bend: { first: number; second: number }): number {
  const slice1 = Math.min(aime, bend.first);
  const slice2 = Math.max(0, Math.min(aime, bend.second) - bend.first);
  const slice3 = Math.max(0, aime - bend.second);
  return dimeFloor(0.9 * slice1 + 0.32 * slice2 + 0.15 * slice3);
}

/**
 * Full SSA computation from a nominal earnings history. Throws if the AWI for
 * the indexing year (age 60) isn't on record yet — use estimatePiaToday for
 * workers that young.
 */
export function computePia(birthYear: number, earnings: YearEarnings[]): PiaResult {
  const indexingYear = birthYear + 60;
  const eligibilityYear = birthYear + 62;
  const awiBase = awiFor(indexingYear);
  if (!awiBase) throw new Error(`AWI for indexing year ${indexingYear} not on record`);

  const indexed = earnings.map(({ year, amount }) => {
    const awiY = year < indexingYear ? awiFor(year) : undefined;
    const factor = year < indexingYear ? (awiY ? awiBase / awiY : 1) : 1;
    return amount * factor;
  });
  indexed.sort((a, b) => b - a);
  const top35 = indexed.slice(0, 35).reduce((s, v) => s + v, 0);
  const aime = Math.floor(top35 / 420);

  const bend = socialSecurity.bendPoints.find((b) => b.year === eligibilityYear);
  if (!bend) throw new Error(`No bend points for eligibility year ${eligibilityYear}`);

  const piaAtEligibility = piaFromAime(aime, bend);
  let pia = piaAtEligibility;
  for (const c of socialSecurity.cola) {
    if (c.year >= eligibilityYear) pia = dimeFloor(pia * (1 + c.value));
  }
  return { aime, eligibilityYear, bendPoints: { first: bend.first, second: bend.second }, piaAtEligibility, pia };
}

/** 2026 contribution & benefit base — earnings above it aren't covered. */
export const TAXABLE_MAX = 184_500;

/**
 * Quick steady-earner estimate in TODAY'S dollars, for people who don't know
 * their PIA: assumes earnings hold their current position relative to the
 * national average wage for `yearsWorked` years, and applies the latest bend
 * points. Within ~10% for steady careers (rising careers land a bit higher);
 * the SSA's own estimate (ssa.gov/myaccount) uses the real earnings record.
 */
export function estimatePiaToday(annualSalary: number, yearsWorked: number): { aime: number; pia: number } {
  const covered = Math.min(Math.max(0, annualSalary), TAXABLE_MAX);
  const aime = Math.floor((covered * Math.min(yearsWorked, 35)) / 35 / 12);
  const bend = socialSecurity.bendPoints[socialSecurity.bendPoints.length - 1];
  return { aime, pia: piaFromAime(aime, bend) };
}
