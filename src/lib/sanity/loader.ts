/**
 * Astro Content Layer loaders backed by Sanity.
 *
 * WHY LOADERS RATHER THAN A REWRITE
 * Moving to a headless CMS normally means rewriting every page that touches
 * content. It did not here, because this site already routed everything
 * through `getCollection()`. A custom loader plugs in underneath that, so
 * `lib/posts.ts`, `lib/caseStudies.ts`, `lib/searchDocs.ts` and all the page
 * routes carry on working untouched — they still call `getCollection('blog')`
 * and still get `{ id, data, body }` entries back.
 *
 * Three things are preserved on purpose, because dropping any of them would
 * have broken something visible:
 *
 *   1. `id` is the slug. Routes do `params: { slug: post.id }`, so the slug
 *      must arrive as the entry id or every URL on the blog changes.
 *   2. `body` is plain text. `readingTime()` counts the words in it.
 *   3. `rendered.metadata.headings` is what Astro's `render()` gives back as
 *      `headings`, which the sticky table of contents filters by depth.
 *
 * The Zod schemas in `content.config.ts` still run: `parseData()` validates
 * every document against them. That is the real reason this design earns the
 * loader code — a CMS field that goes missing fails the BUILD, loudly, rather
 * than rendering an empty heading on the live site. It is also what stops a
 * non-technical editor publishing a job with no `posted` date, which would
 * quietly drop the role out of Google's job index.
 */
import type { Loader, LoaderContext } from 'astro/loaders';
import { sanityClient, sanityConfigured, draftsVisible } from './client';
import { renderBody, toPlainText } from './portableText';

/**
 * Second line of defence.
 *
 * The real guarantee is the client's `perspective` — see `client.ts`, which
 * requests `published` in a production build so the API never sends a draft
 * at all. This filter is then redundant, costs nothing, and stays because the
 * failure mode of getting it wrong is publishing unfinished writing to a live
 * site. If someone later changes the perspective without thinking it through,
 * this still holds.
 *
 * In dev the perspective is `raw`, so both a draft and its published twin come
 * back with their real ids and the dedupe below can tell them apart.
 */
const PUBLISHED_ONLY = '!(_id in path("drafts.**"))';

const isDev = import.meta.env?.DEV === true;

/* Only skip the published-only filter when drafts can actually come back —
   i.e. in dev WITH a token. Without one the perspective is `published`
   anyway, so dropping the filter would gain nothing. */
const includeDrafts = draftsVisible;

interface SanityDoc {
  _id: string;
  slug?: { current?: string };
  body?: unknown[];
  [key: string]: any;
}

/**
 * Shared loader body. The collections differ only in their GROQ projection
 * and in how a document maps onto the Zod schema, so everything else is here.
 */
