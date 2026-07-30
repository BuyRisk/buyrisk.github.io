import { shillerMonthly } from "../data/generated/shiller-monthly";

/**
 * Shared access to Shiller's monthly real total-return series, plus a cumulative
 * growth curve. Used by the dollar-cost-averaging and "time in the market" tools.
 * Returns are real (inflation-adjusted); index i is the return for the month
 * `dateAt(i)`.
 */
export const R = shillerMonthly.returns;
export const N = R.length;
export const FIRST_YEAR = shillerMonthly.startYear;
export const LAST_YEAR = shillerMonthly.endYear;

/** Calendar date of return index i. */
export function dateAt(i: number): { year: number; month: number } {
  const m0 = FIRST_YEAR * 12 + (shillerMonthly.startMonth - 1) + i;
  return { year: Math.floor(m0 / 12), month: (m0 % 12) + 1 };
}

/**
 * Cumulative growth of $1: C[i] is the value after the first i months, so growth
 * from month a to month b is C[b] / C[a]. Length N + 1, C[0] = 1.
 */
export const C: number[] = (() => {
  const c = new Array<number>(N + 1);
  c[0] = 1;
  for (let i = 0; i < N; i++) c[i + 1] = c[i] * (1 + R[i]);
  return c;
})();
