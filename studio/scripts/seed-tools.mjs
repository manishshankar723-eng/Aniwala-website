/**
 * Give every tool the site names a row to hang a logo on.
 *
 *   cd studio && npm run seed:tools -- --dry-run
 *   cd studio && npm run seed:tools
 *
 * WHY THIS EXISTS AT ALL.
 *
 * The pipeline strip (`TagListBlock`) matches a logo to a tool BY NAME,
 * because the list of tools is not the `tool` document's to own: the studio
 * strip reads `siteCopy.capabilities` and a service's reads that service's own
 * `tools`, and a third copy is how a service page ends up naming a tool the
 * strip beneath it does not.
 *
 * The cost of that choice is a join key typed by hand. "ZBrush" against
 * "Zbrush" loses a logo silently, and nobody finds it for a month. So no
 * human types it: this reads the names out of the dataset and writes the rows,
 * spelled exactly as the rest of the site spells them, leaving nothing to do
 * in the Studio but drop a file onto one.
 *
 * WHY IT DERIVES RATHER THAN CARRYING A LIST. The two sources are seeded by
 * two different scripts — `migrate.mjs` for the capabilities, `seed-services`
 * for the per-service tools — and a list here would be a third that drifts
 * from both. Run this after either of them, or after an editor adds a tool.
 *
 * `createIfNotExists`, so re-running never touches a logo already uploaded,
 * and a tool since renamed is left alone rather than resurrected. Rows for
 * tools that no longer exist are harmless — nothing looks them up — but they
 * are safe to delete in the Studio.
 */
import { createClient } from '@sanity/client';

const DRY_RUN = process.argv.includes('--dry-run');

const projectId = process.env.SANITY_STUDIO_PROJECT_ID;
const dataset = process.env.SANITY_STUDIO_DATASET ?? 'production';
const token = process.env.SANITY_WRITE_TOKEN;

if (!projectId) {
  console.error('Set SANITY_STUDIO_PROJECT_ID. Find it at sanity.io/manage.');
  process.exit(1);
}
if (!token && !DRY_RUN) {
  console.error('Set SANITY_WRITE_TOKEN, or pass --dry-run to see what would change.');
  process.exit(1);
}

const client = createClient({ projectId, dataset, token, apiVersion: '2024-10-01', useCdn: false });

console.log(`\nSeeding tool rows into ${projectId}/${dataset}${DRY_RUN ? '  (DRY RUN)' : ''}\n`);

const { capabilities = [], serviceTools = [] } = await client.fetch(`{
  "capabilities": *[_id == "siteCopy"][0].capabilities,
  "serviceTools": *[_type == "service"].tools[]
}`);

/* First appearance wins the position, so the Studio list opens in the same
   order the studio strip does rather than alphabetically by accident. */
const seen = new Map();
for (const name of [...capabilities, ...serviceTools]) {
  const clean = String(name ?? '').trim();
  if (!clean) continue;
  const key = clean.toLowerCase();
  if (!seen.has(key)) seen.set(key, clean);
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const docs = [...seen.values()].map((name, i) => ({
  _id: `tool-${slug(name)}`,
  _type: 'tool',
  name,
  order: (i + 1) * 10,
}));

/* Two tools whose names differ only in punctuation — "C#" and "C" — would
   slug to one id, and `createIfNotExists` would skip the second silently,
   leaving it with no row and no way to have a logo. Say so instead. */
const byId = new Map();
for (const d of docs) {
  if (byId.has(d._id)) {
    console.error(
      `Both "${byId.get(d._id)}" and "${d.name}" produce the id ${d._id}. ` +
        'Rename one, or give it a row by hand.'
    );
    process.exit(1);
  }
  byId.set(d._id, d.name);
}

const existing = new Set(await client.fetch('*[_id in $ids]._id', { ids: docs.map((d) => d._id) }));

for (const d of docs) {
  console.log(`  ${existing.has(d._id) ? 'exists ' : 'create '} ${d._id.padEnd(28)} ${d.name}`);
}
console.log(`\n  ${docs.length} tool(s), ${docs.length - existing.size} to create.`);

if (DRY_RUN) {
  console.log('\nNothing was written.\n');
  process.exit(0);
}

let tx = client.transaction();
for (const d of docs) tx = tx.createIfNotExists(d);
await tx.commit();

console.log('\nDone. Upload logos in the Studio under "Tool logos".\n');