function sanityLoader(options: {
  name: string;
  type: string;
  projection: string;
  /** Map a raw Sanity document onto the shape the Zod schema expects. */
  toData: (doc: SanityDoc, isDraft: boolean) => Record<string, unknown>;
  /** Collections whose entries have no rich-text body skip rendering. */
  hasBody?: boolean;
  /**
   * Where the entry id comes from. Defaults to the document's slug.
   *
   * A singleton — the announcement bar, say — has no slug because it has no
   * URL and there is only ever one of it. Such a type passes a constant here
   * instead, so the entry can still be looked up by a stable id.
   */
  idFrom?: (doc: SanityDoc) => string | undefined;
}): Loader {
  const {
    name,
    type,
    projection,
    toData,
    hasBody = true,
    idFrom = (doc) => doc.slug?.current,
  } = options;

  return {
    name,

    async load({ store, logger, parseData }: LoaderContext) {
      store.clear();

      if (!sanityConfigured || !sanityClient) {
        /*
         * Under `astro dev`, warn and carry on: a fresh clone with no
         * credentials should still start, so someone can work on the header
         * without a Sanity account.
         *
         * In a production build, FAIL. This used to warn here too, and that
         * was a genuine bug: a build with no credentials produced a complete
         * site with an empty blog, an empty careers page and no case studies,
         * exited 0, and handed a deployable `dist/` to the FTP step. The one
         * thing that caught it was `check-links.mjs` noticing two hardcoded
         * case-study links in `config/portfolio.ts` — pure luck. Remove those
         * two links and a misconfigured deploy would have gone green and
         * replaced the live site with a hollow one.
         *
         * Never let a missing credential be quieter than a broken link.
         */
        if (isDev) {
          logger.warn(
            `Sanity is not configured — "${name}" is empty. Set SANITY_PROJECT_ID in .env to load content.`
          );
          return;
        }

        throw new Error(
          `Sanity is not configured, so "${name}" would be empty and this build would ` +
            `produce a site with no content.\n\n` +
            `  SANITY_PROJECT_ID is missing or blank.\n\n` +
            `  Locally: copy .env.example to .env and fill it in.\n` +
            `  In CI:   add SANITY_PROJECT_ID and SANITY_DATASET as repository secrets\n` +
            `           (Settings -> Secrets and variables -> Actions -> Repository secrets).\n` +
            `           Environment secrets do NOT reach a job with no environment set.`
        );
      }

      const filter = includeDrafts ? '' : ` && ${PUBLISHED_ONLY}`;
      const query = `*[_type == "${type}"${filter}]{ ${projection} }`;

      let docs: SanityDoc[];
      try {
        docs = await sanityClient.fetch<SanityDoc[]>(query);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;

        /*
         * A 401 here almost always means a revoked or mistyped token, not a
         * missing one — the dataset is public, so with NO token these queries
         * succeed. Sending a dead one is worse than sending none, and Sanity
         * reports it as "Unauthorized - Session not found", which reads like a
         * login problem and sends you looking in the wrong place.
         *
         * Failing rather than dropping the token and retrying is deliberate:
         * a credential that was configured on purpose and no longer works is
         * something you want to be told about, not something to paper over.
         */
        if (status === 401) {
          throw new Error(
            `Sanity rejected the credentials while loading "${name}".\n\n` +
              `  SANITY_READ_TOKEN is set but is not valid — most likely revoked.\n\n` +
              `  This dataset is public, so the token is OPTIONAL: it is only needed to\n` +
              `  preview unpublished drafts under \`astro dev\`. Either clear\n` +
              `  SANITY_READ_TOKEN in .env, or replace it with a fresh Viewer token from\n` +
              `  sanity.io/manage -> API -> Tokens.`
          );
        }

        /* Fail the build. A network blip that silently produced an empty blog
           would deploy a site with every post missing and no error anywhere. */
        throw new Error(`Failed to load "${name}" from Sanity: ${(error as Error).message}`);
      }

      /* In dev both a draft and its published twin come back for the same
         slug. Keep the draft — it is the newer text, and previewing edits is
         the entire reason drafts are loaded at all. */
      const bySlug = new Map<string, { doc: SanityDoc; isDraft: boolean }>();
      for (const doc of docs) {
        const slug = idFrom(doc);
        if (!slug) {
          logger.warn(`Skipped a ${type} with no slug (_id: ${doc._id}) — the slug is its id.`);
          continue;
        }
        const isDraft = doc._id.startsWith('drafts.');
        const existing = bySlug.get(slug);
        if (!existing || isDraft) bySlug.set(slug, { doc, isDraft });
      }

      for (const [slug, { doc, isDraft }] of bySlug) {
        /* Throws on a schema violation, failing the build with the field name
           and the offending document. This is the guard rail. */
        const data = await parseData({ id: slug, data: toData(doc, isDraft) });

        if (!hasBody) {
          store.set({ id: slug, data });
          continue;
        }

        const blocks = (doc.body ?? []) as never[];
        const { html, headings } = renderBody(blocks);

        store.set({
          id: slug,
          data,
          /* Plain text, for `readingTime()`. */
          body: toPlainText(blocks),
          rendered: { html, metadata: { headings } },
        });
      }

      logger.info(`Loaded ${bySlug.size} ${type} document(s) from Sanity.`);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Blog                                                                */
/* ------------------------------------------------------------------ */
export const sanityPosts = (): Loader =>
  sanityLoader({
    name: 'sanity:blog',
    type: 'post',
    projection: `
      _id, slug, title, description, pubDate, updatedDate,
      category, tags, author, tint, cover, body
    `,
    toData: (doc, isDraft) => ({
      title: doc.title,
      description: doc.description,
      pubDate: doc.pubDate,
      /* Sanity omits an unset date rather than sending null, and the Zod
         field is `.optional()` — so leave it out entirely when unset. */
      ...(doc.updatedDate ? { updatedDate: doc.updatedDate } : {}),
      category: doc.category,
      tags: doc.tags ?? [],
      author: doc.author ?? 'Aniwala Studios',
      tint: doc.tint ?? '210 70% 22%',
      ...(doc.cover ? { cover: doc.cover } : {}),
      draft: isDraft,
    }),
  });

/* ------------------------------------------------------------------ */
/* Case studies                                                        */
/* ------------------------------------------------------------------ */
export const sanityCaseStudies = (): Loader =>
  sanityLoader({
    name: 'sanity:case-studies',
    type: 'caseStudy',
    projection: `
      _id, slug, title, description, kind, client, sector, year,
      services, deliverables, tools, results, tint, featured, cover, body
    `,
    toData: (doc, isDraft) => ({
      title: doc.title,
      description: doc.description,
      kind: doc.kind,
      client: doc.client,
      sector: doc.sector,
      year: doc.year,
      services: doc.services ?? [],
      deliverables: doc.deliverables ?? [],
      tools: doc.tools ?? [],
      results: doc.results ?? [],
      tint: doc.tint ?? '210 70% 22%',
      featured: doc.featured ?? false,
      ...(doc.cover ? { cover: doc.cover } : {}),
      draft: isDraft,
    }),
  });

/* ------------------------------------------------------------------ */
/* Open roles                                                          */
/* ------------------------------------------------------------------ */
export const sanityRoles = (): Loader =>
  sanityLoader({
    name: 'sanity:roles',
    type: 'role',
    hasBody: false,
    projection: `
      _id, slug, title, discipline, kind, location, experience, openings,
      posted, closes, tint, summary, about, responsibilities, requirements,
      niceToHave, software, reelNote
    `,
    toData: (doc, isDraft) => ({
      title: doc.title,
      discipline: doc.discipline,
      kind: doc.kind,
      location: doc.location,
      experience: doc.experience,
      openings: doc.openings ?? 1,
      posted: doc.posted,
      ...(doc.closes ? { closes: doc.closes } : {}),
      tint: doc.tint ?? '265 60% 28%',
      summary: doc.summary,
      about: doc.about,
      responsibilities: doc.responsibilities ?? [],
      requirements: doc.requirements ?? [],
      ...(doc.niceToHave?.length ? { niceToHave: doc.niceToHave } : {}),
      software: doc.software ?? [],
      reelNote: doc.reelNote,
      draft: isDraft,
    }),
  });

/* ------------------------------------------------------------------ */
/* Team                                                                */
/* ------------------------------------------------------------------ */
export const sanityTeam = (): Loader =>
  sanityLoader({
    name: 'sanity:team',
    type: 'teamMember',
    hasBody: false,
    projection: `
      _id, slug, name, role, bio, photo, href, order
    `,
    toData: (doc, isDraft) => ({
      name: doc.name,
      role: doc.role,
      bio: doc.bio,
      ...(doc.photo ? { photo: doc.photo } : {}),
      ...(doc.href ? { href: doc.href } : {}),
      order: doc.order ?? 50,
      draft: isDraft,
    }),
  });

/* ------------------------------------------------------------------ */
/* Announcement bar (singleton)                                        */
/* ------------------------------------------------------------------ */
export const sanityAnnouncement = (): Loader =>
  sanityLoader({
    name: 'sanity:announcement',
    type: 'announcement',
    hasBody: false,
    /* No slug: there is one of these and it has no URL. A constant id keeps
       it addressable as `getEntry('announcement', 'announcement')`. */
    idFrom: () => 'announcement',
    projection: `_id, enabled, text, cta, href, id`,
    toData: (doc, isDraft) => ({
      enabled: doc.enabled ?? false,
      text: doc.text ?? '',
      cta: doc.cta ?? '',
      href: doc.href ?? '',
      id: doc.id ?? 'announcement',
      draft: isDraft,
    }),
  });

/* ------------------------------------------------------------------ */
/* Artwork — one image per named slot                                  */
/* ------------------------------------------------------------------ */
export const sanityArtwork = (): Loader =>
  sanityLoader({
    name: 'sanity:artwork',
    type: 'artwork',
    hasBody: false,
    /* Keyed by slot, not by slug: the slot IS the address. Two documents
       filed against the same slot collapse to one, which is the documented
       behaviour rather than an accident. */
    idFrom: (doc) => doc.slot,
    projection: `_id, slot, image, alt`,
    toData: (doc, isDraft) => ({
      slot: doc.slot,
      image: doc.image,
      alt: doc.alt ?? '',
      draft: isDraft,
    }),
  });

/* ------------------------------------------------------------------ */
/* Portfolio pieces                                                    */
/* ------------------------------------------------------------------ */
export const sanityPieces = (): Loader =>
  sanityLoader({
    name: 'sanity:pieces',
    type: 'piece',
    hasBody: false,
    projection: `
      _id, slug, title, category, blurb, image, kind, client, year,
      tools, caseStudy, tint, wide, order
    `,
    toData: (doc, isDraft) => ({
      title: doc.title,
      category: doc.category,
      blurb: doc.blurb,
      ...(doc.image ? { image: doc.image } : {}),
      kind: doc.kind,
      client: doc.client,
      year: doc.year,
      tools: doc.tools ?? [],
      ...(doc.caseStudy ? { caseStudy: doc.caseStudy } : {}),
      tint: doc.tint ?? '210 70% 22%',
      wide: doc.wide ?? false,
      order: doc.order ?? 50,
      draft: isDraft,
    }),
  });

/* ------------------------------------------------------------------ */
/* Proof — testimonials, clients, milestones                           */
/* ------------------------------------------------------------------ */
export const sanityTestimonials = (): Loader =>
  sanityLoader({
    name: 'sanity:testimonials',
    type: 'testimonial',
    hasBody: false,
    /* No slug field: a testimonial has no URL. The document id is unique
       already, so it doubles as the entry id. */
    idFrom: (doc) => doc._id.replace(/^drafts\./, ''),
    projection: `_id, quote, name, role, company, order`,
    toData: (doc, isDraft) => ({
      quote: doc.quote,
      name: doc.name,
      role: doc.role,
      company: doc.company,
      order: doc.order ?? 50,
      draft: isDraft,
    }),
  });

export const sanityClients = (): Loader =>
  sanityLoader({
    name: 'sanity:clients',
    type: 'client',
    hasBody: false,
    idFrom: (doc) => doc._id.replace(/^drafts\./, ''),
    projection: `_id, name, logo, order`,
    toData: (doc, isDraft) => ({
      name: doc.name,
      ...(doc.logo ? { logo: doc.logo } : {}),
      order: doc.order ?? 50,
      draft: isDraft,
    }),
  });

export const sanityMilestones = (): Loader =>
  sanityLoader({
    name: 'sanity:milestones',
    type: 'milestone',
    hasBody: false,
    idFrom: (doc) => doc._id.replace(/^drafts\./, ''),
    projection: `_id, when, title, body, order`,
    toData: (doc, isDraft) => ({
      when: doc.when,
      title: doc.title,
      body: doc.body,
      order: doc.order ?? 50,
      draft: isDraft,
    }),
  });

/* ------------------------------------------------------------------ */
/* FAQs — service and careers, separated by `scope`                    */
/* ------------------------------------------------------------------ */
export const sanityFaqs = (): Loader =>
  sanityLoader({
    name: 'sanity:faqs',
    type: 'faq',
    hasBody: false,
    idFrom: (doc) => doc._id.replace(/^drafts\./, ''),
    projection: `_id, scope, question, answer, order`,
    toData: (doc, isDraft) => ({
      scope: doc.scope,
      question: doc.question,
      answer: doc.answer,
      order: doc.order ?? 50,
      draft: isDraft,
    }),
  });

/* ------------------------------------------------------------------ */
/* Singletons — contact details and site copy                          */
/* ------------------------------------------------------------------ */
export const sanityContactDetails = (): Loader =>
  sanityLoader({
    name: 'sanity:contact',
    type: 'contactDetails',
    hasBody: false,
    idFrom: () => 'contactDetails',
    projection: `_id, email, careersEmail, addressLines, country, socials`,
    toData: (doc, isDraft) => ({
      email: doc.email,
      careersEmail: doc.careersEmail,
      addressLines: doc.addressLines ?? [],
      country: doc.country ?? 'India',
      socials: (doc.socials ?? []).map((s: Record<string, unknown>) => ({
        icon: s.icon,
        label: s.label,
        href: s.href ?? '',
      })),
      draft: isDraft,
    }),
  });

export const sanitySiteCopy = (): Loader =>
  sanityLoader({
    name: 'sanity:copy',
    type: 'siteCopy',
    hasBody: false,
    idFrom: () => 'siteCopy',
    projection: `_id, positioning, teamIntro, marqueeItems, capabilities`,
    toData: (doc, isDraft) => ({
      positioning: doc.positioning ?? '',
      teamIntro: doc.teamIntro ?? '',
      marqueeItems: doc.marqueeItems ?? [],
      capabilities: doc.capabilities ?? [],
      draft: isDraft,
    }),
  });
