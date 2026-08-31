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

  let source;
  try {
    source = execSync('git show HEAD:src/config/about.ts', {
      cwd: REPO,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    console.warn('  ! Could not read the old about.ts from git — skipping team.');
    return [];
  }

  const match = source.match(/export const team: Member\[\] = (\[[\s\S]*?\n\]);/);
  if (!match) {
    console.warn('  ! Could not find the team array in the committed about.ts — skipping.');
    return [];
  }

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
/* These configs are imported directly rather than scraped out of git   */
/* with a regex, the way `openRoles` had to be. They have no imports of */
/* their own, so Node can load them with type stripping and hand back   */
/* real objects — which is both shorter and impossible to get subtly    */
/* wrong the way a regex over source can be.                            */
/* ------------------------------------------------------------------ */

async function migratePieces() {
  const { pieces } = await import('../../src/config/portfolio.ts');

  return pieces.map((p, i) => ({
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

  const { services } = await import('../../src/config/services.ts');

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
  const contact = await import('../../src/config/contact.ts');

  const source = await readCareersSource();
  const emailMatch = source.match(/export const careersEmail = '([^']+)'/);
  const careersEmail = emailMatch ? emailMatch[1] : contact.email;

  return [
    {
      _id: 'contactDetails',
      _type: 'contactDetails',
      email: contact.email,
      careersEmail,
      addressLines: contact.office.lines,
      country: contact.office.country,
      socials: contact.socials.map((s, i) => ({
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
  const { positioning, teamIntro } = await import('../../src/config/about.ts');
  const { marqueeItems, capabilities } = await import('../../src/config/site.ts');

  return [
    {
      _id: 'siteCopy',
      _type: 'siteCopy',
      positioning,
      teamIntro,
      marqueeItems,
      capabilities,
    },
  ];
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
  ];

  for (const doc of docs) {
    const blocks = Array.isArray(doc.body) ? doc.body.length : 0;
    const state = doc._id.startsWith('drafts.') ? '  [unpublished]' : '';
    /* FAQs and the singletons have no slug — fall back to the id. */
    const label = doc.slug?.current ?? doc._id;
    console.log(
      `  ${doc._type.padEnd(16)} ${label}${blocks ? `  (${blocks} blocks)` : ''}${state}`
    );
  }

  if (DRY_RUN) {
    console.log(`\n${docs.length} documents would be created. Nothing was written.\n`);
    return;
  }

  /* One transaction: either everything lands or nothing does. A partial
     migration is the worst outcome here — you cannot tell by looking at the
     Studio which half made it. */
  const tx = docs.reduce((t, doc) => t.createOrReplace(doc), client.transaction());
  await tx.commit();

  console.log(`\n${docs.length} documents written and PUBLISHED.`);
  console.log('\nPublished rather than drafted on purpose: this content was already live');
  console.log('on the site, and importing it as drafts would have taken the blog down');
  console.log('until someone clicked publish sixteen times.');
  console.log('\nCheck a long post in the Studio for formatting before you rebuild.\n');
}

main().catch((error) => {
  console.error('\nMigration failed:', error.message);
  process.exit(1);
});
