/**
 * The chatbot's knowledge base, built from the same content as the pages.
 *
 * Served as `/chat/knowledge.json` and fetched by the `chat` Edge Function
 * from SITE_URL. CHATBOT-PLAN.md section 3 is the design; the part that
 * matters most is WHERE this runs, which is the security decision (R10):
 *
 *   - INSIDE the Astro build, through `astro:content`. The Sanity dataset also
 *     holds the `submission` mirror — every lead and every applicant, with
 *     phone numbers and CV links — and the content layer has no collection
 *     for that type. Nothing built here can reach one. A standalone script
 *     holding SANITY_READ_TOKEN and a GROQ query would have no such wall.
 *   - Drafts and `noindex` entries are dropped HERE, explicitly, and not left
 *     to `previewMode`: a preview build must produce the same file production
 *     does, so the bot can never announce a role or a client that is not on
 *     the live site yet. That is why this file calls `getCollection` with its
 *     own filter rather than the page helpers, which let drafts through in a
 *     preview on purpose.
 *   - The rule for adding anything: if it is not on a public page, it does
 *     not go in here. The file is public, and that is only fine because of
 *     that rule.
 *
 * Every `url` is built from a slug by the route rule the pages use, and the
 * finished file goes through the SAME `validateKnowledge` the function runs on
 * what it fetches — so a file the bot would refuse fails the build instead of
 * silently muting the bot.
 */
import { getCollection, getEntry } from 'astro:content';
import {
  estimateTokens,
  renderConcept,
  renderIndex,
  validateKnowledge,
  type Concept,
  type KnowledgeFile,
} from '../../supabase/functions/chat/guards.ts';
import { categoryHref } from './workCategories';

/* Published and indexable, whatever kind of build this is. */
const publicEntry = ({ data }: { data: { draft?: boolean; noindex?: boolean } }) =>
  !data.draft && !data.noindex;

const byOrder = (a: { data: { order: number } }, b: { data: { order: number } }) =>
  a.data.order - b.data.order;

/** Lines of `label: value`, skipping blanks, so a body reads as a fact sheet. */
const facts = (rows: Array<[string, string | number | undefined | null]>) =>
  rows
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

const list = (heading: string, items: string[]) =>
  items.filter((s) => s.trim()).length
    ? `${heading}:\n${items.filter((s) => s.trim()).map((s) => `- ${s}`).join('\n')}`
    : '';

const join = (...parts: string[]) => parts.filter((p) => p.trim()).join('\n\n');

/** Distinct, lower-cased, short — they are retrieval hints, not prose. */
const keywords = (...values: Array<string | string[] | undefined>) =>
  [
    ...new Set(
      values
        .flat()
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.trim().toLowerCase())
        .filter((v) => v && v.length <= 80)
    ),
  ].slice(0, 40);

async function faqsByScope(): Promise<Map<string, Array<{ q: string; a: string }>>> {
  const entries = (await getCollection('faqs', publicEntry)).sort(byOrder);
  const out = new Map<string, Array<{ q: string; a: string }>>();
  for (const e of entries) {
    const list = out.get(e.data.scope) ?? [];
    list.push({ q: e.data.question, a: e.data.answer });
    out.set(e.data.scope, list);
  }
  return out;
}

const faqText = (items: Array<{ q: string; a: string }> = []) =>
  items.length ? `Questions people ask:\n${items.map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n\n')}` : '';

