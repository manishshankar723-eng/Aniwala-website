/**
 * One-off: point the brand document at the right three marks.
 *
 * Three separate wrongs, all of them the same shape — a field holding the one
 * file that happened to be at hand rather than the one the slot is for.
 *
 *   1. `logoDark` and `logoLight` both held
 *      `cropped-Aniwala_W_L-100x88.png`: the SAME asset in both slots, so the
 *      two-image swap in Header.astro had nothing to swap. The file is the
 *      WordPress header crop — a white mark with a hairline black outline,
 *      100x88, with the words ANIWALA STUDIOS baked into it. Three problems
 *      at once:
 *
 *        - In light mode a white mark on a cream ground is a ghost. The
 *          outline is all that survives, at 1px, and the logo reads as a
 *          smudge rather than as a logo.
 *        - The baked-in wordmark is drawn a second time beside it, because
 *          `showWordmark` is true and the header renders ANIWALA / Studios
 *          as type. The brand name appeared twice, in two different faces.
 *        - 100x88 is below 1x for the header at any scale. `imageUrl` asks
 *          for 320px and `.fit('max')` refuses to upscale, so the mark was
 *          delivered at a third of the resolution the slot can show.
 *
 *      The dataset already contained the real pair — `Aniwala logo white.png`
 *      and `Aniwala logo black.png`, both 1536x1024, both transparent, both
 *      mark-only with no wordmark. They had been uploaded and never wired up.
 *
 *   2. `favicon` held `aniwala-favicon-512.png`: the gold mark on a solid
 *      #0b0c10 tile. At the 16px a tab actually renders, that ground is not
 *      read as "near black" — it is read as a dark BLUE square, because
 *      #0b0c10 is 11 red, 12 green, 16 blue and blue wins. That is the tile
 *      in the browser tab.
 *
 *      Unsetting the field is the fix, not uploading a different PNG. With it
 *      empty, `getBrand` returns no `icon` at all and Base.astro takes its
 *      fallback branch, which links `public/favicon.svg` — the same mark,
 *      transparent, with a `prefers-color-scheme` rule inside the SVG that
 *      fills it black on a light tab strip and white on a dark one. A PNG
 *      cannot do that; it is the colour it was exported as, on the ground it
 *      was exported over. Any uploaded icon wins over the SVG, so the CMS
 *      field is the thing standing in the way.
 *
 *      This does NOT change the installed-app icon or the iOS touch icon.
 *      Those come from the committed `public/icon-*.png` and stay opaque
 *      gold-on-ground deliberately — iOS composites a transparent touch icon
 *      onto its own background and it comes out looking broken. See the note
 *      at the top of `scripts/generate-icons.mjs`.
 *
 * DRAFTS ARE INCLUDED. A draft is a separate document with its own copy of
 * every field, so patching only `brand` leaves an unpublished edit holding the
 * old refs, ready to put them back the moment somebody presses Publish.
 *
 * Safe to run twice: the script asks the dataset what each field currently
 * holds and skips a document that is already correct.
 *
 * Usage:
 *   node --env-file=.env scripts/fix-brand-marks.mjs --dry   # look, change nothing
 *   node --env-file=.env scripts/fix-brand-marks.mjs
 *
 * AFTERWARDS: `npm run restart`. Astro's content layer caches the dataset into
 * `.astro/` at boot, so a running dev server keeps serving the old content
 * indefinitely — see the note at the top of CLAUDE.md.
 */
import { createClient } from '@sanity/client';

const dry = process.argv.includes('--dry');

const { SANITY_PROJECT_ID, SANITY_DATASET, SANITY_WRITE_TOKEN } = process.env;

if (!SANITY_PROJECT_ID || !SANITY_DATASET) {
  console.error('Missing SANITY_PROJECT_ID / SANITY_DATASET. Run with --env-file=.env');
  process.exit(1);
}
if (!dry && !SANITY_WRITE_TOKEN) {
  console.error('Missing SANITY_WRITE_TOKEN — needed to write. Use --dry to look without one.');
  process.exit(1);
}

const client = createClient({
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  apiVersion: '2024-01-01',
  useCdn: false,
  token: SANITY_WRITE_TOKEN,
  /* `raw` so drafts come back as themselves rather than being folded into, or
     hidden behind, their published versions. */
  perspective: 'raw',
});

/* The two marks, by asset id rather than by filename. A filename is an
   editor-facing label that anyone can change from the Studio's media browser;
   the id is the content hash and cannot drift. Both are 1536x1024 PNGs with
   alpha, uploaded already — this script wires them up, it does not upload. */
const WHITE = 'image-19e720a5d8a302eb6a75fbee10d1d515864a6207-1536x1024-png';
const BLACK = 'image-748949e5208e765b64dc0f2405452ed4355bd49b-1536x1024-png';

const ref = (id) => ({ _type: 'image', asset: { _type: 'reference', _ref: id } });

const docs = await client.fetch(
  '*[_id == "brand" || _id == "drafts.brand"]{_id, logoDark, logoLight, favicon}'
);

if (docs.length === 0) {
  console.error('No brand document found. Nothing to do.');
  process.exit(1);
}

const tx = client.transaction();
let pending = 0;

for (const doc of docs) {
  const have = {
    logoDark: doc.logoDark?.asset?._ref ?? null,
    logoLight: doc.logoLight?.asset?._ref ?? null,
    favicon: doc.favicon?.asset?._ref ?? null,
  };

  console.log(`\n${doc._id}`);
  console.log(`  logoDark   ${have.logoDark ?? '(unset)'}`);
  console.log(`  logoLight  ${have.logoLight ?? '(unset)'}`);
  console.log(`  favicon    ${have.favicon ?? '(unset)'}`);

  const set = {};
  if (have.logoDark !== WHITE) set.logoDark = ref(WHITE);
  if (have.logoLight !== BLACK) set.logoLight = ref(BLACK);
  const unset = have.favicon ? ['favicon'] : [];

  if (Object.keys(set).length === 0 && unset.length === 0) {
    console.log('  → already correct, skipping');
    continue;
  }

  for (const k of Object.keys(set)) {
    console.log(`  → set ${k} = ${k === 'logoDark' ? WHITE : BLACK}`);
  }
  for (const k of unset) console.log(`  → unset ${k}`);

  /* One patch per document, both operations in it, and the whole run in one
     transaction — so a failure halfway cannot leave the pair half-swapped
     with a white mark sitting in the light slot. */
  let patch = client.patch(doc._id);
  if (Object.keys(set).length) patch = patch.set(set);
  if (unset.length) patch = patch.unset(unset);
  tx.patch(patch);
  pending += 1;
}

/* Falling off the end rather than calling process.exit on the happy paths.
   The Sanity client holds an open handle, and tearing the loop down under it
   trips a libuv assertion on Windows that reads like a failure and is not. */
if (pending === 0) {
  console.log('\nNothing to change.');
} else if (dry) {
  console.log(`\n--dry: would patch ${pending} document(s). Nothing written.`);
} else {
  await tx.commit();
  console.log(`\nPatched ${pending} document(s).`);
  console.log('Now run `npm run restart` — the content layer caches the dataset at boot.');
}
