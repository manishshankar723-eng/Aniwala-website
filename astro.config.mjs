// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://aniwala.com',

  // Static output — Hostinger shared hosting serves files, not Node.
  output: 'static',

  build: {
    // Hostinger/Apache serves /work/ -> /work/index.html cleanly.
    format: 'directory',
  },

  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: ['.trycloudflare.com'],
    },
  },

  integrations: [sitemap()],
});