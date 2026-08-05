// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  // Public URL of the deployed site (used for canonical URLs, sitemaps, etc.).
  // For a GitHub user/org page repo named `buyrisk.github.io`, this is the root.
  // Change it here if you later move to a custom domain.
  site: 'https://buyrisk.github.io',
  integrations: [react()],
  // Consolidated modules: retired tool URLs redirect to their new home so
  // existing links keep working.
  redirects: {
    '/tools/waveforms': '/tools/diversification',
    '/tools/randomness': '/tools/diversification',
    '/tools/inflation': '/tools/fees',
    '/tools/how-many-stocks': '/tools/stock-picking',
    '/tools/superstocks': '/tools/stock-picking',
    '/tools/capm': '/tools/factors',
    '/tools/savings-rate': '/tools/compound-growth',
    '/tools/debt': '/tools/compound-growth',
    '/tools/asset-allocation': '/tools/portfolio',
    '/tools/bonds': '/tools/portfolio',
    '/tools/time-in-market': '/tools/beat-the-market',
    '/tools/dollar-cost-averaging': '/tools/beat-the-market',
    '/tools/active-vs-passive': '/tools/beat-the-market',
    '/tools/burn-rate': '/tools/retirement',
    // Social Security + Roth split out of the Playground into Personal Finance;
    // the "will my money last" sim stays at /tools/retirement.
    '/tools/social-security': '/personal-finance/retirement-accounts',
    '/tools/roth-vs-traditional': '/personal-finance/retirement-accounts',
    // Taxes merged into the "What Eats Your Returns" module at /tools/fees.
    '/tools/tax-drag': '/tools/fees',
    '/tools/asset-location': '/tools/fees',
    '/tools/taxes': '/tools/fees',
    // Rebalancing folded into the Portfolio module; Closet Indexing into Beat-the-Market.
    '/tools/rebalancing': '/tools/portfolio',
    '/tools/closet-indexing': '/tools/beat-the-market',
    '/tools/home-bias': '/tools/global',
    '/tools/currency-risk': '/tools/global',
    '/tools/us-vs-world': '/tools/global',
    // Tools that fit Personal Finance better than the Playground (a checklist
    // and a questionnaire, not interactive simulators).
    '/tools/rent-vs-buy': '/personal-finance/rent-vs-buy',
    '/tools/next-dollar': '/personal-finance/next-dollar',
    '/tools/risk-tolerance': '/personal-finance/risk-tolerance',
  },
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      wrap: true,
    },
  },
});
