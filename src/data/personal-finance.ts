/**
 * The Personal Finance section: interactive money-management tools (budgeting,
 * debt, cash flow, goals) — distinct from the investing-focused Portfolio
 * Playground and the reference-only Info hub.
 *
 * Like TOOLS and INFO_PAGES, the header dropdown and the /personal-finance
 * overview read PF_TOOLS, so adding a page here slots it into both. Every tool
 * is a stateless, no-login calculator — nothing is stored or synced.
 */
import type { Tool } from "./tools";

/** Live Personal Finance tools, in learning order (foundations first). */
export const PF_TOOLS: Tool[] = [
  {
    title: "The 50/30/20 Budget",
    href: "/personal-finance/budget",
    blurb:
      "See how your take-home pay splits across needs, wants, and saving — and how it compares to the 50/30/20 guideline. The last slice is what becomes invested.",
  },
  {
    title: "Emergency Fund Sizer",
    href: "/personal-finance/emergency-fund",
    blurb:
      "How many months of expenses to keep in cash, based on how steady your income is — then how long to fund it. The buffer that keeps a surprise from becoming debt.",
  },
  {
    title: "Debt Payoff: Avalanche vs. Snowball",
    href: "/personal-finance/debt-payoff",
    blurb:
      "Compare the two payoff strategies on your own debts — highest-rate-first vs. smallest-balance-first — and see months to debt-free, total interest, and whether a rate is high enough to refinance.",
  },
  {
    title: "Your Next Dollar: Order of Operations",
    href: "/personal-finance/next-dollar",
    blurb:
      "Match, debt, Roth, or brokerage? The order you fund things in beats almost any single investment choice. Check off what you've handled and see the one next step in the priority ladder — and the logic that ranks it there. (US accounts.)",
  },
  {
    title: "Savings Goal Planner",
    href: "/personal-finance/savings-goal",
    blurb:
      "Put a number and a date on a goal and find the monthly amount that gets you there, with investment growth carrying part of the load.",
  },
  {
    title: "Net Worth Tracker",
    href: "/personal-finance/net-worth",
    blurb:
      "Add up what you own, subtract what you owe, and see the one number that captures your whole financial picture — plus where consistent investing takes it.",
  },
  {
    title: "Risk Tolerance Questionnaire",
    href: "/personal-finance/risk-tolerance",
    blurb:
      "Six quick questions place you on the risk/return spectrum and suggest a stock/bond starting point — scored across your ability, willingness, and need to take risk, with the honest reminder that the lowest of the three is the one that binds.",
  },
  {
    title: "Rent or Buy?",
    href: "/personal-finance/rent-vs-buy",
    blurb:
      "Renting isn't throwing money away. Run a buyer and a renter side by side (investing the difference) and find the year buying actually breaks even.",
  },
];

/** Planned tools, shown as "coming soon" cards. Not yet routes. */
export const PF_UPCOMING: { title: string; blurb: string }[] = [];
