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
    title: "Money Basics: Budget, Buffer, Goals, Net Worth & Debt",
    href: "/personal-finance/money-basics",
    blurb:
      "The five foundations in one place, in learning order: the 50/30/20 budget, sizing an emergency fund, planning a savings goal, tracking net worth, and paying off debt (avalanche vs. snowball, with a refinance flag). Everything that comes before investing.",
  },
  {
    title: "Your Next Dollar: Order of Operations",
    href: "/personal-finance/next-dollar",
    blurb:
      "Match, debt, Roth, or brokerage? The order you fund things in beats almost any single investment choice. Check off what you've handled and see the one next step in the priority ladder — and the logic that ranks it there. (US accounts.)",
  },
  {
    title: "Risk Tolerance Questionnaire",
    href: "/personal-finance/risk-tolerance",
    blurb:
      "Six quick questions place you on the risk/return spectrum and suggest a stock/bond starting point — scored across your ability, willingness, and need to take risk, with the honest reminder that the lowest of the three is the one that binds.",
  },
  {
    title: "Retirement Accounts: Social Security, Roth & Cheap Tax Years",
    href: "/personal-finance/retirement-accounts",
    blurb:
      "The big US retirement-account decisions: when to claim Social Security (guaranteed, inflation-adjusted income you can't outlive), whether to save Roth or Traditional — starting with the employer match — and how to spend a low-income year's cheap tax space: harvest gains at 0% or convert to Roth.",
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
