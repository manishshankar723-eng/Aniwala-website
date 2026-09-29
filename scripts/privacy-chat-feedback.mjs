/**
 * One-off: tell the privacy page about the chat's "not helpful" button.
 *
 * WHY. From 29 September 2026 each chat answer carries a thumbs up and a
 * thumbs down. A thumbs down stores that answer and the question it answered
 * (scrubbed, like everything in `chat_flags`) for 30 days — the `feedback`
 * path in supabase/functions/chat/index.ts. The policy said the only chat
 * text kept was "the questions the assistant declined to answer", and in two
 * places. Both stop being true when that code ships, so the page changes with
 * it — see the note at the top of studio/schemas/privacyPage.ts. A thumbs UP
 * is sent nowhere and needs no mention.
 *
 * Same mechanics as privacy-chat-visitor.mjs: drafts included, every edit
 * matched on the exact existing text, refuses to write if any is missing,
 * one transaction pinned to the revisions this run read.
 *
 * Usage:
 *   node --env-file=.env scripts/privacy-chat-feedback.mjs --dry   # show, change nothing
 *   node --env-file=.env scripts/privacy-chat-feedback.mjs
 *
 * AFTERWARDS: the live page is a static build, so it changes on the next
 * deploy (or a Publish in the Studio, which triggers one). A running dev
 * server needs `npm run restart` — see CLAUDE.md.
 */
import { createClient } from '@sanity/client';

const dry = process.argv.includes('--dry');
const { SANITY_PROJECT_ID, SANITY_DATASET, SANITY_WRITE_TOKEN, SANITY_READ_TOKEN } = process.env;
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
  token: SANITY_WRITE_TOKEN || SANITY_READ_TOKEN,
  perspective: 'raw',
});

const TODAY = '2026-09-29';
const text = (b) => (b.children ?? []).map((c) => c.text ?? '').join('');

/* Sentence swaps inside existing spans: [block starts with, old, new]. */
const SWAPS = [
  [
    'What we keep:',
    'the questions the assistant declined to answer, with emails and phone numbers removed, for 30 days, so we can see where it falls short.',
    'the questions the assistant declined to answer, and any answer you mark as not helpful together with the question it answered, with emails and phone numbers removed, for 30 days, so we can see where it falls short.',
  ],
  [
    'Supabase',
    'the chat assistant’s daily limits and the questions it declined.',
    'the chat assistant’s daily limits, the questions it declined and the answers marked as not helpful.',
  ],
];

function edit(doc) {
  const body = structuredClone(doc.body);
  const problems = [];
  for (const [start, from, to] of SWAPS) {
    const block = body.find((b) => b._type === 'block' && text(b).startsWith(start));
    const span = block?.children?.find((c) => typeof c.text === 'string' && c.text.includes(from));
    if (!span) problems.push(`"${start}…" does not contain the expected sentence`);
    else span.text = span.text.replace(from, to);
  }
  return { body, problems };
}

const docs = await client.fetch('*[_id in ["privacyPage", "drafts.privacyPage"]]{_id, _rev, body, lastUpdated}');
if (!docs.some((d) => d._id === 'privacyPage')) {
  console.error('No published privacyPage.');
  process.exit(1);
}

const plans = docs.map((d) => ({ doc: d, ...edit(d) }));
for (const p of plans) {
  console.log(`\n${p.doc._id} (rev ${p.doc._rev}), lastUpdated ${p.doc.lastUpdated} -> ${TODAY}`);
  if (p.problems.length) console.log('  PROBLEMS:\n   - ' + p.problems.join('\n   - '));
  const before = new Map(p.doc.body.map((b) => [b._key, text(b)]));
  for (const b of p.body) {
    if (before.get(b._key) !== text(b)) console.log(`  ~ ${text(b)}`);
  }
}

if (plans.some((p) => p.problems.length)) {
  console.error('\nRefusing to write: fix the problems above first.');
  process.exit(1);
}
if (dry) {
  console.log('\n--dry: nothing written.');
  process.exit(0);
}

/* One transaction, each patch pinned to the revision read above: if anyone
   edited the page since, nothing is written. */
const tx = client.transaction();
for (const p of plans) {
  tx.patch(p.doc._id, (patch) => patch.ifRevisionId(p.doc._rev).set({ body: p.body, lastUpdated: TODAY }));
}
const res = await tx.commit();
console.log(`\nWritten: ${res.documentIds.join(', ')}`);
