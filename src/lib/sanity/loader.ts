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
import { sanityClient, sanityConfigured } from './client';
import { renderBody, toPlainText } from './portableText';

/**
 * Drafts are visible under `astro dev` and never in a production build — the
 * same rule the Markdown files had, so previewing unfinished writing works
 * the way it always did.
 *
 * Sanity models an unpublished document as a separate `drafts.<id>` record.
 * With a read token the API returns both, so production has to filter them
 * out explicitly; without a token it only ever sees published documents and
 * the filter costs nothing. Belt and braces, deliberately: the failure mode
 * of getting this wrong is publishing unfinished writing to a live site.
 */
const PUBLISHED_ONLY = '!(_id in path("drafts.**"))';

const isDev = import.meta.env?.DEV === true;

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
}): Loader {
  const { name, type, projection, toData, hasBody = true } = options;

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

      const filter = isDev ? '' : ` && ${PUBLISHED_ONLY}`;
      const query = `*[_type == "${type}"${filter}]{ ${projection} }`;

      let docs: SanityDoc[];
      try {
        docs = await sanityClient.fetch<SanityDoc[]>(query);
      } catch (error) {
        /* Fail the build. A network blip that silently produced an empty blog
           would deploy a site with every post missing and no error anywhere. */
        throw new Error(`Failed to load "${name}" from Sanity: ${(error as Error).message}`);
      }

      /* In dev both a draft and its published twin come back for the same
         slug. Keep the draft — it is the newer text, and previewing edits is
         the entire reason drafts are loaded at all. */
      const bySlug = new Map<string, { doc: SanityDoc; isDraft: boolean }>();
      for (const doc of docs) {
        const slug = doc.slug?.current;
        if (!slug) {
          logger.warn(`Skipped a ${type} with no slug (_id: ${doc._id}) — it has no URL.`);
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
