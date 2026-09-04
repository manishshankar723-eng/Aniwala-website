/**
 * One-time migration: Markdown files -> Sanity documents.
 *
 * Reads the posts and case studies that used to live in `src/content/`, plus
 * the roles that used to live in `src/config/careers.ts`, and creates them in
 * Sanity. Run it once, check the Studio, then delete the source files.
 *
 * RUN IT
 *   cd studio
 *   npm install
 *   SANITY_WRITE_TOKEN=sk... node scripts/migrate.mjs --dry-run    # look first
 *   SANITY_WRITE_TOKEN=sk... node scripts/migrate.mjs              # then do it
 *
 * The token needs Editor permissions and is created at
 * sanity.io/manage -> your project -> API -> Tokens. It is a WRITE token:
 * do not put it in `.env` next to the read token, do not commit it, and
 * revoke it once the migration is done. It has no other use.
 *
 * SAFE TO RE-RUN. Documents get a deterministic `_id` derived from the slug
 * and are written with `createOrReplace`, so running twice updates rather than
 * duplicating. That also means it will OVERWRITE edits made in the Studio to
 * a migrated document — which is fine on the day you migrate and destructive
 * three weeks later. Delete this script once it has done its job.
 *
 * WHAT IT DOES NOT DO
 * Images. There are none to move — the posts used colour placeholders, which
 * carry over as the `tint` field. Cover images get added in the Studio.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@sanity/client';
import { htmlToBlocks } from '@sanity/block-tools';
import { Schema } from '@sanity/schema';
import { JSDOM } from 'jsdom';
import { marked } from 'marked';
import matter from 'gray-matter';

/* Imported with its .ts extension: Node strips the types at runtime (22.12+,
   which package.json already requires). Using the real Studio definition means
   the conversion is validated against exactly what the editor can represent —
   anything Markdown produces that the editor cannot show is dropped here,
   loudly, instead of being stored and never rendered. */
import blockContent from '../schemas/blockContent.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

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
  process.exit(1);
}

const client = createClient({ projectId, dataset, token, apiVersion: '2026-01-01', useCdn: false });

/* block-tools needs the compiled schema to know which blocks are legal, so
   the conversion is validated against the SAME blockContent definition the
   Studio uses. Anything Markdown produces that the editor cannot represent is
   dropped here rather than silently stored and never rendered. */
const schema = Schema.compile({
  name: 'default',
  types: [{ name: 'body', type: 'array', of: blockContent.of }],
});
const blockContentType = schema.get('body');

/** Markdown -> Portable Text, via HTML. */
const toPortableText = (markdown) => {
  const html = marked.parse(markdown, { async: false });
  return htmlToBlocks(html, blockContentType, {
    parseHtml: (h) => new JSDOM(h).window.document,
  });
};

/** A stable id from a slug, so re-running updates instead of duplicating. */
const idFor = (type, slug) => `${type}-${slug}`;

const slugField = (slug) => ({ _type: 'slug', current: slug });

/**
 * Read every .md file in a directory as { slug, data, body }.
 *
 * A missing directory is not an error. The Markdown was deleted once it had
 * been migrated, so this returns nothing on a later run rather than failing —
 * which is what lets the script be re-run to migrate a NEW content type
 * without first restoring content that has already moved.
 */
async function readMarkdownDir(dir) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`  (${basename(dir)}: already migrated, nothing on disk)`);
      return [];
    }
    throw error;
  }

  const files = entries.filter((f) => f.endsWith('.md'));
  return Promise.all(
    files.map(async (file) => {
      const raw = await readFile(join(dir, file), 'utf8');
      const { data, content } = matter(raw);
      return { slug: basename(file, '.md'), data, body: content };
    })
  );
}

/** Frontmatter dates parse as Date objects; Sanity wants YYYY-MM-DD. */
const toISODate = (value) => {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return String(value).split('T')[0];
};

