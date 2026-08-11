import { socialSecurity } from "../data/generated/social-security";
import {
  taxableSocialSecurity,
  irmaaAnnual,
  irmaaTierIndex,
  type FilingStatus,
} from "../data/tax-irmaa";

/**
 * A Social Security claiming optimizer, in the spirit of Mike Piper's Open Social
 * Security: for each possible claim age (62–70), present-value the lifetime
 * benefit stream *weighted by the probability of being alive to collect it*, and
 * pick the age that maximizes it. Benefits are real (they rise with COLA), so we
 * discount at a real rate.
 *
 * Two personalization levers beyond the textbook version:
 *  • Health → a mortality hazard multiplier (smoking, exercise) reshapes the
 *    survival curve, quantifying how much longevity (and thus the value of
 *    delaying) fitness buys.
 *  • Debt → the discount rate. Using early benefits to retire a 6% mortgage *is*
 *    a 6% return, so debt raises your effective discount rate and favors claiming
 *    earlier.
 *
 * For couples, `optimizeCouple` adds the single most important effect the
 * single-earner model misses: the survivor benefit. When the first spouse dies,
 * the survivor's check steps up to the larger of the two, and it keeps the
 * deceased's delayed-retirement credits, so the higher earner's benefit really
 * insures the longer of two lives. That reliably pushes the higher earner's
 * optimal claim age toward 70.
 *
 * Educational only. We model retirement + survivor benefits and joint mortality;
 * we still omit spousal top-ups, taxes, and the earnings test. For an actual
 * filing strategy, use opensocialsecurity.com.
 */

export type Sex = "male" | "female";
export type Smoking = "never" | "former" | "current";
export type Exercise = "sedentary" | "moderate" | "active" | "daily";
/** A known health outlook, layered on top of smoking/exercise. */
export type Condition = "none" | "chronic" | "serious";
export interface Health {
  sex: Sex;
  smoking: Smoking;
  exercise: Exercise;
  /** Optional diagnosed condition that shortens the survival curve. */
  condition?: Condition;
}

/** Full retirement age in months, by birth year (SSA schedule). */
export function fraMonths(birthYear: number): number {
  if (birthYear <= 1937) return 65 * 12;
  if (birthYear <= 1942) return 65 * 12 + (birthYear - 1937) * 2;
  if (birthYear <= 1954) return 66 * 12;
  if (birthYear <= 1959) return 66 * 12 + (birthYear - 1954) * 2;
  return 67 * 12;
}

/** Monthly benefit as a fraction of PIA for a claim age (months), given FRA. */
export function benefitFactor(claimMonths: number, fra: number): number {
  const capped = Math.min(claimMonths, 70 * 12); // no credit past 70
  const diff = capped - fra;
  if (diff >= 0) return 1 + (2 / 3 / 100) * diff; // delayed credit: +2/3%/mo (8%/yr)
  const early = -diff;
  const first = Math.min(early, 36);
  const rest = Math.max(0, early - 36);
  return 1 - (5 / 9 / 100) * first - (5 / 12 / 100) * rest; // early reduction
}

// Illustrative all-cause mortality hazard multipliers, centered so an "average"
// profile ≈ 1.0 (the SSA table is already population-average). Rough magnitudes
// from epidemiology; a teaching approximation, not a medical model.
const SMOKE_MULT: Record<Smoking, number> = { never: 0.85, former: 1.0, current: 2.0 };
const EXERCISE_MULT: Record<Exercise, number> = { sedentary: 1.25, moderate: 1.0, active: 0.8, daily: 0.7 };
// A diagnosed serious/chronic illness raises mortality. Deliberately coarse and
// illustrative — a teaching device to show a shorter horizon favors claiming
// earlier, not a medical prognosis.
const CONDITION_MULT: Record<Condition, number> = { none: 1.0, chronic: 1.7, serious: 3.5 };

export function hazardMultiplier(h: Health): number {
  return SMOKE_MULT[h.smoking] * EXERCISE_MULT[h.exercise] * CONDITION_MULT[h.condition ?? "none"];
}

/**
 * Survivors lₓ (starting from 1.0 at birth) with the hazard multiplier applied
 * to each year's death probability. Length 121 (ages 0..120).
 */
