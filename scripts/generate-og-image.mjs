// The default social card: public/og-default.jpg
//
// og:image has pointed at /og-default.jpg on all 64 pages since the layout was
// written, and the file was never added — so every share of this site on
// WhatsApp, LinkedIn or Slack rendered an empty card.
//
// THE MARK COMES FROM THE CMS, and that is the whole point of the second
// version of this script.
//
// The first one drew a mark from an SVG path pasted into this file. It was
// correct on the day it was written and wrong three weeks later: the studio
// uploaded a new logo in the Studio, the header changed, the loading screen
// changed, the favicon changed — and the social card, alone among them, kept
// drawing the old one. Nothing was broken, nothing failed a build, and the only
// place the stale mark appeared was inside other people's chat apps, which is
// the one surface nobody on the team looks at. It was reported by someone
// sending a link to a client.
//
// So the path is gone and the logo is fetched from the same `brand` document
// the header reads. There is no second copy to go stale. The built-in mark
// survives only as the fallback for a checkout with no credentials — the same
// thing `Header.astro` falls back to, for the same reason.
//
// It is STILL not part of the build: this needs sharp, and making CI install a
// native image toolchain to regenerate a file that changes twice a year is a
// bad trade. `scripts/check-og.mjs` closes that gap instead — it runs in
// `npm run verify`, needs nothing but a Sanity query, and fails the build if
// the committed card was made from a logo the CMS no longer uses. Which is
// exactly the failure above, caught by CI rather than by a client.
//
// Type is converted to OUTLINES rather than set as <text>. The renderer behind
// sharp (librsvg) ignores @font-face entirely — data URI or not — and silently
// falls back to a monospace system font, which is what the first attempt at
// this produced. Outlines make the card exact and independent of what fonts
// happen to be installed on whatever machine regenerates it.
//
// Both families are variable fonts whose DEFAULT instance is the one we want
// here: Bricolage defaults to wght 800 / opsz 96, Instrument Sans to wght 400.
// So no variation instancing is needed — which is fortunate, because fontkit
// drops the cmap when you ask it for one.
//
// Run it by hand when the mark, the palette or the wording changes:
//
//   npm i --no-save sharp fontkit
//   node --env-file=.env scripts/generate-og-image.mjs
//   npm i          # drop them again
//
import sharp from 'sharp';
import * as fontkitNS from 'fontkit';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@sanity/client';
import { createImageUrlBuilder } from '@sanity/image-url';
import { PALETTE_PROJECTION, resolvePalette } from './lib/og-brand.mjs';

const fontkit = fontkitNS.default ?? fontkitNS;

// Resolved from this file, so the script works from any checkout.
const ROOT = new URL('..', import.meta.url);
const asset = (p) => new URL(p, ROOT);
const OUT = asset('public/og-default.jpg');
/* The provenance record `check-og.mjs` reads. Committed beside the card. */
const SOURCE = asset('scripts/og-source.json');

const display = fontkit.create(readFileSync(asset('public/fonts/bricolage-grotesque-latin.woff2')));
const body = fontkit.create(readFileSync(asset('public/fonts/instrument-sans-latin.woff2')));

/**
 * Lay out a string and return it as one SVG path, already positioned.
 * `tracking` is in the same units as `size` (so -2 is 2px tighter per glyph).
 */
function textPath(font, text, x, y, size, tracking = 0) {
  const s = size / font.unitsPerEm;
  const run = font.layout(text);
  let pen = x;
  let d = '';

  run.glyphs.forEach((glyph, i) => {
    const pos = run.positions[i];
    const gx = pen + pos.xOffset * s;
    const gy = y - pos.yOffset * s;
    // Font space is y-up, SVG is y-down, hence the negative vertical scale.
    d += glyph.path.transform(s, 0, 0, -s, gx, gy).toSVG() + ' ';
    pen += pos.xAdvance * s + tracking;
  });

  return { d: d.trim(), width: pen - x };
}

/**
 * The built-in mark — the FALLBACK, not the logo.
 *
 * Reached only when there are no Sanity credentials to hand, which is the
 * fresh-clone case. `Header.astro` falls back to its own inline mark under the
 * same condition, so a card generated without credentials matches a site
 * rendered without them. It is not what aniwala.com ships.
 */
