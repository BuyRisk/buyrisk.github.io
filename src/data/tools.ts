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
    title: "Rebalancing: Discipline vs. Drift",
    href: "/tools/rebalancing",
    blurb:
      "Left alone, a portfolio drifts: stocks out-grow bonds and a tidy 60/40 quietly becomes a risky 80/20. See how never, annual, and threshold rebalancing change the risk and return you actually get, and why rebalancing controls risk rather than boosting returns.",
    tag: "New",
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
    title: "Retirement, Social Security & Roth",
    href: "/tools/retirement",
    blurb:
      "Funding and spending retirement: what it costs and whether your money lasts, the big Social Security claiming decision (including survivor and tax/IRMAA cases), and choosing Roth vs. Traditional (and grabbing the employer match).",
  },
  {
    title: "The Tax Drag: What a Taxable Account Costs",
    href: "/tools/tax-drag",
    blurb:
      "Tax on a taxable account isn't a one-off haircut — it's a leak that compounds. Watch the gap between a sheltered and a taxable account widen year by year, then break the drag into its sources: dividends, fund turnover, and the capital-gains tax finally due at sale.",
    tag: "New",
  },
  {
    title: "Asset Location: Which Account Holds What",
    href: "/tools/asset-location",
    blurb:
      "Same portfolio, same allocation, same tax rates — but which account holds your bonds versus your stocks changes your after-tax wealth. See why the tax-hungry asset belongs in your tax-advantaged account.",
    tag: "New",
  },
  {
    title: "Risk Tolerance Questionnaire",
    href: "/tools/risk-tolerance",
    blurb:
      "Six quick questions place you on the risk/return spectrum and suggest a stock/bond starting point — scored across your ability, willingness, and need to take risk, with the honest reminder that the lowest of the three is the one that binds.",
    tag: "New",
  },
  {
    title: "Your Next Dollar: Order of Operations",
    href: "/tools/next-dollar",
    blurb:
      "Match, debt, Roth, or brokerage? The order you fund things in beats almost any single investment choice. Check off what you've handled and see the one next step in the priority ladder — and the logic that ranks it there. (US accounts.)",
    tag: "New",
  },
  {
    title: "Home Bias: How Much of the World Do You Own?",
    href: "/tools/home-bias",
    blurb:
      "A globally diversified investor holds each country in proportion to its size — almost nobody does. Pick your home market, see how small a slice of the world it really is, and what tilting toward home costs you in diversification.",
    tag: "New",
  },
  {
    title: "Currency Risk: Hedged vs. Unhedged",
    href: "/tools/currency-risk",
    blurb:
      "Own a foreign stock or bond and you own its currency too. See how currency swings add volatility — a lot for calm bonds, little for volatile stocks — and why the evidence says hedge your bonds but rarely your stocks.",
    tag: "New",
  },
];
