/**
 * Constants shared between the page builder's two halves.
 *
 * This file used to declare which pages existed and which named copy slots
 * each one rendered — the `pageCopy` system, where a template owned its own
 * shape and the CMS only filled in the words. That was replaced by the block
 * builder, which lets an editor add, reorder and delete sections outright, and
 * a page's shape now genuinely lives in Sanity.
 *
 * The two could not usefully coexist. Every page the builder converts is a
 * page `pageCopy` no longer describes, and leaving both meant two systems
 * owning the same headings and no way to tell which one a given page used. So
 * the slot machinery is gone and this is what survived it.
 */

/**
 * The slug of the built page that `index.astro` renders as `/`.
 *
 * The homepage is a `page` document like any other, but it gets a dedicated
 * route rather than being served by the catch-all — see the note at the top of
 * `src/pages/index.astro` for why. Both files import this constant so the
 * catch-all can skip the same document the homepage claims, instead of also
 * building it at `/home/`.
 */
export const HOME_SLUG = 'home';
