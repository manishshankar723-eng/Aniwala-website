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
/* Pieces                                                              */
/* ------------------------------------------------------------------ */
export interface Piece {
  /** Stable id. Used as the React-ish key and in the lightbox hash. */
  slug: string;
  title: string;
  /** Must match a `slug` in workCategories above. */
  category: string;
  /** One line. What the piece actually is, not how good it looks. */
  blurb: string;
  /**
   * Set 'Client project' only when there was a client, and only when they
   * have agreed to be named. Everything else is a studio project.
   */
  kind: 'Client project' | 'Studio project';
  /** Who it was for. Use the studio\'s own name on a self-directed piece. */
  client: string;
  year: number;
  /** A few, not the whole pipeline. Shown as small print on the card. */
  tools: string[];
  /** Placeholder tint until `image` is set. */
  tint: string;
  /** Swap for a real import via astro:assets once art exists. */
  image?: string;
  /**
   * Case study id (the Markdown filename without .md) when this piece has
   * one. The card becomes a link to it; without one the tile is inert,
   * because a dead end is worse than a tile that plainly is not clickable.
   */
  caseStudy?: string;
  /** Spans two columns in the portfolio grid. Use sparingly — one in four. */
  wide?: boolean;
}

/**
 * Everything we can show, newest first.
 *
 * Seeded from the case studies that already exist in this repo, because those
 * are the pieces that are genuinely ours and genuinely finished. Add standalone
 * art here as it clears — a piece does NOT need a case study to be listed,
 * only a `caseStudy` id if one has been written.
 */
export const pieces: Piece[] = [
  {
    slug: 'kite',
    title: 'Kite',
    category: 'animation',
    blurb:
      'A 40-second hand-drawn short: rigged bodies carrying the staging, drawn faces carrying the performance.',
    kind: 'Studio project',
    client: 'Aniwala Studios',
    year: 2026,
    tools: ['Toon Boom Harmony', 'Storyboard Pro', 'After Effects'],
    tint: '28 75% 26%',
    caseStudy: 'kite-short-film',
    wide: true,
  },
  {
    slug: 'downpour',
    title: 'Downpour',
    category: 'vfx',
    blurb:
      'Six shots of rain, standing water and structural collapse, built to find where a Houdini sim stops earning its render time.',
    kind: 'Studio project',
    client: 'Aniwala Studios',
    year: 2026,
    tools: ['Houdini', 'Karma', 'Nuke'],
    tint: '280 50% 26%',
    caseStudy: 'downpour-fx-study',
  },
  {
    slug: 'ferrous',
    title: 'Ferrous',
    category: 'environments',
    blurb:
      'A modular sci-fi corridor kit on a fixed memory budget, testing how far four trim sheets go before repetition shows.',
    kind: 'Studio project',
    client: 'Aniwala Studios',
    year: 2026,
    tools: ['Blender', 'Substance 3D Designer', 'Unreal Engine'],
    tint: '150 45% 20%',
  },
];

/**
 * Pieces in one discipline, newest first.
 *
 * Sorted here rather than at each call site so the index and the category
 * pages can never disagree about the order.
 */
export const piecesIn = (categorySlug?: string): Piece[] =>
  pieces
    .filter((p) => !categorySlug || p.category === categorySlug)
    .sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));

/** How many pieces sit in each discipline, for the filter bar\'s counts. */
export const pieceCounts = (): Record<string, number> =>
  Object.fromEntries(workCategories.map((c) => [c.slug, piecesIn(c.slug).length]));
