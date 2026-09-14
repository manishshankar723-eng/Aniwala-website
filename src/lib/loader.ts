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
import { imageUrl, webpUrl, previewMode, type SanityImage } from './sanity/client';

export interface LoaderSettings {
  enabled: boolean;
  /** Ready-to-render URL, or undefined — the component draws the built-in mark. */
  imageUrl?: string;
  /**
   * The uploaded mark as a `data:` URI, used as a CSS mask so the mark fills
   * in the accent colour like the built-in one. Absent when nothing is
   * uploaded, or when fetching it failed — the loader then shows the upload
   * in its own colours instead.
   */
  maskUri?: string;
  alt: string;
  /** Milliseconds the curtain may stay up if `load` never fires. */
  maxDuration: number;
}

const DEFAULTS: LoaderSettings = {
  enabled: true,
  alt: '',
  maxDuration: 2200,
};

/**
 * Fetch the mark once and inline it.
 *
 * WHY INLINE, rather than `mask-image: url(https://cdn.sanity.io/…)`: a CSS
 * mask is fetched in CORS mode, and cdn.sanity.io refuses any origin that is
 * not on the project's CORS list — which today is the Studio alone. A refused
 * mask paints nothing and reports nothing, so the loader would show an empty
 * screen where the mark should be, on every origin not yet listed, with no
 * error anywhere. An `<img>` is fetched without CORS, which is why the plain
 * upload always worked and hid the problem. Inlined at build there is no
 * request to refuse, and `img-src data:` in .htaccess already allows it.
 *
 * 256px WebP, about 9 KB: the mark renders at most 8.5rem, two device pixels
 * each, and a mask reads only the alpha channel.
 *
 * MEMOISED because every built page renders the loader. Keyed by URL so a
 * `astro dev` session that picks up a new upload after a restart gets it.
 *
 * Never throws. A failed fetch must not fail the build over a one-second
 * decoration; it degrades to the uncoloured upload.
 */
const masks = new Map<string, Promise<string | undefined>>();

function maskFor(url: string): Promise<string | undefined> {
  let pending = masks.get(url);
  if (!pending) {
    pending = fetch(url)
      .then(async (res) => {
        const type = res.headers.get('content-type') ?? '';
        if (!res.ok || !type.startsWith('image/')) return undefined;
        const bytes = Buffer.from(await res.arrayBuffer());
        return `data:${type};base64,${bytes.toString('base64')}`;
      })
      .catch(() => undefined);
    masks.set(url, pending);
  }
  return pending;
}

export async function getLoaderSettings(): Promise<LoaderSettings> {
  const entry = await getEntry('loaderSettings', 'loaderSettings');
  if (!entry || (entry.data.draft && !previewMode)) return DEFAULTS;

  const image = entry.data.image as SanityImage | undefined;
  const maskSource = image ? webpUrl(image, 256) : '';

  return {
    enabled: entry.data.enabled,
    /* 256px, not 128: the mark renders at 128 CSS pixels and a retina screen
       wants two device pixels for each of them. */
    imageUrl: image ? imageUrl(image, 256) : undefined,
    maskUri: maskSource ? await maskFor(maskSource) : undefined,
    alt: entry.data.alt,
    maxDuration: entry.data.maxDuration,
  };
}
