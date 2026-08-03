/**
 * Global market-capitalisation breakdown — the reference data behind
 * /info/global-market-cap.
 *
 * The thesis of the page: a global, market-cap-weighted stock portfolio (the
 * kind a single fund like Vanguard's VT delivers) is just the whole investable
 * world held in proportion to each piece's size. Most people can't buy VT in
 * every account — a 401(k), an IRA, and an HSA each expose a different fund
 * menu — so they have to *reassemble* that whole-world weighting from the
 * building blocks each account happens to offer. These weights are the recipe.
 *
 * ─── Refreshing this file (monthly) ────────────────────────────────────────
 * The anchor source is the FTSE Global All Cap Index factsheet (the index VT
 * tracks). It's published monthly by FTSE Russell:
 *   research.ftserussell.com  →  issueName=GEISLMS
 * Region weights can also be read off Vanguard's VT "portfolio composition"
 * page. To refresh: update `asOf`, then the `ofGlobal` region weights. The
 * cap-tier splits (`tiers[].withinRegion`) come from the index's size-band
 * *methodology* and barely move — leave them unless the methodology changes.
 *
 * Regions' `ofGlobal` should sum to ~100; each region's tier `withinRegion`
 * should sum to ~100. The page derives every "% of the whole world" figure as
 * ofGlobal × withinRegion, so you never hand-maintain the products.
 */

export type CapTierName = "Large cap" | "Mid cap" | "Small cap";

export interface CapTier {
  tier: CapTierName;
  /** This tier's share of *its own region's* market cap (region tiers ≈ 100). */
  withinRegion: number;
  /** What this slice is, in one plain-language clause. */
  note: string;
}

export interface Region {
  key: "us" | "developed-ex-us" | "emerging";
  name: string;
  /** Share of the whole investable world (regions ≈ 100). */
  ofGlobal: number;
  /** One-line description of the region. */
  blurb: string;
  tiers: CapTier[];
}

export interface FundBlock {
  /** The slice of the market this building block covers. */
  slice: string;
  /** Approx. share of the whole world this block spans (for overlap context). */
  ofGlobal: number;
  /** Example funds that track it — grouped by provider. NOT recommendations. */
  funds: { provider: string; tickers: string }[];
}

export interface MarketCapData {
  /** The month-end the weights reflect (ISO date). */
  asOf: string;
  /** Roughly how many stocks the whole-world index holds, for color. */
  approxHoldings: number;
  regions: Region[];
  /** Non-additive reference: common funds and what each one covers. */
  fundBlocks: FundBlock[];
}

