/**
 * Artwork lookup.
 *
 * Every replaceable image on the site is filed in the CMS against a slot name
 * from `config/imageSlots.ts`. This resolves a slot to a ready-to-render
 * image, or to nothing.
 *
 * NOTHING IS THE NORMAL CASE. Most slots are empty until somebody uploads to
 * them, and every caller falls back to the colour placeholder the site
 * already used. That is why this returns `undefined` rather than throwing:
 * a missing picture is a page that looks like it did last week, not a broken
 * build.
 *
 * The whole collection is fetched once and cached in a module-level promise.
 * Astro renders 65 pages in one process and several of them ask for artwork,
 * so without this the same lookup would walk the collection dozens of times.
 */
import { getCollection } from 'astro:content';
import { imageUrl, imageSrcSet, type SanityImage } from './sanity/client';

export interface Artwork {
  image: SanityImage;
  alt: string;
  /** Ready-to-use `src` at a sensible default width. */
  src: string;
  /** Ready-to-use `srcset` across the widths the layouts use. */
  srcset: string;
}

let cache: Promise<Map<string, Artwork>> | null = null;

function load(): Promise<Map<string, Artwork>> {
  cache ??= (async () => {
    const entries = await getCollection('artwork', ({ data }) => import.meta.env.DEV || !data.draft);
    const bySlot = new Map<string, Artwork>();

    for (const entry of entries) {
      const image = entry.data.image as SanityImage;
      if (!image?.asset) continue;

      bySlot.set(entry.data.slot, {
        image,
        alt: entry.data.alt,
        src: imageUrl(image, 1200),
        srcset: imageSrcSet(image, [480, 768, 1200, 1800]),
      });
    }

    return bySlot;
  })();

  return cache;
}

/** The artwork for one slot, or undefined when nothing is filed against it. */
export async function getArtwork(slot: string): Promise<Artwork | undefined> {
  return (await load()).get(slot);
}

/**
 * Several slots at once, as a lookup.
 *
 * For a page rendering a grid — the portfolio tiles, the services index —
 * where asking slot by slot inside a loop would read worse than resolving
 * them all up front.
 */
export async function getArtworkMap(slots: string[]): Promise<Map<string, Artwork>> {
  const all = await load();
  const picked = new Map<string, Artwork>();
  for (const slot of slots) {
    const art = all.get(slot);
    if (art) picked.set(slot, art);
  }
  return picked;
}
