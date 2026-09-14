/**
 * One-off: remove the `sound` fields from the dataset.
 *
 * WHY THIS EXISTS AS A FILE rather than as a line somebody pasted into a
 * terminal. Two boolean fields were deleted from the Studio schemas in the
 * same change that made every video on the site silent by default:
 *
 *   - `heroBlock.sound` on a `page` — armed a script that waited for the
 *     visitor's first click or scroll and used it as the gesture a browser
 *     requires before audio may play, then faded a full-screen showreel up to
 *     full volume. See the note where the field used to be in
 *     `studio/schemas/blocks.ts` for why that is no longer an editor's call.
 *   - `piece.sound` — promised an unmute button on a portfolio tile. Dead for
 *     longer than it looked: the tile ships the browser's own control bar,
 *     which carries a volume control whatever this said.
 *
 * Deleting a field from a Sanity schema does NOT delete the data. The values
 * stay in the Content Lake, the Studio renders them as "unknown field" warnings
 * on every affected document, and the obvious way for a future editor to make
 * that warning go away is to put the field back. So the values go too.
 *
 * DRAFTS ARE INCLUDED, and they are most of the work — 27 of the 36 pieces
 * carrying this were drafts. A draft is a separate document (`drafts.<id>`)
 * with its own copy of every field, so unsetting only the published one leaves
 * the value to come back the moment somebody hits Publish.
 *
 * Safe to run twice: `unset` on a field that is already gone is a no-op, and
 * the script asks the dataset what still has one rather than assuming.
 *
 * Usage:
 *   node --env-file=.env scripts/unset-sound.mjs --dry   # list, change nothing
 *   node --env-file=.env scripts/unset-sound.mjs
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

/*
 * The hero blocks, addressed by key.
 *
 * `blocks` is an array, so the path to one field inside one block is
 * `blocks[_key=="block-0"].sound`. Sanity resolves that filter server-side,
 * which matters: computing an index here and patching `blocks[3].sound` would
 * write to whatever sits at position 3 by the time the mutation lands.
 */
const pages = await client.fetch(
  `*[_type == "page" && count(blocks[_type == "heroBlock" && defined(sound)]) > 0]{
     _id, "keys": blocks[_type == "heroBlock" && defined(sound)]._key
   }`
);

const pieces = await client.fetch(`*[_type == "piece" && defined(sound)]{_id}`);

console.log(`hero blocks with a sound value: ${pages.reduce((n, p) => n + p.keys.length, 0)}`);
for (const page of pages) console.log(`  ${page._id} -> ${page.keys.join(', ')}`);
console.log(`pieces with a sound value:      ${pieces.length}`);

if (!pages.length && !pieces.length) {
  console.log('\nNothing to do — the dataset is already clean.');
  process.exit(0);
}

if (dry) {
  console.log('\n--dry: nothing written.');
  process.exit(0);
}

/* One transaction. Either the dataset comes out clean or it comes out
   untouched — a half-applied migration is the state nobody thinks to check
   for afterwards. */
const tx = client.transaction();

for (const page of pages) {
  tx.patch(page._id, {
    unset: page.keys.map((key) => `blocks[_key=="${key}"].sound`),
  });
}
for (const piece of pieces) {
  tx.patch(piece._id, { unset: ['sound'] });
}

const result = await tx.commit();
console.log(`\nok — ${result.results.length} document(s) patched.`);
console.log('Now run `npm run restart` so the dev server re-fetches the dataset.');
