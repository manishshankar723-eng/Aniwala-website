/**
 * Publish many drafts in one run, instead of pressing Publish thirty-six times.
 *
 * WHY THIS IS NOT SIMPLY "PUBLISH EVERYTHING"
 *
 * A draft is not the same thing as a finished document. Seeding a gallery
 * creates tiles with placeholder titles and no artwork, and an unfinished
 * draft sitting where nobody can see it costs nothing — published, it is a
 * live page with "Animation 3" on a flat colour tint. The dangerous version of
 * this script is the one-liner that publishes the lot.
 *
 * So it filters, and `--require-image` is the filter that matters: publish the
 * tiles somebody has actually finished, leave the rest as drafts. Run it again
 * tomorrow and it picks up whatever was finished since.
 *
 * `--dry-run` prints the list and writes nothing. Use it first. Always.
 *
 * THE STUDIO'S OWN ANSWER IS *RELEASES*, in the top bar, and it is the better
 * tool when the point is coordination rather than volume: add documents to a
 * release, then publish the release as one action, optionally at a chosen
 * time. This script is for the other case — thirty tiles that are simply
 * ready and want no ceremony.
 *
 * USAGE, from `studio/`:
 *
 *   node --env-file=../.env scripts/publish-drafts.mjs --type=piece --dry-run
 *   node --env-file=../.env scripts/publish-drafts.mjs --type=piece --require-image
 *   node --env-file=../.env scripts/publish-drafts.mjs --type=piece --category=vfx
 *
 * FLAGS
 *   --type=<name>       only this document type, e.g. `piece`. Omit for every
 *                       type, which you almost certainly do not want.
 *   --category=<slug>   pieces only: just this discipline.
 *   --require-image     skip anything with no image. The safety catch.
 *   --dry-run           print the plan, write nothing.
 *   --yes               skip the confirmation pause.
 *
 * WHAT PUBLISHING IS, mechanically: the draft's content is written to the id
 * without the `drafts.` prefix, and the draft is deleted. That is exactly what
 * the Publish button does. It happens in ONE transaction, so a run either
 * lands completely or not at all — a half-published gallery is worse than an
 * unpublished one, because it looks finished.
 */
import { createClient } from '@sanity/client';

/* ------------------------------------------------------------------ */
/* Arguments                                                           */
/* ------------------------------------------------------------------ */

const args = new Map(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const i = a.indexOf('=');
      return i === -1 ? [a.slice(2), 'true'] : [a.slice(2, i), a.slice(i + 1)];
    })
);

const DRY_RUN = args.has('dry-run');
const REQUIRE_IMAGE = args.has('require-image');
const SKIP_PAUSE = args.has('yes');
const type = (args.get('type') ?? '').trim();
const category = (args.get('category') ?? '').trim();

const die = (message) => {
  console.error(`\n  ${message}\n`);
  process.exit(1);
};

if (category && type && type !== 'piece') {
  die('--category only applies to --type=piece.');
}

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? process.env.SANITY_PROJECT_ID;
const dataset = process.env.SANITY_STUDIO_DATASET ?? process.env.SANITY_DATASET ?? 'production';
const token = process.env.SANITY_WRITE_TOKEN;

if (!projectId) die('SANITY_STUDIO_PROJECT_ID is not set. Run with `node --env-file=../.env`.');
if (!token && !DRY_RUN) die('SANITY_WRITE_TOKEN is not set. Add it, or pass --dry-run.');

const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: '2026-01-01',
  useCdn: false,
  /*
   * `raw`, and without it this script silently does nothing.
   *
   * The default perspective on this API version EXCLUDES drafts — the same
   * trap `src/lib/sanity/client.ts` documents at length. A query for
   * `_id in path("drafts.**")` then returns an empty array and the script
   * reports "No drafts match", which reads as "there is nothing to publish"
   * rather than "I cannot see any of it".
   */
  perspective: 'raw',
});

/* ------------------------------------------------------------------ */
/* Find the drafts                                                     */
/* ------------------------------------------------------------------ */

const filters = ['_id in path("drafts.**")'];
if (type) filters.push('_type == $type');
if (category) filters.push('category->slug.current == $category');

const drafts = await client.fetch(
  `*[${filters.join(' && ')}]|order(_type, _id)`,
  { type, category }
);

if (!drafts.length) {
  console.log('\n  No drafts match. Nothing to do.\n');
  process.exit(0);
}

/*
 * The safety catch. A tile with no artwork is the thing this script exists to
 * NOT publish — it is the difference between a gallery and a grid of coloured
 * rectangles with placeholder names on them.
 */
const ready = REQUIRE_IMAGE ? drafts.filter((d) => d.image?.asset) : drafts;
const skipped = drafts.length - ready.length;

console.log(
  `\n  ${DRY_RUN ? 'Would publish' : 'Publishing'} ${ready.length} of ${drafts.length} draft(s) ` +
    `in ${projectId}/${dataset}\n`
);
for (const d of ready) {
  const img = d.image?.asset ? '' : '  (no image)';
  console.log(`    ${d._id.replace('drafts.', '').padEnd(38)} ${d.title ?? ''}${img}`);
}
if (skipped) {
  console.log(`\n  Skipping ${skipped} with no image (--require-image).`);
}

if (!ready.length) {
  console.log('\n  Nothing ready to publish.\n');
  process.exit(0);
}

if (DRY_RUN) {
  console.log('\n  --dry-run: nothing was written.\n');
  process.exit(0);
}

/*
 * A beat before a write that is visible to the public. Publishing is not
 * destructive — the previous published version is recoverable from history —
 * but it IS the moment something reaches the internet, and a typo'd --category
 * should be catchable without reading the docs on how to unpublish.
 */
if (!SKIP_PAUSE) {
  console.log('\n  Publishing in 3 seconds. Ctrl-C to stop.');
  await new Promise((r) => setTimeout(r, 3000));
}

/* ------------------------------------------------------------------ */
/* Publish                                                             */
/* ------------------------------------------------------------------ */

/* System fields belong to the document Sanity is about to create, not to the
   draft being copied. `_rev` in particular would pin the write to a revision
   of a different document and fail the whole transaction. */
const strip = ({ _rev, _createdAt, _updatedAt, ...rest }) => rest;

const tx = client.transaction();
for (const draft of ready) {
  const published = { ...strip(draft), _id: draft._id.replace('drafts.', '') };
  tx.createOrReplace(published);
  tx.delete(draft._id);
}

await tx.commit();

console.log(
  `\n  Published ${ready.length}. The Sanity webhook triggers a rebuild, so the\n` +
    '  site catches up in about 90 seconds. Locally, run `npm run restart`.\n'
);
