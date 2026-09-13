/**
 * Put a file in the R2 bucket and print its public URL.
 *
 *   node --env-file=.env scripts/upload-r2.mjs <file> [key]
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
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const [, , filePath, keyArg] = process.argv;

if (!filePath) {
  console.error('Usage: node --env-file=.env scripts/upload-r2.mjs <file> [key]');
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

const body = await readFile(filePath);
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

/* Sorted, lowercase, and every one of them signed — a header sent but not
   signed makes R2 reject the whole request rather than ignore the header. */
const canonicalHeaders =
  `content-type:${contentType}\n` +
  `host:${host}\n` +
  `x-amz-content-sha256:${payloadHash}\n` +
  `x-amz-date:${amzDate}\n`;
const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

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
console.log(`  ${mb} MB, ${contentType}`);
console.log(`  -> ${BUCKET}/${key}\n`);

const response = await fetch(`https://${host}${canonicalUri}`, {
  method: 'PUT',
  headers: {
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
