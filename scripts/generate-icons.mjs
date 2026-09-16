// Rasterise the Aniwala mark into the icon files the head references.
//
// The mark is the single <path> in public/favicon.svg, READ FROM THAT FILE
// rather than copied into a constant here. It used to be copied, and the copy
// is how the site shipped Astro's logo for months: the starter's favicon.svg
// was never replaced, this script inlined its path under a comment calling it
// "the Aniwala mark", and every generated icon inherited it. One source, so a
// wrong mark can only ever be wrong in one place.
//
// favicon.svg itself flips its fill with prefers-color-scheme, because it sits
// on the browser's own tab strip. These cannot: iOS composites the
// apple-touch-icon onto its own background and a transparent one comes out
// looking broken. So they get the brand ground and the gold mark, always.
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
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

const source = readFileSync(new URL('favicon.svg', OUT), 'utf8');
const MARK = source.match(/\sd="([^"]+)"/)?.[1];
/*
 * The WHOLE viewBox, all four numbers, and every one of them is load bearing.
 *
 * Only the `d` is lifted out of favicon.svg — so anything that positions the
 * path in that file, a wrapping <g transform>, is left behind and silently
 * lost. The first version of this centred the mark with exactly such a group
 * and read only the viewBox's width, which put every icon up and to the left
 * of centre: on the 512 the mark sat 53px left and 83px high, with a 45px
 * margin on one side and 151px on the other.
 *
 * So favicon.svg now carries no transform at all. Its viewBox IS the mark's
 * bounding box, min-x and min-y included, and the centring happens below
 * where the target size is known. Keep it that way: if a future mark needs
 * shifting, tighten its viewBox rather than wrapping it in a group.
 */
const BOX = source.match(/viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/)?.slice(1).map(Number);
if (!MARK || !BOX) throw new Error('No path or 4-value viewBox found in public/favicon.svg');
const [VX, VY, VW, VH] = BOX;

const GROUND = '#0b0c10';
const GOLD = '#e4c24c';

// Fit the mark inside `size` less `pad` on each edge, then centre what is left
// over on BOTH axes. The mark is wider than it is tall, so it is the width
// that meets the padding and the height that gets the leftover split evenly —
// which is why this cannot just scale and translate by `pad`.
//
// `fill-rule` is carried over deliberately. potrace emits one path whose
// counters — the A's bowl, the dashes along the swoosh — are subpaths that
// only punch through under evenodd. Drop it and the mark fills in solid.
const place = (size, pad) => {
  const scale = Math.min((size - pad * 2) / VW, (size - pad * 2) / VH);
  return {
    scale,
    dx: (size - VW * scale) / 2 - VX * scale,
    dy: (size - VH * scale) / 2 - VY * scale,
  };
};

const svg = (size, pad, radius, bg) => {
  const { scale, dx, dy } = place(size, pad);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg ? `<rect width="${size}" height="${size}" rx="${radius}" fill="${GROUND}"/>` : ''}
  <g transform="translate(${dx} ${dy}) scale(${scale})">
    <path d="${MARK}" fill="${GOLD}" fill-rule="evenodd"/>
  </g>
</svg>`;
};

const png = (size, pad, radius, bg) =>
  sharp(Buffer.from(svg(size, pad, radius, bg))).png({ compressionLevel: 9 }).toBuffer();

const jobs = [
  // iOS home screen. Square: iOS applies its own corner radius.
  { file: 'apple-touch-icon.png', size: 180, pad: 16, radius: 0, bg: true },
  // Android / PWA manifest.
  { file: 'icon-192.png', size: 192, pad: 17, radius: 0, bg: true },
  { file: 'icon-512.png', size: 512, pad: 46, radius: 0, bg: true },
  // Social card fallback is generated separately.
];

for (const j of jobs) {
  const buf = await png(j.size, j.pad, j.radius, j.bg);
  writeFileSync(new URL(j.file, OUT), buf);
  console.log(`  ${j.file.padEnd(22)} ${j.size}x${j.size}  ${(buf.length / 1024).toFixed(1)} KB`);
}

/*
 * favicon.ico, and why it is assembled here by hand.
 *
 * A browser asks for /favicon.ico by that exact path before it has parsed any
 * HTML, and Google falls back to it when choosing the icon beside a search
 * result — so it has to be a real file, and it has to be a real ICO. It was
 * neither: a bare 32x32 PNG with an .ico extension, which Chrome and Firefox
 * sniff and accept and stricter Windows consumers do not.
 *
 * It also has to contain a 48. Google requires the favicon it shows to be
 * square and a MULTIPLE OF 48px, and a lone 32 disqualified the file.
 *
 * sharp has no ICO encoder, so the container is written out below: a directory
 * of ICONDIRENTRYs pointing at 32-bit BMPs. BMP rather than PNG entries
 * because PNG-in-ICO needs Vista or newer to decode, and compatibility is this
 * file's entire job. Inside an ICO a BMP carries DOUBLE the real height in its
 * header (an XOR image plus an AND transparency mask) and its rows run bottom
 * to top. The mask is all zeros here — every pixel is opaque, since these sit
 * on the brand ground.
 */
const ICO_SIZES = [16, 32, 48];

/** One 32-bit BGRA BMP, bottom-up, with a zeroed AND mask — an ICO payload. */
const dib = (rgba, size) => {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0); // biSize
  header.writeInt32LE(size, 4); // biWidth
  header.writeInt32LE(size * 2, 8); // biHeight: XOR + AND
  header.writeUInt16LE(1, 12); // biPlanes
  header.writeUInt16LE(32, 14); // biBitCount
  const xor = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const from = (y * size + x) * 4;
      const to = ((size - 1 - y) * size + x) * 4; // flip: BMP rows run upward
      xor[to] = rgba[from + 2]; // B
      xor[to + 1] = rgba[from + 1]; // G
      xor[to + 2] = rgba[from]; // R
      xor[to + 3] = rgba[from + 3]; // A
    }
  }
  // AND mask: 1bpp, each row padded to a 4-byte boundary. Zero = opaque.
  const mask = Buffer.alloc(Math.ceil(size / 32) * 4 * size);
  header.writeUInt32LE(xor.length + mask.length, 20); // biSizeImage
  return Buffer.concat([header, xor, mask]);
};

const entries = [];
for (const size of ICO_SIZES) {
  const { data } = await sharp(Buffer.from(svg(size, Math.round(size * 0.09), 0, true)))
    .raw()
    .toBuffer({ resolveWithObject: true });
  entries.push({ size, payload: dib(data, size) });
}

const dir = Buffer.alloc(6 + entries.length * 16);
dir.writeUInt16LE(0, 0); // reserved
dir.writeUInt16LE(1, 2); // type 1 = icon
dir.writeUInt16LE(entries.length, 4);
let offset = dir.length;
entries.forEach((e, i) => {
  const at = 6 + i * 16;
  dir[at] = e.size; // 0 would mean 256
  dir[at + 1] = e.size;
  dir.writeUInt16LE(1, at + 4); // planes
  dir.writeUInt16LE(32, at + 6); // bit count
  dir.writeUInt32LE(e.payload.length, at + 8);
  dir.writeUInt32LE(offset, at + 12);
  offset += e.payload.length;
});

const ico = Buffer.concat([dir, ...entries.map((e) => e.payload)]);
writeFileSync(new URL('favicon.ico', OUT), ico);
console.log(`  ${'favicon.ico'.padEnd(22)} ${ICO_SIZES.join('/')}       ${(ico.length / 1024).toFixed(1)} KB`);