function survivorsWithHazard(sex: Sex, mult: number): number[] {
  const lt = socialSecurity.lifeTable;
  const l = new Array<number>(121);
  let surv = 1;
  for (let age = 0; age <= 120; age++) {
    l[age] = surv;
    const row = lt[age]; // table is contiguous 0..119
    const q = row ? (sex === "male" ? row.qMale : row.qFemale) : 1;
    surv *= 1 - Math.min(1, q * mult);
  }
  return l;
}

export interface AgePoint {
  age: number; // whole-year claim age
  monthly: number; // real monthly benefit if claimed here
  npv: number; // survival-weighted present value from currentAge
  claimable: boolean; // false for ages already behind you (npv is not a reachable choice)
}

/**
 * Optional "Advanced" tax + IRMAA layer. When present, the optimizer values the
 * *after-tax* benefit stream: it subtracts federal tax on the taxable portion of
 * benefits and the marginal Medicare IRMAA surcharge the benefit triggers (from
 * age 65). Everything is in today's dollars; `otherIncome` is assumed constant.
 */
export interface TaxParams {
  filing: FilingStatus;
  /** Annual non-SS income that counts toward provisional income & MAGI (today's $). */
  otherIncome: number;
  /** Marginal tax rate applied to the taxable portion of benefits (percent). */
  marginalRate: number;
}

export interface TaxInfo {
  /** Fraction of the benefit that is federally taxable, at the best claim age. */
  taxablePct: number;
  /** Annual federal tax on benefits, at the best claim age (today's $). */
  annualTax: number;
  /** Marginal annual IRMAA surcharge the benefit triggers (age 65+, today's $). */
  annualIrmaa: number;
  /** IRMAA tier (1 = no surcharge … 6 = top) at the best claim's MAGI. */
  irmaaTier: number;
  /** Survival-weighted PV of the worker's benefit ignoring tax & IRMAA. */
  grossNpv: number;
  /** Survival-weighted PV of the worker's benefit after tax & IRMAA. */
  netWorkerNpv: number;
  /** Net monthly benefit after tax & IRMAA once on Medicare, at the best claim. */
  netMonthly65Plus: number;
}

export interface OptimizeResult {
  fraMonths: number;
  hazardMult: number;
  lifeExpectancy: number; // total age
  best: { ageMonths: number; monthly: number; npv: number };
  points: AgePoint[]; // one per whole claim age 62..70
  breakevenAge: number; // 62-vs-70 cumulative crossover
  tax?: TaxInfo; // present only when a tax layer was supplied
  /** PV of a disabled adult child's benefit at the best claim (if modeled). */
  childNpv?: number;
}

export interface OptimizeInput {
  pia: number; // monthly PIA (benefit at full retirement age)
  birthYear: number;
  currentAge: number; // age at the decision point
  discountRate: number; // real, percent
  health: Health;
  tax?: TaxParams; // optional Advanced tax + IRMAA layer
  /** Model a disabled adult child drawing on this record (50% while you claim, 75% survivor). */
  disabledChild?: boolean;
}

