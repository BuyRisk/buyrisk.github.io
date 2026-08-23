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
 *  • NIIT, 3.8% on investment income above the MAGI threshold,
 *  • the Earned Income Credit (phase-in, plateau, phase-out, and the
 *    investment-income cutoff — a true cliff),
 *  • the Child Tax Credit (refundable-portion phase-in on earned income,
 *    high-income phase-out; the $50-per-$1,000 step is smoothed to 5%),
 *  • the saver's credit (50/20/10% AGI tiers — each boundary is a cliff),
 *  • Medicare IRMAA as a premium OVERLAY (not a tax): this year's MAGI sets
 *    Part B/D surcharges two years later, in whole-tier cliffs.
 *
 * Deliberately OUT: itemized deductions, head-of-household, state tax, AMT,
 * payroll/SE tax, dependent-care/education credits. Stated in the tool's
 * copy. Educational only — real returns differ.
 *
 * Statutory, non-inflation-indexed thresholds live here (not in the generated
 * params): SS taxability ($25k/$34k single, $32k/$44k MFJ), NIIT
 * ($200k/$250k), CTC phase-out starts ($200k/$400k), the CTC earned-income
 * floor ($2,500), and the saver's-credit basis cap ($2,000/person).
 */

export type FilingStatus = "single" | "mfj";

export interface Household {
  year: number;
  status: FilingStatus;
  /** People aged 65+ (0–2; capped at 1 for single). */
  age65: number;
  /** Earned income: wages and self-employment. Drives EIC/ACTC phase-ins. */
  wages: number;
  /** Unearned ordinary income: pension, tIRA withdrawals, Roth conversions. */
  otherOrdinary: number;
  /** Annual gross Social Security benefits. */
  ssBenefit: number;
  /** Qualified dividends + net long-term capital gains. */
  qdivLtcg: number;
  /** Qualifying children (EIC counts at most 3; CTC counts all). */
  kids: number;
  /** Retirement contributions eligible for the saver's credit (basis is
   *  capped at $2,000/person; MFJ assumed split evenly between spouses). */
  saverContrib: number;
}

