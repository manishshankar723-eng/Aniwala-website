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

/** What each category is for. Shown on its archive page. */
export const CATEGORY_BLURBS: Record<Category, string> = {
  Craft: 'How the work is actually made — technique, timing and the decisions animators argue about.',
  Pipeline:
    'The technical spine: budgets, formats, hand-offs and the specifications that stop a project drifting.',
  Studio: 'How we run — quoting, scheduling, reviewing, and the promises we are willing to make.',
  Industry: 'The wider trade: tools, shifts in how production works, and what is worth adopting.',
};
