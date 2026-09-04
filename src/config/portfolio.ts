/**
 * The portfolio: the disciplines work is filed under, and the pieces
 * themselves.
 *
 * This file owns the whole taxonomy. The homepage work grid, `/portfolio/`
 * and every `/portfolio/[category]/` page all read from here, so a new
 * discipline is added once and appears in three places.
 *
 * HONESTY RULE (same as site.ts and services.ts): nothing here may claim
 * something that is not true yet. A piece belongs in this file once it
 * exists and we are allowed to show it — not before. `kind` is not
 * decoration: a self-directed piece must never be mistaken for commissioned
 * work, so every card renders that badge.
 */

/* ------------------------------------------------------------------ */
/* Disciplines — the way an art director shops                         */
/* ------------------------------------------------------------------ */
export interface WorkCategory {
  /** URL segment. `/portfolio/{slug}/` */
  slug: string;
  title: string;
  /**
   * The discipline\'s name as it appears mid-sentence ("Have VFX on your
   * brief?", "Ask to see character design").
   *
   * Stored rather than lower-cased from `title`, for the same reason
   * config/services.ts stores one: toLowerCase() turns VFX into "vfx" and
   * "Concept & 2D Art" into "concept & 2d art".
   */
  shortName: string;
  blurb: string;
  /** One or two sentences. Only the category page shows this. */
  intro: string;
  /** Placeholder tint used until real art exists, e.g. '210 70% 22%'. */
  tint: string;
  /**
   * Slugs from config/services.ts — the disciplines you actually hire to get
   * this work. A craft and a service are not the same thing (character design
   * draws on three services), so the mapping is stated rather than derived.
   */
  services: string[];
  /** Set true to make the homepage tile span two columns. */
  wide?: boolean;
}

export const workCategories: WorkCategory[] = [
  {
    slug: 'character-design',
    title: 'Character Design',
    shortName: 'character design',
    blurb: 'Concept through to production-ready rigs',
    intro:
      'Silhouette and personality first, then the technical work that keeps them intact — topology that deforms, a rig an animator can actually drive, and a face that holds up in close-up.',
    services: ['3d-art', '2d-art', 'animation'],
    tint: '210 70% 22%',
    wide: true,
  },
  {
    slug: 'environments',
    title: 'Environments & Props',
    shortName: 'environments and props',
    blurb: 'Worlds, set dressing and hero assets',
    intro:
      'Modular kits, hero assets and the dressing between them, built to a stated budget and a uniform texel density rather than to whatever the viewport tolerated on the day.',
    services: ['3d-art', 'integration'],
    tint: '150 45% 20%',
  },
  {
    slug: 'animation',
    title: 'Animation',
    shortName: 'animation',
    blurb: '2D and 3D performance, gameplay and cinematic',
    intro:
      'Performance, gameplay loops and cinematic staging — in 2D, 3D or the hybrid of the two we use when a drawn face has to carry a rigged body.',
    services: ['animation', 'video-editing'],
    tint: '28 75% 26%',
  },
  {
    slug: 'vfx',
    title: 'VFX',
    shortName: 'VFX',
    blurb: 'Simulation, compositing and finishing',
    intro:
      'Simulation, compositing and the finishing that makes it sit in the plate. We\'re as interested in which shots don\'t need a full sim as in the ones that do.',
    services: ['vfx', 'integration'],
    tint: '280 50% 26%',
    wide: true,
  },
  {
    slug: 'concept-art',
    title: 'Concept & 2D Art',
    shortName: 'concept and 2D art',
    blurb: 'Visual development, key art and storyboards',
    intro:
      'Visual development, key art, storyboards and the style frames that settle a look while changing it is still cheap.',
    services: ['2d-art'],
    tint: '340 55% 24%',
  },
  {
    slug: 'motion-graphics',
    title: 'Motion Graphics',
    shortName: 'motion graphics',
    blurb: 'Titles, explainers and broadcast design',
    intro:
      'Titles, explainers, broadcast packages and the cutdowns that come after — designed to survive being resized for six placements.',
    services: ['video-editing', 'vfx'],
    tint: '195 60% 24%',
  },
];

/** `/portfolio/animation/`. Derived, so a slug is never written out twice. */
export const categoryHref = (slug: string) => `/portfolio/${slug}/`;

export const categoryBySlug = (slug: string) => workCategories.find((c) => c.slug === slug);

/* ------------------------------------------------------------------ */
/* Pieces — moved to Sanity                                            */
/*                                                                     */
/* The `Piece` type, the pieces array and the `piecesIn` / `pieceCounts`*/
/* helpers all live in `lib/pieces.ts` now, reading the `piece`         */
/* document type. The three seeded pieces that used to sit here were    */
/* migrated into the Studio and then deleted, because two lists of the  */
/* same work is one list too many.                                      */
/*                                                                     */
/* The CATEGORIES above stayed. They drive the /portfolio/[category]/   */
/* routes and the Zod validation on a piece's `category`, so they are   */
/* structure rather than content — a category exists because there is a */
/* page for it.                                                         */
/* ------------------------------------------------------------------ */
