/**
 * The canonical list of interactive tool modules, in learning-progression order.
 * Both the Portfolio Playground dropdown in the header and the /tools overview
 * page read from this, and each tool page shows a "next tool" link derived from
 * this order — so adding a module here slots it into all three automatically.
 *
 * Each entry is a consolidated MODULE; several earlier single tools now live
 * inside one module as tabs. Retired URLs redirect (see astro.config.mjs).
 */
export type Tool = {
  title: string;
  href: string;
  blurb: string;
  /** Optional short badge, e.g. "New". */
  tag?: string;
};

export const TOOLS: Tool[] = [
  {
    title: "Growth, Savings & Debt",
    href: "/tools/compound-growth",
    blurb:
      "The engine of personal finance — compounding — in every direction: how wealth builds, how your savings rate sets your timeline to independence, and how the same math runs in reverse as debt.",
  },
  {
    title: "Fees & Inflation",
    href: "/tools/fees",
    blurb:
      "The two silent drains on your money: fund fees (the drag you control) and inflation (the one you don't). See how a tiny fee compounds against you, then how unevenly prices really rise.",
  },
  {
    title: "Diversification",
    href: "/tools/diversification",
    blurb:
      "The only free lunch in investing: how mixing assets that don't move together lowers risk. From pure out-of-phase waves to messy, real randomness.",
  },
  {
    title: "Stock-Picking: How Many, and Why a Few Win",
    href: "/tools/stock-picking",
    blurb:
      "Two hard truths about owning individual stocks: diversifying cuts risk only to a floor, and most stocks lose to T-bills while a tiny few create all the wealth.",
  },
  {
    title: "Portfolio, Allocation & Bonds",
    href: "/tools/portfolio",
    blurb:
      "Build the actual portfolio: mix assets to find the efficient frontier, dial the all-important stock/bond split, and see why the 'safe' bond sleeve still moves with interest rates.",
  },
  {
    title: "Risk & Return: CAPM & Factors",
    href: "/tools/factors",
    blurb:
      "How markets price risk: start with CAPM — one risk, the market's, measured by beta — then extend to the Fama–French factors that explain what CAPM called 'alpha.'",
  },
  {
    title: "Can You Outsmart the Market?",
    href: "/tools/beat-the-market",
    blurb:
      "Four bets against the market — predicting it, timing it, deploying into it, and hiring active managers — and the one answer that keeps appearing. The whole case for indexing.",
  },
  {
    title: "Retirement & Roth",
    href: "/tools/retirement",
    blurb:
      "Funding and spending retirement: what it costs and whether your money lasts, when to claim Social Security, and choosing Roth vs. Traditional (and grabbing the employer match).",
  },
  {
    title: "Rent or Buy?",
    href: "/tools/rent-vs-buy",
    blurb:
      "Renting isn't throwing money away. Run a buyer and a renter side by side — investing the difference — and find the year buying actually breaks even.",
  },
];
