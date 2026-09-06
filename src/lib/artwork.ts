/**
 * Ready-to-render pictures.
 *
 * Two ways in, one shape out.
 *
 * `toArtwork` takes an image field off a document — a service's hero, a
 * discipline's tile — and returns it sized. That is where nearly every
 * picture on this site comes from, because an image belongs to the thing it
 * depicts: it is created with it, deleted with it, and cannot be orphaned by
 * a slug rename.
 *
 * `getArtwork` takes a SLOT NAME, for the handful of images that belong to a
 * page rather than to a document — see `config/imageSlots.ts`, which is down
 * to one entry and explains at length why.
 *
 * NOTHING IS THE NORMAL CASE for both. Every caller falls back to the colour
 * placeholder the site already used, which is why these return `undefined`
 * rather than throwing: a missing picture is a page that looks like it did
 * last week, not a broken build.
 *
 * The artwork collection is fetched once and cached in a module-level
 * promise. Astro renders 65 pages in one process, so without this the same
 * lookup would walk the collection dozens of times.
 */
import { getCollection } from 'astro:content';
import { previewMode } from './sanity/client';
import { imageUrl, imageSrcSet, type SanityImage } from './sanity/client';

export interface Artwork {
  image: SanityImage;
  alt: string;
  /** Ready-to-use `src` at a sensible default width. */
  src: string;
  /** Ready-to-use `srcset` across the widths the layouts use. */
  srcset: string;
}

/**
 * An image field off a document, sized for rendering.
 *
 * `undefined` in gives `undefined` out, so a caller can hand this an optional
 * field and pass the result straight to a component that treats a missing
 * picture as "use the tint". An image whose asset is missing — which is what
 * a half-uploaded field looks like — is treated the same way rather than
 * producing an `<img>` with an empty `src`.
 *
 * `alt` defaults to empty rather than to the document's title. These pictures
 * sit behind a heading that says the same thing, so the correct alt text for
 * an unlabelled one is nothing at all; a title repeated here would make a
 * screen reader announce the page twice.
 */
export function toArtwork(image?: SanityImage): Artwork | undefined {
  if (!image?.asset) return undefined;
  return {
    image,
    alt: image.alt ?? '',
    src: imageUrl(image, 1200),
    srcset: imageSrcSet(image, [480, 768, 1200, 1800]),
  };
}

let cache: Promise<Map<string, Artwork>> | null = null;

function load(): Promise<Map<string, Artwork>> {
  cache ??= (async () => {
    const entries = await getCollection('artwork', ({ data }) => previewMode || !data.draft);
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

/*
 * `getArtworkMap` was here — several slots at once, for a grid that would
 * otherwise ask slot by slot inside a loop.
 *
 * Both of its callers were grids of DOCUMENTS whose pictures are now fields
 * on those documents, so they map with `toArtwork` and never touch the slot
 * collection at all. With one slot left on the site there is no grid of slots
 * to resolve, and a helper with no callers is a helper that stops matching
 * how the site actually works.
 */
