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
];

/** Planned pages, shown as "coming soon" cards on /info. Not yet routes. */
export const INFO_UPCOMING: { title: string; blurb: string }[] = [
  {
    title: "Interest Rates Dashboard",
    blurb:
      "Fed funds, the Treasury yield curve, mortgage rates, and money-market yields — the current numbers, updated automatically, from official sources.",
  },
  {
    title: "Investing Glossary",
    blurb:
      "Every term the site uses, defined in plain language before the jargon — expense ratio, basis point, duration, rebalancing, and the rest.",
  },
  {
    title: "Account Contribution Limits",
    blurb:
      "This year's 401(k), IRA, HSA, and catch-up limits in one place, so you stop re-Googling them every January.",
  },
  {
    title: "Historical Returns",
    blurb:
      "Long-run real returns for stocks, bonds, and bills, plus valuation gauges like the CAPE ratio — the numbers behind the site's risk-and-return story.",
  },
];
