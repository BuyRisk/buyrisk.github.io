/**
 * Factor data for the Factor Lab.
 *
 * The five Fama–French factors (market, size, value, profitability, investment)
 * carry long-run annualized US averages (≈1963–present) from the Kenneth French
 * Data Library. The four "extended" factors (momentum, quality, defensive,
 * liquidity) pull their premium and volatility from the generated
 * factor-premia.ts reducer output, so those figures stay tied to the real data.
 *
 * Every premium is real but period-dependent (value in particular has had long
 * droughts). They ground the tool's return attribution — educational only, not
 * financial advice.
 *
 * Sources: https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html
 *          AQR (Quality-Minus-Junk, Betting-Against-Beta) · Pastor–Stambaugh liquidity.
 */
import { factorPremia } from "./generated/factor-premia";

export type FactorKey =
  | "mkt"
  | "smb"
  | "hml"
  | "rmw"
  | "cma"
  | "umd"
  | "qmj"
  | "bab"
  | "liq";

export type Factor = {
  key: FactorKey;
  name: string;
  short: string;
  /** True once you leave the core five: an opt-in "Extended" factor. */
  extended?: boolean;
  /** Annualized average premium (excess return of the long-short spread). */
  premium: number;
  /** Annualized volatility of the factor. */
  vol: number;
  color: string;
  blurb: string;
};

/** premium/vol for an extended factor, from the generated reducer output. */
const ext = (key: "umd" | "qmj" | "bab" | "liq") => {
  const p = factorPremia.premia.find((x) => x.key === key);
  if (!p) throw new Error(`missing premia for ${key}`);
  return { premium: p.premium, vol: p.vol };
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
  {
    key: "umd",
    name: "Momentum",
    short: "UMD",
    extended: true,
    ...ext("umd"),
    color: "var(--pl-c6)",
    blurb: "Recent winners minus recent losers. Stocks that led over the past year have tended to keep leading — the strongest, and most fragile, of the anomalies.",
  },
  {
    key: "qmj",
    name: "Quality",
    short: "QMJ",
    extended: true,
    ...ext("qmj"),
    color: "var(--pl-c7)",
    blurb: "'Quality minus junk': profitable, growing, safe, well-run companies minus their opposites (AQR).",
  },
  {
    key: "bab",
    name: "Defensive",
    short: "BAB",
    extended: true,
    ...ext("bab"),
    color: "var(--pl-c8)",
    blurb: "'Betting against beta': low-risk stocks have earned more per unit of risk than high-risk ones — so a leveraged low-beta, short high-beta bet has paid off (AQR).",
  },
  {
    key: "liq",
    name: "Liquidity",
    short: "LIQ",
    extended: true,
    ...ext("liq"),
    color: "var(--pl-c9)",
    blurb: "Stocks that are hard to trade when markets seize up have paid extra to compensate — the Pastor–Stambaugh traded liquidity factor.",
  },
];

export const RISK_FREE = 0.025; // illustrative T-bill base for total-return figures

export type Loadings = Record<FactorKey, number>;

/** All-zero loadings, so a preset only needs to name its non-zero tilts. */
const ZERO: Loadings = { mkt: 0, smb: 0, hml: 0, rmw: 0, cma: 0, umd: 0, qmj: 0, bab: 0, liq: 0 };

export type FactorPreset = { name: string; blurb: string; loadings: Loadings };

/**
 * Typical factor loadings (betas) for well-known equity styles, in the ballpark
 * of published factor regressions. Illustrative, not fitted to a specific fund.
 */
export const FACTOR_PRESETS: FactorPreset[] = [
  {
    name: "Total US market",
    blurb: "The whole market: market risk only, no tilts.",
    loadings: { ...ZERO, mkt: 1 },
  },
  {
    name: "Large-cap value",
    blurb: "Big, cheap, profitable companies.",
    loadings: { ...ZERO, mkt: 0.98, smb: -0.15, hml: 0.42, rmw: 0.15, cma: 0.22 },
  },
  {
    name: "Small-cap value",
    blurb: "The classic high-expected-return tilt.",
    loadings: { ...ZERO, mkt: 1.05, smb: 0.62, hml: 0.5, rmw: 0.12, cma: 0.3 },
  },
  {
    name: "Small-cap growth",
    blurb: "Small, expensive, unprofitable: historically the weakest corner.",
    loadings: { ...ZERO, mkt: 1.12, smb: 0.72, hml: -0.42, rmw: -0.35, cma: -0.45 },
  },
  {
    name: "Quality tilt",
    blurb: "Lean toward profitable, conservative, high-quality firms.",
    loadings: { ...ZERO, mkt: 0.97, smb: 0.05, hml: 0.1, rmw: 0.45, cma: 0.35, qmj: 0.55 },
  },
  {
    name: "Momentum tilt",
    blurb: "Ride recent winners: a strong momentum overlay on the market.",
    loadings: { ...ZERO, mkt: 1.0, smb: 0.1, hml: -0.1, umd: 0.7 },
  },
  {
    name: "Defensive / low-vol",
    blurb: "Own steadier, lower-beta stocks — the betting-against-beta bet.",
    loadings: { ...ZERO, mkt: 0.78, smb: -0.05, hml: 0.15, rmw: 0.3, cma: 0.25, bab: 0.6, qmj: 0.35 },
  },
  {
    name: "Multifactor",
    blurb: "Spread small, deliberate tilts across every rewarded factor.",
    loadings: { ...ZERO, mkt: 1.0, smb: 0.25, hml: 0.3, rmw: 0.3, cma: 0.25, umd: 0.25, qmj: 0.3, bab: 0.3, liq: 0.15 },
  },
];
