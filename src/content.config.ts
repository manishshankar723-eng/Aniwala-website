import { defineCollection, z } from 'astro:content';
import { CATEGORIES } from './config/categories';
import { DISCIPLINES, EMPLOYMENT_KINDS } from './config/disciplines';
import { sanityPosts, sanityCaseStudies, sanityRoles } from './lib/sanity/loader';

/**
 * WHERE CONTENT COMES FROM
 *
 * These collections used to read Markdown files from `src/content/`. They now
 * read from Sanity at build time — see `lib/sanity/loader.ts` for how, and for
 * why the loaders bend over backwards to keep the entry shape identical.
 *
 * The schemas below did NOT become decoration when the files went away. They
 * are the only thing standing between a CMS document and the live site, and
 * they run on every build: `parseData()` in the loader validates each document
 * against the schema here and throws if it does not fit. A missing field fails
 * the build in CI, before the deploy job can FTP it to `public_html`.
 *
 * That matters more now than it did with Markdown. When content lived in this
 * repo, a bad post came with a diff and a review. Now someone can publish from
 * a browser, and these schemas are the review.
 *
 * KEEP THESE IN STEP WITH THE STUDIO. The field definitions in `studio/schemas/`
 * decide what an editor can type; the schemas here decide what the site will
 * accept. When they disagree, the build fails — noisy, but late. Change both.
 */

/**
 * A Sanity image reference.
 *
 * Kept loose on purpose. Sanity attaches hotspot and crop metadata that the
 * URL builder in `lib/sanity/client.ts` consumes and nothing here needs to
 * understand, so validating its internals would only create a second place to
 * update whenever Sanity adds a field.
 *
 * `alt` is the exception and is REQUIRED. It is the one part of an image a
 * machine cannot supply, the Studio schema marks it required too, and an
 * image published without it is an accessibility defect that no test catches.
 */
const sanityImage = z
  .object({
    asset: z.object({ _ref: z.string() }).passthrough(),
    alt: z.string().min(1, 'Every image needs alt text.'),
  })
  .passthrough();

/**
 * The blog.
 *
 * The Sanity slug becomes the entry id, which becomes the URL — a post with
 * slug `pipeline-notes` renders at `/blog/pipeline-notes/`. Changing a slug in
 * the Studio breaks that post's existing links, exactly as renaming the file
 * used to. The Studio warns about this; nothing here can enforce it.
 *
 * Reading time is NOT stored. It is counted from the body at build time in
 * `lib/posts.ts`, because a hand-typed number goes stale the moment anyone
 * edits a paragraph.
 */
const blog = defineCollection({
  loader: sanityPosts(),
  schema: z.object({
    title: z.string(),
    /**
     * Shown on cards AND used as the meta description.
     *
     * Google truncates around 160 characters, and the Studio warns past that
     * while you type. It is NOT a hard limit here, deliberately: a 165-
     * character description is slightly worse, not broken, and failing a
     * production build over it would block a deploy for a copy-editing
     * nitpick. The cap below is a different thing — it catches somebody
     * pasting a paragraph into the field, which does render badly.
     *
     * Compare `posted` on the roles collection, which IS strict, because a
     * malformed date there silently removes the job from Google entirely.
     * Hard-fail what is broken; warn about what is merely worse.
     */
    description: z.string().min(1).max(300, 'This is a summary line, not a paragraph — keep it under ~160 for search results.'),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    /** One only. Drives the category filter pages. */
    category: z.enum(CATEGORIES),
    tags: z.array(z.string()).default([]),
    author: z.string().default('Aniwala Studios'),
    /** Card and hero artwork. Falls back to the `tint` placeholder when unset. */
    cover: sanityImage.optional(),
    /**
     * HSL triple for the card's placeholder art, e.g. '210 70% 22%'.
     * Still used wherever `cover` is unset, and behind a cover while it loads.
     */
    tint: z.string().default('210 70% 22%'),
    /**
     * Set by the loader from Sanity's own draft state, not typed by anyone.
     * Unpublished documents are visible under `astro dev` and excluded from
     * production builds.
     */
    draft: z.boolean().default(false),
  }),
});

/**
 * Case studies — one project each.
 *
 * `kind` is not decoration. A new studio's own pieces belong in the portfolio,
 * but a visitor must never mistake one for commissioned work, so every card
 * and page renders this badge. Set 'Client project' only when there was a
 * client, and only when they have agreed to be named.
 */
