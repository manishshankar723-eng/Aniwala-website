/**
 * Crawls ./dist for internal links and asset references that do not resolve
 * to a file, and fails the build if any do not.
 *
 * This exists because a static site generator will happily emit a link to a
 * page that was never written, and nothing downstream complains. Two such
 * links were live on every page of this site at once:
 *
 *   - the announcement bar pointed at /ai-animation/, which did not exist
 *   - og:image pointed at /og-default.jpg, which was never added to public/
 *
 * Both were invisible in the source (one came from config, one from the
 * layout) and both survived a clean `astro build`.
 *
 * Run:  node scripts/check-links.mjs
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const DIST = 'dist';
const SITE = 'https://aniwala.com';

/* Absolute URLs on our own origin are checked too — Base.astro builds
   og:image and canonical as absolute, which is how the missing OG image hid
   from an earlier version of this script. */
const ORIGIN = new RegExp(`^${SITE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');

const SKIP = /^(mailto:|tel:|data:|javascript:|#|\/\/)/i;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

function resolves(url) {
  const clean = url.split('#')[0].split('?')[0];
  if (clean === '' || clean === '/') return existsSync(path.join(DIST, 'index.html'));
  const fs = path.join(DIST, clean.replace(/^\//, ''));
  return existsSync(fs) || existsSync(path.join(fs, 'index.html'));
}

const files = (await walk(DIST)).filter((f) => f.endsWith('.html'));
const problems = new Map();

for (const file of files) {
  const html = await readFile(file, 'utf8');
  const page = '/' + path.relative(DIST, file).split(path.sep).join('/');

  // href, src and content (the last one catches og:image / twitter:image).
  for (const m of html.matchAll(/(?:href|src|content)="([^"]+)"/g)) {
    let url = m[1]
      .replace(/&amp;/g, '&')
      .trim();

    if (!url || SKIP.test(url)) continue;

    // Same-origin absolute -> treat as a path.
    if (ORIGIN.test(url)) url = url.replace(ORIGIN, '') || '/';
    else if (/^https?:\/\//i.test(url)) continue; // genuinely external, not ours to check

    if (!url.startsWith('/')) continue; // relative — Astro does not emit these

    if (!resolves(url)) {
      if (!problems.has(url)) problems.set(url, new Set());
      problems.get(url).add(page);
    }
  }
}

if (problems.size === 0) {
  console.log(`OK — ${files.length} pages, every internal link and asset resolves.`);
  process.exit(0);
}

console.error(`\nBroken internal references in ${DIST}/:\n`);
for (const [url, pages] of [...problems].sort()) {
  const list = [...pages].sort();
  const shown = list.slice(0, 3).join(', ');
  const more = list.length > 3 ? ` (+${list.length - 3} more)` : '';
  console.error(`  ${url}`);
  console.error(`      referenced by ${list.length} page(s): ${shown}${more}\n`);
}
console.error(`${problems.size} broken reference(s). Failing the build.\n`);
process.exit(1);
