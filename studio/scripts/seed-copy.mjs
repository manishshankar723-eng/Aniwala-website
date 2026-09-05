/**
 * Seed the interface copy, the privacy policy and the two forms' wording.
 *
 *   SANITY_WRITE_TOKEN=sk... node --env-file=../.env scripts/seed-copy.mjs --dry-run
 *   SANITY_WRITE_TOKEN=sk... node --env-file=../.env scripts/seed-copy.mjs
 *
 * WHY THIS EXISTS RATHER THAN JUST USING migrate.mjs.
 *
 * That script writes every document with `createOrReplace`, which is exactly
 * right on the day of a migration and destructive on every day after it: once
 * an editor has touched something in the Studio, a second run silently
 * reverts them. Three of the five documents this change touches — the careers
 * page, the booking widget and the contact details — are already live and
 * already edited. Replacing them wholesale to add a field to each would trade
 * one problem for a worse one.
 *
 * So every document gets the same two-step treatment, whether it is new or
 * years old:
 *
 *   1. `createIfNotExists` with nothing but an id and a type, so a document
 *      that does not exist yet comes into being and one that does is left
 *      completely alone.
 *   2. `setIfMissing` for every seeded field. A field that is not there yet
 *      gets its value; a field somebody has already written stays exactly as
 *      they left it.
 *
 * Doing both to everything is what makes this safe to re-run AND useful to
 * re-run. An earlier version created new documents in one step and patched old
 * ones in another, which worked exactly once: the day a field was ADDED to a
 * document this script had already created, `createIfNotExists` saw the
 * document was there, skipped the whole thing, and the new field never
 * arrived. Same rule for every document, no exceptions, no such gap.
 *
 * WHAT IT DOES NOT DO: publish. Every id here is the published id, not a
 * `drafts.` one, because this content was already live on the site as markup
 * — importing it as drafts would blank the header, the footer and the two
 * forms until somebody clicked publish five times.
 */
import { createClient } from '@sanity/client';
import { Schema } from '@sanity/schema';
import { htmlToBlocks } from '@sanity/block-tools';
import { JSDOM } from 'jsdom';
import { marked } from 'marked';

import blockContent from '../schemas/blockContent.ts';
import {
  UI_COPY,
  PRIVACY,
  PRIVACY_BODY,
  APPLY_COPY,
  CAREERS_CLOSING,
  BOOKING_COPY,
  BRAND,
  ENGAGEMENT_MODELS,
  SEARCH_PAGES,
  SERVICE_GRID_CTA,
  LEGAL_NAME,
} from './seed-ui.mjs';

const DRY_RUN = process.argv.includes('--dry-run');

const projectId = process.env.SANITY_STUDIO_PROJECT_ID;
const dataset = process.env.SANITY_STUDIO_DATASET ?? 'production';
const token = process.env.SANITY_WRITE_TOKEN;

if (!projectId) {
  console.error('Set SANITY_STUDIO_PROJECT_ID. Find it at sanity.io/manage.');
  process.exit(1);
}
if (!token && !DRY_RUN) {
  console.error('Set SANITY_WRITE_TOKEN, or pass --dry-run to preview without writing.');
  console.error('Create one at sanity.io/manage -> your project -> API -> Tokens (Editor).');
  process.exit(1);
}

const client = createClient({ projectId, dataset, token, apiVersion: '2026-01-01', useCdn: false });

/* Markdown -> Portable Text, validated against the SAME blockContent schema
   the Studio edits with, so anything the editor could not represent is
   dropped here rather than stored and never rendered. */
const schema = Schema.compile({
  name: 'default',
  types: [{ name: 'body', type: 'array', of: blockContent.of }],
});
const blockContentType = schema.get('body');

const toPortableText = (markdown) =>
  htmlToBlocks(marked.parse(markdown, { async: false }), blockContentType, {
    parseHtml: (h) => new JSDOM(h).window.document,
  });

/** Sanity needs a stable `_key` on every member of an array of objects. */
const keyed = (type, rows) =>
  rows.map((row, i) => ({ _type: type, _key: `${type}-${i}`, ...row }));

/* ------------------------------------------------------------------ */
/* What to write                                                       */
/* ------------------------------------------------------------------ */

/**
 * Every document this script seeds, as { id, type, fields }.
 *
 * `type` is only used when the document has to be created; an existing one
 * keeps whatever type it already has, which is why changing this list cannot
 * retype a live document by accident.
 */
