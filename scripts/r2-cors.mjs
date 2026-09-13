/**
 * Put the CORS policy on the R2 bucket.
 *
 *   node --env-file=.env scripts/r2-cors.mjs --dry-run
 *   node --env-file=.env scripts/r2-cors.mjs
 *
 * WHY THE BUCKET NEEDS ONE AT ALL.
 *
 * The Studio uploads a video straight from the browser to R2, using a
 * presigned URL it got from the `sign-upload` Edge Function. Browser to R2
 * with nothing in between is the whole point: an Edge Function's request body
 * is capped far below the size of a real video, so anything that proxies the
 * file breaks on the first upload that matters.
 *
 * A cross-origin PUT is only allowed if the bucket says so. Without this the
 * upload fails at the preflight, before a single byte moves, and the browser
 * reports it as a network error — which reads as "R2 is down" rather than
 * "the bucket has no CORS policy".
 *
 * THE ORIGINS ARE A LIST, not `*`. Only the Studio uploads; the site merely
 * plays what is already there, and reading a video in a <video> tag is not a
 * CORS request at all. So `*` would be granting write-preflight rights to
 * every page on the internet for no benefit.
 */
import { createHash, createHmac } from 'node:crypto';

const DRY_RUN = process.argv.includes('--dry-run');

const ACCOUNT = process.env.R2_ACCOUNT_ID;
const BUCKET = process.env.R2_BUCKET;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET = process.env.R2_SECRET_ACCESS_KEY;

const missing = Object.entries({
  R2_ACCOUNT_ID: ACCOUNT,
  R2_BUCKET: BUCKET,
  R2_ACCESS_KEY_ID: ACCESS_KEY,
  R2_SECRET_ACCESS_KEY: SECRET,
})
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length) {
  console.error(`\nNot set in .env:\n${missing.map((m) => `  ${m}`).join('\n')}\n`);
  process.exit(1);
}

/* Where an upload can be started from. The deployed Studio, and a local one
   for anyone working on the input component. */
const ORIGINS = ['https://aniwala.sanity.studio', 'http://localhost:3333'];

const cors = `<CORSConfiguration><CORSRule>${ORIGINS.map((o) => `<AllowedOrigin>${o}</AllowedOrigin>`).join(
  ''
)}<AllowedMethod>PUT</AllowedMethod><AllowedHeader>*</AllowedHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule></CORSConfiguration>`;

console.log(`\n  ${BUCKET}  CORS`);
for (const o of ORIGINS) console.log(`    allow PUT from ${o}`);

if (DRY_RUN) {
  console.log('\nNothing was written.\n');
  process.exit(0);
}

const host = `${ACCOUNT}.r2.cloudflarestorage.com`;
const canonicalUri = `/${BUCKET}`;
const now = new Date();
const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
const dateStamp = amzDate.slice(0, 8);

const sha256 = (d) => createHash('sha256').update(d).digest('hex');
const hmac = (k, d) => createHmac('sha256', k).update(d).digest();

const payloadHash = sha256(cors);
/* `?cors` is a subresource, and it is part of the canonical query string —
   signing without it produces a valid-looking signature that R2 rejects. */
const canonicalQuery = 'cors=';
const canonicalHeaders =
  `content-type:application/xml\n` +
  `host:${host}\n` +
  `x-amz-content-sha256:${payloadHash}\n` +
  `x-amz-date:${amzDate}\n`;
const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

const canonicalRequest = [
  'PUT',
  canonicalUri,
  canonicalQuery,
  canonicalHeaders,
  signedHeaders,
  payloadHash,
].join('\n');

const scope = `${dateStamp}/auto/s3/aws4_request`;
const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');
const signingKey = hmac(hmac(hmac(hmac(`AWS4${SECRET}`, dateStamp), 'auto'), 's3'), 'aws4_request');
const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

const response = await fetch(`https://${host}${canonicalUri}?cors`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/xml',
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    Authorization:
      `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  },
  body: cors,
});

if (!response.ok) {
  const detail = await response.text();

  /*
   * A 403 here is almost always the token's SCOPE, not the signature — a bad
   * signature comes back as SignatureDoesNotMatch, not AccessDenied. Writing a
   * bucket's CORS policy is a bucket-level operation, and the token this repo
   * uses is deliberately "Object Read & Write" so that a leaked upload key
   * cannot reconfigure the bucket. That scope is worth keeping.
   *
   * So say that, rather than sending somebody to re-check a secret which is
   * working perfectly well for every upload.
   */
  if (response.status === 403) {
    console.error('\n  403 — this token may not configure the bucket, only its objects.');
    console.error('  That scope is correct and worth keeping, so set the policy by hand:\n');
    console.error(`    R2 → ${BUCKET} → Settings → CORS Policy → Add\n`);
    console.error(
      JSON.stringify(
        [
          {
            AllowedOrigins: ORIGINS,
            AllowedMethods: ['PUT'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3600,
          },
        ],
        null,
        2
      )
    );
    console.error('');
    process.exit(1);
  }

  console.error(`\nFailed: ${response.status} ${response.statusText}\n`);
  console.error(detail.slice(0, 600));
  process.exit(1);
}

console.log('\n  Done.\n');
