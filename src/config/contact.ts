/**
 * The parts of "how to reach us" that are NOT content.
 *
 * The inbox, the office address and the social links used to live here. They
 * now live in Sanity as the `contactDetails` singleton and are read through
 * `getContactDetails()` in `lib/studio.ts` — so an editor can change the
 * address without a deploy.
 *
 * They were removed rather than left in place, because for a while both
 * existed: the footer read Sanity while the CTA band, the about page and the
 * careers structured data read this file. Two addresses, one of them stale,
 * and nothing to tell you which page you were looking at. A duplicate that
 * silently takes over is worse than no fallback at all.
 *
 * What stays here is the stuff a template, not an editor, decides.
 */

/**
 * The icons `SocialIcon.astro` can actually draw.
 *
 * This belongs in code, not in the CMS: an icon exists because there is an
 * SVG path for it in that component. A const array rather than a bare union,
 * so the Studio schema can offer exactly this list and the Zod schema in
 * `content.config.ts` can validate against it. An icon name that is not one
 * of these renders as nothing — visible to no one, with no error — which is
 * precisely the kind of silent failure worth a few lines to prevent.
 */
export const SOCIAL_ICONS = [
  'whatsapp',
  'linkedin',
  'x',
  'youtube',
  'facebook',
  'artstation',
] as const;

export type SocialIcon = (typeof SOCIAL_ICONS)[number];

/*
 * The trading name and the footer's legal links used to live here too.
 *
 * They went the same way the address did. `legalName` is now on
 * `contactDetails`, because the footer's copyright line and the privacy
 * policy's opening sentence name the same entity and two copies of that is
 * how they end up naming two different ones. `legalLinks` is on `uiCopy`.
 *
 * The argument for keeping the links in code was that a route has to exist
 * for each of them, and a row without a page is a broken link on every page
 * of the site. That argument turned out to be about the wrong guard: what
 * catches a bad path is `check-links.mjs` at the end of the build, and it
 * catches one typed into Sanity exactly as well as one typed into this file.
 * The menus had already made the same move for the same reason.
 */
