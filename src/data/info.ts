/**
 * The Info section: an ad-free, paywall-free reference hub for the investing
 * facts people usually have to dig around the web for. Distinct from the
 * interactive "Portfolio Playground" tools — this is data you look up, not
 * simulators you play with.
 *
 * The header dropdown and the /info overview page both read INFO_PAGES, so
 * adding a live reference page here slots it into both automatically. Reuses
 * the Tool shape from tools.ts (title + href + blurb).
 */
import type { Tool } from "./tools";

/** Live reference pages, in the order they appear in the nav and on /info. */
export const INFO_PAGES: Tool[] = [
  {
    title: "Global Market-Cap Breakdown",
    href: "/info/global-market-cap",
    blurb:
      "How the world's investable stock market splits across the US, developed-ex-US, and emerging markets — and large, mid, and small caps within each. The recipe for assembling your own total-world portfolio across separate accounts.",
  },
  {
    title: "Historical Returns by Asset Class",
    href: "/info/historical-returns",
    blurb:
      "Long-run US returns and risk for stocks, bonds, cash, and gold since 1928 — nominal and after inflation — plus how the asset classes move together.",
  },
  {
    title: "Factor Premia",
    href: "/info/factor-premia",
    blurb:
      "The historical extra return of the Fama–French factors — market, size, value, profitability, investment — and the volatility that came with each.",
  },
  {
    title: "Active vs. Index (SPIVA)",
    href: "/info/active-vs-index",
    blurb:
      "The share of professional, actively managed funds that fail to beat a simple index — by category and time horizon, straight from the SPIVA Scorecard.",
  },
  {
    title: "Fund Fees Over Time",
    href: "/info/fund-fees",
    blurb:
      "What investors actually pay in expense ratios, active vs. index and stocks vs. bonds, from 1996 to today. The cost you control, and how far it has fallen.",
  },
  {
    title: "Inflation, by Category",
    href: "/info/inflation",
    blurb:
      "How prices have really risen — the headline CPI plus how differently college, healthcare, housing, cars, and electronics have moved since the 1970s.",
  },
  {
    title: "Treasury Yields & the Yield Curve",
    href: "/info/treasury-yields",
    blurb:
      "The current US Treasury yield curve from 3 months to 30 years, the 10-year yield split into real and inflation components, and 70+ years of history.",
  },
  {
    title: "Contribution Limits",
    href: "/info/contribution-limits",
    blurb:
      "This year's 401(k), IRA, and HSA limits — including catch-up amounts and income phase-outs — in one place, straight from the IRS.",
  },
  {
    title: "Social Security Claiming",
    href: "/info/social-security",
    blurb:
      "How your Social Security benefit changes with the age you claim, from 70% of full at 62 to 124% at 70, plus life expectancy and the latest COLA.",
  },
  {
    title: "Tax-Loss Harvesting Partners",
    href: "/info/tax-loss-harvesting",
    blurb:
      "Funds and ETFs that track the same slice of the market through a different index — candidate swaps for harvesting a loss without tripping the wash-sale rule. Educational only, not tax advice.",
  },
  {
    title: "Investing Glossary",
    href: "/info/glossary",
    blurb:
      "Plain-language definitions of every term the site uses — from asset allocation and basis points to volatility, wash sales, and yield curves.",
  },
];

/** Planned pages, shown as "coming soon" cards on /info. Not yet routes. */
export const INFO_UPCOMING: { title: string; blurb: string }[] = [
  {
    title: "Market Valuations (CAPE)",
    blurb:
      "The Shiller CAPE ratio and other valuation gauges over time — a sense of whether the market is historically cheap or expensive, with the usual caveats.",
  },
  {
    title: "Live Rates Dashboard",
    blurb:
      "The always-current companion to the Treasury snapshot — Fed funds, mortgage rates, and money-market yields, refreshed automatically from official feeds.",
  },
];
