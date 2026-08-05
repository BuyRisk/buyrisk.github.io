/**
 * The canonical list of interactive tool modules, in learning-progression order.
 * Both the Portfolio Playground dropdown in the header and the /tools overview
 * page read from this, and each tool page shows a "next tool" link derived from
 * this order, so adding a module here slots it into all three automatically.
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
      "The engine of personal finance (compounding) in every direction: how wealth builds, how your savings rate sets your timeline to independence, and how the same math runs in reverse as debt.",
  },
  {
    title: "What Eats Your Returns: Fees, Inflation & Taxes",
    href: "/tools/fees",
    blurb:
      "The quiet drains on your wealth in one place: fund fees (the drag you control), inflation (the one you don't), the tax drag on a taxable account, and asset location — holding the right asset in the right account. See how each compounds against you, and how to blunt the ones you can.",
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
    title: "Options Pricing, Demystified",
    href: "/tools/options",
    blurb:
      "What is an option actually worth? Drag the strike, time to expiry, and volatility and watch the Black–Scholes price and payoff diagram respond, until calls, puts, intrinsic value, and time value finally click.",
    tag: "New",
  },
  {
    title: "Risk & Return: CAPM & Factors",
    href: "/tools/factors",
    blurb:
      "How markets price risk: start with CAPM (one risk, the market's, measured by beta), then extend to the Fama–French factors that explain what CAPM called 'alpha.'",
  },
  {
    title: "Can You Outsmart the Market?",
    href: "/tools/beat-the-market",
    blurb:
      "Four bets against the market (predicting it, timing it, deploying into it, and hiring active managers), and the one answer that keeps appearing. The whole case for indexing.",
  },
  {
    title: "Behavioral Finance: Your Own Worst Enemy",
    href: "/tools/behavioral-finance",
    blurb:
      "The market doesn't lose you money — your reactions to it do. Watch the behavior gap open up between a buy-and-hold investor and a panic-seller over real market history, then meet the biases (loss aversion, recency, herding) that make selling low feel smart.",
    tag: "New",
  },
  {
    title: "Will Your Money Last? Retirement Spending",
    href: "/tools/retirement",
    blurb:
      "Turn the 4% rule around: your spending sets the nest egg you need, and guaranteed income shrinks it. Then stress-test the plan against real market history to see sequence-of-returns risk — whether your money survives bad luck, not just an average.",
  },
  {
    title: "Global Investing: Home Bias, Currency & Cycles",
    href: "/tools/global",
    blurb:
      "Own the whole world, not just home. See how small a slice your home market really is, why the lead trades between the US and international in long untimeable cycles, and when a foreign holding's currency is worth hedging — the case for owning every country in proportion.",
    tag: "New",
  },
];