const caseStudies = defineCollection({
  loader: sanityCaseStudies(),
  schema: z.object({
    title: z.string(),
    /** One line. Used on cards and as the meta description. See the note on
        the blog collection's `description` for why 300 and not 160. */
    description: z.string().min(1).max(300, 'This is a summary line, not a paragraph — keep it under ~160 for search results.'),
    kind: z.enum(['Client project', 'Studio project']),
    /** Who it was for. Use the studio's own name on a self-directed piece. */
    client: z.string(),
    /** Their industry, or the format — 'Mobile game', 'Broadcast', 'Short film'. */
    sector: z.string(),
    year: z.number(),
    /** Slugs from config/services.ts. Drive the cross-links back to services. */
    services: z.array(z.string()).default([]),
    /** Plain-English list of what was actually handed over. */
    deliverables: z.array(z.string()).default([]),
    tools: z.array(z.string()).default([]),
    /**
     * Two or three factual outcomes. Shot counts, asset counts, runtimes —
     * things that can be pointed at. NOT invented percentages.
     */
    results: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
    cover: sanityImage.optional(),
    /** HSL triple for the placeholder art, e.g. '210 70% 22%'. */
    tint: z.string().default('210 70% 22%'),
    /** Pins the study to the top of every listing. */
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

/**
 * Open roles.
 *
 * These lived in `config/careers.ts` as a hand-edited TypeScript array. They
 * moved here so that hiring does not require a developer — which was the whole
 * point of the CMS — and the validation below is what makes that safe.
 *
 * READ THIS BEFORE LOOSENING ANYTHING. Every role emits `JobPosting`
 * structured data, and that is how these listings reach Google's job results.
 * Google silently ignores a posting with a malformed or missing `datePosted`;
 * there is no error, the page simply never appears in the jobs index and no
 * one finds out for weeks. `posted` is therefore validated as a real ISO date
 * rather than accepted as a string. `kind` is an enum because it maps to the
 * exact string Google expects in `employmentType`, and `discipline` is one so
 * that a typo cannot split the derived filter row into two near-identical
 * chips.
 *
 * The honesty rule from the old config still stands and cannot be enforced by
 * a schema: close a role by UNPUBLISHING it, not by leaving it up with a note.
 * A listing still live three months after it was filled is the fastest way to
 * lose the next good applicant.
 */
const roles = defineCollection({
  loader: sanityRoles(),
  schema: z.object({
    /** The job title as it would appear on a contract. */
    title: z.string(),
    /** Constrained to the list in config/disciplines.ts. */
    discipline: z.enum(DISCIPLINES),
    kind: z.enum(EMPLOYMENT_KINDS),
    /** Human-readable. Say "on-site" or "remote" plainly — people filter on it. */
    location: z.string(),
    /** A band, not a number. "2–5 years" is honest; "3 years" is a lie by precision. */
    experience: z.string(),
    /** How many seats. Rendered as "2 openings". */
    openings: z.number().int().positive().default(1),
    /**
     * ISO date the listing went up, emitted as `datePosted`.
     * Validated strictly: Google drops postings it cannot parse, without
     * telling anyone.
     */
    posted: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD — this is emitted as datePosted.'),
    /** Optional ISO date the listing expires. Emitted as `validThrough`. */
    closes: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD — this is emitted as validThrough.')
      .optional(),
    /** HSL triple driving the page tint, same as the service pages. */
    tint: z.string().default('265 60% 28%'),
    /** One line under the title, in listings and cards. */
    summary: z.string(),
    /** Two or three sentences of real context: the work, not the adjectives. */
    about: z.string(),
    /** What the person actually does, day to day. */
    responsibilities: z.array(z.string()).min(1),
    /** The floor. If someone missing one of these should still apply, say so. */
    requirements: z.array(z.string()).min(1),
    /** Genuinely optional. Never park a real requirement here. */
    niceToHave: z.array(z.string()).optional(),
    /** Software they will be in every day. */
    software: z.array(z.string()).default([]),
    /**
     * What to put in the portfolio for THIS role.
     *
     * The single most useful line on a creative job ad and the one almost
     * nobody writes. An animator and a character artist are judged on
     * entirely different things, and saying which saves everyone a round.
     */
    reelNote: z.string(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, caseStudies, roles };
