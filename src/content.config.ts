import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { CATEGORIES } from './config/categories';

/**
 * The blog.
 *
 * Posts are plain Markdown in `src/content/blog/`. The filename becomes the
 * URL — `pipeline-notes.md` renders at `/blog/pipeline-notes/` — so rename a
 * file only if you are willing to break its link.
 *
 * Reading time is NOT stored here. It is counted from the body at build time
 * in `src/lib/posts.ts`, because a hand-typed number goes stale the moment
 * anyone edits a paragraph.
 */
const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    /** Shown on cards and used as the meta description. Keep it under ~160. */
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    /** One only. Drives the category filter pages. */
    category: z.enum(CATEGORIES),
    tags: z.array(z.string()).default([]),
    author: z.string().default('Aniwala Studios'),
    /**
     * HSL triple for the card's placeholder art, e.g. '210 70% 22%'.
     * Delete it once `cover` points at real artwork.
     */
    tint: z.string().default('210 70% 22%'),
    /** Draft posts build locally but are excluded from the live site. */
    draft: z.boolean().default(false),
  }),
});

/**
 * Case studies — one project each, in `src/content/case-studies/`.
 *
 * `kind` is not decoration. A new studio's own pieces belong in the portfolio,
 * but a visitor must never mistake one for commissioned work, so every card
 * and page renders this badge. Set 'Client project' only when there was a
 * client, and only when they have agreed to be named.
 */
const caseStudies = defineCollection({
  loader: glob({ base: './src/content/case-studies', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    /** One line. Used on cards and as the meta description. */
    description: z.string(),
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
    /** HSL triple for the placeholder art, e.g. '210 70% 22%'. */
    tint: z.string().default('210 70% 22%'),
    /** Pins the study to the top of every listing. */
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, caseStudies };
