import { socialSecurity } from "../data/generated/social-security";

/**
 * A Social Security claiming optimizer, in the spirit of Mike Piper's Open Social
 * Security: for each possible claim age (62–70), present-value the lifetime
 * benefit stream *weighted by the probability of being alive to collect it*, and
 * pick the age that maximizes it. Benefits are real (they rise with COLA), so we
 * discount at a real rate.
 *
 * Two personalization levers beyond the textbook version:
 *  • Health → a mortality hazard multiplier (smoking, exercise) reshapes the
 *    survival curve — quantifying how much longevity (and thus the value of
 *    delaying) fitness buys.
 *  • Debt → the discount rate. Using early benefits to retire a 6% mortgage *is*
 *    a 6% return, so debt raises your effective discount rate and favors claiming
 *    earlier.
 *
 * For couples, `optimizeCouple` adds the single most important effect the
 * single-earner model misses: the survivor benefit. When the first spouse dies,
 * the survivor's check steps up to the larger of the two — and it keeps the
 * deceased's delayed-retirement credits — so the higher earner's benefit really
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
export interface Health {
  sex: Sex;
  smoking: Smoking;
  exercise: Exercise;
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

export function hazardMultiplier(h: Health): number {
  return SMOKE_MULT[h.smoking] * EXERCISE_MULT[h.exercise];
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
}

export interface OptimizeResult {
  fraMonths: number;
  hazardMult: number;
  lifeExpectancy: number; // total age
  best: { ageMonths: number; monthly: number; npv: number };
  points: AgePoint[]; // one per whole claim age 62..70
  breakevenAge: number; // 62-vs-70 cumulative crossover
}

export interface OptimizeInput {
  pia: number; // monthly PIA (benefit at full retirement age)
  birthYear: number;
  currentAge: number; // age at the decision point
  discountRate: number; // real, percent
  health: Health;
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
  const pv = (claimMonth: number) => {
    const monthly = inp.pia * benefitFactor(claimMonth, fra);
    let total = 0;
    for (let m = claimMonth; m <= 119 * 12 + 11; m++) {
      const age = Math.floor(m / 12);
      total += (monthly * S[age]) / Math.pow(1 + d, (m - nowMonth) / 12);
    }
    return { monthly, npv: total };
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
    points.push({ age: a, monthly: r.monthly, npv: r.npv });
  }

  // Undiscounted, unweighted 62-vs-70 cumulative crossover (the classic breakeven).
  const m62 = inp.pia * benefitFactor(62 * 12, fra);
  const m70 = inp.pia * benefitFactor(70 * 12, fra);
  const breakevenAge = (70 * m70 - 62 * m62) / (m70 - m62);

  return { fraMonths: fra, hazardMult: mult, lifeExpectancy, best, points, breakevenAge };
}

// ---- Couple / survivor-aware optimization -------------------------------------

export interface Person {
  pia: number;
  birthYear: number;
  currentAge: number;
  health: Health;
}

export interface CoupleInput {
  a: Person;
  b: Person;
  discountRate: number;
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

  const pv = (claimA: number, claimB: number): number => {
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
      const cash = both * (aOwn + bOwn) + onlyA * Math.max(aOwn, sfB) + onlyB * Math.max(bOwn, sfA);
      npv += cash * disc[t];
    }
    return npv;
  };

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
      const npv = pv(a * 12, b * 12);
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
      const npv = pv(am, bm);
      if (npv > best.npv) best = { aMonths: am, bMonths: bm, npv };
    }
  }

  // Each partner's solo optimum (ignoring the survivor benefit), for contrast.
  const soloA = optimize({ pia: inp.a.pia, birthYear: inp.a.birthYear, currentAge: inp.a.currentAge, discountRate: inp.discountRate, health: inp.a.health }).best.ageMonths;
  const soloB = optimize({ pia: inp.b.pia, birthYear: inp.b.birthYear, currentAge: inp.b.currentAge, discountRate: inp.discountRate, health: inp.b.health }).best.ageMonths;

  return {
    a: { fraMonths: A.fra, lifeExpectancy: A.le, soloBestMonths: soloA, bestMonths: best.aMonths },
    b: { fraMonths: B.fra, lifeExpectancy: B.le, soloBestMonths: soloB, bestMonths: best.bMonths },
    best,
    agesA,
    agesB,
    grid,
    jointIndependentNpv: pv(soloA, soloB),
  };
}

export const monthsToLabel = (m: number) => {
  const y = Math.floor(m / 12);
  const mo = Math.round(m - y * 12);
  return mo === 0 ? `${y}` : `${y} yr ${mo} mo`;
};