export function optimize(inp: OptimizeInput): OptimizeResult {
  const fra = fraMonths(inp.birthYear);
  const mult = hazardMultiplier(inp.health);
  const l = survivorsWithHazard(inp.health.sex, mult);
  const baseAge = Math.min(119, Math.max(0, Math.round(inp.currentAge)));
  const base = l[baseAge] || 1e-9;
  // S[age] = P(alive at `age` | alive at currentAge)
  const S = l.map((v) => v / base);

  // Remaining life expectancy at currentAge (in years).
  let rem = 0.5;
  for (let age = baseAge + 1; age <= 120; age++) rem += S[age];
  const lifeExpectancy = baseAge + rem;

  const d = inp.discountRate / 100;
  const nowMonth = inp.currentAge * 12;
  const tax = inp.tax;

  // Annual tax + marginal-IRMAA charge for a given gross annual benefit. The
  // IRMAA figure is the *incremental* surcharge the benefit causes (MAGI with vs.
  // without the taxable benefit), so income the person owes regardless isn't
  // charged to the claim decision.
  const charges = (annualGross: number) => {
    if (!tax || annualGross <= 0) return { taxAnnual: 0, irmaaAnnual: 0, taxable: 0, tier: 1 };
    const taxable = taxableSocialSecurity(annualGross, tax.otherIncome, tax.filing);
    const taxAnnual = taxable * (tax.marginalRate / 100);
    const magiWith = tax.otherIncome + taxable;
    const irmaa = irmaaAnnual(magiWith, tax.filing) - irmaaAnnual(tax.otherIncome, tax.filing);
    return { taxAnnual, irmaaAnnual: Math.max(0, irmaa), taxable, tier: irmaaTierIndex(magiWith, tax.filing) };
  };

  const child = inp.disabledChild;
  const childAux = child ? 0.5 * inp.pia : 0; // 50% of PIA while you're claiming
  const childSurv = child ? 0.75 * inp.pia : 0; // 75% of PIA once you're gone

  // Survival-weighted PV of the net (after tax & IRMAA) worker stream, plus an
  // optional disabled-adult-child stream. IRMAA applies only from age 65; benefit
  // taxation applies at every age. Child benefits are the child's own income, so
  // they aren't taxed on the worker's return here.
  const pv = (claimMonth: number) => {
    const monthly = inp.pia * benefitFactor(claimMonth, fra);
    const c = charges(monthly * 12);
    const taxM = c.taxAnnual / 12;
    const irmaaM = c.irmaaAnnual / 12;
    let workerNet = 0;
    let workerGross = 0;
    for (let m = claimMonth; m <= 119 * 12 + 11; m++) {
      const age = Math.floor(m / 12);
      const w = S[age] / Math.pow(1 + d, (m - nowMonth) / 12);
      workerGross += monthly * w;
      workerNet += (monthly - taxM - (age >= 65 ? irmaaM : 0)) * w;
    }
    let childPv = 0;
    if (child) {
      for (let m = Math.round(nowMonth); m <= 119 * 12 + 11; m++) {
        const age = Math.floor(m / 12);
        const disc = Math.pow(1 + d, (m - nowMonth) / 12);
        // Auxiliary while you're alive AND have claimed; survivor once you've died.
        childPv += ((m >= claimMonth ? childAux : 0) * S[age] + childSurv * (1 - S[age])) / disc;
      }
    }
    return { monthly, workerNet, workerGross, childPv, npv: workerNet + childPv };
  };

  const startMonth = Math.max(62 * 12, Math.round(inp.currentAge * 12));
  let best = { ageMonths: startMonth, ...pv(startMonth) };
  for (let m = startMonth; m <= 70 * 12; m++) {
    const r = pv(m);
    if (r.npv > best.npv) best = { ageMonths: m, ...r };
  }

  const points: AgePoint[] = [];
  for (let a = 62; a <= 70; a++) {
    const r = pv(a * 12);
    // Ages already behind you aren't reachable choices; their npv double-counts
    // pre-now months, so flag them and let the chart drop them.
    points.push({ age: a, monthly: r.monthly, npv: r.npv, claimable: a * 12 >= startMonth });
  }

  // Undiscounted, unweighted 62-vs-70 cumulative crossover (the classic breakeven).
  const m62 = inp.pia * benefitFactor(62 * 12, fra);
  const m70 = inp.pia * benefitFactor(70 * 12, fra);
  const breakevenAge = (70 * m70 - 62 * m62) / (m70 - m62);

  let taxInfo: TaxInfo | undefined;
  if (tax) {
    const c = charges(best.monthly * 12);
    taxInfo = {
      taxablePct: best.monthly > 0 ? c.taxable / (best.monthly * 12) : 0,
      annualTax: c.taxAnnual,
      annualIrmaa: c.irmaaAnnual,
      irmaaTier: c.tier,
      grossNpv: best.workerGross,
      netWorkerNpv: best.workerNet,
      netMonthly65Plus: best.monthly - c.taxAnnual / 12 - c.irmaaAnnual / 12,
    };
  }

  return {
    fraMonths: fra,
    hazardMult: mult,
    lifeExpectancy,
    best: { ageMonths: best.ageMonths, monthly: best.monthly, npv: best.npv },
    points,
    breakevenAge,
    tax: taxInfo,
    childNpv: child ? best.childPv : undefined,
  };
}

