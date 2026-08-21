import { taxParams, type TaxYearParams } from "../data/generated/tax-params";

/**
 * Deliberately simplified US federal income-tax engine for the "How it's
 * taxed" (marginal-rate) mode of the Next Dollar tool.
 *
 * In scope — the pieces that create the surprising marginal rates:
 *  • ordinary brackets and the standard deduction (incl. the 65+ adder and the
 *    OBBBA senior deduction with its 6% phase-out),
 *  • Social Security taxability (the 50%/85% provisional-income thresholds —
 *    the "tax torpedo"),
 *  • qualified-dividend/LTCG stacking with the 0/15/20% zones (the phantom
 *    bump when ordinary income pushes gains out of the 0% zone),
 *  • NIIT, 3.8% on investment income above the MAGI threshold.
 *
 * Deliberately OUT: itemized deductions, state tax, AMT, credits (EITC, CTC,
 * saver's), payroll/SE tax, IRMAA. Stated in the tool's copy. Educational
 * only — real returns differ.
 *
 * Statutory, non-inflation-indexed thresholds live here (not in the generated
 * params): SS taxability ($25k/$34k single, $32k/$44k MFJ) and NIIT
 * ($200k/$250k).
 */

export type FilingStatus = "single" | "mfj";

export interface Household {
  year: number;
  status: FilingStatus;
  /** People aged 65+ (0–2; capped at 1 for single). */
  age65: number;
  /** Ordinary income: wages, pension, tIRA withdrawals, Roth conversions. */
  ordinary: number;
  /** Annual gross Social Security benefits. */
  ssBenefit: number;
  /** Qualified dividends + net long-term capital gains. */
  qdivLtcg: number;
}

export interface TaxResult {
  tax: number;
  ordinaryTax: number;
  ltcgTax: number;
  niit: number;
  taxableSS: number;
  agi: number;
  deduction: number;
  taxableIncome: number;
  /** Ordinary bracket the last ordinary dollar lands in (the "sticker" rate). */
  bracketRate: number;
}

const SS_T1 = { single: 25_000, mfj: 32_000 };
const SS_T2 = { single: 34_000, mfj: 44_000 };
const NIIT_RATE = 0.038;
const NIIT_START = { single: 200_000, mfj: 250_000 };

export function paramsFor(year: number): TaxYearParams {
  const p = taxParams.years.find((y) => y.year === year);
  if (!p) throw new Error(`No tax params for ${year}`);
  return p;
}
export const TAX_YEARS = taxParams.years.map((y) => y.year);

/** IRS worksheet: how much of the SS benefit is taxable, given other income. */
export function taxableSocialSecurity(h: Household): number {
  if (h.ssBenefit <= 0) return 0;
  const provisional = h.ordinary + h.qdivLtcg + 0.5 * h.ssBenefit;
  const t1 = SS_T1[h.status];
  const t2 = SS_T2[h.status];
  if (provisional <= t1) return 0;
  if (provisional <= t2) return Math.min(0.5 * (provisional - t1), 0.5 * h.ssBenefit);
  return Math.min(
    0.85 * h.ssBenefit,
    0.85 * (provisional - t2) + Math.min(0.5 * (t2 - t1), 0.5 * h.ssBenefit),
  );
}

/** Progressive tax on `amount` using floors/rates (floors[i] = where rates[i] starts). */
function bracketTax(amount: number, floors: number[], rates: number[]): number {
  let tax = 0;
  for (let i = 0; i < rates.length; i++) {
    const lo = floors[i];
    const hi = i + 1 < floors.length ? floors[i + 1] : Infinity;
    if (amount <= lo) break;
    tax += (Math.min(amount, hi) - lo) * rates[i];
  }
  return tax;
}

export function federalTax(h: Household): TaxResult {
  const p = paramsFor(h.year);
  const s = h.status;
  const n65 = Math.min(h.age65, s === "single" ? 1 : 2);

  const taxableSS = taxableSocialSecurity(h);
  const agi = h.ordinary + h.qdivLtcg + taxableSS; // MAGI ≈ AGI at this level of detail

  // Standard deduction + 65+ adder + OBBBA senior deduction (6% phase-out on
  // MAGI above the start; reduces the combined senior amount, floored at 0).
  let deduction = p.stdDeduction[s] + n65 * p.age65Adder[s];
  if (p.seniorDeduction > 0 && n65 > 0) {
    const excess = Math.max(0, agi - p.seniorPhaseoutStart[s]);
    deduction += Math.max(0, n65 * p.seniorDeduction - p.seniorPhaseoutRate * excess);
  }

  const ti = Math.max(0, agi - deduction);
  // Preferential income fills the TOP of taxable income (QDCGT worksheet):
  // the deduction soaks into ordinary income first.
  const pref = Math.min(h.qdivLtcg, ti);
  const taxableOrdinary = ti - pref;

  const ordinaryTax = bracketTax(taxableOrdinary, p.bracketFloors[s], p.rates);

  // LTCG stacking: pref income occupies [taxableOrdinary, ti] on the ladder;
  // 0% below ltcg15Start, 15% to ltcg20Start, 20% above.
  const z15 = p.ltcg15Start[s];
  const z20 = p.ltcg20Start[s];
  // in15 spans [max(ord, z15), min(ti, z20)]; in20 spans above max(ord, z20).
  // The two zones are disjoint by construction.
  const in15 = Math.max(0, Math.min(ti, z20) - Math.max(taxableOrdinary, z15));
  const in20 = Math.max(0, ti - Math.max(taxableOrdinary, z20));
  const ltcgTax = in15 * 0.15 + in20 * 0.2;

  const niit = NIIT_RATE * Math.min(h.qdivLtcg, Math.max(0, agi - NIIT_START[s]));

  // Sticker bracket for the copy ("you'd guess …%").
  const floors = p.bracketFloors[s];
  let bracketRate = p.rates[0];
  for (let i = 0; i < floors.length; i++) if (taxableOrdinary > floors[i]) bracketRate = p.rates[i];

  const tax = ordinaryTax + ltcgTax + niit;
  return { tax, ordinaryTax, ltcgTax, niit, taxableSS, agi, deduction, taxableIncome: ti, bracketRate };
}

export type SweepVar = "ordinary" | "qdivLtcg";

/** Marginal rate on the next Δ dollars of `sweep` income. Exact for a
 *  piecewise-linear engine as long as Δ doesn't straddle >1 breakpoint. */
export function marginalRate(h: Household, sweep: SweepVar, delta = 10): number {
  const base = federalTax(h).tax;
  const bumped = federalTax({ ...h, [sweep]: h[sweep] + delta }).tax;
  return (bumped - base) / delta;
}