const MARK =
  'M50.4 78.5a75.1 75.1 0 0 0-28.5 6.9l24.2-65.7c.7-2 1.9-3.2 3.4-3.2h29c1.5 0 2.7 1.2 3.4 3.2l24.2 65.7s-11.6-7-28.5-7L67 45.5c-.4-1.7-1.6-2.8-2.9-2.8-1.3 0-2.5 1.1-2.9 2.7L50.4 78.5Zm-1.1 28.2Zm-4.2-20.2c-2 6.6-.6 15.8 4.2 20.2a17.5 17.5 0 0 1 .2-.7 5.5 5.5 0 0 1 5.7-4.5c2.8.1 4.3 1.5 4.7 4.7.2 1.1.2 2.3.2 3.5v.4c0 2.7.7 5.2 2.2 7.4a13 13 0 0 0 5.7 4.9v-.3l-.2-.3c-1.8-5.6-.5-9.5 4.4-12.8l1.5-1a73 73 0 0 0 3.2-2.2 16 16 0 0 0 6.8-11.4c.3-2 .1-4-.6-6l-.8.6-1.6 1a37 37 0 0 1-22.4 2.7c-5-.7-9.7-2-13.2-6.2Z';

const W = 1200;
const H = 630;

/* Where the lockup sits, and how tall it is drawn. The headline below starts
   at a cap-height of roughly y=273, so this has room to 250 before the two
   would crowd. */
const LOGO_X = 84;
const LOGO_Y = 54;
const LOGO_H = 150;

/**
 * The studio's logo, as PNG bytes at the size the card draws it.
 *
 * FETCHED AS PNG, not through `auto('format')`. That negotiates off the
 * request's Accept header and a `fetch` from Node sends none, so the answer
 * is whatever the original was — and the original may be anything. PNG is the
 * one format certain to carry the ALPHA CHANNEL, which is the only reason this
 * composites onto the card rather than arriving in a white box.
 *
 * At 2x the drawn height, because the card is routinely rendered on 2x screens
 * and the whole file is 32 KB — there is nothing to save by sending a soft one.
 *
 * Returns null when Sanity is not configured or the brand has no logo, which
 * are the same two conditions under which the header shows its inline mark.
 */
async function brandFromCms() {
  const projectId = (process.env.SANITY_PROJECT_ID ?? '').trim();
  const dataset = (process.env.SANITY_DATASET ?? '').trim() || 'production';
  if (!projectId) return null;

  const client = createClient({
    projectId,
    dataset,
    apiVersion: '2026-01-01',
    useCdn: false,
    perspective: 'published',
    token: (process.env.SANITY_READ_TOKEN ?? '').trim() || undefined,
  });

  /* `logoDark` specifically: this card is dark in every client that renders
     it, so it wants the asset the site shows on its dark theme. The pair is
     published together or not at all — see `getBrand` in lib/studio.ts. */
  const doc = await client.fetch(`*[_type == "brand"][0]{ logoDark, ${PALETTE_PROJECTION} }`);

  /* The document comes back whether or not a logo does — a studio may well
     recolour the site without ever uploading a mark. */
  const ref = doc?.logoDark?.asset?._ref;
  if (!ref) return { doc, logo: null };

  const url = createImageUrlBuilder(client)
    .image(doc.logoDark)
    .height(LOGO_H * 2)
    .format('png')
    .url();

  const res = await fetch(url);
  if (!res.ok) throw new Error(`logo fetch failed: ${res.status} ${url}`);
  return { doc, logo: { ref, bytes: Buffer.from(await res.arrayBuffer()) } };
}

const cms = (await brandFromCms()) ?? { doc: null, logo: null };
const logo = cms.logo;

/* What the site ships, with whatever the Studio overrides on top. Shared with
   check-og.mjs so the checker cannot certify a card the generator would now
   draw differently — see scripts/lib/og-brand.mjs. */
const C = resolvePalette(cms.doc);

/*
 * THE WORDMARK IS DRAWN ONLY WHEN THE LOGO DOES NOT CARRY ONE.
 *
 * The uploaded lockup is a stacked mark with "ANIWALA STUDIOS" already set
 * underneath it. Drawing the text as well put the studio's name on the card
 * twice, in two different typefaces, one above the other. The fallback mark is
 * a bare glyph and does need it.
 */
