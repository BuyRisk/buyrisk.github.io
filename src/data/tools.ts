/**
 * The canonical list of interactive tools, in learning-progression order.
 * Both the Portfolio Playground dropdown in the header and the /tools overview
 * page read from this, and each tool page shows a "next tool" link derived from
 * this order — so adding a tool here slots it into all three automatically.
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
    title: "Compound Growth Explorer",
    href: "/tools/compound-growth",
    blurb:
      "See how a starting balance, regular contributions, return, and time compound into long-run growth.",
  },
  {
    title: "Savings Rate & Financial Independence",
    href: "/tools/savings-rate",
    blurb:
      "How long until your investments could cover your life? It's set by your savings rate — not your income. See the math, and why a raise barely moves the finish line.",
  },
  {
    title: "The Cost of Debt",
    href: "/tools/debt",
    blurb:
      "Compounding in reverse. At a credit card's rate, paying the minimum stretches a small balance into decades — see the trap, and how a fixed payment breaks it.",
  },
  {
    title: "Fees & Inflation",
    href: "/tools/fees",
    blurb:
      "The two silent drains on your money: fund fees (the drag you control) and inflation (the one you don't). See how a tiny fee compounds against you, then how unevenly prices really rise.",
  },
  {
    title: "Roth or Traditional? (+ the Match)",
    href: "/tools/roth-vs-traditional",
    blurb:
      "The Roth-vs-Traditional choice comes down to one thing: your tax rate now vs. in retirement. Plus why the employer match is free money you should never leave behind.",
  },
  {
    title: "Retirement Burn-Rate Calculator",
    href: "/tools/burn-rate",
    blurb:
      "Estimate your monthly costs in retirement and see the nest egg they imply — the flip side of the 4% rule.",
  },
  {
    title: "When to Claim Social Security",
    href: "/tools/social-security",
    blurb:
      "Bigger checks later or more checks sooner? See delayed-retirement credits, the breakeven age, longevity risk — and how a couple's survivor benefit changes it.",
  },
  {
    title: "Rent or Buy?",
    href: "/tools/rent-vs-buy",
    blurb:
      "Renting isn't throwing money away. Run a buyer and a renter side by side — investing the difference — and find the year buying actually breaks even.",
  },
  {
    title: "Diversification",
    href: "/tools/diversification",
    blurb:
      "The only free lunch in investing: how mixing assets that don't move together lowers risk. From pure out-of-phase waves to messy, real randomness.",
  },
  {
    title: "How Many Stocks Is Enough?",
    href: "/tools/how-many-stocks",
    blurb:
      "Diversifying within stocks cuts risk — but only to a floor. Watch the classic risk-vs-count curve.",
  },
  {
    title: "The Superstock Problem",
    href: "/tools/superstocks",
    blurb:
      "Most stocks lose to T-bills; a few create all the wealth. See why hand-picking a few usually loses.",
  },
  {
    title: "Portfolio Diversification Lab",
    href: "/tools/portfolio",
    blurb:
      "Mix assets and watch correlations, the efficient frontier, and the range of outcomes come to life.",
  },
  {
    title: "How Much in Stocks?",
    href: "/tools/asset-allocation",
    blurb:
      "The biggest decision you'll make: the stock/bond mix. See the trade-off between long-run growth and the worst drop you'd have to survive — plus the volatility drag that rewards a smoother ride.",
  },
  {
    title: "Bonds & Interest-Rate Risk",
    href: "/tools/bonds",
    blurb:
      "The 'safe' sleeve has a catch: when rates rise, bond prices fall — and longer bonds fall harder. Meet duration, and read today's Treasury yield curve.",
  },
  {
    title: "CAPM & the Security Market Line",
    href: "/tools/capm",
    blurb:
      "Measure an asset's beta from a return scatter, then see how beta alone sets its fair expected return.",
  },
  {
    title: "Factor Models (Fama–French)",
    href: "/tools/factors",
    blurb:
      "Beyond CAPM: attribute a portfolio's return to size, value, profitability, and investment tilts.",
  },
  {
    title: "All at Once, or Bit by Bit?",
    href: "/tools/dollar-cost-averaging",
    blurb:
      "Got a windfall? Lump sum vs dollar-cost averaging, tested across 150+ years of real returns — why all-at-once usually wins, and what averaging really buys.",
  },
  {
    title: "Time in the Market",
    href: "/tools/time-in-market",
    blurb:
      "Miss the market's best days and decades of growth vanish — because the best days hide right next to the worst. The case against timing, from real daily data.",
  },
  {
    title: "Can Active Managers Beat the Market?",
    href: "/tools/active-vs-passive",
    blurb:
      "The SPIVA scorecard, made interactive: see the share of professional active funds that fail to beat their benchmark — and how it climbs with the years.",
  },
  {
    title: "Can You Beat the Market?",
    href: "/tools/beat-the-market",
    blurb:
      "An efficient-markets game: predict the next move, and learn why you're at coin-flip odds.",
  },
];
