// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import redirects from './src/integrations/redirects.mjs';

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

/**
 * Keep `noindex` pages out of the sitemap.
 *
 * A sitemap is a request to index; `<meta name="robots" content="noindex">`
 * is a request not to. Sending both about the same URL is a contradiction, and
 * the site was sending it — /admin/ sat in the sitemap while the page itself
 * asked to be dropped.
 *
 * READ OFF THE OUTPUT, not off a list. `noindex` is a CMS field now, so any
 * page can become hidden between one build and the next; a hand-kept
 * exclusion list would go stale the first time somebody ticked the box. By the
 * time the sitemap integration runs its filter, every page has already been
 * written to disk — so the honest answer to "is this page noindex" is to look
 * at the page. Same rule the search index follows: derive, never duplicate.
 *
 * A file that cannot be read is treated as indexable. That is the safe
 * direction: the worst case is a sitemap entry for a page that also carries a
 * noindex tag, which is where this started, rather than silently dropping a
 * real page out of search.
 */
const outDir = new URL('./dist/', import.meta.url);

/** @param {string} pageUrl */
const isNoindex = (pageUrl) => {
  try {
    const { pathname } = new URL(pageUrl);
    const file = new URL(`.${pathname}index.html`, outDir);
    return /<meta name="robots" content="noindex/.test(readFileSync(file, 'utf8'));
  } catch {
    return false;
  }
};

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

  /* Order matters: both of these run at `astro:build:done`, and the sitemap
     filter reads the HTML the build has just written. The redirects
     integration touches only .htaccess, so it is independent. */
  integrations: [sitemap({ filter: (page) => !isNoindex(page) }), redirects()],
});