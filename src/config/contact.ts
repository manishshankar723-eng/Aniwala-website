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

/** Shown as the copyright holder and used in the footer base line. */
export const legalName = 'aniwala.com';

/* ------------------------------------------------------------------ */
/* Legal pages linked from the footer base                             */
/*                                                                     */
/* A route has to exist for each of these, so they are code: adding a   */
/* row here without adding the page fails `check-links.mjs`, which is   */
/* the behaviour you want.                                              */
/* ------------------------------------------------------------------ */
export const legalLinks = [{ label: 'Privacy Policy', href: '/privacy/' }];
