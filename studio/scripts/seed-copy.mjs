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
 * So this script does two different things to two kinds of document:
 *
 *   NEW documents (`uiCopy`, `privacyPage`) are created outright. There is
 *   nothing to lose, and `createIfNotExists` means a second run leaves an
 *   edited one alone.
 *
 *   EXISTING documents are PATCHED with `setIfMissing`, key by key. A field
 *   that is not there yet gets its seeded value; a field somebody has already
 *   written stays exactly as they left it. That makes this safe to re-run,
 *   and safe to run against production while somebody is editing.
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

const created = [
  {
    _id: 'uiCopy',
    _type: 'uiCopy',
    ...UI_COPY,
    legalLinks: keyed('legalLink', UI_COPY.legalLinks),
    notFoundRoutes: keyed('route', UI_COPY.notFoundRoutes),
  },
  {
    _id: 'privacyPage',
    _type: 'privacyPage',
    ...PRIVACY,
    body: toPortableText(PRIVACY_BODY),
  },
];

const patched = [
  {
    id: 'careersContent',
    fields: {
      ...CAREERS_CLOSING,
      ...APPLY_COPY,
      applyPromises: keyed('promise', APPLY_COPY.applyPromises),
    },
  },
  { id: 'bookingSettings', fields: BOOKING_COPY },
  { id: 'contactDetails', fields: { legalName: LEGAL_NAME } },
];

/* ------------------------------------------------------------------ */

async function main() {
  console.log(`\nSeeding copy into ${projectId}/${dataset}${DRY_RUN ? '  (DRY RUN)' : ''}\n`);

  for (const doc of created) {
    const blocks = Array.isArray(doc.body) ? `  (${doc.body.length} blocks)` : '';
    console.log(`  create   ${doc._type.padEnd(14)} ${doc._id}${blocks}`);
  }
  for (const { id, fields } of patched) {
    console.log(`  fill in  ${id.padEnd(14)} ${Object.keys(fields).length} field(s)`);
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

  for (const doc of created) tx = tx.createIfNotExists(doc);
  for (const { id, fields } of patched) {
    tx = tx.patch(id, (p) => p.setIfMissing(fields));
  }

  await tx.commit();

  console.log('\nDone.\n');
  console.log('  New documents were created only if they did not already exist,');
  console.log('  and existing ones only had fields FILLED IN that were empty —');
  console.log('  so nothing anybody has edited in the Studio was overwritten.');
  console.log('  Re-running this is safe and does nothing the second time.\n');
}

main().catch((error) => {
  console.error('\nSeeding failed:', error.message);
  process.exit(1);
});
