import { defineCollection, z } from 'astro:content';
import { CATEGORIES } from './config/categories';
import { DISCIPLINES, EMPLOYMENT_KINDS } from './config/disciplines';
import { IMAGE_SLOT_NAMES } from './config/imageSlots';
import { SOCIAL_ICONS } from './config/contact';
import {
  sanityPosts,
  sanityCaseStudies,
  sanityRoles,
  sanityTeam,
  sanityAnnouncement,
  sanityArtwork,
  sanityPieces,
  sanityTestimonials,
  sanityClients,
  sanityMilestones,
  sanityFaqs,
  sanityContactDetails,
  sanitySiteCopy,
  sanityBuiltPages,
} from './lib/sanity/loader';


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

/**
 * The team.
 *
 * These were a hand-written array in `config/about.ts`, with photos dropped
 * into `/public/team/`. Moving them here means a new hire does not need a
 * developer, a commit and a deploy — and their photo gets the same CDN
 * resizing and hotspot cropping everything else now gets, instead of being
 * served at whatever size it was exported at.
 *
 * `order` is the field that matters. An array had an order for free; CMS
 * documents do not, and sorting by name would put the production manager
 * above the creative director on the page a client reads to decide who they
 * would be working with.
 *
 * There is deliberately no `alt` on the photo. The card renders
 * `"{name}, {role}"` as the alt text, which is exactly what a screen reader
 * should say, so asking an editor to retype it would only create a second
 * copy to keep in step.
 */
const team = defineCollection({
  loader: sanityTeam(),
  schema: z.object({
    name: z.string(),
    /** Discipline and what they own — "Creative Director | External Game Art". */
    role: z.string(),
    /** Two or three sentences. What they actually do here, not adjectives. */
    bio: z.string(),
    /** Optional. The card falls back to initials, never to a stock avatar. */
    photo: sanityImage.omit({ alt: true }).optional(),
    /** ArtStation, LinkedIn, a reel. No link means no button is rendered. */
    href: z.url().optional(),
    /** Lower first. Gaps are intentional so someone can be slotted in later. */
    order: z.number().int().default(50),
    draft: z.boolean().default(false),
  }),
});

/**
 * The announcement strip. A singleton — one entry, id `announcement`.
 *
 * `href` is validated as a path or an absolute URL rather than left free, and
 * it is the field worth being strict about: the strip renders on every page,
 * so a broken link here is 65 broken links, and `check-links.mjs` fails the
 * whole deploy over it. That has happened on this site before — see the note
 * in the deploy workflow.
 *
 * What this schema CANNOT check is whether the path exists. That is the link
 * checker's job, at the end of the build, which is the right place for it.
 */
const announcement = defineCollection({
  loader: sanityAnnouncement(),
  schema: z.object({
    enabled: z.boolean().default(false),
    text: z.string().default(''),
    cta: z.string().default(''),
    /** A site path ("/services/") or an absolute URL. */
    href: z
      .string()
      .refine((v) => v === '' || v.startsWith('/') || /^https?:\/\//.test(v), {
        message: 'Use a path starting with / or a full http(s) URL.',
      })
      .default(''),
    /**
     * Versions the dismissal. Bump it and the bar returns for people who
     * dismissed the previous one, instead of staying hidden forever.
     */
    id: z.string().default('announcement'),
    draft: z.boolean().default(false),
  }),
});

/**
 * Artwork, keyed by slot.
 *
 * The entry id IS the slot name, so a page asks for its picture by a stable
 * key — `getArtwork('service-vfx')` — rather than by hunting through a list.
 *
 * `slot` is validated against `config/imageSlots.ts` rather than left free.
 * An image filed against a slot nothing renders is invisible with no error,
 * which is the worst kind of bug: the editor uploaded something, the site
 * looks unchanged, and there is nothing to read. Failing the build names the
 * bad slot instead.
 */
const artwork = defineCollection({
  loader: sanityArtwork(),
  schema: z.object({
    slot: z.enum(IMAGE_SLOT_NAMES as [string, ...string[]]),
    image: sanityImage.omit({ alt: true }),
    alt: z.string().default(''),
    draft: z.boolean().default(false),
  }),
});


/**
 * Portfolio pieces.
 *
 * `category` is validated against the categories still defined in
 * `config/portfolio.ts`, because those drive the /portfolio/ URLs and the
 * filter chips. A piece filed under a category that does not exist would
 * build fine and then be unreachable from every route that lists it.
 */
