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
    title: "Retirement Burn-Rate Calculator",
    href: "/tools/burn-rate",
    blurb:
      "Estimate your monthly costs in retirement and see the nest egg they imply — the flip side of the 4% rule.",
  },
  {
    title: "When to Claim Social Security",
    href: "/tools/social-security",
    blurb:
      "Bigger checks later or more checks sooner? See delayed-retirement credits, the breakeven age, and longevity risk.",
  },
  {
    title: "Diversification: Waveforms",
    href: "/tools/waveforms",
    blurb:
      "The idea behind diversification, from first principles: how out-of-phase ups and downs cancel out.",
  },
  {
    title: "Diversification: Randomness",
    href: "/tools/randomness",
    blurb:
      "The noisy sequel: with real randomness, variance never fully cancels — and assets sometimes fall together.",
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
];
