/**
 * Fama–French factor data. Premia and volatilities are long-run annualized US
 * averages (≈1963–present) from the Kenneth French Data Library: real
 * empirical figures, though every one is period-dependent (value in particular
 * has had long droughts). They ground the factor tool's return attribution.
 *
 * Source: https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html
 */

export type Factor = {
  key: "mkt" | "smb" | "hml" | "rmw" | "cma";
  name: string;
  short: string;
  /** Annualized average premium (excess return of the long-short spread). */
  premium: number;
  /** Annualized volatility of the factor. */
  vol: number;
  color: string;
  blurb: string;
};

export const FACTORS: Factor[] = [
  {
    key: "mkt",
    name: "Market",
    short: "Mkt−RF",
    premium: 0.066,
    vol: 0.154,
    color: "var(--pl-c1)",
    blurb: "The whole stock market's return above Treasury bills: the reward for bearing market risk.",
  },
  {
    key: "smb",
    name: "Size",
    short: "SMB",
    premium: 0.023,
    vol: 0.105,
    color: "var(--pl-c2)",
    blurb: "Small companies minus big ones. Small caps have historically earned a bit more.",
  },
  {
    key: "hml",
    name: "Value",
    short: "HML",
    premium: 0.034,
    vol: 0.107,
    color: "var(--pl-c3)",
    blurb: "Cheap 'value' stocks (high book/price) minus expensive 'growth' ones.",
  },
  {
    key: "rmw",
    name: "Profitability",
    short: "RMW",
    premium: 0.033,
    vol: 0.076,
    color: "var(--pl-c4)",
    blurb: "Robustly profitable firms minus weakly profitable ones.",
  },
  {
    key: "cma",
    name: "Investment",
    short: "CMA",
    premium: 0.03,
    vol: 0.069,
    color: "var(--pl-c5)",
    blurb: "Conservative firms that reinvest cautiously minus aggressive ones.",
  },
];

export const RISK_FREE = 0.025; // illustrative T-bill base for total-return figures

export type Loadings = Record<Factor["key"], number>;

export type FactorPreset = { name: string; blurb: string; loadings: Loadings };

/**
 * Typical factor loadings (betas) for well-known equity styles, in the ballpark
 * of published Fama–French regressions. Illustrative, not fitted to a specific
 * fund.
 */
export const FACTOR_PRESETS: FactorPreset[] = [
  {
    name: "Total US market",
    blurb: "The whole market: market risk only, no tilts.",
    loadings: { mkt: 1, smb: 0, hml: 0, rmw: 0, cma: 0 },
  },
  {
    name: "Large-cap value",
    blurb: "Big, cheap, profitable companies.",
    loadings: { mkt: 0.98, smb: -0.15, hml: 0.42, rmw: 0.15, cma: 0.22 },
  },
  {
    name: "Small-cap value",
    blurb: "The classic high-expected-return tilt.",
    loadings: { mkt: 1.05, smb: 0.62, hml: 0.5, rmw: 0.12, cma: 0.3 },
  },
  {
    name: "Small-cap growth",
    blurb: "Small, expensive, unprofitable: historically the weakest corner.",
    loadings: { mkt: 1.12, smb: 0.72, hml: -0.42, rmw: -0.35, cma: -0.45 },
  },
  {
    name: "Quality tilt",
    blurb: "Lean toward profitable, conservative firms.",
    loadings: { mkt: 0.97, smb: 0.05, hml: 0.1, rmw: 0.45, cma: 0.35 },
  },
];