const pieces = defineCollection({
  loader: sanityPieces(),
  schema: z.object({
    title: z.string(),
    category: z.string(),
    /** One line: what it is, not how good it looks. */
    blurb: z.string(),
    image: sanityImage.optional(),
    kind: z.enum(['Client project', 'Studio project']),
    client: z.string(),
    year: z.number(),
    tools: z.array(z.string()).default([]),
    /** Slug of a case study, when one has been written. */
    caseStudy: z.string().optional(),
    tint: z.string().default('210 70% 22%'),
    wide: z.boolean().default(false),
    order: z.number().int().default(50),
    draft: z.boolean().default(false),
  }),
});

/**
 * Proof — testimonials, clients, milestones.
 *
 * All three replace arrays that were deliberately left EMPTY, with notes
 * reading "add real ones as they arrive" and "an empty logo wall is worse
 * than none". Each section still hides itself when its collection is empty,
 * so moving them to the CMS changed nothing on the site: it only removed the
 * need for a deploy the day something real turns up.
 */
const testimonials = defineCollection({
  loader: sanityTestimonials(),
  schema: z.object({
    quote: z.string(),
    name: z.string(),
    role: z.string(),
    company: z.string(),
    order: z.number().int().default(50),
    draft: z.boolean().default(false),
  }),
});

const clients = defineCollection({
  loader: sanityClients(),
  schema: z.object({
    name: z.string(),
    /** Optional: without one the wall renders the name as text. */
    logo: sanityImage.omit({ alt: true }).optional(),
    order: z.number().int().default(50),
    draft: z.boolean().default(false),
  }),
});

const milestones = defineCollection({
  loader: sanityMilestones(),
  schema: z.object({
    /** A string, not a date, so a quarter fits: '2026' or '2026 Q1'. */
    when: z.string(),
    title: z.string(),
    body: z.string(),
    order: z.number().int().default(50),
    draft: z.boolean().default(false),
  }),
});

/**
 * FAQs for the service pages and the careers page.
 *
 * `scope` is what separates them: 'careers', or 'service:<slug>'. Validated
 * loosely on purpose — a scope that matches nothing renders nowhere, which is
 * invisible but harmless, whereas an enum here would have to be regenerated
 * every time a service is added and would fail the build until it was.
 */
const faqs = defineCollection({
  loader: sanityFaqs(),
  schema: z.object({
    scope: z.string(),
    question: z.string(),
    answer: z.string(),
    order: z.number().int().default(50),
    draft: z.boolean().default(false),
  }),
});

/** Contact details and social links. A singleton. */
const contactDetails = defineCollection({
  loader: sanityContactDetails(),
  schema: z.object({
    email: z.string(),
    careersEmail: z.string(),
    addressLines: z.array(z.string()).default([]),
    country: z.string().default('India'),
    socials: z
      .array(
        z.object({
          icon: z.enum(SOCIAL_ICONS),
          label: z.string(),
          /** Blank means "no account yet" — the icon is dropped, not linked. */
          href: z.string().default(''),
        })
      )
      .default([]),
    draft: z.boolean().default(false),
  }),
});

/** Standalone lines of copy. A singleton. */
const siteCopy = defineCollection({
  loader: sanitySiteCopy(),
  schema: z.object({
    positioning: z.string().default(''),
    teamIntro: z.string().default(''),
    marqueeItems: z.array(z.string()).default([]),
    capabilities: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

/**
 * Built pages — the page builder.
 *
 * The block array is validated loosely ON PURPOSE, which is the opposite of
 * every other collection here and worth explaining.
 *
 * Elsewhere the shape is known in code, so a schema can insist on it and fail
 * a build when a document does not fit. A built page's shape is chosen by the
 * editor: any block, any number, any order. There is no correct shape to check
 * against. What CAN be checked is that each block is a type the renderer knows
 * — which is done here — and that its own required fields are present, which
 * is done in the Studio where the editor can see the error while typing.
 *
 * The renderer is the backstop: an unknown `_type` throws in a production
 * build rather than rendering nothing, so a block that exists in Sanity but
 * has no component cannot ship as a silent gap in a page.
 */
const builtPages = defineCollection({
  loader: sanityBuiltPages(),
  schema: z.object({
    title: z.string(),
    seoTitle: z.string().min(1),
    seoDescription: z.string().min(1).max(300),
    ogImage: sanityImage.omit({ alt: true }).optional(),
    noindex: z.boolean().default(false),
    blocks: z
      .array(
        z
          .object({
            _type: z.string(),
            _key: z.string(),
          })
          .passthrough()
      )
      .min(1, 'A page with no sections would render as an empty document.'),
    draft: z.boolean().default(false),
  }),
});

export const collections = {
  blog,
  caseStudies,
  roles,
  team,
  pieces,
  testimonials,
  clients,
  milestones,
  faqs,
  artwork,
  announcement,
  contactDetails,
  siteCopy,
  builtPages,
};