const SEEDS = [
  {
    id: 'uiCopy',
    type: 'uiCopy',
    fields: {
      ...UI_COPY,
      legalLinks: keyed('legalLink', UI_COPY.legalLinks),
      notFoundRoutes: keyed('route', UI_COPY.notFoundRoutes),
    },
  },
  {
    id: 'privacyPage',
    type: 'privacyPage',
    fields: { ...PRIVACY, body: toPortableText(PRIVACY_BODY) },
  },
  /* Words and colours only — the logo and icon images stay unset, because the
     built-in mark and the committed icons already are the defaults. */
  { id: 'brand', type: 'brand', fields: BRAND },
  {
    id: 'careersContent',
    type: 'careersContent',
    fields: {
      ...CAREERS_CLOSING,
      ...APPLY_COPY,
      applyPromises: keyed('promise', APPLY_COPY.applyPromises),
    },
  },
  { id: 'bookingSettings', type: 'bookingSettings', fields: BOOKING_COPY },
  { id: 'contactDetails', type: 'contactDetails', fields: { legalName: LEGAL_NAME } },
  { id: 'navigation', type: 'navigation', fields: { searchPages: keyed('searchPage', SEARCH_PAGES) } },

  /* The engagement models are a LIST, not a singleton, so they get one
     document each with a stable id — re-running fills in a model somebody
     deleted rather than duplicating the two they kept. */
  ...ENGAGEMENT_MODELS.map((m, i) => ({
    id: `engagement-${i}`,
    type: 'engagementModel',
    fields: m,
  })),
];

/* ------------------------------------------------------------------ */

async function main() {
  console.log(`\nSeeding copy into ${projectId}/${dataset}${DRY_RUN ? '  (DRY RUN)' : ''}\n`);

  /* Which documents are already there, so the log can say what will happen
     rather than listing everything as if it were new. */
  const existing = new Set(
    await client.fetch('*[_id in $ids]._id', { ids: SEEDS.map((s) => s.id) })
  );

  for (const { id, fields } of SEEDS) {
    const verb = existing.has(id) ? 'fill in ' : 'create  ';
    const blocks = Array.isArray(fields.body) ? `, ${fields.body.length} blocks` : '';
    console.log(`  ${verb} ${id.padEnd(16)} ${Object.keys(fields).length} field(s)${blocks}`);
  }

  /*
   * The services grid's closing tile.
   *
   * A block INSIDE a page's block array rather than a document of its own, so
   * it cannot go in SEEDS above — it is patched by path, keyed on the block's
   * own `_key`. Found by query rather than hardcoded, because which page uses
   * a services grid is the editor's decision and this script should not have
   * an opinion about it.
   *
   * Only the "tiles" layout is touched. The numbered "rows" layout never
   * rendered the tile, so seeding one there would ADD something the site did
   * not have, which is not what a transcription is for.
   */
  const gridBlocks = await client.fetch(
    `*[_type == "page"]{ _id, "keys": blocks[_type == "serviceGridBlock" && layout != "rows"]._key }[count(keys) > 0]`
  );

  for (const page of gridBlocks) {
    for (const key of page.keys) {
      console.log(`  fill in  ${page._id.padEnd(16)} services grid tile (${key})`);
    }
  }

  if (DRY_RUN) {
    console.log('\nNothing was written.\n');
    return;
  }

  /*
   * One transaction. A half-applied seed is the worst outcome here: the
   * templates read all of this on every page, so a site with `uiCopy` and no
   * `privacyPage` fails the build with the second error only after somebody
   * has fixed the first.
   */
  let tx = client.transaction();

  for (const { id, type, fields } of SEEDS) {
    tx = tx.createIfNotExists({ _id: id, _type: type });
    tx = tx.patch(id, (p) => p.setIfMissing(fields));
  }

  /* Addressed by the block's own key, so reordering the page's blocks later
     cannot make this write land on a different section. */
  for (const page of gridBlocks) {
    for (const key of page.keys) {
      tx = tx.patch(page._id, (p) =>
        p.setIfMissing(
          Object.fromEntries(
            Object.entries(SERVICE_GRID_CTA).map(([field, value]) => [
              `blocks[_key=="${key}"].${field}`,
              value,
            ])
          )
        )
      );
    }
  }

  await tx.commit();

  console.log('\nDone.\n');
  console.log('  Documents were created only if they did not already exist, and');
  console.log('  every field was FILLED IN only where it was empty — so nothing');
  console.log('  anybody has edited in the Studio was overwritten.');
  console.log('');
  console.log('  Re-running is safe, and is how a newly ADDED field reaches a');
  console.log('  document that already exists.\n');
}

main().catch((error) => {
  console.error('\nSeeding failed:', error.message);
  process.exit(1);
});
