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
    '/tools/social-security': '/tools/retirement',
    '/tools/roth-vs-traditional': '/tools/retirement',
    '/tools/tax-drag': '/tools/taxes',
    '/tools/asset-location': '/tools/taxes',
    '/tools/home-bias': '/tools/global',
    '/tools/currency-risk': '/tools/global',
    '/tools/us-vs-world': '/tools/global',
    // Rent-vs-Buy moved to the Personal Finance section.
    '/tools/rent-vs-buy': '/personal-finance/rent-vs-buy',
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
