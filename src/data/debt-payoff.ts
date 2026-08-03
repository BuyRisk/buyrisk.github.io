/**
 * Debt types for the payoff tool, each with an illustrative "typical" APR and a
 * threshold above which the tool suggests looking into refinancing/consolidation.
 *
 * These benchmarks are ROUGH, average-credit figures (~2026) meant to prompt a
 * question, not quote a rate. Refresh `asOf` and the numbers occasionally.
 */
export interface DebtType {
  id: string;
  label: string;
  /** Typical APR (%) for average credit, or null if it varies too much to flag. */
  typicalApr: number | null;
  /** Flag a refinance/consolidation suggestion when the APR exceeds this (%). */
  flagAbove: number | null;
  /** Type-specific, caveated suggestion shown when the rate is flagged. */
  hint: string;
}

export const DEBT_BENCHMARKS_ASOF = 2026;

export const DEBT_TYPES: DebtType[] = [
  {
    id: "credit-card",
    label: "Credit card",
    typicalApr: 22,
    flagAbove: 24,
    hint: "Credit-card rates are steep by nature. A 0%-intro balance-transfer card or a lower-rate personal (consolidation) loan can slash the interest while you pay it down — mind transfer fees and the post-intro rate.",
  },
  {
    id: "auto",
    label: "Auto loan",
    typicalApr: 7.5,
    flagAbove: 10,
    hint: "This is well above typical auto-loan rates. If your credit has improved since you borrowed, refinancing the loan could lower the rate — check for any prepayment fees.",
  },
  {
    id: "student",
    label: "Student loan",
    typicalApr: 6.5,
    flagAbove: 9,
    hint: "This is above typical student-loan rates. Refinancing private loans can lower it — but refinancing FEDERAL loans gives up federal protections (income-driven plans, forgiveness), so weigh that carefully.",
  },
  {
    id: "mortgage",
    label: "Mortgage",
    typicalApr: 6.75,
    flagAbove: 8.5,
    hint: "This is well above typical mortgage rates. Refinancing could lower your rate and speed up payoff — but it has closing costs and resets the term, so run the break-even before you commit.",
  },
  {
    id: "personal",
    label: "Personal loan",
    typicalApr: 12,
    flagAbove: 16,
    hint: "This is high for a personal loan. Shopping a consolidation loan or a different lender — especially with good credit — could bring it down.",
  },
  {
    id: "medical",
    label: "Medical debt",
    typicalApr: 0,
    flagAbove: 6,
    hint: "Medical debt is often interest-free or negotiable. Before paying interest on it, ask the provider about a zero-interest payment plan or a reduced settlement.",
  },
  {
    id: "other",
    label: "Other",
    typicalApr: null,
    flagAbove: null,
    hint: "",
  },
];
