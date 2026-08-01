// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://buyrisk.example',
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