export async function buildChatKnowledge(): Promise<KnowledgeFile> {
  const faqs = await faqsByScope();
  const concepts: Concept[] = [];

  /* ---------- services ---------- */
  const services = (await getCollection('services', publicEntry)).sort(
    (a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title)
  );
  const serviceName = new Map(services.map((s) => [s.id, s.data.label]));
  for (const s of services) {
    const d = s.data;
    concepts.push({
      id: `service-${s.id}`,
      type: 'service',
      title: d.title,
      url: `/services/${s.id}/`,
      summary: d.tagline || d.seoDescription || '',
      keywords: keywords(d.label, d.shortName, d.offerings.map((o) => o.title), d.tools, d.deliverables),
      body: join(
        d.intro,
        list('What is included', d.offerings.map((o) => `${o.title} — ${o.body}`)),
        list('How it runs', d.pipeline.map((p) => `${p.title} — ${p.body}`)),
        list('Deliverables', d.deliverables),
        list('Tools', d.tools),
        faqText(faqs.get(`service:${s.id}`))
      ),
    });
  }

  /* ---------- portfolio disciplines ---------- */
  for (const c of (await getCollection('workCategories', publicEntry)).sort(byOrder)) {
    concepts.push({
      id: `portfolio-${c.id}`,
      type: 'portfolio',
      title: c.data.title,
      url: categoryHref(c.id),
      summary: c.data.blurb,
      keywords: keywords(c.data.title, c.data.shortName, c.data.services.map((id) => serviceName.get(id) ?? '')),
      body: c.data.intro,
    });
  }

  /* ---------- case studies ---------- */
  const studies = (await getCollection('caseStudies', publicEntry)).sort(
    (a, b) => b.data.year - a.data.year || a.data.title.localeCompare(b.data.title)
  );
  for (const c of studies) {
    const d = c.data;
    concepts.push({
      id: `case-study-${c.id}`,
      type: 'case-study',
      title: d.title,
      url: `/case-studies/${c.id}/`,
      summary: d.description,
      keywords: keywords(d.client, d.sector, d.tools, d.services.map((id) => serviceName.get(id) ?? id)),
      body: join(
        facts([
          ['Kind', d.kind],
          ['Client', d.client],
          ['Sector', d.sector],
          ['Year', d.year],
          ['Services', d.services.map((id) => serviceName.get(id) ?? id).join(', ')],
        ]),
        list('Deliverables', d.deliverables),
        list('Results', d.results.map((r) => `${r.label}: ${r.value}`)),
        list('Tools', d.tools)
      ),
    });
  }

  /* ---------- careers ---------- */
  const roles = (await getCollection('roles', publicEntry)).sort(
    (a, b) => b.data.posted.localeCompare(a.data.posted) || a.data.title.localeCompare(b.data.title)
  );
  for (const r of roles) {
    const d = r.data;
    concepts.push({
      id: `role-${r.id}`,
      type: 'role',
      title: d.title,
      url: `/careers/${r.id}/`,
      summary: d.summary,
      keywords: keywords(d.title, d.discipline, d.kind, d.location, d.software, 'job', 'hiring', 'apply'),
      body: join(
        d.about,
        facts([
          ['Discipline', d.discipline],
          ['Employment', d.kind],
          ['Location', d.location],
          ['Experience', d.experience],
          ['Openings', d.openings],
          ['Posted', d.posted],
          ['Applications close', d.closes],
        ]),
        list('Responsibilities', d.responsibilities),
        list('Requirements', d.requirements),
        list('Nice to have', d.niceToHave ?? []),
        list('Software', d.software),
        d.reelNote,
        'Apply with the form on this role page.'
      ),
    });
  }
  concepts.push({
    id: 'careers',
    type: 'careers',
    title: 'Careers',
    url: '/careers/',
    summary: roles.length
      ? `Open roles and how applying works. ${roles.length} open now.`
      : 'How applying works. No roles are open right now; open applications are welcome.',
    keywords: keywords('careers', 'jobs', 'hiring', 'apply', 'internship', 'work with us', 'open application'),
    body: join(
      list('Open roles', roles.map((r) => `${r.data.title} (${r.data.location}) — /careers/${r.id}/`)),
      roles.length ? '' : 'No roles are open right now. The careers page takes open applications.',
      faqText(faqs.get('careers'))
    ),
  });

  /* ---------- about ---------- */
  const copy = await getEntry('siteCopy', 'siteCopy');
  const engagement = (await getCollection('engagementModels', publicEntry)).sort(byOrder);
  const milestones = (await getCollection('milestones', publicEntry)).sort(byOrder);
  const about = copy && !copy.data.draft ? copy.data : null;
  concepts.push({
    id: 'about',
    type: 'about',
    title: 'About the studio',
    url: '/about/',
    summary: about?.positioning.split(/(?<=\.)\s/)[0] ?? '',
    /* The words people use to ask what the studio IS. "About" is a stop word
       and "studio" is in every case study ("Studio project"), so without
       these, "what kind of studio are you?" matched the case studies. */
    keywords: keywords(
      'about',
      'studio',
      'kind of studio',
      'company',
      'agency',
      'overview',
      'introduction',
      'where are you based',
      'process',
      'how we work',
      about?.capabilities ?? []
    ),
    body: join(
      about?.positioning ?? '',
      about?.teamIntro ?? '',
      list('Capabilities', about?.capabilities ?? []),
      list('Process', (about?.processSteps ?? []).map((p) => `${p.title} — ${p.body}`)),
      list('Ways to work with us', engagement.map((e) => `${e.data.title} — ${e.data.body} Best for: ${e.data.bestFor}`)),
      list('Milestones', milestones.map((m) => `${m.data.when}: ${m.data.title} — ${m.data.body}`))
    ),
  });

  /* ---------- team: what the /about/ page shows, and nothing more ----------
     Name, role and bio — the three things on each member's card. Not the
     profile link and not the photo; nothing here is a way to reach a person
     other than through the studio. */
  const team = (await getCollection('team', publicEntry)).sort(byOrder);
  if (team.length) {
    concepts.push({
      id: 'team',
      type: 'team',
      title: 'The team',
      url: '/about/',
      summary: `Who works at the studio: ${team.map((m) => m.data.name).join(', ')}.`,
      keywords: keywords(
        'team',
        'people',
        'founder',
        'owner',
        'leadership',
        'runs',
        'who',
        team.flatMap((m) => [m.data.name, ...m.data.name.split(/\s+/), m.data.role])
      ),
      body: team.map((m) => `${m.data.name} — ${m.data.role}\n${m.data.bio}`).join('\n\n'),
    });
  }

  /* ---------- contact ---------- */
  const contact = await getEntry('contactDetails', 'contactDetails');
  const c = contact && !contact.data.draft ? contact.data : null;
  concepts.push({
    id: 'contact',
    type: 'contact',
    title: 'Contact and booking a call',
    url: '/contact/',
    summary: 'How to get in touch, book a call or send a brief.',
    keywords: keywords('contact', 'email', 'phone', 'address', 'book', 'call', 'meeting', 'quote', 'brief', 'price'),
    body: join(
      facts([
        ['Email', c?.email],
        ['Careers email', c?.careersEmail],
        ['Phone', c?.phone],
        ['Address', [...(c?.addressLines ?? []), c?.country].filter(Boolean).join(', ')],
        ['Opening hours', (c?.openingHours ?? []).join('; ')],
        ['Areas served', (c?.areaServed ?? []).join(', ')],
      ]),
      'Send a brief with the enquiry form on the contact page, or book a call at /contact/#book. ' +
        'Quotes, prices and dates are given by the team after an enquiry, never in chat.'
    ),
  });

  /* ---------- blog: titles and one line, never bodies ---------- */
  const posts = (await getCollection('blog', publicEntry)).sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime()
  );
  for (const p of posts) {
    concepts.push({
      id: `post-${p.id}`,
      type: 'post',
      title: p.data.title,
      url: `/blog/${p.id}/`,
      summary: p.data.description,
      keywords: keywords(p.data.category, p.data.tags),
      body: p.data.description,
    });
  }

  const file: KnowledgeFile = { version: 1, concepts };

  /* The function's own check, at build time. A slug that makes a bad path, a
     duplicate id, an oversized body: all fail here, loudly. */
  if (!validateKnowledge(file)) {
    const bad = concepts.find((k) => !validateKnowledge({ version: 1, concepts: [k] }));
    throw new Error(
      `chat knowledge failed validation${bad ? ` at "${bad.id}" (${bad.url})` : ' (duplicate id?)'}. ` +
        'See CHATBOT-PLAN.md section 3.'
    );
  }

  return file;
}

/** What the build log prints, so growth is visible long before it matters. */
export function knowledgeStats(file: KnowledgeFile): string {
  const prefix = estimateTokens(renderIndex(file.concepts));
  const full = estimateTokens(file.concepts.map(renderConcept).join('\n\n'));
  return `chat knowledge: ${file.concepts.length} concepts, index ~${prefix} tokens, full base ~${full} tokens`;
}
