// The default social card: public/og-default.jpg
//
// og:image has pointed at /og-default.jpg on all 64 pages since the layout was
// written, and the file was never added — so every share of this site on
// WhatsApp, LinkedIn or Slack rendered an empty card.
//
// Built from the same mark, palette and typefaces as the site rather than
// designed somewhere else, so it cannot drift.
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
// NOT part of the build. These assets are generated once and committed, so
// `npm run build` and CI never need sharp or fontkit. Run this by hand when
// the mark, the palette or the wording changes:
//
//   npm i --no-save sharp fontkit
//   node scripts/generate-og-image.mjs
//   npm i          # drop them again
//
import sharp from 'sharp';
import * as fontkitNS from 'fontkit';
import { readFileSync, writeFileSync } from 'node:fs';

const fontkit = fontkitNS.default ?? fontkitNS;

// Resolved from this file, so the script works from any checkout.
const ROOT = new URL('..', import.meta.url);
const asset = (p) => new URL(p, ROOT);
const OUT = asset('public/og-default.jpg');

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

const MARK =
  'M50.4 78.5a75.1 75.1 0 0 0-28.5 6.9l24.2-65.7c.7-2 1.9-3.2 3.4-3.2h29c1.5 0 2.7 1.2 3.4 3.2l24.2 65.7s-11.6-7-28.5-7L67 45.5c-.4-1.7-1.6-2.8-2.9-2.8-1.3 0-2.5 1.1-2.9 2.7L50.4 78.5Zm-1.1 28.2Zm-4.2-20.2c-2 6.6-.6 15.8 4.2 20.2a17.5 17.5 0 0 1 .2-.7 5.5 5.5 0 0 1 5.7-4.5c2.8.1 4.3 1.5 4.7 4.7.2 1.1.2 2.3.2 3.5v.4c0 2.7.7 5.2 2.2 7.4a13 13 0 0 0 5.7 4.9v-.3l-.2-.3c-1.8-5.6-.5-9.5 4.4-12.8l1.5-1a73 73 0 0 0 3.2-2.2 16 16 0 0 0 6.8-11.4c.3-2 .1-4-.6-6l-.8.6-1.6 1a37 37 0 0 1-22.4 2.7c-5-.7-9.7-2-13.2-6.2Z';

const W = 1200;
const H = 630;

const INK = '#f4f4f2';
const MUTED = '#9aa0ae';
const FAINT = '#6b7185';
const GOLD = '#e4c24c';

const wordmark = textPath(body, 'ANIWALA STUDIOS', 176, 128, 24, 3.4);
const line1 = textPath(display, 'Animation, game art', 84, 336, 88, -2.2);
const line2 = textPath(display, 'and VFX.', 84, 430, 88, -2.2);
const lead = textPath(body, 'Tell us the deadline first.', 84, 500, 28);
const domain = textPath(body, 'aniwala.com', 84, 594, 24);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="tintA" cx="88%" cy="0%" r="80%">
      <stop offset="0%" stop-color="#4a3080" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="#4a3080" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="tintB" cx="2%" cy="16%" r="65%">
      <stop offset="0%" stop-color="${GOLD}" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="#0b0c10"/>
  <rect width="${W}" height="${H}" fill="url(#tintA)"/>
  <rect width="${W}" height="${H}" fill="url(#tintB)"/>

  <g transform="translate(84 62) scale(0.62)">
    <path d="${MARK}" fill="${GOLD}"/>
  </g>
  <path d="${wordmark.d}" fill="${INK}"/>

  <path d="${line1.d}" fill="${INK}"/>
  <path d="${line2.d}" fill="${INK}"/>
  <path d="${lead.d}" fill="${MUTED}"/>

  <rect x="84" y="552" width="104" height="3" fill="${GOLD}"/>
  <path d="${domain.d}" fill="${FAINT}"/>
</svg>`;

const buf = await sharp(Buffer.from(svg)).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
writeFileSync(OUT, buf);
console.log(`  og-default.jpg  ${W}x${H}  ${(buf.length / 1024).toFixed(1)} KB`);