export const GLOBAL_MARKET_CAP: MarketCapData = {
  asOf: "2026-06-30",
  approxHoldings: 10000,

  regions: [
    {
      key: "us",
      name: "United States",
      ofGlobal: 62.2,
      blurb:
        "The single largest slice of the world's stock market — roughly three-fifths of it.",
      tiers: [
        {
          tier: "Large cap",
          withinRegion: 71,
          note: "The S&P 500 lives here. What most 401(k) menus offer.",
        },
        {
          tier: "Mid cap",
          withinRegion: 19,
          note: "The middle tier the S&P 500 leaves out.",
        },
        {
          tier: "Small cap",
          withinRegion: 10,
          note: "The long tail of smaller US companies.",
        },
      ],
    },
    {
      key: "developed-ex-us",
      name: "Developed markets ex-US",
      ofGlobal: 27.8,
      blurb:
        "Canada, Western Europe, Japan, Australia and other developed economies outside the US.",
      tiers: [
        {
          tier: "Large cap",
          withinRegion: 73,
          note: "Big multinationals — Nestlé, Toyota, ASML and the like.",
        },
        {
          tier: "Mid cap",
          withinRegion: 18,
          note: "Mid-sized developed-world companies.",
        },
        {
          tier: "Small cap",
          withinRegion: 9,
          note: "Often missing from cheaper international funds.",
        },
      ],
    },
    {
      key: "emerging",
      name: "Emerging markets",
      ofGlobal: 10.0,
      blurb:
        "Faster-growing, less-established markets — China, India, Taiwan, Brazil and others.",
      tiers: [
        {
          tier: "Large cap",
          withinRegion: 77,
          note: "TSMC, Tencent, Samsung and other EM giants.",
        },
        {
          tier: "Mid cap",
          withinRegion: 16,
          note: "Mid-sized emerging-market companies.",
        },
        {
          tier: "Small cap",
          withinRegion: 7,
          note: "The hardest slice to buy cheaply.",
        },
      ],
    },
  ],

  // Non-additive: these overlap. A "US total market" fund already contains the
  // US large/mid/small slices; an S&P 500 fund contains only US large cap.
  fundBlocks: [
    {
      slice: "Entire world (one fund)",
      ofGlobal: 100,
      funds: [
        { provider: "Vanguard", tickers: "VT / VTWAX" },
        { provider: "iShares", tickers: "ACWI (large + mid only)" },
        { provider: "SPDR", tickers: "SPGM" },
      ],
    },
    {
      slice: "US — total market (large + mid + small)",
      ofGlobal: 62.2,
      funds: [
        { provider: "Vanguard", tickers: "VTI / VTSAX" },
        { provider: "iShares", tickers: "ITOT" },
        { provider: "Schwab", tickers: "SCHB / SWTSX" },
        { provider: "Fidelity", tickers: "FSKAX / FZROX" },
      ],
    },
    {
      slice: "US — large cap (the S&P 500)",
      ofGlobal: 44.2,
      funds: [
        { provider: "Vanguard", tickers: "VOO / VFIAX" },
        { provider: "iShares", tickers: "IVV" },
        { provider: "SPDR", tickers: "SPY" },
        { provider: "Fidelity", tickers: "FXAIX" },
        { provider: "Schwab", tickers: "SWPPX" },
      ],
    },
    {
      slice: "US — extended market (mid + small; completes an S&P 500 fund)",
      ofGlobal: 18.0,
      funds: [
        { provider: "Vanguard", tickers: "VXF / VEXAX" },
        { provider: "Fidelity", tickers: "FSMAX" },
      ],
    },
    {
      slice: "International — total (developed ex-US + emerging)",
      ofGlobal: 37.8,
      funds: [
        { provider: "Vanguard", tickers: "VXUS / VTIAX" },
        { provider: "iShares", tickers: "IXUS" },
        { provider: "Fidelity", tickers: "FTIHX" },
      ],
    },
    {
      slice: "Developed markets ex-US",
      ofGlobal: 27.8,
      funds: [
        { provider: "Vanguard", tickers: "VEA / VTMGX" },
        { provider: "iShares", tickers: "IEFA" },
        { provider: "Schwab", tickers: "SCHF / SWISX" },
        { provider: "Fidelity", tickers: "FSPSX" },
      ],
    },
    {
      slice: "Emerging markets",
      ofGlobal: 10.0,
      funds: [
        { provider: "Vanguard", tickers: "VWO / VEMAX" },
        { provider: "iShares", tickers: "IEMG" },
        { provider: "Schwab", tickers: "SCHE" },
        { provider: "Fidelity", tickers: "FPADX" },
      ],
    },
  ],
};

// ─── Derived helpers (kept here so the page stays declarative) ──────────────

/** A single region×tier cell, with its share of the whole world computed. */
export interface Slice {
  region: Region;
  tier: CapTier;
  /** ofGlobal × withinRegion, i.e. this cell's share of the entire world. */
  ofGlobal: number;
}

/** Flatten the region tree into 9 slices (3 regions × 3 tiers). */
export function slices(data: MarketCapData = GLOBAL_MARKET_CAP): Slice[] {
  return data.regions.flatMap((region) =>
    region.tiers.map((tier) => ({
      region,
      tier,
      ofGlobal: round1((region.ofGlobal * tier.withinRegion) / 100),
    })),
  );
}

/** US vs. ex-US, the simplest two-fund split. */
export function usVsExUs(data: MarketCapData = GLOBAL_MARKET_CAP) {
  const us = data.regions.find((r) => r.key === "us")?.ofGlobal ?? 0;
  return { us: round1(us), exUs: round1(100 - us) };
}

/** Whole-world total for one cap tier across every region. */
export function tierTotals(data: MarketCapData = GLOBAL_MARKET_CAP) {
  const totals: Record<CapTierName, number> = {
    "Large cap": 0,
    "Mid cap": 0,
    "Small cap": 0,
  };
  for (const s of slices(data)) totals[s.tier.tier] += s.ofGlobal;
  return {
    "Large cap": round1(totals["Large cap"]),
    "Mid cap": round1(totals["Mid cap"]),
    "Small cap": round1(totals["Small cap"]),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
