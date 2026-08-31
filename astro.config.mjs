// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/*
 * Put `.env` into `process.env` before anything else runs.
 *
 * Content loaders run in Node during the build and the dev sync, and Vite
 * only exposes variables to `import.meta.env` — not to `process.env`, and
 * not un-prefixed ones to every context. That left `SANITY_READ_TOKEN`
 * invisible to `lib/sanity/client.ts` under `astro dev`, so the dev server
 * asked Sanity for drafts with no credentials and died on
 * "Unauthorized - Session not found".
 *
 * In CI there is no `.env` and the values arrive in the job environment
 * instead, so this finds nothing and changes nothing. An existing environment
 * variable is never overwritten.
 *
 * Parsed by hand rather than with Vite's `loadEnv`, which Astro 7 does not
 * re-export — one fewer thing to break on an upgrade, for six lines.
 */
try {
  for (const line of readFileSync(new URL('.env', import.meta.url), 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    /* Strip surrounding quotes. Splitting on /\r?\n/ above already removed
       the carriage return a .env edited in a Windows editor leaves behind,
       which would otherwise have become part of the token. */
    const value = rawValue.trim().replace(/^["']|["']$/g, '');
    /* A real environment variable always wins, so CI is never overridden. */
    if (value && !process.env[key]) process.env[key] = value;
  }
} catch {
  /* No .env — normal in CI, where the values come from the job environment. */
}

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
    server: {
      allowedHosts: ['.trycloudflare.com'],
    },
  },

  integrations: [sitemap()],
});