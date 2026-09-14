/**
 * Put a file in the R2 bucket and print its public URL.
 *
 *   node --env-file=.env scripts/upload-r2.mjs <file> [key] [--keep-audio]
 *   node --env-file=.env scripts/upload-r2.mjs dist/video/home-hero.mp4 video/home-hero.mp4
 *
 * WHY THIS SIGNS THE REQUEST BY HAND rather than using @aws-sdk/client-s3.
 *
 * The SDK is ~50 packages and several megabytes to send one PUT. This repo
 * already made the same call about Tailwind — a framework pulled in so one
 * page could use a dozen utilities — and the reasoning holds better here,
 * because everything below is one request with a fixed shape. SigV4 is a
 * documented hashing recipe, not an integration.
 *
 * R2 is S3-compatible with two fixed quirks worth knowing: the region is
 * always the literal string `auto`, and the endpoint is per-ACCOUNT, with the
 * bucket as the first path segment rather than a subdomain.
 *
 * NOTHING HERE REACHES THE SITE. The build renders whatever public URL is
 * stored on the hero block; these credentials only ever run on a laptop.
 */
import { createHash, createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const KEEP_AUDIO = process.argv.includes('--keep-audio');
const NO_POSTER = process.argv.includes('--no-poster');
/* `=` form on purpose. The positional parse below drops every `--` argument
   whole, so a space-separated value would survive as a stray positional and be
   read as the object key. */
const POSTER_AT = Number(
  process.argv.find((a) => a.startsWith('--poster-at='))?.split('=')[1] ?? NaN
);
const START_AT = Number(
  process.argv.find((a) => a.startsWith('--start='))?.split('=')[1] ?? NaN
);
const [, , filePath, keyArg] = process.argv.filter((a) => !a.startsWith('--'));

if (!filePath) {
  console.error('Usage: node --env-file=.env scripts/upload-r2.mjs <file> [key]');
  console.error('       [--keep-audio] [--no-poster] [--poster-at=<seconds>]');
  console.error('       [--start=<seconds>]   trim the front off, poster from the new first frame');
  process.exit(1);
}

const ACCOUNT = process.env.R2_ACCOUNT_ID;
const BUCKET = process.env.R2_BUCKET;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET = process.env.R2_SECRET_ACCESS_KEY;
const PUBLIC_BASE = process.env.R2_PUBLIC_BASE;

/* Named one at a time. "R2 is not configured" sends you to check all five. */
const missing = Object.entries({
  R2_ACCOUNT_ID: ACCOUNT,
  R2_BUCKET: BUCKET,
  R2_ACCESS_KEY_ID: ACCESS_KEY,
  R2_SECRET_ACCESS_KEY: SECRET,
  R2_PUBLIC_BASE: PUBLIC_BASE,
})
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length) {
  console.error(`\nNot set in .env:\n${missing.map((m) => `  ${m}`).join('\n')}\n`);
  console.error('See the R2 block at the end of .env.example for where each one comes from.\n');
  process.exit(1);
}

const TYPES = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};

/**
 * Cut the front off, so the video OPENS on the frame you want.
 *
 * This is the difference between a good poster and an invisible one. A
 * `<video>` swaps its poster for the first decoded frame instantly and
 * unfaded, so a still taken from a good moment and a video that opens on black
 * do not merely differ — they visibly snap the instant playback starts, and
 * again on every loop. Picking a better still makes that worse, because it
 * widens the gap.
 *
 * Trimming closes it from the other side. The poster is then taken from the
 * TRIMMED file at t=0 rather than from the original, so the still and the first
 * frame are the same bytes and the handover cannot be seen. The site also
 * crossfades the two (see `src/lib/video.ts`), which covers the cases this
 * cannot; the two are belt and braces and neither makes the other pointless.
 *
 * `-c:v copy`, so there is no re-encode and no generation loss — the same
 * trade `stripAudio` makes below. The cost is that a stream copy can only cut
 * at a KEYFRAME, so the real start lands at or before the second you asked
 * for, sometimes by a second or two. That does not weaken the guarantee: the
 * poster is read from wherever the cut actually landed. It is reported rather
 * than hidden, because "I asked for 1.6 and got 0.0" is something you want to
 * know before you look at the page and wonder.
 */