// ---- Couple / survivor-aware optimization -------------------------------------

export interface Person {
  pia: number;
  birthYear: number;
  currentAge: number;
  health: Health;
}

/** Household tax layer for couples. Filing is automatic: married-filing-jointly
 *  while both are alive, single once one is a survivor. `otherIncome` is the
 *  household's non-SS income (today's $). */
export interface CoupleTaxParams {
  otherIncome: number;
  marginalRate: number;
  /** Household non-SS income for a lone survivor (often lower). Defaults to `otherIncome`. */
  survivorOtherIncome?: number;
}

export interface CoupleInput {
  a: Person;
  b: Person;
  discountRate: number;
  tax?: CoupleTaxParams;
  /** Model a disabled adult child drawing on the higher earner's record. */
  disabledChild?: boolean;
}

export interface CouplePoint {
  ageA: number;
  ageB: number;
  npv: number;
}

export interface CoupleResult {
  a: { fraMonths: number; lifeExpectancy: number; soloBestMonths: number; bestMonths: number };
  b: { fraMonths: number; lifeExpectancy: number; soloBestMonths: number; bestMonths: number };
  best: { aMonths: number; bMonths: number; npv: number };
  agesA: number[]; // whole claim ages available to A (rows of the grid)
  agesB: number[];
  grid: CouplePoint[]; // household NPV for every whole-age pair
  jointIndependentNpv: number; // value if each claims at their own solo optimum
  tax?: {
    grossNpv: number; // household PV ignoring tax & IRMAA
    netNpv: number; // household PV after tax & IRMAA (= best.npv)
    /** Household IRMAA tier while both are on Medicare, at the best claim pair. */
    irmaaTierBoth: number;
  };
  /** PV of a disabled adult child's benefit at the best claim pair (if modeled). */
  childNpv?: number;
}

/** Survival curve (conditioned on being alive at currentAge), FRA, and LE. */
function personSurvival(p: Person) {
  const mult = hazardMultiplier(p.health);
  const l = survivorsWithHazard(p.health.sex, mult);
  const baseAge = Math.min(119, Math.max(0, Math.round(p.currentAge)));
  const base = l[baseAge] || 1e-9;
  const S = l.map((v) => v / base);
  let rem = 0.5;
  for (let age = baseAge + 1; age <= 120; age++) rem += S[age];
  return { S, fra: fraMonths(p.birthYear), le: baseAge + rem };
}

/**
 * Survivor-aware joint optimization for a couple. Present-values the household
 * benefit stream over the joint mortality distribution: while both are alive each
 * receives their own benefit; once one dies, the survivor receives the LARGER of
 * their own benefit and the deceased's (the survivor benefit, which carries the
 * deceased's delayed credits and is floored at 82.5% of the deceased's PIA).
 * Teaching model: survivor benefits are available from age 60 and we omit spousal
 * top-ups, taxes, and the earnings test.
 */