export interface TaxResult {
  /** Net federal tax: negative when refundable credits exceed liability. */
  tax: number;
  /** Bracket tax on ordinary + stacked LTCG, before any credits. */
  taxBeforeCredits: number;
  ordinaryTax: number;
  ltcgTax: number;
  niit: number;
  /** Saver's credit actually used (nonrefundable). */
  saversCredit: number;
  /** Child Tax Credit: nonrefundable part used + refundable ACTC. */
  ctc: number;
  actc: number;
  eic: number;
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
const CTC_PHASEOUT_START = { single: 200_000, mfj: 400_000 };
const CTC_PHASEOUT_RATE = 0.05; // $50 per $1,000 step, smoothed
const CTC_EARNED_FLOOR = 2_500;
const SAVER_BASIS_CAP = 2_000; // per person

export function paramsFor(year: number): TaxYearParams {
  const p = taxParams.years.find((y) => y.year === year);
  if (!p) throw new Error(`No tax params for ${year}`);
  return p;
}
export const TAX_YEARS = taxParams.years.map((y) => y.year);

/** IRS worksheet: how much of the SS benefit is taxable, given other income. */
export function taxableSocialSecurity(h: Household): number {
  if (h.ssBenefit <= 0) return 0;
  const other = h.wages + h.otherOrdinary + h.qdivLtcg;
  const provisional = other + 0.5 * h.ssBenefit;
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

/** EIC before considering the rest of the return: phase-in on earned income,
 *  plateau, phase-out on max(AGI, earned). Two hard eligibility gates: the
 *  investment-income cap (a cliff) and, for childless filers, the 25–64 age
 *  window (we can only see the 65+ end of it). */
function earnedIncomeCredit(h: Household, p: TaxYearParams, agi: number): number {
  if (h.wages <= 0) return 0;
  if (h.qdivLtcg > p.eic.investmentIncomeCap) return 0;
  const k = Math.min(Math.max(h.kids, 0), 3);
  if (k === 0 && h.age65 > 0) return 0; // childless EIC ends at 65
  const base = Math.min(p.eic.phaseInRate[k] * h.wages, p.eic.maxCredit[k]);
  const poIncome = Math.max(agi, h.wages);
  const reduction = p.eic.phaseOutRate[k] * Math.max(0, poIncome - p.eic.phaseOutStart[h.status][k]);
  return Math.max(0, base - reduction);
}

export function federalTax(h: Household): TaxResult {
  const p = paramsFor(h.year);
  const s = h.status;
  const n65 = Math.min(h.age65, s === "single" ? 1 : 2);

  const taxableSS = taxableSocialSecurity(h);
  const ordinary = h.wages + h.otherOrdinary;
  const agi = ordinary + h.qdivLtcg + taxableSS; // MAGI ≈ AGI at this level of detail

  // Standard deduction + 65+ adder + OBBBA senior deduction. The 6% phase-out
  // applies PER QUALIFYING PERSON against the same MAGI excess — a 65+ couple
  // loses 12¢ of deduction per extra dollar, and the whole $12,000 is gone by
  // $250k MAGI (verified against the CSS oracle and published OBBBA guidance).
  let deduction = p.stdDeduction[s] + n65 * p.age65Adder[s];
  if (p.seniorDeduction > 0 && n65 > 0) {
    const excess = Math.max(0, agi - p.seniorPhaseoutStart[s]);
    deduction += n65 * Math.max(0, p.seniorDeduction - p.seniorPhaseoutRate * excess);
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

  const taxBeforeCredits = ordinaryTax + ltcgTax;

  // Credits, in Form-1040 worksheet order: Schedule 3 nonrefundables (saver's)
  // reduce tax first, then the CTC's nonrefundable part, then the refundable
  // ACTC, then the fully refundable EIC. NIIT sits outside — nonrefundable
  // credits can't offset it.
  const tiers = p.saverTiers[s];
  const saverRate = agi <= tiers[0] ? 0.5 : agi <= tiers[1] ? 0.2 : agi <= tiers[2] ? 0.1 : 0;
  const saverBasis = Math.min(Math.max(h.saverContrib, 0), SAVER_BASIS_CAP * (s === "mfj" ? 2 : 1));
  const saversCredit = Math.min(saverRate * saverBasis, taxBeforeCredits);

  const ctcTotal = Math.max(
    0,
    p.ctc.maxPerChild * h.kids - CTC_PHASEOUT_RATE * Math.max(0, agi - CTC_PHASEOUT_START[s]),
  );
  const ctc = Math.min(ctcTotal, taxBeforeCredits - saversCredit);
  const actc = Math.min(
    ctcTotal - ctc,
    p.ctc.maxRefundable * h.kids,
    0.15 * Math.max(0, h.wages - CTC_EARNED_FLOOR),
  );

  const eic = earnedIncomeCredit(h, p, agi);

  // Sticker bracket for the copy ("you'd guess …%").
  const floors = p.bracketFloors[s];
  let bracketRate = p.rates[0];
  for (let i = 0; i < floors.length; i++) if (taxableOrdinary > floors[i]) bracketRate = p.rates[i];

  const tax = taxBeforeCredits - saversCredit - ctc + niit - actc - eic;
  return {
    tax, taxBeforeCredits, ordinaryTax, ltcgTax, niit,
    saversCredit, ctc, actc, eic,
    taxableSS, agi, deduction, taxableIncome: ti, bracketRate,
  };
}

// ---------------------------------------------------------------------------
// IRMAA — Medicare premium overlay. Not a tax: this year's MAGI sets each
// Medicare enrollee's Part B/D premiums two years from now, jumping a whole
// tier the dollar you cross a threshold. Cliffs, not rates.

export interface IrmaaResult {
  /** 0 = base premium, 1–5 = surcharge tiers. */
  tier: number;
  /** Medicare enrollees we assume: people 65+ (capped by filing status). */
  persons: number;
  /** Part B + Part D IRMAA per person per month at this MAGI. */
  perPersonMonthly: number;
  /** Annual household surcharge ABOVE the base premium (the cliff amounts). */
  annualSurcharge: number;
  /** Annual household total incl. the base Part B premium, for the readout. */
  annualTotal: number;
  /** MAGI thresholds for this status (where each tier begins). */
  thresholds: number[];
}

export function irmaa(h: Household): IrmaaResult {
  const p = paramsFor(h.year).irmaa;
  const persons = Math.min(h.age65, h.status === "single" ? 1 : 2);
  const thresholds =
    h.status === "single"
      ? p.tiersSingle
      : [...p.tiersSingle.slice(0, 4).map((t) => 2 * t), p.tier5Mfj];
  if (persons === 0) return { tier: 0, persons, perPersonMonthly: 0, annualSurcharge: 0, annualTotal: 0, thresholds };
  const magi = h.wages + h.otherOrdinary + h.qdivLtcg + taxableSocialSecurity(h);
  let tier = 0;
  for (const t of thresholds) if (magi > t) tier++;
  const monthly = tier === 0 ? p.basePartB : p.basePartB * p.partBFactor[tier - 1] + p.partDAdder[tier - 1];
  return {
    tier,
    persons,
    perPersonMonthly: monthly,
    annualSurcharge: persons * 12 * (monthly - p.basePartB),
    annualTotal: persons * 12 * monthly,
    thresholds,
  };
}

// ---------------------------------------------------------------------------
// Sweeps: marginal rates and cliff detection.

export type SweepVar = "wages" | "otherOrdinary" | "qdivLtcg";

/** Federal tax plus (optionally) the IRMAA surcharge — the "cost" whose slope
 *  and jumps the chart shows. */
export function totalCost(h: Household, includeIrmaa: boolean): number {
  return federalTax(h).tax + (includeIrmaa ? irmaa(h).annualSurcharge : 0);
}

/** Marginal rate on the next Δ dollars of `sweep` income. Exact for a
 *  piecewise-linear engine as long as Δ doesn't straddle >1 breakpoint —
 *  cliffs inside the window blow it up by design; see findCliffs. */
export function marginalRate(h: Household, sweep: SweepVar, delta = 10, includeIrmaa = false): number {
  const base = totalCost(h, includeIrmaa);
  const bumped = totalCost({ ...h, [sweep]: h[sweep] + delta }, includeIrmaa);
  return (bumped - base) / delta;
}

export interface Cliff {
  /** Extra swept dollars at which the jump occurs. */
  x: number;
  /** Dollar size of the discontinuity. */
  jump: number;
}

/**
 * Find discontinuities in totalCost along the sweep: points where one extra
 * dollar costs a lump sum (saver's-credit tier edges, the EIC investment-
 * income cutoff, IRMAA thresholds). Scale separation makes this exact: smooth
 * marginal rates in this engine stay within (−0.6, +1.2) per dollar, so
 * across a $16 window smooth change is at most ~$19, while a cliff of
 * ≥ `minJump` (default $50) moves it by ≥ $50 − $10. A fine scan flags
 * windows above the midpoint threshold and bisection pins each cliff to $2.
 */
export function findCliffs(
  h: Household,
  sweep: SweepVar,
  xMax: number,
  includeIrmaa = false,
  minJump = 50,
): Cliff[] {
  const cost = (x: number) => totalCost({ ...h, [sweep]: h[sweep] + x }, includeIrmaa);
  const cliffs: Cliff[] = [];
  const FINE = 16;
  const THRESH = minJump * 0.6; // above smooth-max, below cliff-min for FINE=16
  const bisect = (a: number, b: number, fa: number, fb: number) => {
    while (b - a > 2) {
      const m = Math.round((a + b) / 2);
      const fm = cost(m);
      // The (upward) jump lives in whichever half rose more.
      if (fm - fa > fb - fm) { b = m; fb = fm; } else { a = m; fa = fm; }
    }
    cliffs.push({ x: b, jump: fb - fa });
  };
  let prevX = 0;
  let prevF = cost(0);
  for (let x = FINE; prevX < xMax; x += FINE) {
    const xe = Math.min(x, xMax);
    const f = cost(xe);
    if (f - prevF > THRESH) bisect(prevX, xe, prevF, f);
    prevX = xe;
    prevF = f;
  }
  return cliffs.filter((c) => c.jump >= minJump * 0.9);
}