function trimFront(source) {
  if (!Number.isFinite(START_AT) || START_AT <= 0) return null;
  if (!/\.(mp4|webm|mov|m4v)$/i.test(source)) return null;

  const out = path.join(os.tmpdir(), `r2-trim-${Date.now()}${path.extname(source)}`);
  try {
    execFileSync(
      'ffmpeg',
      ['-y', '-v', 'error', '-ss', String(START_AT), '-i', source,
       '-c:v', 'copy', '-c:a', 'copy', '-movflags', '+faststart', out],
      { stdio: 'ignore' }
    );
  } catch {
    return null;
  }

  /* What the keyframe snap actually gave us, inferred from the durations
     rather than assumed. */
  const seconds = (file) => {
    try {
      return Number(
        execFileSync(
          'ffprobe',
          ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
          { encoding: 'utf8' }
        ).trim()
      );
    } catch {
      return NaN;
    }
  };

  const before = seconds(source);
  const after = seconds(out);
  const actual = Number.isFinite(before) && Number.isFinite(after) ? before - after : START_AT;

  return { file: out, temp: true, asked: START_AT, actual };
}

/**
 * Drop the audio track, unless asked not to.
 *
 * Every player on this site is muted. A hero loop has no controls at all, and
 * a portfolio tile only offers sound when the piece is marked as having some.
 * So an audio track on a silent video is bytes every visitor downloads and
 * nobody can ever hear.
 *
 * `-c:v copy` is what makes this cheap and safe: the video is not re-encoded,
 * so there is no generation loss and no wait. It rewrites the container
 * without the audio stream and changes nothing else.
 *
 * Needs ffmpeg. Without it the file uploads untouched and says so — failing an
 * upload over an optimisation would be the wrong trade.
 */
async function stripAudio(source) {
  if (KEEP_AUDIO) return { file: source, note: 'audio kept (--keep-audio)' };
  if (!/\.(mp4|webm|mov|m4v)$/i.test(source)) return { file: source };

  let hasAudio;
  try {
    hasAudio = Boolean(
      execFileSync(
        'ffprobe',
        ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', source],
        { encoding: 'utf8' }
      ).trim()
    );
  } catch {
    return { file: source, note: 'ffmpeg not found, uploading as-is' };
  }
  if (!hasAudio) return { file: source, note: 'no audio track' };

  const out = path.join(os.tmpdir(), `r2-silent-${Date.now()}${path.extname(source)}`);
  try {
    execFileSync(
      'ffmpeg',
      ['-y', '-v', 'error', '-i', source, '-an', '-c:v', 'copy', '-movflags', '+faststart', out],
      { stdio: 'ignore' }
    );
    return { file: out, temp: true, note: 'audio stripped' };
  } catch {
    return { file: source, note: 'could not strip audio, uploading as-is' };
  }
}

/**
 * A still for the video, written next to the source file.
 *
 * WHY THE SCRIPT DOES THIS AT ALL. A `<video>` with no poster paints a black
 * rectangle until its first frame decodes, so the poster is not decoration —
 * it is what the hero looks like for the whole of a cold load. Nothing in the
 * upload path could produce one before this: the Studio drop zone sends the
 * file straight from the browser to R2 and a browser has no decoder to hand,
 * and Sanity only ever receives a URL string. So every still on the site was a
 * separate manual upload that nobody revisited when the video changed. That is
 * how the homepage ended up showing a frame from the middle of a previous cut.
 *
 * WHICH FRAME, and this is the part worth getting right. Frame 0 is the
 * obvious choice and it is usually wrong — a graded piece opens on black, or
 * fades up, and a poster grabbed from the first frame is a black rectangle
 * that looks exactly like the bug it was meant to fix.
 *
 * So the opening is sampled at 2fps and scored, and the score is CONTRAST —
 * the standard deviation of the frame's luma — not brightness. Brightness
 * alone rejects a black frame and then happily picks a white flash or an empty
 * lit background. Spread asks "is there anything in this picture", which is
 * nearer the question. On the homepage reel it scores the opening black at 1.0
 * and the title reveal at 80.
 *
 * It is a DEFAULT, not a judgement. No measurement knows that a title card is
 * the frame you wanted; `--poster-at=<seconds>` is how you say so, and it is
 * expected to get used. The bar this clears is "never silently produce a black
 * rectangle", which is the failure that actually shipped.
 *
 * Measured from raw grayscale pixels rather than through ffmpeg's signalstats
 * filter. signalstats is the more obvious tool and it has to be reached
 * through the lavfi `movie=` source, whose filename is part of a filtergraph
 * STRING — so a Windows path arrives carrying a drive-letter colon and a
 * backslash, both of which are filtergraph syntax. Escaping that correctly on
 * every shell is a losing game. Passing the file as a plain `-i` argument and
 * doing the arithmetic here has no escaping surface at all: 16x9 grays is 144
 * bytes a frame, and the whole 15-second window is under 5KB.
 *
 * It is written, never uploaded. The video belongs in R2; a poster belongs in
 * Sanity as an image, on a different field depending on what the video is for
 * — a piece's Image, a discipline's Tile image, an artwork slot for the hero.
 * Guessing which would be worse than printing the path and letting you drop it
 * in the one place you already know.
 */
