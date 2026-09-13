/**
 * Create empty portfolio tiles for a discipline, ready for their artwork.
 *
 * WHY THIS EXISTS
 *
 * A tile in the `/portfolio/<discipline>/` grid is one `piece` document. There
 * is no grid editor and there is deliberately no cap: six tiles is six
 * documents, twelve is twelve. Building each from scratch in the Studio means
 * retyping Category, Kind, Client, Year and Position every time, which is the
 * boring half of the job and the half that goes wrong — a piece with no
 * category is filed nowhere and appears on no page.
 *
 * So this stamps out the scaffolding and leaves exactly one thing to do per
 * tile: open it, drop the image (or the video) in, and press Publish.
 *
 * EVERYTHING IT CREATES IS A SANITY DRAFT — the ids carry the `drafts.` prefix.
 * A production build reads with `perspective: 'published'` (see
 * `src/lib/sanity/client.ts`), so none of these can reach staging or the live
 * site however long they sit there. They become real when a person presses
 * Publish, which is the point: the artwork decides when a tile is ready, not
 * this script.
 *
 * `createIfNotExists`, NOT `createOrReplace`, and the difference matters on the
 * second run. Replace would wipe the image somebody had already uploaded into
 * a draft this script made earlier — turning a re-run from a no-op into an
 * afternoon's work lost. Running this twice is safe; it skips what is there.
 *
 * USAGE, from `studio/`:
 *
 *   node --env-file=../.env scripts/seed-pieces.mjs --category=character-design
 *   node --env-file=../.env scripts/seed-pieces.mjs --category=vfx --count=12
 *   node --env-file=../.env scripts/seed-pieces.mjs --category=animation --wide=1,5,9
 *   node --env-file=../.env scripts/seed-pieces.mjs --category=vfx --dry-run
 *
 * FLAGS
 *   --category=<slug>  required. The discipline's URL slug, e.g. `character-design`.
 *   --count=<n>        how many tiles. Default 6. No ceiling — the grid is a
 *                      filter over every piece in the category, with no slice
 *                      anywhere in it (see `piecesIn` in src/lib/pieces.ts).
 *   --wide=<1,4>       which tiles span the full row, 1-based. Default `1,4`,
 *                      which gives the wide / narrow / narrow rhythm most
 *                      studio galleries use. Pass `--wide=` for none, or list
 *                      every index for all of them. Nothing enforces a ratio.
 *   --start=<n>        Position of the first tile. Default 10.
 *   --step=<n>         gap between Positions. Default 10, so one can be slotted
 *                      in later without renumbering the rest.
 *   --prefix=<text>    Title stem. Default the discipline's own title.
 *   --dry-run          print what would be written and write nothing.
 *
 * The write token is the same one `migrate.mjs` wants, and the same warning
 * applies: it is not scoped to a document type, so anything holding it can
 * rewrite the dataset. Keep it out of the repo.
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
const category = (args.get('category') ?? '').trim();
const count = Number(args.get('count') ?? 6);
const start = Number(args.get('start') ?? 10);
const step = Number(args.get('step') ?? 10);
const prefixArg = args.get('prefix');

/* `--wide=` (empty) means none, which is different from the flag being absent
   and meaning the default. `has` before `get` is what tells them apart. */
const wideRaw = args.has('wide') ? args.get('wide') : '1,4';
const wide = new Set(
  String(wideRaw)
    .split(',')
    .map((n) => Number(n.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
);

const die = (message) => {
  console.error(`\n  ${message}\n`);
  process.exitCode = 1;
};

if (!category) {
  die('Pass --category=<slug>, e.g. --category=character-design');
} else if (!Number.isInteger(count) || count < 1) {
  die(`--count must be a whole number of 1 or more (got "${args.get('count')}").`);
} else if (!Number.isInteger(start) || !Number.isInteger(step) || step < 1) {
  die('--start and --step must be whole numbers, and --step at least 1.');
}
if (process.exitCode) process.exit();

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? process.env.SANITY_PROJECT_ID;
const dataset =
  process.env.SANITY_STUDIO_DATASET ?? process.env.SANITY_DATASET ?? 'production';
const token = process.env.SANITY_WRITE_TOKEN;

if (!projectId) {
  die('SANITY_STUDIO_PROJECT_ID is not set. Run with `node --env-file=../.env`.');
  process.exit();
}
if (!token && !DRY_RUN) {
  die('SANITY_WRITE_TOKEN is not set. Add it, or pass --dry-run to see the plan.');
  process.exit();
}

const client = createClient({
  projectId,
  dataset,
  token,
  /* Pinned, like every other Sanity call in this project. */
  apiVersion: '2026-01-01',
  useCdn: false,
});

/* ------------------------------------------------------------------ */
/* Build and write                                                     */
/* ------------------------------------------------------------------ */

/*
 * The discipline is looked up rather than assumed, and the script stops if it
 * is not there. A `piece` whose `category` reference points at nothing builds
 * fine, renders nowhere, and is invisible until somebody wonders why a tile
 * never appeared — so a typo in --category should cost a second, not an hour.
 */
const discipline = await client.fetch(
  '*[_type == "workCategory" && slug.current == $slug][0]{_id, title}',
  { slug: category }
);

if (!discipline) {
  const known = await client.fetch(
    '*[_type == "workCategory"]|order(order){"s": slug.current}.s'
  );
  die(
    `No discipline with the slug "${category}".\n  Known slugs: ${known.join(', ')}`
  );
  process.exit();
}

const prefix = (prefixArg ?? discipline.title).trim();
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const docs = Array.from({ length: count }, (_, i) => {
  const n = i + 1;
  const pad = String(n).padStart(2, '0');
  return {
    /* `drafts.` is what keeps these off the site until somebody publishes. */
    _id: `drafts.piece-${category}-${pad}`,
    _type: 'piece',
    title: `${prefix} ${n}`,
    slug: { _type: 'slug', current: `${slugify(prefix)}-${n}` },
    category: { _type: 'reference', _ref: discipline._id },
    blurb: 'PLACEHOLDER — one line on what this is, not how good it looks.',
    /* A safe default: claiming a client on a tile nobody has filled in yet is
       the one field here that could become a false statement in public. */
    kind: 'Studio project',
    client: 'Aniwala Studios',
    year: new Date().getFullYear(),
    tools: [],
    /* The shipped default from the schema. Shown until an image is added, so
       an unfilled tile is a flat colour rather than a broken box. */
    tint: '210 70% 22%',
    sound: false,
    wide: wide.has(n),
    order: start + i * step,
  };
});

console.log(
  `\n  ${DRY_RUN ? 'Would create' : 'Creating'} ${docs.length} draft tile(s) ` +
    `for "${discipline.title}" in ${projectId}/${dataset}\n`
);
for (const d of docs) {
  console.log(
    `    ${d._id.padEnd(36)} order=${String(d.order).padEnd(4)} ${d.wide ? 'WIDE' : 'narrow'}`
  );
}

if (DRY_RUN) {
  console.log('\n  --dry-run: nothing was written.\n');
  process.exit();
}

/* One transaction: either every tile lands or none does. A half-seeded grid
   with gaps in its Positions is more annoying to clean up than to redo. */
const tx = docs.reduce((t, doc) => t.createIfNotExists(doc), client.transaction());
await tx.commit();

console.log(
  '\n  Done. They are DRAFTS — open each in the Studio under Portfolio pieces,\n' +
    '  drop in the image (and a video if you want one), then press Publish.\n' +
    '  Nothing appears on the site until you do.\n'
);
