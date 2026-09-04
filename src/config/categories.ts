/**
 * Blog categories.
 *
 * Deliberately its own tiny module. Both `content.config.ts` (which validates
 * post frontmatter against it) and the components that render the filter row
 * need this list, and `content.config.ts` is loaded by Astro in a special
 * context — importing it from a component happens to work today but is not a
 * contract. One plain module that both sides import is.
 *
 * The order here is the order the filter row shows. Listed explicitly rather
 * than derived from the posts, so the row does not reshuffle itself whenever
 * something is published.
 */
export const CATEGORIES = ['Craft', 'Pipeline', 'Studio', 'Industry'] as const;

export type Category = (typeof CATEGORIES)[number];

/*
 * The DESCRIPTIONS moved to Sanity — see `categoryBlurbs` on the site copy
 * singleton. The list above did not, and should not: it drives the archive
 * URLs and validates the category on every post, so a category that exists
 * only as a document could be renamed out from under published posts.
 */
