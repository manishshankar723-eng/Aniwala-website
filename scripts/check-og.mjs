/**
 * Does the committed social card still show the logo the site shows?
 *
 * WHY THIS IS A BUILD CHECK AND NOT A LINE IN THE README
 *
 * `public/og-default.jpg` is what every WhatsApp, LinkedIn, Slack and iMessage
 * preview of this site renders. It is a generated file, committed rather than
 * built — `scripts/generate-og-image.mjs` explains why — and a committed
 * generated file is a copy, which means it can disagree with its source.
 *
 * It did. The studio uploaded a new logo in the Studio; the header took it,
 * the loading screen took it, the favicon took it, and the social card kept
 * drawing the old mark from an SVG path that had been pasted into the
 * generator months earlier. Nothing failed. Nothing looked wrong to anybody
 * working on the site, because the stale mark only ever appeared inside OTHER
 * PEOPLE'S chat apps. It was found when someone sent a link to a client and
 * noticed the logo was not the company's.
 *
 * That is the exact shape of failure this repo keeps a check for: silent,
 * invisible from the inside, and discovered by somebody you were trying to
 * impress. The generator now reads the logo from the `brand` document, so the
 * two cannot be written differently — but they can still DRIFT APART IN TIME,
 * because the generator runs by hand and publishing a new logo does not run
 * it. This closes that last gap by comparing what the card was made from
 * against what the CMS currently serves.
 *
 * WHY NOT JUST GENERATE THE CARD DURING THE BUILD. Because that puts sharp — a
 * native image toolchain — into CI, permanently, to regenerate a file that
 * changes about twice a year. This check needs one GROQ query and no native
 * dependencies, and it catches the same mistake.
 *
 * OUTCOMES
 *
 *   Card drawn from a logo the brand no longer uses  -> FAIL.
 *     Every share of the site is showing the wrong company's mark. Two
 *     commands to fix, and the message says which.
 *
 *   No provenance record                             -> FAIL.
 *     The card was generated before this check existed, or by hand. Either
 *     way nothing here can vouch for it, and "cannot tell" is not a pass for
 *     the one asset the studio's name hangs on.
 *
 *   Sanity not configured, or no logo published      -> SKIP.
 *     A fresh clone with no `.env` must still build, and a brand with no
 *     uploaded logo is a site rendering its built-in mark — which is exactly
 *     what the generator falls back to. Nothing is in disagreement.
 */
import { readFileSync } from 'node:fs';
import { PALETTE_PROJECTION, resolvePalette } from './lib/og-brand.mjs';

const SOURCE = new URL('./og-source.json', import.meta.url);

const env = (key) => (process.env[key] ?? '').trim();

const PROJECT_ID = env('SANITY_PROJECT_ID');
const DATASET = env('SANITY_DATASET') || 'production';
const TOKEN = env('SANITY_READ_TOKEN');

/* Read `.env` the way astro.config.mjs does, so this behaves the same whether
   it is run bare, through `npm run verify`, or with `--env-file=.env`. An
   existing environment variable always wins, so CI is never overridden. */
try {
  const text = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, raw] = match;
    const value = raw.trim().replace(/^["']|["']$/g, '');
    if (value && !process.env[key]) process.env[key] = value;
  }
} catch {
  /* No .env — normal in CI, where the values arrive in the job environment. */
}

async function main() {
  const projectId = env('SANITY_PROJECT_ID') || PROJECT_ID;
  const dataset = env('SANITY_DATASET') || DATASET;
  const token = env('SANITY_READ_TOKEN') || TOKEN;

  if (!projectId) {
    console.log('  og card: skipped (SANITY_PROJECT_ID not set)');
    return 0;
  }

  let recorded;
  try {
    recorded = JSON.parse(readFileSync(SOURCE, 'utf8'));
  } catch {
    console.error('\n  The social card has no provenance record.\n');
    console.error('  scripts/og-source.json is missing, so there is no way to tell whether');
    console.error('  public/og-default.jpg still shows the current logo. Regenerate it:\n');
    console.error('    npm i --no-save sharp fontkit');
    console.error('    node --env-file=.env scripts/generate-og-image.mjs');
    console.error('    npm i\n');
    return 1;
  }

  const query = encodeURIComponent(
    `*[_type == "brand"][0]{ "ref": logoDark.asset._ref, ${PALETTE_PROJECTION} }`
  );
  const url =
    `https://${projectId}.api.sanity.io/v2026-01-01/data/query/${dataset}` + `?query=${query}`;

  const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);

  if (!res.ok) {
    /* A check that cannot reach the CMS must not fail a deploy — the site
       builds from the content layer's cache and is not in danger. Same
       direction the sitemap filter takes when it cannot read a file. */
    console.log(`  og card: skipped (Sanity returned ${res.status})`);
    return 0;
  }

  const doc = (await res.json())?.result ?? null;
  const live = doc?.ref ?? null;

  /*
   * THE PALETTE IS CHECKED TOO, and for the same reason the mark is.
   *
   * The card is painted in the site's colours — the stylesheet's `:root`
   * block, with any Studio override on top. Both can move without anybody
   * touching this script: an edit to `global.css` is at least visible in a
   * diff, but a colour changed in the Studio is not in the repository at all.
   * A card carrying the old ground colour is the same failure as one carrying
   * the old mark, and just as invisible from the inside.
   */
  const expected = resolvePalette(doc);
  const drifted = Object.entries(expected).filter(
    ([key, value]) => (recorded.palette?.[key] ?? null) !== value
  );

  const regenerate = () => {
    console.error('  Regenerate the card and commit it:\n');
    console.error('    npm i --no-save sharp fontkit');
    console.error('    node --env-file=.env scripts/generate-og-image.mjs');
    console.error('    npm i\n');
  };

  if (live && recorded.logoDark !== live) {
    console.error('\n  The social card shows a logo the site no longer uses.\n');
    console.error(`    card was made from : ${recorded.logoDark ?? '(built-in fallback mark)'}`);
    console.error(`    brand now publishes: ${live}\n`);
    console.error('  Every WhatsApp, LinkedIn and Slack preview of this site is showing');
    console.error('  the old mark.\n');
    regenerate();
    return 1;
  }

  if (drifted.length) {
    console.error('\n  The social card is painted in colours the site no longer uses.\n');
    for (const [key, value] of drifted) {
      console.error(`    ${key.padEnd(9)} card ${recorded.palette?.[key] ?? '(absent)'}  ->  site ${value}`);
    }
    console.error('');
    regenerate();
    return 1;
  }

  if (!live) {
    console.log('  og card: palette matches (no brand logo published — card uses the built-in mark)');
    return 0;
  }

  console.log('  og card: matches the published brand logo and palette.');
  return 0;
}

/* `process.exitCode`, never `process.exit()` — see the long note at the foot
   of check-dataset.mjs. Tearing the loop down while undici still holds a
   keep-alive socket crashes Node on Windows, after the verdict has printed. */
process.exitCode = await main();
