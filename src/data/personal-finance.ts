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

/** Live Personal Finance tools, in learning order. */
export const PF_TOOLS: Tool[] = [
  {
    title: "Debt Payoff: Avalanche vs. Snowball",
    href: "/personal-finance/debt-payoff",
    blurb:
      "Compare the two payoff strategies on your own debts — highest-rate-first vs. smallest-balance-first — and see months to debt-free, total interest, and whether a rate is high enough to refinance.",
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