export function optimizeCouple(inp: CoupleInput): CoupleResult {
  const A = personSurvival(inp.a);
  const B = personSurvival(inp.b);
  const d = inp.discountRate / 100;
  const startA = Math.round(inp.a.currentAge);
  const startB = Math.round(inp.b.currentAge);
  const T = Math.round((120 - Math.min(startA, startB)) * 12);

  // Precompute survival + discount along the shared calendar-month axis.
  const pA = new Array<number>(T + 1);
  const pB = new Array<number>(T + 1);
  const disc = new Array<number>(T + 1);
  const ageMA = new Array<number>(T + 1); // A's age in months at calendar month t
  const ageMB = new Array<number>(T + 1);
  for (let t = 0; t <= T; t++) {
    const am = startA * 12 + t;
    const bm = startB * 12 + t;
    ageMA[t] = am;
    ageMB[t] = bm;
    pA[t] = am <= 120 * 12 ? A.S[Math.floor(am / 12)] || 0 : 0;
    pB[t] = bm <= 120 * 12 ? B.S[Math.floor(bm / 12)] || 0 : 0;
    disc[t] = 1 / Math.pow(1 + d, t / 12);
  }

  const tax = inp.tax;
  const survInc = tax ? tax.survivorOtherIncome ?? tax.otherIncome : 0;
  // Net a monthly benefit for tax + per-person IRMAA. `filing` is married while
  // both live, single for a survivor; `irmaaCount` is how many in that state are
  // 65+ (each pays IRMAA, computed on the state's MAGI); `income` is the state's
  // other income (household while both live, survivor's alone once one dies).
  const netMonthly = (monthly: number, filing: FilingStatus, irmaaCount: number, income: number): number => {
    if (!tax || monthly <= 0) return monthly;
    const annual = monthly * 12;
    const taxable = taxableSocialSecurity(annual, income, filing);
    const taxCost = taxable * (tax.marginalRate / 100);
    const irmaaPer = Math.max(0, irmaaAnnual(income + taxable, filing) - irmaaAnnual(income, filing));
    return monthly - taxCost / 12 - (irmaaPer * irmaaCount) / 12;
  };

  // Worker (retirement + survivor) household PV only — no child benefits.
  const pv = (claimA: number, claimB: number, applyTax: boolean): number => {
    const benA = inp.a.pia * benefitFactor(claimA, A.fra);
    const benB = inp.b.pia * benefitFactor(claimB, B.fra);
    const survFromA = Math.max(benA, 0.825 * inp.a.pia); // what B inherits if A dies
    const survFromB = Math.max(benB, 0.825 * inp.b.pia);
    let npv = 0;
    for (let t = 0; t <= T; t++) {
      const aOwn = ageMA[t] >= claimA ? benA : 0;
      const bOwn = ageMB[t] >= claimB ? benB : 0;
      const sfB = ageMA[t] >= 60 * 12 ? survFromB : 0; // survivor benefits from age 60
      const sfA = ageMB[t] >= 60 * 12 ? survFromA : 0;
      const both = pA[t] * pB[t];
      const onlyA = pA[t] * (1 - pB[t]);
      const onlyB = (1 - pA[t]) * pB[t];
      let cBoth = aOwn + bOwn;
      let cA = Math.max(aOwn, sfB);
      let cB = Math.max(bOwn, sfA);
      if (applyTax && tax) {
        const a65 = ageMA[t] >= 65 * 12 ? 1 : 0;
        const b65 = ageMB[t] >= 65 * 12 ? 1 : 0;
        cBoth = netMonthly(cBoth, "married", a65 + b65, tax.otherIncome);
        cA = netMonthly(cA, "single", a65, survInc);
        cB = netMonthly(cB, "single", b65, survInc);
      }
      npv += (both * cBoth + onlyA * cA + onlyB * cB) * disc[t];
    }
    return npv;
  };

  // Disabled-adult-child stream, modeled on the higher earner's record: 50% of
  // that PIA while they're alive and have claimed, 75% once they've died.
  const child = inp.disabledChild;
  const hiIsA = inp.a.pia >= inp.b.pia;
  const piaHi = hiIsA ? inp.a.pia : inp.b.pia;
  const pHi = hiIsA ? pA : pB;
  const ageMHi = hiIsA ? ageMA : ageMB;
  const childPvAt = (claimHi: number): number => {
    let v = 0;
    for (let t = 0; t <= T; t++) {
      const aux = (ageMHi[t] >= claimHi ? 0.5 * piaHi : 0) * pHi[t];
      const surv = 0.75 * piaHi * (1 - pHi[t]);
      v += (aux + surv) * disc[t];
    }
    return v;
  };
  // Total household value used for the decision: worker stream + child stream.
  const score = (claimA: number, claimB: number): number =>
    pv(claimA, claimB, !!tax) + (child ? childPvAt(hiIsA ? claimA : claimB) : 0);

  const loA = Math.max(62, Math.ceil(inp.a.currentAge));
  const loB = Math.max(62, Math.ceil(inp.b.currentAge));
  const agesA: number[] = [];
  const agesB: number[] = [];
  for (let a = loA; a <= 70; a++) agesA.push(a);
  for (let b = loB; b <= 70; b++) agesB.push(b);

  // Coarse whole-age scan (also builds the heatmap grid).
  const grid: CouplePoint[] = [];
  let coarse = { aMonths: loA * 12, bMonths: loB * 12, npv: -Infinity };
  for (const a of agesA) {
    for (const b of agesB) {
      const npv = score(a * 12, b * 12);
      grid.push({ ageA: a, ageB: b, npv });
      if (npv > coarse.npv) coarse = { aMonths: a * 12, bMonths: b * 12, npv };
    }
  }

  // Refine to monthly resolution in a window around the coarse optimum.
  let best = coarse;
  const aFrom = Math.max(loA * 12, coarse.aMonths - 11);
  const aTo = Math.min(70 * 12, coarse.aMonths + 11);
  const bFrom = Math.max(loB * 12, coarse.bMonths - 11);
  const bTo = Math.min(70 * 12, coarse.bMonths + 11);
  for (let am = aFrom; am <= aTo; am++) {
    for (let bm = bFrom; bm <= bTo; bm++) {
      const npv = score(am, bm);
      if (npv > best.npv) best = { aMonths: am, bMonths: bm, npv };
    }
  }

  // Each partner's solo optimum (ignoring the survivor benefit), for contrast.
  const soloA = optimize({ pia: inp.a.pia, birthYear: inp.a.birthYear, currentAge: inp.a.currentAge, discountRate: inp.discountRate, health: inp.a.health }).best.ageMonths;
  const soloB = optimize({ pia: inp.b.pia, birthYear: inp.b.birthYear, currentAge: inp.b.currentAge, discountRate: inp.discountRate, health: inp.b.health }).best.ageMonths;

  let taxInfo: CoupleResult["tax"];
  if (tax) {
    const benA = inp.a.pia * benefitFactor(best.aMonths, A.fra);
    const benB = inp.b.pia * benefitFactor(best.bMonths, B.fra);
    const taxable = taxableSocialSecurity((benA + benB) * 12, tax.otherIncome, "married");
    taxInfo = {
      grossNpv: pv(best.aMonths, best.bMonths, false), // worker only, no tax
      netNpv: pv(best.aMonths, best.bMonths, true), // worker only, after tax
      irmaaTierBoth: irmaaTierIndex(tax.otherIncome + taxable, "married"),
    };
  }

  return {
    a: { fraMonths: A.fra, lifeExpectancy: A.le, soloBestMonths: soloA, bestMonths: best.aMonths },
    b: { fraMonths: B.fra, lifeExpectancy: B.le, soloBestMonths: soloB, bestMonths: best.bMonths },
    best,
    agesA,
    agesB,
    grid,
    jointIndependentNpv: score(soloA, soloB),
    tax: taxInfo,
    childNpv: child ? childPvAt(hiIsA ? best.aMonths : best.bMonths) : undefined,
  };
}

