/**
 * One-off: set how the existing tool logos show on each theme.
 *
 * WHY THIS EXISTS. The `appearance` field on a tool (Studio → Tools) arrived
 * after 34 logos were already uploaded, and the Studio only measures a logo
 * and fills that field in when one is UPLOADED while the document is open —
 * opening a document never writes, so the existing ones would otherwise stay
 * "as uploaded" everywhere, which is the bug.
 *
 * THE VALUES ARE NOT GUESSED. Every logo was rendered onto both badge colours
 * on 15 September 2026 and judged by eye, and `suggestFor` in
 * studio/components/logoTheme.ts reproduces exactly this list from the pixels.
 * Eleven need a treatment; the other 23 read on both themes as uploaded, which
 * is the default and needs nothing written.
 *
 *   dark theme, flip:  Houdini, ZBrush, Nuke, Unity, Perforce, Procreate
 *                      (black or near-black marks that vanished)
 *   light theme, flip: Toon Boom Harmony, TVPaint, 3DEqualizer, Spine,
 *                      Marmoset Toolbag (white or pale marks that vanished)
 *
 * NEVER OVERWRITES A CHOICE. A tool whose `appearance` is already set was
 * decided by a person in the Studio, and is skipped — pass --force to reset
 * those too.
 *
 * DRAFTS ARE INCLUDED. A draft is its own document with its own copy of every
 * field; patching only the published one would let the old value come back
 * the moment somebody publishes the draft.
 *
 * ORDER: deploy the Studio FIRST (`cd studio && npm run deploy`). Written
 * before the Studio knows the field, these values show as "unknown field"
 * warnings on eleven documents — whose obvious fix is to delete them.
 *
 * Usage:
 *   node --env-file=.env scripts/set-tool-appearance.mjs --dry   # list, change nothing
 *   node --env-file=.env scripts/set-tool-appearance.mjs
 *
 * The write fires the Sanity publish webhook like any other change, so the
 * live site rebuilds on its own. Locally: `npm run restart`.
 */
import { createClient } from '@sanity/client';

const dry = process.argv.includes('--dry');
const force = process.argv.includes('--force');

const { SANITY_PROJECT_ID, SANITY_DATASET, SANITY_WRITE_TOKEN } = process.env;

if (!SANITY_PROJECT_ID || !SANITY_DATASET) {
  console.error('Missing SANITY_PROJECT_ID / SANITY_DATASET. Run with --env-file=.env');
  process.exit(1);
}
if (!dry && !SANITY_WRITE_TOKEN) {
  console.error('Missing SANITY_WRITE_TOKEN — needed to write. Use --dry to look without one.');
  process.exit(1);
}

/* By document id, not by name: the name is free text an editor can change,
   the id is what these documents were created with. */
const VERIFIED = {
  'tool-houdini': { onDark: 'invert', onLight: 'asIs' },
  'tool-zbrush': { onDark: 'invert', onLight: 'asIs' },
  'tool-nuke': { onDark: 'invert', onLight: 'asIs' },
  'tool-unity': { onDark: 'invert', onLight: 'asIs' },
  'tool-perforce': { onDark: 'invert', onLight: 'asIs' },
  'tool-procreate': { onDark: 'invert', onLight: 'asIs' },
  'tool-toon-boom-harmony': { onDark: 'asIs', onLight: 'invert' },
  'tool-tvpaint': { onDark: 'asIs', onLight: 'invert' },
  'tool-3dequalizer': { onDark: 'asIs', onLight: 'invert' },
  'tool-spine': { onDark: 'asIs', onLight: 'invert' },
  'tool-marmoset-toolbag': { onDark: 'asIs', onLight: 'invert' },
};

const client = createClient({
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  apiVersion: '2024-01-01',
  useCdn: false,
  token: SANITY_WRITE_TOKEN,
  /* `raw` so drafts come back as themselves. */
  perspective: 'raw',
});

const ids = Object.keys(VERIFIED).flatMap((id) => [id, `drafts.${id}`]);
const docs = await client.fetch(`*[_id in $ids]{_id, name, appearance}`, { ids });

const plan = [];
for (const doc of docs) {
  const base = doc._id.replace(/^drafts\./, '');
  const want = VERIFIED[base];
  const has = doc.appearance && (doc.appearance.onDark || doc.appearance.onLight);
  if (has && !force) {
    console.log(`  skip   ${doc._id.padEnd(34)} already set by hand: ${JSON.stringify(doc.appearance)}`);
    continue;
  }
  plan.push({ id: doc._id, want });
  console.log(`  set    ${doc._id.padEnd(34)} dark=${want.onDark} light=${want.onLight}  (${doc.name})`);
}

const missing = Object.keys(VERIFIED).filter((id) => !docs.some((d) => d._id === id));
for (const id of missing) console.log(`  gone   ${id} — no published document with this id`);

/* No `process.exit()` past this point. On Windows, exiting while the client's
   keep-alive socket is still closing aborts Node with a libuv assertion AFTER
   everything has printed — harmless, and exactly the kind of output that
   makes a person think the write failed. Letting the script end is enough. */
if (!plan.length) {
  console.log('\nNothing to do.');
} else if (dry) {
  console.log(`\n--dry: ${plan.length} document(s) would be patched. Nothing written.`);
} else {
  /* One transaction: every logo gets its treatment, or none does. */
  const tx = client.transaction();
  for (const { id, want } of plan) {
    tx.patch(id, { set: { appearance: { onDark: want.onDark, onLight: want.onLight } } });
  }
  const result = await tx.commit();
  console.log(`\nok — ${result.results.length} document(s) patched.`);
  console.log('The publish webhook rebuilds the live site. Locally: `npm run restart`.');
}
