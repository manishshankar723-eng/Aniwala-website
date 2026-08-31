/**
 * Sanity client, used at BUILD TIME only.
 *
 * Nothing in this file ships to the browser. The site is still static: the
 * loaders in `loader.ts` run during `astro build`, pull content over GROQ,
 * and bake it into HTML. A visitor's browser never talks to Sanity, which is
 * why there is no anon-key-style public credential here and why a Sanity
 * outage cannot take the live site down — only a rebuild would fail.
 *
 * That is the opposite of how `lib/supabase.ts` works, and the difference is
 * deliberate. Comments and enquiries have to be live, so they go direct from
 * the browser under RLS. Blog posts do not, so they get baked.
 *
 * CONFIG. `projectId` and `dataset` are not secret — they appear in every
 * cdn.sanity.io image URL on the site. `SANITY_READ_TOKEN` IS secret. It is
 * only needed to read drafts for previewing; a published-only build works
 * without it. Never commit it; it lives in `.env` locally and in GitHub
 * Actions secrets for CI.
 */
import { createClient } from '@sanity/client';
import { createImageUrlBuilder } from '@sanity/image-url';

/* Loaders run in Node during the build, before Vite has processed anything,
   so `process.env` is the reliable source. `import.meta.env` is checked too
   because that is what a `.env` file feeds under `astro dev`. */
const env = (key: string): string => {
  const fromNode = typeof process !== 'undefined' ? process.env?.[key] : undefined;
  return fromNode ?? (import.meta.env as Record<string, string | undefined>)[key] ?? '';
};

export const SANITY_PROJECT_ID = env('SANITY_PROJECT_ID');
export const SANITY_DATASET = env('SANITY_DATASET') || 'production';
const SANITY_READ_TOKEN = env('SANITY_READ_TOKEN');

/**
 * Whether Sanity is usable. The loaders check this and fall back to an empty
 * collection rather than throwing, so a fresh clone with no `.env` still
 * builds and still renders every non-content page. A hard failure here would
 * mean nobody can run the site locally without credentials.
 */
export const sanityConfigured = Boolean(SANITY_PROJECT_ID);

export const sanityClient = sanityConfigured
  ? createClient({
      projectId: SANITY_PROJECT_ID,
      dataset: SANITY_DATASET,
      /* Pinned. An unpinned version means Sanity can change query behaviour
         under a build that has not changed a line of code. */
      apiVersion: '2026-01-01',
      /* The CDN caches for up to a minute. That is fine for a website and
         wrong for a build triggered by a "publish" webhook — the editor hits
         publish, the rebuild starts immediately, and a cached response would
         ship the previous version and look like the CMS lost the edit. */
      useCdn: false,
      token: SANITY_READ_TOKEN || undefined,
    })
  : null;

const builder = sanityClient ? createImageUrlBuilder(sanityClient) : null;

/** Minimal shape of a Sanity image reference. */
export interface SanityImage {
  asset?: { _ref?: string; _id?: string };
  alt?: string;
  hotspot?: unknown;
  crop?: unknown;
}

/**
 * Build a CDN URL for a Sanity image at a given width.
 *
 * `auto('format')` is what makes this worth using: Sanity serves WebP or AVIF
 * to browsers that accept them and falls back to JPEG for those that do not,
 * from one URL, with no build step. That is the image pipeline this site was
 * missing entirely — `public/` held originals at full size and served them to
 * phones untouched.
 */
export function imageUrl(source: SanityImage, width: number, quality = 80): string {
  if (!builder || !source?.asset) return '';
  return builder.image(source).width(width).quality(quality).auto('format').url();
}

/** A `srcset` across the widths the layouts actually use. */
export function imageSrcSet(source: SanityImage, widths = [480, 768, 1200, 1800]): string {
  if (!builder || !source?.asset) return '';
  return widths.map((w) => `${imageUrl(source, w)} ${w}w`).join(', ');
}

/**
 * A 1200x630 social card cropped from an image.
 *
 * Open Graph wants exactly this ratio, and the `og:image:width/height` tags
 * in `Base.astro` declare it — so the image has to be CROPPED to fit rather
 * than scaled, or the declared dimensions lie and the card renders letterboxed
 * in some clients and stretched in others.
 *
 * `fit: crop` with Sanity's hotspot means the editor decides what survives
 * the crop. Without a hotspot it crops to centre, which is why the Studio
 * schema turns hotspot on for every cover field.
 */
export function ogImageUrl(source: SanityImage): string {
  if (!builder || !source?.asset) return '';
  return builder.image(source).width(1200).height(630).fit('crop').auto('format').url();
}
