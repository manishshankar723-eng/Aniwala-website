/**
 * The three labels the role page's salary row needs, and nothing else.
 *
 * `npm run seed:copy` would also add these, but it runs `setIfMissing` over
 * every seeded field on every copy document — which re-fills anything that
 * was emptied on purpose since, and recreates engagement models somebody
 * deleted. This touches three fields on `uiCopy` (and its draft, if one is
 * open: a draft is its own document, and publishing one that lacks these
 * would drop them and fail the next build).
 *
 *   node --env-file=../.env scripts/seed-salary-copy.mjs --dry-run
 *   node --env-file=../.env scripts/seed-salary-copy.mjs
 */
import { createClient } from '@sanity/client';
import { UI_COPY } from './seed-ui.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const FIELDS = ['roleFactSalary', 'roleSalaryMonth', 'roleSalaryYear'];

const client = createClient({
  projectId: process.env.SANITY_STUDIO_PROJECT_ID,
  dataset: process.env.SANITY_STUDIO_DATASET ?? 'production',
  token: process.env.SANITY_WRITE_TOKEN,
  apiVersion: '2026-01-01',
  useCdn: false,
});

const fields = Object.fromEntries(FIELDS.map((f) => [f, UI_COPY[f]]));
const docs = await client.fetch(
  `*[_id in ["uiCopy", "drafts.uiCopy"]]{ _id, ${FIELDS.join(', ')} }`
);

let tx = client.transaction();
for (const doc of docs) {
  const missing = FIELDS.filter((f) => !doc[f]);
  console.log(`  ${doc._id.padEnd(14)} ${missing.length ? `fill in ${missing.join(', ')}` : 'already set'}`);
  if (missing.length) tx = tx.patch(doc._id, (p) => p.setIfMissing(fields));
}

if (DRY_RUN) console.log('\nDRY RUN — nothing was written.\n');
else {
  await tx.commit();
  console.log('\nDone.\n');
}
