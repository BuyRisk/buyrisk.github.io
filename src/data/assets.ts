import type { Asset } from "../lib/portfolio";

/**
 * Preset asset classes with *illustrative* long-run annual figures.
 *
 * These are round-number, education-grade approximations of historical
 * nominal returns and volatilities, NOT values scraped from a specific
 * dataset. `marketCorr` is each class's correlation with a common "market"
 * factor; pairwise correlations follow as rho_i * rho_j. Note bonds/cash/gold
 * carry low or negative market correlation, which is what makes them diversify
 * equity risk.
 *
 * Phase 2: replace these with statistics estimated from a real return series
 * (e.g. Damodaran annual or Ken French monthly).
 */
export type PresetAsset = Omit<Asset, "id"> & { id: string; blurb: string };

export const PRESET_ASSETS: PresetAsset[] = [
  {
    id: "us-stocks",
    name: "US Stocks",
    mu: 0.1,
    sigma: 0.16,
    marketCorr: 0.98,
    color: "var(--pl-c1)",
    blurb: "Broad US equity market",
  },
  {
    id: "small-cap-value",
    name: "Small-Cap Value",
    mu: 0.12,
    sigma: 0.21,
    marketCorr: 0.9,
    color: "var(--pl-c2)",
    blurb: "Higher expected return, higher risk",
  },
  {
    id: "intl-stocks",
    name: "International Stocks",
    mu: 0.09,
    sigma: 0.17,
    marketCorr: 0.85,
    color: "var(--pl-c3)",
    blurb: "Developed markets outside the US",
  },
  {
    id: "reits",
    name: "Real Estate (REITs)",
    mu: 0.09,
    sigma: 0.18,
    marketCorr: 0.6,
    color: "var(--pl-c4)",
    blurb: "Listed property",
  },
  {
    id: "corporate-bonds",
    name: "Corporate Bonds",
    mu: 0.055,
    sigma: 0.08,
    marketCorr: 0.3,
    color: "var(--pl-c5)",
    blurb: "Investment-grade credit",
  },
  {
    id: "treasuries",
    name: "US Treasuries (10yr)",
    mu: 0.045,
    sigma: 0.07,
    marketCorr: -0.2,
    color: "var(--pl-c6)",
    blurb: "Government bonds: often zig when stocks zag",
  },
  {
    id: "tbills",
    name: "Cash (T-Bills)",
    mu: 0.033,
    sigma: 0.012,
    marketCorr: 0.0,
    color: "var(--pl-c7)",
    blurb: "Near risk-free short-term government debt",
  },
  {
    id: "gold",
    name: "Gold",
    mu: 0.05,
    sigma: 0.15,
    marketCorr: 0.05,
    color: "var(--pl-c8)",
    blurb: "Commodity store of value, weak equity link",
  },
];

/** A sensible starting portfolio: the classic stocks + bonds pairing. */
export const DEFAULT_ASSET_IDS = ["us-stocks", "treasuries"];

export const ASSET_COLORS = [
  "var(--pl-c1)",
  "var(--pl-c2)",
  "var(--pl-c3)",
  "var(--pl-c4)",
  "var(--pl-c5)",
];
