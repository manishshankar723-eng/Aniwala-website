/**
 * Portfolio pieces.
 *
 * Replaces `pieces`, `piecesIn` and `pieceCounts` in `config/portfolio.ts`.
 * The CATEGORIES stayed there: they drive the `/portfolio/[category]/` routes
 * and the filter chips, so they are structure. The pieces filed under them
 * are content, added the week the work clears.
 *
 * The flat `Piece` shape below is the one the old config exported, kept
 * deliberately so `PieceCard.astro` and both portfolio pages did not need
 * rewriting around `.data.` accessors for a change with no behaviour in it.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { previewMode } from './sanity/client';
import { imageUrl, imageSrcSet, type SanityImage } from './sanity/client';

export interface Piece {
  slug: string;
  title: string;
  category: string;
  blurb: string;
  kind: 'Client project' | 'Studio project';
  client: string;
  year: number;
  tools: string[];
  tint: string;
  /** Ready-to-render, or undefined — the tile falls back to `tint`. */
  image?: string;
  srcset?: string;
  imageAlt?: string;
  caseStudy?: string;
  wide?: boolean;
}

const flatten = (entry: CollectionEntry<'pieces'>): Piece => {
  const cover = entry.data.image as (SanityImage & { alt?: string }) | undefined;

  return {
    slug: entry.id,
    title: entry.data.title,
    category: entry.data.category,
    blurb: entry.data.blurb,
    kind: entry.data.kind,
    client: entry.data.client,
    year: entry.data.year,
    tools: entry.data.tools,
    tint: entry.data.tint,
    image: cover?.asset ? imageUrl(cover, 1200) : undefined,
    srcset: cover?.asset ? imageSrcSet(cover, [480, 768, 1200, 1800]) : undefined,
    imageAlt: cover?.alt,
    caseStudy: entry.data.caseStudy,
    wide: entry.data.wide,
  };
};

/**
 * Every published piece, in grid order.
 *
 * Unpublished ones show under `astro dev` and are dropped from production —
 * the same rule the rest of the content follows, so a piece can be staged
 * with its image before it goes live.
 */
export async function getPieces(): Promise<Piece[]> {
  const entries = await getCollection('pieces', ({ data }) => previewMode || !data.draft);

  /* `order` first, then newest, then title — so two pieces sharing an order
     hold a stable position instead of reshuffling between builds. */
  return entries
    .sort(
      (a, b) =>
        a.data.order - b.data.order ||
        b.data.year - a.data.year ||
        a.data.title.localeCompare(b.data.title)
    )
    .map(flatten);
}

/** Pieces in one category, or everything when no category is given. */
export async function piecesIn(categorySlug?: string): Promise<Piece[]> {
  const all = await getPieces();
  return categorySlug ? all.filter((p) => p.category === categorySlug) : all;
}

/**
 * How many pieces sit under each category, for the filter chips.
 *
 * Derived rather than stored: a chip claiming four pieces when three are
 * published is the kind of thing nobody notices until a visitor clicks it.
 */
export async function pieceCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const piece of await getPieces()) {
    counts[piece.category] = (counts[piece.category] ?? 0) + 1;
  }
  return counts;
}
