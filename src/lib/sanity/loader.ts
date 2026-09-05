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
import { sanityClient, sanityConfigured, draftsVisible, previewMode } from './client';
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
      const bySlug = new Map<
        string,
        { doc: SanityDoc; isDraft: boolean; published?: SanityDoc }
      >();
      for (const doc of docs) {
        const slug = idFrom(doc);
        if (!slug) {
          logger.warn(`Skipped a ${type} with no slug (_id: ${doc._id}) — the slug is its id.`);
          continue;
        }
        const isDraft = doc._id.startsWith('drafts.');
        const existing = bySlug.get(slug);

        if (isDraft) {
          /* The draft wins, but the published twin is kept beside it. A
             half-finished draft is normal — someone is mid-edit — and preview
             needs something to fall back to rather than dying. */
          bySlug.set(slug, { doc, isDraft: true, published: existing?.doc });
        } else if (!existing) {
          bySlug.set(slug, { doc, isDraft: false });
        } else if (existing.isDraft) {
          bySlug.set(slug, { ...existing, published: doc });
        }
      }

      for (const [slug, { doc, isDraft, published }] of bySlug) {
        /*
         * Validation, and it behaves differently in a preview.
         *
         * On a LIVE build a schema violation throws, naming the field and the
         * document. That is the guard rail and it must stay: publishing a
         * document with a required field missing should stop the deploy.
         *
         * In a PREVIEW it must not. A draft is unfinished BY DEFINITION —
         * somebody is typing into it right now — and one incomplete draft
         * taking down the whole preview site is the fastest way to make the
         * review workflow useless. So preview falls back to the published
         * version of that document and says loudly which draft is not ready.
         * If there is no published version, the entry is skipped.
         *
         * This is not a loosening of the rules. The draft still cannot be
         * published while it fails, because publishing rebuilds the live site,
         * which validates strictly and refuses it.
         */
        let data;
        try {
          data = await parseData({ id: slug, data: toData(doc, isDraft) });
        } catch (error) {
          if (!previewMode) throw error;

          const why = (error as Error).message.split(String.fromCharCode(10))[0];

          if (published) {
            logger.warn(
              `Draft "${slug}" (${type}) is not ready — showing the published version instead. ${why}`
            );
            data = await parseData({ id: slug, data: toData(published, false) });
          } else {
            logger.warn(`Draft "${slug}" (${type}) is not ready and has never been published — skipped. ${why}`);
            continue;
          }
        }

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
      category, tags, author, tint, cover, body, seoTitle, seoDescription, ogImage, noindex, canonicalUrl
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
      ...(doc.seoTitle ? { seoTitle: doc.seoTitle } : {}),
      ...(doc.seoDescription ? { seoDescription: doc.seoDescription } : {}),
      ...(doc.ogImage ? { ogImage: doc.ogImage } : {}),
      noindex: doc.noindex ?? false,
      ...(doc.canonicalUrl ? { canonicalUrl: doc.canonicalUrl } : {}),
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
      services, deliverables, tools, results, tint, featured, cover, body,
      seoTitle, seoDescription, ogImage, noindex, canonicalUrl
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
      ...(doc.seoTitle ? { seoTitle: doc.seoTitle } : {}),
      ...(doc.seoDescription ? { seoDescription: doc.seoDescription } : {}),
      ...(doc.ogImage ? { ogImage: doc.ogImage } : {}),
      noindex: doc.noindex ?? false,
      ...(doc.canonicalUrl ? { canonicalUrl: doc.canonicalUrl } : {}),
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
      niceToHave, software, reelNote, seoTitle, seoDescription, ogImage, noindex, canonicalUrl
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
      ...(doc.seoTitle ? { seoTitle: doc.seoTitle } : {}),
      ...(doc.seoDescription ? { seoDescription: doc.seoDescription } : {}),
      ...(doc.ogImage ? { ogImage: doc.ogImage } : {}),
      noindex: doc.noindex ?? false,
      ...(doc.canonicalUrl ? { canonicalUrl: doc.canonicalUrl } : {}),
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
      _id, slug, title, "category": category->slug.current, blurb, image, kind,
      client, year, tools, caseStudy, tint, wide, order
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
    projection: `_id, email, careersEmail, legalName, addressLines, country, socials`,
    toData: (doc, isDraft) => ({
      email: doc.email,
      careersEmail: doc.careersEmail,
      legalName: doc.legalName ?? '',
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

/* ------------------------------------------------------------------ */
/* Built pages — the page builder                                      */
/* ------------------------------------------------------------------ */

/**
 * Pages assembled from blocks, rendered by the catch-all route.
 *
 * The projection dereferences nothing and flattens nothing: a block array is
 * heterogeneous by design and each block component knows how to read its own
 * shape. Trying to normalise that here would mean this file growing a branch
 * per block type, which is precisely the coupling the block components exist
 * to avoid.
 *
 * `_type` and `_key` are kept rather than stripped — the renderer dispatches
 * on `_type`, and `_key` is what makes a reordered array diff sanely.
 */
export const sanityBuiltPages = (): Loader =>
  sanityLoader({
    name: 'sanity:built-pages',
    type: 'page',
    hasBody: false,
    projection: `
      _id, title, slug, blocks, seoTitle, seoDescription, ogImage, noindex, canonicalUrl
    `,
    toData: (doc, isDraft) => ({
      title: doc.title,
      blocks: doc.blocks ?? [],
      seoTitle: doc.seoTitle,
      seoDescription: doc.seoDescription,
      ...(doc.ogImage ? { ogImage: doc.ogImage } : {}),
      noindex: doc.noindex ?? false,
      ...(doc.canonicalUrl ? { canonicalUrl: doc.canonicalUrl } : {}),
      draft: isDraft,
    }),
  });


/* ------------------------------------------------------------------ */
/* Careers page content (singleton)                                    */
/* ------------------------------------------------------------------ */

/**
 * Everything editable on the careers page except the roles themselves.
 *
 * The page stays a template — it filters listings, prefills the application
 * form and emits JobPosting data — so this carries its copy rather than its
 * shape. See the note on the Studio schema for why it is not a built page.
 */
export const sanityCareersContent = (): Loader =>
  sanityLoader({
    name: 'sanity:careers',
    type: 'careersContent',
    hasBody: false,
    idFrom: () => 'careersContent',
    /*
     * Everything, rather than a named list.
     *
     * This document carries the careers page's copy AND every string in the
     * application form — around eighty fields, and it grows whenever somebody
     * rewords a label. A hand-kept projection at that size stops being a
     * safeguard and becomes the bug: add a field in the Studio, forget this
     * line, and the site renders that field blank with nothing to read. The
     * Zod schema in `content.config.ts` is what actually decides which fields
     * are allowed through, and it drops the rest.
     */
    projection: `...`,
    toData: (doc, isDraft) => ({
      ...doc,
      hiringOpen: doc.hiringOpen ?? true,
      heroEyebrow: doc.heroEyebrow ?? '',
      heroTitle: doc.heroTitle ?? '',
      heroLead: doc.heroLead ?? '',
      heroStatDays: doc.heroStatDays ?? '',
      heroStatDaysLabel: doc.heroStatDaysLabel ?? '',
      heroStatMonths: doc.heroStatMonths ?? '',
      heroStatMonthsLabel: doc.heroStatMonthsLabel ?? '',
      heroActRoles: doc.heroActRoles ?? '',
      heroActOpen: doc.heroActOpen ?? '',
      rolesEyebrow: doc.rolesEyebrow ?? '',
      rolesTitle: doc.rolesTitle ?? '',
      rolesTitleEmpty: doc.rolesTitleEmpty ?? '',
      rolesLinkLabel: doc.rolesLinkLabel ?? '',
      emptyOpen: doc.emptyOpen ?? '',
      emptyPaused: doc.emptyPaused ?? '',
      emptyBody: doc.emptyBody ?? '',
      emptyAct: doc.emptyAct ?? '',
      specEyebrow: doc.specEyebrow ?? '',
      specTitle: doc.specTitle ?? '',
      specBody: doc.specBody ?? '',
      specAct: doc.specAct ?? '',
      studioEyebrow: doc.studioEyebrow ?? '',
      studioTitle: doc.studioTitle ?? '',
      studioNote: doc.studioNote ?? '',
      processEyebrow: doc.processEyebrow ?? '',
      processTitle: doc.processTitle ?? '',
      values: (doc.values ?? []).map((v: Record<string, any>) => ({
        title: v.title,
        body: v.body,
      })),
      hiringSteps: (doc.hiringSteps ?? []).map((h: Record<string, any>) => ({
        title: h.title,
        when: h.when,
        body: h.body,
      })),
      draft: isDraft,
    }),
  });

/* ------------------------------------------------------------------ */
/* Services — one document per discipline                              */
/* ------------------------------------------------------------------ */

/**
 * `related` is stored as references, so the projection dereferences them to
 * plain slugs. The page only ever needs the slug and the label, and resolving
 * that here means the template does not have to know Sanity has references at
 * all — it gets the same string array the old config exported.
 */
export const sanityServices = (): Loader =>
  sanityLoader({
    name: 'sanity:services',
    type: 'service',
    hasBody: false,
    projection: `
      _id, slug, title, label, shortName, article, tagline, intro, tint, order,
      offerings, pipeline, tools, deliverables,
      "related": related[]->slug.current, seoTitle, seoDescription, ogImage, noindex, canonicalUrl
    `,
    toData: (doc, isDraft) => ({
      title: doc.title,
      label: doc.label,
      shortName: doc.shortName,
      article: doc.article,
      tagline: doc.tagline,
      intro: doc.intro,
      tint: doc.tint,
      order: doc.order ?? 50,
      offerings: (doc.offerings ?? []).map((o: Record<string, any>) => ({
        title: o.title,
        body: o.body,
      })),
      pipeline: (doc.pipeline ?? []).map((p: Record<string, any>) => ({
        title: p.title,
        body: p.body,
        ...(p.tools ? { tools: p.tools } : {}),
      })),
      tools: doc.tools ?? [],
      deliverables: doc.deliverables ?? [],
      /* A reference that has been deleted comes back as null. Dropped rather
         than kept, because a related-services row linking to nothing is a
         dead card on a live page. */
      related: (doc.related ?? []).filter(Boolean),
      ...(doc.seoTitle ? { seoTitle: doc.seoTitle } : {}),
      ...(doc.seoDescription ? { seoDescription: doc.seoDescription } : {}),
      ...(doc.ogImage ? { ogImage: doc.ogImage } : {}),
      noindex: doc.noindex ?? false,
      ...(doc.canonicalUrl ? { canonicalUrl: doc.canonicalUrl } : {}),
      draft: isDraft,
    }),
  });

/* ------------------------------------------------------------------ */
/* Portfolio disciplines                                               */
/* ------------------------------------------------------------------ */
export const sanityWorkCategories = (): Loader =>
  sanityLoader({
    name: 'sanity:work-categories',
    type: 'workCategory',
    hasBody: false,
    projection: `
      _id, slug, title, shortName, blurb, intro, tint, wide, order,
      "services": services[]->slug.current, seoTitle, seoDescription, ogImage, noindex, canonicalUrl
    `,
    toData: (doc, isDraft) => ({
      title: doc.title,
      shortName: doc.shortName,
      blurb: doc.blurb,
      intro: doc.intro,
      tint: doc.tint,
      wide: doc.wide ?? false,
      order: doc.order ?? 50,
      services: (doc.services ?? []).filter(Boolean),
      ...(doc.seoTitle ? { seoTitle: doc.seoTitle } : {}),
      ...(doc.seoDescription ? { seoDescription: doc.seoDescription } : {}),
      ...(doc.ogImage ? { ogImage: doc.ogImage } : {}),
      noindex: doc.noindex ?? false,
      ...(doc.canonicalUrl ? { canonicalUrl: doc.canonicalUrl } : {}),
      draft: isDraft,
    }),
  });

/* ------------------------------------------------------------------ */
/* Book a call (singleton)                                             */
/* ------------------------------------------------------------------ */
export const sanityBookingSettings = (): Loader =>
  sanityLoader({
    name: 'sanity:booking',
    type: 'bookingSettings',
    hasBody: false,
    idFrom: () => 'bookingSettings',
    /* Everything, for the same reason careers does — see the note there.
       The widget's own wording lives on this document too, which is another
       thirty-odd fields nobody should have to list twice. */
    projection: `...`,
    toData: (doc, isDraft) => ({
      ...doc,
      hostName: doc.hostName,
      hostRole: doc.hostRole,
      ...(doc.hostPhoto ? { hostPhoto: doc.hostPhoto } : {}),
      callDurations: doc.callDurations ?? [15, 30, 45],
      dayStart: doc.dayStart ?? '09:00',
      dayEnd: doc.dayEnd ?? '18:00',
      stepMinutes: doc.stepMinutes ?? 30,
      closedDays: doc.closedDays ?? [],
      bookingWindowDays: doc.bookingWindowDays ?? 60,
      whatToExpect: doc.whatToExpect ?? [],
      enquiryTypes: doc.enquiryTypes ?? [],
      draft: isDraft,
    }),
  });

/* ------------------------------------------------------------------ */
/* Loading screen (singleton)                                          */
/* ------------------------------------------------------------------ */
export const sanityLoaderSettings = (): Loader =>
  sanityLoader({
    name: 'sanity:loader',
    type: 'loaderSettings',
    hasBody: false,
    idFrom: () => 'loaderSettings',
    projection: `_id, enabled, image, alt, maxDuration`,
    toData: (doc, isDraft) => ({
      enabled: doc.enabled ?? true,
      ...(doc.image ? { image: doc.image } : {}),
      alt: doc.alt ?? '',
      maxDuration: doc.maxDuration ?? 2200,
      draft: isDraft,
    }),
  });

/* ------------------------------------------------------------------ */
/* Navigation — header and footer menus (singleton)                    */
/* ------------------------------------------------------------------ */
export const sanityNavigation = (): Loader =>
  sanityLoader({
    name: 'sanity:navigation',
    type: 'navigation',
    hasBody: false,
    idFrom: () => 'navigation',
    projection: `_id, items, ctaLabel, ctaHref, searchPages`,
    toData: (doc, isDraft) => ({
      items: (doc.items ?? []).map((i: Record<string, any>) => ({
        label: i.label,
        ...(i.href ? { href: i.href } : {}),
        hiddenInHeader: i.hiddenInHeader ?? false,
        children: (i.children ?? []).map((c: Record<string, any>) => ({
          label: c.label,
          href: c.href ?? '',
          ...(c.blurb ? { blurb: c.blurb } : {}),
        })),
      })),
      ctaLabel: doc.ctaLabel,
      ctaHref: doc.ctaHref,
      searchPages: (doc.searchPages ?? []).map((p: Record<string, any>) => ({
        title: p.title,
        href: p.href,
        section: p.section,
        keywords: p.keywords ?? '',
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
    projection: `_id, positioning, teamIntro, marqueeItems, capabilities, processSteps, categoryBlurbs`,
    toData: (doc, isDraft) => ({
      positioning: doc.positioning ?? '',
      teamIntro: doc.teamIntro ?? '',
      marqueeItems: doc.marqueeItems ?? [],
      capabilities: doc.capabilities ?? [],
      processSteps: (doc.processSteps ?? []).map((p: Record<string, any>) => ({
        title: p.title,
        body: p.body,
      })),
      categoryBlurbs: (doc.categoryBlurbs ?? []).map((c: Record<string, any>) => ({
        category: c.category,
        blurb: c.blurb,
      })),
      draft: isDraft,
    }),
  });

/* ------------------------------------------------------------------ */
/* Engagement models                                                   */
/* ------------------------------------------------------------------ */
export const sanityEngagementModels = (): Loader =>
  sanityLoader({
    name: 'sanity:engagement',
    type: 'engagementModel',
    hasBody: false,
    idFrom: (doc) => doc._id.replace(/^drafts\./, ''),
    projection: `_id, title, body, bestFor, order`,
    toData: (doc, isDraft) => ({
      title: doc.title,
      body: doc.body,
      bestFor: doc.bestFor,
      order: doc.order ?? 50,
      draft: isDraft,
    }),
  });

/* ------------------------------------------------------------------ */
/* Logo and icons (singleton)                                          */
/* ------------------------------------------------------------------ */

/**
 * OPTIONAL, like the loading screen and unlike everything else here.
 *
 * A site with no `brand` document renders the built-in mark and the icons
 * committed in `public/` — which is exactly what it did before this document
 * existed. Failing a build over an absent logo would be failing over a
 * setting whose default is already correct.
 */
export const sanityBrand = (): Loader =>
  sanityLoader({
    name: 'sanity:brand',
    type: 'brand',
    hasBody: false,
    idFrom: () => 'brand',
    projection: `
      _id, logoDark, logoLight, showWordmark, wordmark, wordmarkSub,
      accentDark, accentLight, buttonFill, buttonInk,
      favicon, themeColor, themeColorLight, backgroundColor,
      appName, appShortName, appDescription
    `,
    toData: (doc, isDraft) => ({
      ...(doc.logoDark ? { logoDark: doc.logoDark } : {}),
      ...(doc.logoLight ? { logoLight: doc.logoLight } : {}),
      showWordmark: doc.showWordmark ?? true,
      wordmark: doc.wordmark ?? '',
      wordmarkSub: doc.wordmarkSub ?? '',
      accentDark: doc.accentDark ?? '',
      accentLight: doc.accentLight ?? '',
      buttonFill: doc.buttonFill ?? '',
      buttonInk: doc.buttonInk ?? '',
      ...(doc.favicon ? { favicon: doc.favicon } : {}),
      themeColor: doc.themeColor ?? '',
      themeColorLight: doc.themeColorLight ?? '',
      backgroundColor: doc.backgroundColor ?? '',
      appName: doc.appName ?? '',
      appShortName: doc.appShortName ?? '',
      appDescription: doc.appDescription ?? '',
      draft: isDraft,
    }),
  });

/* ------------------------------------------------------------------ */
/* Interface copy (singleton)                                          */
/* ------------------------------------------------------------------ */

/**
 * Every word the site says that is not attached to a piece of content.
 *
 * Projected wholesale for the reason the careers loader gives: this is two
 * hundred flat strings and a hand-kept list of their names would be the
 * least reliable thing in the file. The Zod schema decides what gets through.
 */
export const sanityUiCopy = (): Loader =>
  sanityLoader({
    name: 'sanity:ui-copy',
    type: 'uiCopy',
    hasBody: false,
    idFrom: () => 'uiCopy',
    projection: `...`,
    toData: (doc, isDraft) => ({ ...doc, draft: isDraft }),
  });

/* ------------------------------------------------------------------ */
/* Privacy policy (singleton)                                          */
/* ------------------------------------------------------------------ */

/**
 * The policy, as rich text.
 *
 * `hasBody` is false even though this document plainly has a body, because
 * that flag means "the body lives in a field called `body` and should be
 * rendered by the shared code path". It does not here: the field is projected
 * like any other and rendered by the page, which needs to substitute the
 * studio's address and inbox into it afterwards. Routing it through the
 * shared renderer would produce finished HTML with the tokens already
 * escaped into it and nowhere left to fill them in.
 */
export const sanityPrivacyPage = (): Loader =>
  sanityLoader({
    name: 'sanity:privacy',
    type: 'privacyPage',
    hasBody: false,
    idFrom: () => 'privacyPage',
    projection: `
      _id, eyebrow, title, lead, tint, lastUpdated, lastUpdatedLabel, body,
      contactHeading, contactLead, seoTitle, seoDescription, ogImage, noindex, canonicalUrl
    `,
    toData: (doc, isDraft) => ({
      eyebrow: doc.eyebrow,
      title: doc.title,
      lead: doc.lead,
      tint: doc.tint,
      lastUpdated: doc.lastUpdated,
      lastUpdatedLabel: doc.lastUpdatedLabel,
      body: doc.body ?? [],
      contactHeading: doc.contactHeading,
      contactLead: doc.contactLead,
      ...(doc.seoTitle ? { seoTitle: doc.seoTitle } : {}),
      ...(doc.seoDescription ? { seoDescription: doc.seoDescription } : {}),
      ...(doc.ogImage ? { ogImage: doc.ogImage } : {}),
      noindex: doc.noindex ?? false,
      ...(doc.canonicalUrl ? { canonicalUrl: doc.canonicalUrl } : {}),
      draft: isDraft,
    }),
  });