const POSTER_WINDOW_S = 15;
const POSTER_FPS = 2;
const GRID_W = 16;
const GRID_H = 9;

function posterFrame(source, forced) {
  if (NO_POSTER) return null;
  if (!/\.(mp4|webm|mov|m4v)$/i.test(source)) return null;

  let at = Number.isFinite(forced) ? forced : POSTER_AT;

  if (!Number.isFinite(at)) {
    let gray;
    try {
      gray = execFileSync(
        'ffmpeg',
        [
          '-v', 'error',
          '-i', source,
          '-t', String(POSTER_WINDOW_S),
          '-vf', `fps=${POSTER_FPS},scale=${GRID_W}:${GRID_H},format=gray`,
          '-f', 'rawvideo',
          '-pix_fmt', 'gray',
          '-',
        ],
        { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 20 }
      );
    } catch {
      return null;
    }

    const size = GRID_W * GRID_H;
    let best = { t: 0, score: -1 };

    for (let i = 0; i + size <= gray.length; i += size) {
      const frame = gray.subarray(i, i + size);
      let sum = 0;
      for (const p of frame) sum += p;
      const mean = sum / size;
      let variance = 0;
      for (const p of frame) variance += (p - mean) ** 2;
      const score = Math.sqrt(variance / size);
      if (score > best.score) best = { t: i / size / POSTER_FPS, score };
    }

    if (best.score < 0) return null;
    at = best.t;
  }

  /* Named after the file YOU passed, not after `source` — with `--start` the
     frame is read out of a trimmed temp copy, and writing the poster beside
     that would leave it in the OS temp directory to be swept away. */
  const out = path.join(
    path.dirname(filePath),
    `${path.basename(filePath, path.extname(filePath))}-poster.jpg`
  );

  try {
    /* `-ss` AFTER `-i` so the seek is frame-accurate rather than snapping to
       the nearest keyframe — which on a long GOP can be seconds away from the
       frame that was measured, and is how a careful pick still lands on
       black. */
    execFileSync(
      'ffmpeg',
      ['-y', '-v', 'error', '-i', source, '-ss', String(at), '-frames:v', '1', '-q:v', '3', out],
      { stdio: 'ignore' }
    );
    return { file: out, at };
  } catch {
    return null;
  }
}

/* Trim first, then strip: stripping rewrites the container, so doing it the
   other way round would throw away the faststart the trim just added. */
const trimmed = trimFront(filePath);
const stripped = await stripAudio(trimmed?.file ?? filePath);
const body = await readFile(stripped.file);
const key = (keyArg ?? path.basename(filePath)).replace(/^\/+/, '');
const ext = path.extname(key).toLowerCase();
const contentType = TYPES[ext] ?? 'application/octet-stream';

const host = `${ACCOUNT}.r2.cloudflarestorage.com`;
/* Each segment encoded, the separators kept — S3 canonicalisation treats the
   path as a path, not as one opaque string. */
const canonicalUri = `/${BUCKET}/${key}`
  .split('/')
  .map((seg) => encodeURIComponent(seg))
  .join('/');

const now = new Date();
const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
const dateStamp = amzDate.slice(0, 8);

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();

const payloadHash = sha256(body);

/*
 * HOW LONG A BROWSER MAY KEEP THIS.
 *
 * R2 sends no `Cache-Control` of its own — an object uploaded without one
 * comes back carrying an ETag and a Last-Modified and nothing else, so a
 * browser falls back to HEURISTIC freshness: a fraction of the object's age,
 * which for a file uploaded yesterday is a couple of hours. After that every
 * visit spends a round trip revalidating before it may play a frame. The
 * response is a cheap 304 rather than the whole file, so this was never the
 * headline cost — but it is a stall in front of a hero, and it is free to fix.
 *
 * NOT `immutable`, and not a year. `immutable` is only honest when the URL
 * changes with the content, and the key here is whatever the caller passed:
 * `const key = keyArg ?? basename(filePath)`. Re-uploading over an existing
 * key is a DOCUMENTED workflow — README, "Uploading": push a new file to
 * `video/home-hero.mp4` and the hero swaps with no Studio edit. Cache that for
 * a year and marked immutable, and the swap would reach nobody who had already
 * visited, for a year, with no way to force it short of renaming the file.
 *
 * A month with revalidation left available is the honest trade: repeat visits
 * inside it are instant, and an overwrite still reaches everybody once the
 * month is out. If a file ever needs the year, give it a content-hashed key
 * first — that is the half that makes the promise true.
 */