async function migratePosts() {
  const posts = await readMarkdownDir(join(REPO, 'src', 'content', 'blog'));

  return posts.map(({ slug, data, body }) => ({
    _id: idFor('post', slug),
    _type: 'post',
    title: data.title,
    slug: slugField(slug),
    description: data.description,
    pubDate: toISODate(data.pubDate),
    ...(data.updatedDate ? { updatedDate: toISODate(data.updatedDate) } : {}),
    category: data.category,
    tags: data.tags ?? [],
    author: data.author ?? 'Aniwala Studios',
    tint: data.tint ?? '210 70% 22%',
    body: toPortableText(body),
  }));
}

async function migrateCaseStudies() {
  const studies = await readMarkdownDir(join(REPO, 'src', 'content', 'case-studies'));

  return studies.map(({ slug, data, body }) => ({
    _id: idFor('caseStudy', slug),
    _type: 'caseStudy',
    title: data.title,
    slug: slugField(slug),
    description: data.description,
    kind: data.kind,
    client: data.client,
    sector: data.sector,
    year: data.year,
    services: data.services ?? [],
    deliverables: data.deliverables ?? [],
    tools: data.tools ?? [],
    results: (data.results ?? []).map((r, i) => ({
      _type: 'object',
      _key: `result-${i}`,
      label: r.label,
      value: r.value,
    })),
    tint: data.tint ?? '210 70% 22%',
    featured: data.featured ?? false,
    body: toPortableText(body),
  }));
}

/**
 * Roles come from git rather than the working tree, because the array was
 * deleted from `config/careers.ts` as part of this migration. Reading the
 * committed version means the script still works after that deletion.
 */
