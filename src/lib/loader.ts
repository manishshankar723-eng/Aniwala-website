/**
 * The first-load screen's settings.
 *
 * Optional in a way no other singleton is: a site with no `loaderSettings`
 * document falls back to the built-in mark and the built-in timing, rather
 * than failing the build. Every other singleton describes something the site
 * cannot render honestly without — an address, a menu — and this one describes
 * a decorative curtain. Failing a deploy over it would be absurd.
 */
import { getEntry } from 'astro:content';
import { imageUrl, previewMode, type SanityImage } from './sanity/client';

export interface LoaderSettings {
  enabled: boolean;
  /** Ready-to-render URL, or undefined — the component draws the built-in mark. */
  imageUrl?: string;
  alt: string;
  /** Milliseconds the curtain may stay up if `load` never fires. */
  maxDuration: number;
}

const DEFAULTS: LoaderSettings = {
  enabled: true,
  alt: '',
  maxDuration: 2200,
};

export async function getLoaderSettings(): Promise<LoaderSettings> {
  const entry = await getEntry('loaderSettings', 'loaderSettings');
  if (!entry || (entry.data.draft && !previewMode)) return DEFAULTS;

  return {
    enabled: entry.data.enabled,
    /* 256px, not 128: the mark renders at 128 CSS pixels and a retina screen
       wants two device pixels for each of them. */
    imageUrl: entry.data.image ? imageUrl(entry.data.image as SanityImage, 256) : undefined,
    alt: entry.data.alt,
    maxDuration: entry.data.maxDuration,
  };
}