// ---- Surviving-spouse (widow/widower) optimization -----------------------------

/**
 * Survivor-benefit reduction factor for a claim age (months), given FRA. Survivor
 * benefits are available from 60, reduced to 71.5% at 60, rising linearly to 100%
 * at (survivor) full retirement age. Unlike retirement benefits, they earn NO
 * delayed credits past FRA. (We approximate survivor FRA with the retirement FRA.)
 */
export function survivorFactor(claimMonths: number, fra: number): number {
  const start = 60 * 12;
  if (claimMonths >= fra) return 1;
  if (claimMonths <= start) return 0.715;
  return 0.715 + 0.285 * ((claimMonths - start) / (fra - start));
}

export interface WidowInput {
  /** The survivor's OWN benefit at their full retirement age (their PIA). */
  ownPia: number;
  /** The full survivor benefit — what the late spouse was receiving (or would at the survivor's FRA). */
  survivorFull: number;
  birthYear: number;
  currentAge: number;
  discountRate: number;
  health: Health;
}

export interface WidowStrategy {
  firstType: "own" | "survivor";
  firstAgeMonths: number;
  secondType: "own" | "survivor" | null; // null = never switch (single benefit)
  switchAgeMonths: number;
  firstMonthly: number;
  secondMonthly: number;
  npv: number;
}

