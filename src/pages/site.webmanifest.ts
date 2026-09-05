import type { APIRoute } from 'astro';
import { getBrand } from '../lib/studio';

/**
 * The web app manifest — what a phone reads when somebody adds the site to
 * their home screen.
 *
 * WHY THIS IS A ROUTE AND NOT A FILE IN `public/`
 *
 * It used to be `public/site.webmanifest`, a static file naming two icon
 * paths and two hex colours. All four of those are now editable in the Studio
 * under "Logo & icons", and a file in `public/` is copied to the output
 * verbatim — there is nothing in it that could read a CMS document.
 *
 * A route can. It is prerendered like every other page on this static site,
 * so the cost is the same as the file it replaces: one request, one flat
 * asset, no server. `public/site.webmanifest` was deleted when this arrived,
 * because two things answering the same URL is a coin toss over which one
 * wins.
 *
 * THE FALLBACKS ARE NOT DECORATION. Every field is optional in the Studio,
 * and a manifest is parsed strictly: a missing `name`, or an `icons` array
 * pointing at nothing, makes some browsers discard the whole document rather
 * than the offending line. So each value falls back to what the committed
 * file said, and the icon list falls back to the committed PNGs — which is
 * exactly what the site shipped with before any of this was editable.
 */
export const prerender = true;

/* The values the static file carried. Kept here rather than left blank for
   the reason above: a partial manifest is thrown away whole, so "nothing
   uploaded yet" has to still produce a complete, valid document. */
const FALLBACK = {
  name: 'Aniwala Studios',
  shortName: 'Aniwala',
  description: 'Animation studio producing 2D, 3D, VFX and game art.',
  themeColor: '#0b0c10',
  backgroundColor: '#0b0c10',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  ],
};

export const GET: APIRoute = async () => {
  const brand = await getBrand();

  const manifest = {
    name: brand.appName || FALLBACK.name,
    short_name: brand.appShortName || FALLBACK.shortName,
    description: brand.appDescription || FALLBACK.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: brand.backgroundColor || FALLBACK.backgroundColor,
    theme_color: brand.themeColor || FALLBACK.themeColor,
    icons: brand.icon
      ? [
          { src: brand.icon.png192, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: brand.icon.png512, sizes: '512x512', type: 'image/png', purpose: 'any' },
        ]
      : FALLBACK.icons,
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      /* The registered type. `application/json` works in every browser that
         matters, but the spec names this one and some install prompts check. */
      'Content-Type': 'application/manifest+json; charset=utf-8',
    },
  });
};