const cacheControl = 'public, max-age=2592000';

/* Sorted, lowercase, and every one of them signed — a header sent but not
   signed makes R2 reject the whole request rather than ignore the header.
   Adding one means adding it in BOTH places, and in alphabetical order. */
const canonicalHeaders =
  `cache-control:${cacheControl}\n` +
  `content-type:${contentType}\n` +
  `host:${host}\n` +
  `x-amz-content-sha256:${payloadHash}\n` +
  `x-amz-date:${amzDate}\n`;
const signedHeaders = 'cache-control;content-type;host;x-amz-content-sha256;x-amz-date';

const canonicalRequest = [
  'PUT',
  canonicalUri,
  '',
  canonicalHeaders,
  signedHeaders,
  payloadHash,
].join('\n');

/* `auto` is not a placeholder. R2 has no regions, and signing with a real
   one ("us-east-1", the habit from S3) fails with a signature mismatch that
   reads as a wrong secret key. */
const scope = `${dateStamp}/auto/s3/aws4_request`;
const stringToSign = [
  'AWS4-HMAC-SHA256',
  amzDate,
  scope,
  sha256(canonicalRequest),
].join('\n');

const signingKey = hmac(hmac(hmac(hmac(`AWS4${SECRET}`, dateStamp), 'auto'), 's3'), 'aws4_request');
const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

const mb = (body.length / 1024 / 1024).toFixed(2);
console.log(`\n  ${filePath}`);
console.log(`  ${mb} MB, ${contentType}${stripped.note ? `  (${stripped.note})` : ''}`);
console.log(`  -> ${BUCKET}/${key}\n`);

const response = await fetch(`https://${host}${canonicalUri}`, {
  method: 'PUT',
  headers: {
    'Cache-Control': cacheControl,
    'Content-Type': contentType,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    Authorization:
      `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  },
  body,
});

if (!response.ok) {
  console.error(`Upload failed: ${response.status} ${response.statusText}\n`);
  console.error((await response.text()).slice(0, 600));
  console.error('');
  process.exit(1);
}

const url = `${PUBLIC_BASE.replace(/\/+$/, '')}/${key}`;
console.log(`  Uploaded.\n  ${url}\n`);

if (trimmed) {
  console.log(`  Trimmed to start at ${trimmed.actual.toFixed(2)}s (asked for ${trimmed.asked}s —`);
  console.log('  a stream copy can only cut at a keyframe).\n');
}

/*
 * WHICH FILE THE STILL COMES FROM, and it is the whole point of `--start`.
 *
 * Trimmed: the prepared file at t=0, so the poster IS the first frame and the
 * handover cannot be seen at all. Untrimmed: the original, scored as described
 * on `posterFrame` — `stripped.file` would do equally well, since dropping an
 * audio track changes nothing about the pictures, but the original is certain
 * to still be on disk.
 *
 * This has to run BEFORE the temp files are removed, which is why the cleanup
 * moved down here from beside the upload.
 */
const poster = trimmed ? posterFrame(stripped.file, 0) : posterFrame(filePath);
if (poster) {
  console.log(`  Poster frame at ${poster.at.toFixed(2)}s:`);
  console.log(`  ${poster.file}`);
  console.log('  Put it on the video’s own document — a piece’s Image, a');
  console.log('  discipline’s Tile image, or a hero block’s Still image.\n');
}

if (stripped.temp) await unlink(stripped.file).catch(() => {});
if (trimmed?.temp && trimmed.file !== stripped.file) {
  await unlink(trimmed.file).catch(() => {});
}

/* Read it back. A 200 from the PUT only proves the object landed; it says
   nothing about whether the bucket is actually readable from the internet,
   which is a separate setting and the thing that quietly breaks the page. */
const check = await fetch(url, { method: 'HEAD' });
if (check.ok) {
  console.log(`  Public read OK (${check.headers.get('content-type')}).\n`);
} else {
  console.log(
    `  WARNING: the object uploaded but ${url} returns ${check.status}.\n` +
      `  The bucket is not public yet — R2 -> your bucket -> Settings -> Public access.\n`
  );
}
