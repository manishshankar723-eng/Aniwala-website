/**
 * Every image on the site that an editor can replace.
 *
 * THE PROBLEM THIS SOLVES
 * Artwork sits in three different kinds of place — portfolio category tiles,
 * service pages, the home hero — and each of those is defined by a config
 * file whose STRUCTURE should stay in code. A new service is a decision that
 * deserves a diff; the picture on its page is not. Moving the whole of
 * `services.ts` into the CMS to make one image editable would be trading a
 * reviewed change for an unreviewed one.
 *
 * So the structure stays put and only the artwork moves, addressed by a
 * stable `slot` name. In the Studio this reads as one "Images" list covering
 * the whole site rather than an image field hidden inside six unrelated
 * document types.
 *
 * ITS OWN TINY MODULE, for the same reason `categories.ts` is one: both
 * `content.config.ts` and the Studio import it, and neither should have to
 * pull in the whole of `portfolio.ts` to do so.
 *
 * ADDING A SLOT: add it here, use `getArtwork('its-name')` where it renders,
 * and redeploy the Studio (`cd studio && npm run deploy`) so the dropdown
 * offers it. A slot nobody has uploaded to simply falls back to the colour
 * placeholder, so adding one is never a breaking change.
 */

export interface ImageSlot {
  /** Stable key. Changing it orphans whatever was uploaded against it. */
  name: string;
  /** How it reads in the Studio dropdown. */
  title: string;
  /** Which part of the site it belongs to — groups the dropdown. */
  group: 'Portfolio' | 'Services' | 'Home';
}

/**
 * Slugs are duplicated here rather than imported from `portfolio.ts` and
 * `services.ts`.
 *
 * That is a deliberate exception to the no-duplication rule everywhere else
 * in this codebase. A slot name is a KEY that an uploaded image is stored
 * against in Sanity: if it were derived from a slug and someone renamed that
 * slug, every image filed under the old name would silently detach and the
 * pages would fall back to colour placeholders with no error anywhere. Slugs
 * are free to change; these must not.
 */
export const IMAGE_SLOTS: ImageSlot[] = [
  /* Portfolio category tiles — the cards on /portfolio/ and the homepage. */
  { name: 'portfolio-character-design', title: 'Portfolio — Character Design', group: 'Portfolio' },
  { name: 'portfolio-environments', title: 'Portfolio — Environments & Props', group: 'Portfolio' },
  { name: 'portfolio-animation', title: 'Portfolio — Animation', group: 'Portfolio' },
  { name: 'portfolio-vfx', title: 'Portfolio — VFX', group: 'Portfolio' },
  { name: 'portfolio-concept-art', title: 'Portfolio — Concept Art', group: 'Portfolio' },
  { name: 'portfolio-motion-graphics', title: 'Portfolio — Motion Graphics', group: 'Portfolio' },

  /* Service pages. */
  { name: 'service-3d-art', title: 'Service — 3D Art', group: 'Services' },
  { name: 'service-2d-art', title: 'Service — 2D Art', group: 'Services' },
  { name: 'service-animation', title: 'Service — Animation', group: 'Services' },
  { name: 'service-vfx', title: 'Service — VFX', group: 'Services' },
  { name: 'service-integration', title: 'Service — Engine Integration', group: 'Services' },
  { name: 'service-video-editing', title: 'Service — Video Editing', group: 'Services' },

  /* Home. */
  { name: 'home-hero-poster', title: 'Home — hero still', group: 'Home' },
];

export const IMAGE_SLOT_NAMES = IMAGE_SLOTS.map((s) => s.name);

/** `character-design` -> `portfolio-character-design`. */
export const portfolioSlot = (categorySlug: string) => `portfolio-${categorySlug}`;

/** `3d-art` -> `service-3d-art`. */
export const serviceSlot = (serviceSlug: string) => `service-${serviceSlug}`;