const wordmark = logo ? null : textPath(body, 'ANIWALA STUDIOS', 176, 128, 24, 3.4);
const line1 = textPath(display, 'Animation, game art', 84, 336, 88, -2.2);
const line2 = textPath(display, 'and VFX.', 84, 430, 88, -2.2);
const lead = textPath(body, 'Tell us the deadline first.', 84, 500, 28);
const domain = textPath(body, 'aniwala.com', 84, 594, 24);

/*
 * THE BACKGROUND IS THE SITE'S OWN HERO, not a wash invented for this file.
 *
 * `.hero-media` in VideoHero.astro is what the homepage paints behind the
 * headline before the video arrives, and on a metered connection it is what
 * the homepage simply IS. Reproducing it here means somebody who taps a shared
 * link lands on the picture the card just showed them, rather than on a
 * different-coloured page. The CSS it mirrors:
 *
 *   radial-gradient(ellipse 80% 60% at 70% 20%,
 *                   color-mix(in srgb, var(--color-accent) 18%, transparent),
 *                   transparent 70%),
 *   linear-gradient(160deg, var(--color-surface), var(--color-ground) 60%)
 *
 * The linear gradient's endpoints are worked out rather than eyeballed,
 * because SVG takes two points where CSS takes an angle. For 160deg the
 * direction is (sin160, -cos160) = (0.342, 0.940); the gradient line is
 * |W*sin| + |H*cos| = 1002.4 long and centred on the box, which puts its ends
 * at the two coordinates below. `color-mix(accent 18%, transparent)` is just
 * the accent at 0.18 alpha, which SVG spells as a separate attribute.
 */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="ground" gradientUnits="userSpaceOnUse"
      x1="428.6" y1="-155.9" x2="771.4" y2="785.9">
      <stop offset="0%" stop-color="${C.surface}"/>
      <stop offset="60%" stop-color="${C.ground}"/>
      <stop offset="100%" stop-color="${C.ground}"/>
    </linearGradient>
    <radialGradient id="glow" cx="70%" cy="20%" r="80%">
      <stop offset="0%" stop-color="${C.accent}" stop-opacity="0.18"/>
      <stop offset="70%" stop-color="${C.accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#ground)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  ${
    logo
      ? ''
      : `<g transform="translate(84 62) scale(0.62)"><path d="${MARK}" fill="${C.accent}"/></g>`
  }
  ${wordmark ? `<path d="${wordmark.d}" fill="${C.ink}"/>` : ''}

  <path d="${line1.d}" fill="${C.ink}"/>
  <path d="${line2.d}" fill="${C.ink}"/>
  <path d="${lead.d}" fill="${C.inkMuted}"/>

  <rect x="84" y="552" width="104" height="3" fill="${C.accent}"/>
  <path d="${domain.d}" fill="${C.inkFaint}"/>
</svg>`;

/*
 * The logo is COMPOSITED, not embedded in the SVG as a data: URI.
 *
 * librsvg's support for `<image href="data:…">` is patchy across the versions
 * that ship with sharp, and when it declines it does so silently — the card
 * renders with a hole where the mark should be, which is not obviously
 * different from the bug this script exists to fix. sharp's own compositor
 * takes the same bytes and has no opinion about them.
 */
let pipeline = sharp(Buffer.from(svg));
if (logo) {
  const resized = await sharp(logo.bytes).resize({ height: LOGO_H }).png().toBuffer();
  pipeline = pipeline.composite([{ input: resized, top: LOGO_Y, left: LOGO_X }]);
}

const buf = await pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
writeFileSync(OUT, buf);

/*
 * The provenance record.
 *
 * Just the asset reference the card was drawn from. `check-og.mjs` compares it
 * against the brand document on every `npm run verify`, so the next time
 * somebody swaps the logo the build says so instead of the card quietly
 * disagreeing with the site for a month.
 */
writeFileSync(
  SOURCE,
  JSON.stringify(
    { logoDark: logo?.ref ?? null, palette: C, generated: new Date().toISOString() },
    null,
    2
  ) + '\n'
);

console.log(`  og-default.jpg  ${W}x${H}  ${(buf.length / 1024).toFixed(1)} KB`);
console.log(`  logo: ${logo ? logo.ref : 'built-in fallback (no Sanity credentials)'}`);
console.log(`  palette: ground ${C.ground}  surface ${C.surface}  accent ${C.accent}`);
