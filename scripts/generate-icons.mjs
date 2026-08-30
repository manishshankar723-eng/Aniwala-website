// Rasterise the Aniwala mark into the PNG icons the head references.
//
// The mark is the single <path> from public/favicon.svg. The favicon flips its
// fill with prefers-color-scheme; these cannot, because iOS composites the
// apple-touch-icon onto its own background and a transparent one comes out
// looking broken. So they get the brand ground and the gold mark, always.
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
//
// NOT part of the build. These assets are generated once and committed, so
// `npm run build` and CI never need sharp or fontkit. Run this by hand when
// the mark, the palette or the wording changes:
//
//   npm i --no-save sharp fontkit
//   node scripts/generate-icons.mjs
//   npm i          # drop them again
//

// Resolved from this file, so the script works from any checkout.
const OUT = new URL('../public/', import.meta.url);

const MARK =
  'M50.4 78.5a75.1 75.1 0 0 0-28.5 6.9l24.2-65.7c.7-2 1.9-3.2 3.4-3.2h29c1.5 0 2.7 1.2 3.4 3.2l24.2 65.7s-11.6-7-28.5-7L67 45.5c-.4-1.7-1.6-2.8-2.9-2.8-1.3 0-2.5 1.1-2.9 2.7L50.4 78.5Zm-1.1 28.2Zm-4.2-20.2c-2 6.6-.6 15.8 4.2 20.2a17.5 17.5 0 0 1 .2-.7 5.5 5.5 0 0 1 5.7-4.5c2.8.1 4.3 1.5 4.7 4.7.2 1.1.2 2.3.2 3.5v.4c0 2.7.7 5.2 2.2 7.4a13 13 0 0 0 5.7 4.9v-.3l-.2-.3c-1.8-5.6-.5-9.5 4.4-12.8l1.5-1a73 73 0 0 0 3.2-2.2 16 16 0 0 0 6.8-11.4c.3-2 .1-4-.6-6l-.8.6-1.6 1a37 37 0 0 1-22.4 2.7c-5-.7-9.7-2-13.2-6.2Z';

const GROUND = '#0b0c10';
const GOLD = '#e4c24c';

// viewBox is 0 0 128 128; inset the mark so it is not flush to the corners.
// iOS crops nothing but the visual weight is better with breathing room.
const svg = (size, pad, radius, bg) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg ? `<rect width="${size}" height="${size}" rx="${radius}" fill="${GROUND}"/>` : ''}
  <g transform="translate(${pad} ${pad}) scale(${(size - pad * 2) / 128})">
    <path d="${MARK}" fill="${GOLD}"/>
  </g>
</svg>`;

const jobs = [
  // iOS home screen. Square: iOS applies its own corner radius.
  { file: 'apple-touch-icon.png', size: 180, pad: 26, radius: 0, bg: true },
  // Android / PWA manifest.
  { file: 'icon-192.png', size: 192, pad: 28, radius: 0, bg: true },
  { file: 'icon-512.png', size: 512, pad: 74, radius: 0, bg: true },
  // Social card fallback is generated separately.
];

for (const j of jobs) {
  const buf = await sharp(Buffer.from(svg(j.size, j.pad, j.radius, j.bg)))
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(new URL(j.file, OUT), buf);
  console.log(`  ${j.file.padEnd(22)} ${j.size}x${j.size}  ${(buf.length / 1024).toFixed(1)} KB`);
}