async function migrateRoles() {
  const { execSync } = await import('node:child_process');

  let source;
  try {
    source = execSync('git show HEAD:src/config/careers.ts', {
      cwd: REPO,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    console.warn('  ! Could not read the old careers.ts from git — skipping roles.');
    return [];
  }

  /* Evaluate just the array literal. This is a throwaway migration script
     reading a file from this same repo, so `eval` here is reading our own
     committed source, not untrusted input. */
  const match = source.match(/export const openRoles: Role\[\] = (\[[\s\S]*?\n\]);/);
  if (!match) {
    console.warn('  ! Could not find openRoles in the committed careers.ts — skipping roles.');
    return [];
  }

  const roles = eval(match[1]);

  return roles.map((r) => ({
    _id: idFor('role', r.slug),
    _type: 'role',
    title: r.title,
    slug: slugField(r.slug),
    discipline: r.discipline,
    kind: r.kind,
    location: r.location,
    experience: r.experience,
    openings: r.openings,
    posted: r.posted,
    ...(r.closes ? { closes: r.closes } : {}),
    tint: r.tint,
    summary: r.summary,
    about: r.about,
    responsibilities: r.responsibilities ?? [],
    requirements: r.requirements ?? [],
    ...(r.niceToHave ? { niceToHave: r.niceToHave } : {}),
    software: r.software ?? [],
    reelNote: r.reelNote,
  }));
}


/**
 * Team members, from the committed `config/about.ts`.
 *
 * Created UNPUBLISHED, unlike everything else this script writes. The old
 * array marked every card `draft: true` so the placeholders rendered under
 * `astro dev` and never reached the live site — they describe roles, not
 * people. Publishing them here would put six invented colleagues on the about
 * page, which is exactly the outcome that flag existed to prevent.
 *
 * A Sanity draft is just a document whose _id is prefixed `drafts.`.
 */
async function migrateTeam() {
  const { execSync } = await import('node:child_process');

  const git = (cmd) =>
    execSync(cmd, { cwd: REPO, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

  const TEAM_RE = /export const team: Member\[\] = (\[[\s\S]*?\n\]);/;

  /*
   * Walk BACK through the history of about.ts for the last revision that
   * still had the team array, rather than reading HEAD.
   *
   * HEAD was the obvious choice and it was wrong within one commit: the
   * cleanup that removed the array landed before this script was ever run,
   * so `git show HEAD:` returned a file with no team in it and the script
   * printed a warning and skipped seven people. A migration that quietly
   * migrates nothing is the failure mode worth spending ten lines on.
   */
  let source = null;
  try {
    const revs = git('git log --format=%H -- src/config/about.ts').trim().split('\n');
    for (const rev of revs) {
      const text = git(`git show ${rev}:src/config/about.ts`);
      if (TEAM_RE.test(text)) {
        source = text;
        if (rev !== revs[0]) {
          console.log(`  (team: recovered from ${rev.slice(0, 7)}, the last commit that had it)`);
        }
        break;
      }
    }
  } catch {
    console.warn('  ! Could not read about.ts from git — skipping team.');
    return [];
  }

  if (!source) {
    console.warn('  ! No commit of about.ts contains the team array — skipping.');
    return [];
  }

  const match = source.match(TEAM_RE);

  const members = eval(match[1]);

  const slugify = (name) =>
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  return members.map((m, i) => {
    const slug = slugify(m.name);
    return {
      /* Gaps of 10 so someone can be slotted between two people later
         without renumbering the whole grid. */
      _id: m.draft ? `drafts.teamMember-${slug}` : `teamMember-${slug}`,
      _type: 'teamMember',
      name: m.name,
      slug: slugField(slug),
      role: m.role,
      bio: m.bio,
      ...(m.href ? { href: m.href } : {}),
      order: (i + 1) * 10,
    };
  });
}


/* ------------------------------------------------------------------ */
/* The studio's own content                                            */
/*                                                                     */
/* The seed values below are INLINED rather than imported from          */
/* `src/config/`, and that is deliberate.                               */
/*                                                                     */
/* They used to be imported. That worked exactly until the configs they */
/* read were cleaned up — at which point this script started producing  */
/* documents with empty fields, silently, for the three types that had  */
/* never been seeded in the first place. A migration script whose input */
/* is the thing the migration is supposed to let you delete is a script */
/* that can only be run once, in the right order, by someone who knows. */
/*                                                                     */
/* Inlined, it is a snapshot: it says what the site said on the day the */
/* content moved, it cannot drift, and deleting the configs cannot      */
/* break it. Run it once, check the Studio, then delete this file.      */
/* ------------------------------------------------------------------ */

/** Was `pieces` in src/config/portfolio.ts. */
const SEED_PIECES = [
  {
    slug: 'kite',
    title: 'Kite',
    category: 'animation',
    blurb:
      'A 40-second hand-drawn short: rigged bodies carrying the staging, drawn faces carrying the performance.',
    kind: 'Studio project',
    client: 'Aniwala Studios',
    year: 2026,
    tools: ['Toon Boom Harmony', 'Storyboard Pro', 'After Effects'],
    tint: '28 75% 26%',
    caseStudy: 'kite-short-film',
    wide: true,
  },
  {
    slug: 'downpour',
    title: 'Downpour',
    category: 'vfx',
    blurb:
      'Six shots of rain, standing water and structural collapse, built to find where a Houdini sim stops earning its render time.',
    kind: 'Studio project',
    client: 'Aniwala Studios',
    year: 2026,
    tools: ['Houdini', 'Karma', 'Nuke'],
    tint: '280 50% 26%',
    caseStudy: 'downpour-fx-study',
  },
  {
    slug: 'ferrous',
    title: 'Ferrous',
    category: 'environments',
    blurb:
      'A modular sci-fi corridor kit on a fixed memory budget, testing how far four trim sheets go before repetition shows.',
    kind: 'Studio project',
    client: 'Aniwala Studios',
    year: 2026,
    tools: ['Blender', 'Substance 3D Designer', 'Unreal Engine'],
    tint: '150 45% 20%',
  },
];

/** Was `email`, `office` and `socials` in src/config/contact.ts. */
const SEED_CONTACT = {
  email: 'contact@aniwala.com',
  addressLines: [
    'Crossroads Building, Bhumkar Chowk',
    'Survey 130/123, Service Rd, Shankar Kalat Nagar',
    'Wakad, Pimpri-Chinchwad',
    'Maharashtra 411057',
  ],
  country: 'India',
  /* THESE POINT AT THE PLATFORMS, NOT AT US. Until the studio accounts
     exist, each link goes to the service's own homepage so the row is live
     and looks right. Swap each href in the Studio as the accounts are
     created — that is now an edit, not a deploy. */
  socials: [
    { label: 'WhatsApp', icon: 'whatsapp', href: 'https://www.whatsapp.com' },
    { label: 'LinkedIn', icon: 'linkedin', href: 'https://www.linkedin.com' },
    { label: 'X', icon: 'x', href: 'https://x.com' },
    { label: 'YouTube', icon: 'youtube', href: 'https://www.youtube.com' },
    { label: 'Facebook', icon: 'facebook', href: 'https://www.facebook.com' },
    { label: 'ArtStation', icon: 'artstation', href: 'https://www.artstation.com' },
  ],
};

/** Was `positioning` / `teamIntro` in config/about.ts and `marqueeItems` /
    `capabilities` in config/site.ts. */
const SEED_COPY = {
  positioning:
    'Aniwala is an animation and game art studio. We handle a brief from board to delivery: 2D, 3D, VFX, engine integration and the edit, all in one pipeline. Most of the time a project loses is spent in the gaps between vendors. There are fewer gaps here.',
  teamIntro:
    'Small studio, so the person you brief is usually the person building it. Worth knowing who that would be before you hand over a budget.',
  marqueeItems: [
    'Character Design',
    'Creature Design',
    'Environment Art',
    'Concept Art',
    'Storyboarding',
    '3D Modelling',
    'Rigging',
    'Cinematics',
    'Simulation & FX',
    'Compositing',
    'Motion Design',
    'UI / UX Art',
  ],
  capabilities: [
    'Maya',
    'Blender',
    'Houdini',
    'ZBrush',
    'Substance',
    'Unreal Engine',
    'Nuke',
    'After Effects',
    'Toon Boom Harmony',
    'Photoshop',
  ],
};

async function migratePieces() {
  return SEED_PIECES.map((p, i) => ({
    _id: idFor('piece', p.slug),
    _type: 'piece',
    title: p.title,
    slug: slugField(p.slug),
    category: p.category,
    blurb: p.blurb,
    kind: p.kind,
    client: p.client,
    year: p.year,
    tools: p.tools ?? [],
    ...(p.caseStudy ? { caseStudy: p.caseStudy } : {}),
    tint: p.tint,
    wide: p.wide ?? false,
    /* Gaps of 10, so a piece can be slotted between two others later
       without renumbering the whole grid. */
    order: (i + 1) * 10,
  }));
}


/*
 * `careers.ts` is read as TEXT, not imported.
 *
 * It is the one config with an import of its own (`./disciplines`), written
 * without a file extension the way bundlers accept and Node's ESM resolver
 * does not. Changing the app's import style to suit a throwaway migration
 * script would be the tail wagging the dog, so this script does the awkward
 * thing instead.
 */
async function readCareersSource() {
  return readFile(join(REPO, 'src', 'config', 'careers.ts'), 'utf8');
}

async function migrateFaqs() {
  const source = await readCareersSource();
  const match = source.match(/export const careerFaqs: CareerFaq\[\] = (\[[\s\S]*?\n\]);/);
  const careerFaqs = match ? eval(match[1]) : [];
  if (!match) console.warn('  ! Could not find careerFaqs — skipping the careers FAQs.');

  /* Was `config/services.ts`, which no longer holds the services — they are
     documents now. The seed module is the snapshot this script already uses
     for the service documents themselves, so the FAQ scopes come from the
     same place and cannot drift from them. */
  const { SERVICES: services } = await import('./seed-services.mjs');

  const docs = [];

  careerFaqs.forEach((f, i) => {
    docs.push({
      _id: `faq-careers-${i}`,
      _type: 'faq',
      scope: 'careers',
      question: f.q,
      answer: f.a,
      order: (i + 1) * 10,
    });
  });

  for (const service of services) {
    (service.faqs ?? []).forEach((f, i) => {
      docs.push({
        _id: `faq-${service.slug}-${i}`,
        _type: 'faq',
        scope: `service:${service.slug}`,
        question: f.q,
        answer: f.a,
        order: (i + 1) * 10,
      });
    });
  }

  return docs;
}

async function migrateContactDetails() {
  const source = await readCareersSource();
  const emailMatch = source.match(/export const careersEmail = '([^']+)'/);
  const careersEmail = emailMatch ? emailMatch[1] : SEED_CONTACT.email;

  return [
    {
      _id: 'contactDetails',
      _type: 'contactDetails',
      email: SEED_CONTACT.email,
      careersEmail,
      addressLines: SEED_CONTACT.addressLines,
      country: SEED_CONTACT.country,
      socials: SEED_CONTACT.socials.map((s, i) => ({
        _type: 'object',
        _key: `social-${i}`,
        icon: s.icon,
        label: s.label,
        href: s.href,
      })),
    },
  ];
}

async function migrateSiteCopy() {
  return [
    {
      _id: 'siteCopy',
      _type: 'siteCopy',
      ...SEED_COPY,
    },
  ];
}

/**
 * The site's fixed pages, as block lists.
 *
 * The block arrays live in `seed-pages.mjs` — nine pages of them is a data
 * file, not part of a script, and inlining them here buried the migration
 * logic under six hundred lines of copy.
 */
/**
 * The six services.
 *
 * `related` is a reference field, so a service can only point at another once
 * BOTH exist. Because the whole migration commits as one transaction, every
 * document in it is created together and the references resolve on commit —
 * no second pass is needed, provided every slug referenced is also in this
 * batch. A slug that is not gets dropped with a warning rather than writing a
 * reference to a document that will never exist.
 */
async function migrateCareersContent() {
  const { CAREERS } = await import('./seed-careers.mjs');

  return [
    {
      _id: 'careersContent',
      _type: 'careersContent',
      ...CAREERS,
      values: CAREERS.values.map((v, i) => ({ _type: 'value', _key: `value-${i}`, ...v })),
      hiringSteps: CAREERS.hiringSteps.map((h, i) => ({ _type: 'step', _key: `step-${i}`, ...h })),
    },
  ];
}

async function migrateServices() {
  const { SERVICES } = await import('./seed-services.mjs');
  const known = new Set(SERVICES.map((s) => s.slug));

  return SERVICES.map((s) => {
    const related = (s.related ?? []).filter((slug) => {
      if (known.has(slug)) return true;
      console.warn(`  ! ${s.slug}: related service "${slug}" does not exist — dropped.`);
      return false;
    });

    return {
      _id: idFor('service', s.slug),
      _type: 'service',
      slug: slugField(s.slug),
      title: s.title,
      label: s.label,
      shortName: s.shortName,
      article: s.article,
      tagline: s.tagline,
      intro: s.intro,
      tint: s.tint,
      order: s.order,
      offerings: s.offerings.map((o, i) => ({ _type: 'entry', _key: `off-${i}`, ...o })),
      pipeline: s.pipeline.map((x, i) => ({ _type: 'entry', _key: `pipe-${i}`, ...x })),
      tools: s.tools,
      deliverables: s.deliverables,
      related: related.map((slug, i) => ({
        _type: 'reference',
        _key: `rel-${i}`,
        _ref: idFor('service', slug),
      })),
    };
  });
}

async function migrateNavigation() {
  const { NAVIGATION } = await import('./seed-pages.mjs');

  return [
    {
      _id: 'navigation',
      _type: 'navigation',
      items: NAVIGATION.items.map((item, i) => ({
        _type: 'item',
        _key: `item-${i}`,
        ...item,
        children: (item.children ?? []).map((c, j) => ({
          _type: 'child',
          _key: `child-${i}-${j}`,
          ...c,
        })),
      })),
      ctaLabel: NAVIGATION.ctaLabel,
      ctaHref: NAVIGATION.ctaHref,
    },
  ];
}

async function migrateBuiltPages() {
  const { PAGES, withKeys } = await import('./seed-pages.mjs');

  return PAGES.map((p) => ({
    _id: `page-${p.slug}`,
    _type: 'page',
    title: p.title,
    slug: slugField(p.slug),
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    noindex: p.noindex ?? false,
    blocks: withKeys(p.blocks),
  }));
}

async function main() {
  console.log(`\nMigrating into ${projectId}/${dataset}${DRY_RUN ? '  (DRY RUN)' : ''}\n`);

  const docs = [
    ...(await migratePosts()),
    ...(await migrateCaseStudies()),
    ...(await migrateRoles()),
    ...(await migrateTeam()),
    ...(await migratePieces()),
    ...(await migrateFaqs()),
    ...(await migrateContactDetails()),
    ...(await migrateSiteCopy()),
    ...(await migrateServices()),
    ...(await migrateCareersContent()),
    ...(await migrateNavigation()),
    ...(await migrateBuiltPages()),
  ];

  /*
   * `--only=page,siteCopy` restricts the write to those types.
   *
   * Every document here is written with `createOrReplace`, which is what makes
   * the script safe to re-run on the day of the migration and destructive
   * afterwards: once an editor has touched something in the Studio, a second
   * full run silently reverts it. That stops being hypothetical the moment a
   * NEW type is added — seeding it should not mean rewriting the twelve that
   * are already live and already edited.
   */
  const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '')
    .replace('--only=', '')
    .split(',')
    .filter(Boolean);

  const selected = only.length ? docs.filter((d) => only.includes(d._type)) : docs;

  if (only.length && !selected.length) {
    console.error(`\nNothing matches --only=${only.join(',')}.`);
    console.error(`Types available: ${[...new Set(docs.map((d) => d._type))].join(', ')}\n`);
    process.exit(1);
  }

  if (only.length) {
    console.log(`  (--only=${only.join(',')}: ${docs.length - selected.length} document(s) skipped)\n`);
  }

  for (const doc of selected) {
    const blocks = Array.isArray(doc.body) ? doc.body.length : 0;
    const state = doc._id.startsWith('drafts.') ? '  [unpublished]' : '';
    /* FAQs and the singletons have no slug — fall back to the id. */
    const label = doc.slug?.current ?? doc._id;
    console.log(
      `  ${doc._type.padEnd(16)} ${label}${blocks ? `  (${blocks} blocks)` : ''}${state}`
    );
  }

  if (DRY_RUN) {
    console.log(`\n${selected.length} documents would be created. Nothing was written.\n`);
    return;
  }

  /* One transaction: either everything lands or nothing does. A partial
     migration is the worst outcome here — you cannot tell by looking at the
     Studio which half made it. */
  const tx = selected.reduce((t, doc) => t.createOrReplace(doc), client.transaction());
  await tx.commit();

  console.log(`\n${selected.length} documents written and PUBLISHED.`);
  console.log('\nPublished rather than drafted on purpose: this content was already live');
  console.log('on the site, and importing it as drafts would have taken the blog down');
  console.log('until someone clicked publish sixteen times.');
  console.log('\nCheck a long post in the Studio for formatting before you rebuild.\n');
}

main().catch((error) => {
  console.error('\nMigration failed:', error.message);
  process.exit(1);
});