export interface WidowResult {
  fraMonths: number;
  lifeExpectancy: number;
  best: WidowStrategy;
  /** Best single-benefit plan (no switching), for the value-of-switching comparison. */
  naive: WidowStrategy;
}

/**
 * A surviving spouse can draw a survivor benefit and their own retirement benefit,
 * and can take one first and switch to the other — once, before 70. Because own
 * retirement earns delayed credits to 70 while survivor benefits max out at FRA,
 * the usual play is to take the smaller/soon-to-be-smaller benefit early and let
 * the other grow. This searches whole-year (start, switch) combinations for the
 * survival-weighted best, and also reports the best no-switch plan for contrast.
 * Educational; taxes/IRMAA and the survivor "RIB-LIM" cap are not modeled here.
 */
export function optimizeWidow(inp: WidowInput): WidowResult {
  const fra = fraMonths(inp.birthYear);
  const mult = hazardMultiplier(inp.health);
  const l = survivorsWithHazard(inp.health.sex, mult);
  const baseAge = Math.min(119, Math.max(0, Math.round(inp.currentAge)));
  const S = l.map((v) => v / (l[baseAge] || 1e-9));
  let rem = 0.5;
  for (let age = baseAge + 1; age <= 120; age++) rem += S[age];
  const lifeExpectancy = baseAge + rem;

  const d = inp.discountRate / 100;
  const nowMonth = inp.currentAge * 12;
  const ownAt = (m: number) => inp.ownPia * benefitFactor(m, fra);
  const survAt = (m: number) => inp.survivorFull * survivorFactor(m, fra);
  const fraYr = Math.round(fra / 12);

  // PV of: benefit1 from a1 up to switchM, then benefit2 from switchM onward.
  const pv = (a1: number, benefit1: number, switchM: number, benefit2: number) => {
    let t = 0;
    for (let m = a1; m <= 119 * 12 + 11; m++) {
      const age = Math.floor(m / 12);
      const b = m < switchM ? benefit1 : benefit2;
      t += (b * S[age]) / Math.pow(1 + d, (m - nowMonth) / 12);
    }
    return t;
  };

  let best: WidowStrategy | null = null;
  let naive: WidowStrategy | null = null;
  const NEVER = 200 * 12;
  const record = (s: WidowStrategy) => {
    if (!best || s.npv > best.npv) best = s;
    if (!s.secondType && (!naive || s.npv > naive.npv)) naive = s;
  };
  const consider = (firstType: "own" | "survivor", a1: number, secondType: "own" | "survivor" | null, switchM: number) => {
    if (a1 < Math.round(inp.currentAge) * 12) return; // can't claim in the past
    const b1 = firstType === "own" ? ownAt(a1) : survAt(a1);
    const sw = secondType ? switchM : NEVER;
    const b2 = secondType ? (secondType === "own" ? ownAt(switchM) : survAt(switchM)) : b1;
    record({ firstType, firstAgeMonths: a1, secondType, switchAgeMonths: secondType ? switchM : a1, firstMonthly: b1, secondMonthly: b2, npv: pv(a1, b1, sw, b2) });
  };

  // Survivor first → switch to own (own keeps growing to 70).
  for (let y1 = 60; y1 <= 70; y1++)
    for (let y2 = Math.max(y1, 62); y2 <= 70; y2++) consider("survivor", y1 * 12, "own", y2 * 12);
  // Own first → switch to survivor (survivor maxes at FRA).
  for (let y1 = 62; y1 <= 70; y1++)
    for (let y2 = Math.max(y1, 60); y2 <= fraYr; y2++) consider("own", y1 * 12, "survivor", y2 * 12);
  // Single-benefit plans (no switch).
  for (let y = 62; y <= 70; y++) consider("own", y * 12, null, 0);
  for (let y = 60; y <= fraYr; y++) consider("survivor", y * 12, null, 0);

  return { fraMonths: fra, lifeExpectancy, best: best!, naive: naive! };
}

export const monthsToLabel = (m: number) => {
  const y = Math.floor(m / 12);
  const mo = Math.round(m - y * 12);
  return mo === 0 ? `${y}` : `${y} yr ${mo} mo`;
};
