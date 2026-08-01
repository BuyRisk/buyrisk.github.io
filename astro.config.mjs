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
