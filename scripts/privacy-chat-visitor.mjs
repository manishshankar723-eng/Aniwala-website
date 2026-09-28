/**
 * One-off: tell the privacy page about the chat's browser id.
 *
 * WHY. On 28 September 2026 the chat's daily ten moved from being counted per
 * internet address to per browser (mintVisitor in supabase/functions/chat/
 * guards.ts), which means the site now keeps a random code in localStorage
 * (`aniwala-chat-visitor`) for 30 days and sends it when a chat starts. The
 * policy said the limit was keyed to the address alone and that no stored
 * value but the conversation ever leaves the device. Both stopped being true,
 * so the page changes with the code — see the note at the top of
 * studio/schemas/privacyPage.ts.
 *
 * DRAFTS ARE INCLUDED. A draft is its own document with its own copy of the
 * body; editing only the published one would let the old wording come back
 * the moment somebody hits Publish on the draft. Every edit is matched on the
 * exact existing text and the script refuses to write if any of it is not
 * found, and each document is patched only at the revision this run read.
 *
 * Usage:
 *   node --env-file=.env scripts/privacy-chat-visitor.mjs --dry   # show, change nothing
 *   node --env-file=.env scripts/privacy-chat-visitor.mjs
 *
 * AFTERWARDS: the live page is a static build, so it changes on the next
 * deploy (or a Publish in the Studio, which triggers one). A running dev
 * server needs `npm run restart` — see CLAUDE.md.
 */
import { createClient } from '@sanity/client';
import { randomBytes } from 'node:crypto';

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

const TODAY = '2026-09-28';
const key = () => randomBytes(6).toString('hex');
const text = (b) => (b.children ?? []).map((c) => c.text ?? '').join('');

/* Sentence swaps inside existing spans: [block starts with, old, new]. */
const SWAPS = [
  [
    'What we keep:',
    'To limit each visitor to ten questions a day, we keep for up to two days a count linked to a one-way code derived from your internet address — never the address itself.',
    'To limit each visitor to ten questions a day, we keep for up to two days a count linked to a random code held by your browser (aniwala-chat-visitor, listed under Cookies below), and — so that one network cannot flood the chat — a count linked to a one-way code derived from your internet address, never the address itself.',
  ],
  [
    'Google Analytics sets two cookies',
    'all of which exist to keep it working the way you left it:',
    'all of which exist to keep the site working:',
  ],
  [
    'None of these values identify you.',
    'Apart from the chat conversation — sent with each new question, as described above — they never leave your device,',
    'Apart from the chat conversation and the chat code — sent as described above — they never leave your device,',
  ],
];

/* The new list item, after `aniwala-chat-limited-until`. */
const visitorItem = () => ({
  _key: key(),
  _type: 'block',
  style: 'normal',
  listItem: 'bullet',
  level: 1,
  markDefs: [],
  children: [
    { _key: key(), _type: 'span', marks: ['code'], text: 'aniwala-chat-visitor' },
    {
      _key: key(),
      _type: 'span',
      marks: [],
      text: ' — a random code the chat gives your browser when you first start a chat, so that the limit of ten questions a day counts each browser on its own rather than everyone sharing your internet connection. It says nothing about who you are, is sent only when you start a new chat, and lasts 30 days.',
    },
  ],
});

function edit(doc) {
  const body = structuredClone(doc.body);
  const problems = [];
  for (const [start, from, to] of SWAPS) {
    const block = body.find((b) => b._type === 'block' && text(b).startsWith(start));
    const span = block?.children?.find((c) => typeof c.text === 'string' && c.text.includes(from));
    if (!span) problems.push(`"${start}…" does not contain the expected sentence`);
    else span.text = span.text.replace(from, to);
  }
  if (body.some((b) => text(b).startsWith('aniwala-chat-visitor'))) {
    problems.push('already lists aniwala-chat-visitor');
  } else {
    const at = body.findIndex((b) => text(b).startsWith('aniwala-chat-limited-until'));
    if (at < 0) problems.push('no aniwala-chat-limited-until item to insert after');
    else body.splice(at + 1, 0, visitorItem());
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
    const was = before.get(b._key);
    if (was === undefined) console.log(`  + ${text(b)}`);
    else if (was !== text(b)) console.log(`  ~ ${text(b)}`);
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
