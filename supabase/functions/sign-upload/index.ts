/**
 * sign-upload — hands the Studio a short-lived URL for one R2 upload.
 *
 * Deploy:  supabase functions deploy sign-upload --no-verify-jwt
 * Secrets: supabase secrets set R2_ACCOUNT_ID=... R2_BUCKET=... \
 *            R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_PUBLIC_BASE=...
 *
 * `--no-verify-jwt` because the caller is an editor's browser inside the
 * Sanity Studio, which has no Supabase session. Authorisation is the Sanity
 * token, checked below.
 *
 * ------------------------------------------------------------------
 * WHY THE FILE DOES NOT COME THROUGH HERE.
 *
 * The obvious design is to POST the video to this function and have it write
 * to R2. An Edge Function's request body is capped well below the size of a
 * real video, so that design breaks on the first upload anybody cares about —
 * and it would pay to move every byte twice.
 *
 * So this signs and steps aside: the browser PUTs straight to R2 with the URL
 * it gets back. That is also why the bucket needs a CORS policy — see
 * `scripts/r2-cors.mjs`.
 *
 * ------------------------------------------------------------------
 * WHY THE SANITY TOKEN IS THE AUTHORISATION, and it cannot be a shared secret.
 *
 * The Studio is a static app. Anything compiled into it — including anything
 * from a SANITY_STUDIO_* variable — is readable by anyone who opens the
 * bundle, so a shared key here would be an open upload endpoint for the
 * bucket wearing a lock.
 *
 * The one credential an editor has that an outsider does not is their own
 * Sanity session. So the browser sends that, and this asks Sanity whether it
 * is real and belongs to THIS project. An attacker would need a working
 * account on the project, at which point they can already publish to the site.
 *
 * The token is never stored, never logged, and never used for anything except
 * that one question.
 */

const ALLOWED_TYPES = new Set(['video/mp4', 'video/webm']);
const EXT: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm' };

/* Generous — this is a backstop against a mis-drop, not a policy about how big
   a video should be. The editor decides that. */
const MAX_BYTES = 1024 * 1024 * 1024;

/* Only the deployed Studio and a local one. Not `*`: an open CORS policy here
   would let any page ask an editor's browser to mint upload URLs. */
const ALLOWED_ORIGINS = new Set(['https://aniwala.sanity.studio', 'http://localhost:3333']);

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : 'null',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(origin) },
  });

const enc = new TextEncoder();

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

const sha256 = async (data: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(data)));

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  return crypto.subtle.sign('HMAC', k, enc.encode(data));
}

/**
 * Is this a real editor on our project?
 *
 * Asked of Sanity rather than answered here, because Sanity is the only thing
 * that knows. A token that is invalid, revoked, or valid for somebody else's
 * project all come back 401, which is the same answer as far as this is
 * concerned.
 *
 * TWO THINGS THE OBVIOUS VERSION OF THIS GETS WRONG, both found by asking the
 * endpoint rather than reading about it:
 *
 *   1. WITH NO TOKEN AT ALL, `users/me` answers 200 — with `{}`. So checking
 *      `response.ok` is not an authorisation check, it is decoration. The
 *      identity has to be read out of the body and found to exist.
 *
 *   2. A READ-ONLY token is a perfectly valid identity. A viewer can see the
 *      dataset and has no business writing to the bucket, so a role that
 *      cannot change content is refused here as well.
 */
async function isEditor(token: string, projectId: string): Promise<boolean> {
  try {
    const r = await fetch(`https://${projectId}.api.sanity.io/v2021-06-07/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return false;

    const user = await r.json();
    if (!user?.id) return false;

    /* Named rather than derived: a role this does not recognise is refused,
       so a new Sanity role never silently arrives holding upload rights. */
    const CAN_WRITE = new Set(['administrator', 'editor', 'developer', 'contributor']);
    const roles: string[] = Array.isArray(user.roles)
      ? user.roles.map((role: { name?: string }) => String(role?.name ?? ''))
      : [];

    return roles.some((name) => CAN_WRITE.has(name));
  } catch {
    return false;
  }
}

/**
 * A key that is safe in a URL, cannot climb out of the prefix, and is THE SAME
 * for the same bytes.
 *
 * The suffix is a content hash, not a random string, and that is the whole
 * design. With a random suffix, dropping the same file twice produced two
 * identical objects under two names: a bucket filling with copies, and no way
 * to tell which one a piece was pointing at. Keyed by content, the second
 * upload resolves to the object that is already there.
 *
 * It still keeps the property the random suffix was for. Two DIFFERENT videos
 * that happen to share a filename hash differently, so neither can silently
 * replace the other.
 */
function safeKey(prefix: string, filename: string, contentType: string, hash: string): string {
  const base = (filename.replace(/\.[^.]+$/, '') || 'video')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  return `${prefix}/${base || 'video'}-${hash.slice(0, 16)}.${EXT[contentType]}`;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, origin);
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return json({ error: 'Forbidden' }, 403, origin);

  const ACCOUNT = Deno.env.get('R2_ACCOUNT_ID');
  const BUCKET = Deno.env.get('R2_BUCKET');
  const ACCESS_KEY = Deno.env.get('R2_ACCESS_KEY_ID');
  const SECRET = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const PUBLIC_BASE = Deno.env.get('R2_PUBLIC_BASE');
  const PROJECT_ID = Deno.env.get('SANITY_PROJECT_ID');

  if (!ACCOUNT || !BUCKET || !ACCESS_KEY || !SECRET || !PUBLIC_BASE || !PROJECT_ID) {
    console.error('sign-upload is missing configuration');
    return json({ error: 'Not configured' }, 500, origin);
  }

  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || !(await isEditor(token, PROJECT_ID))) {
    return json({ error: 'Sign in to the Studio to upload.' }, 401, origin);
  }

  let body: {
    filename?: string;
    contentType?: string;
    size?: number;
    prefix?: string;
    hash?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Expected JSON.' }, 400, origin);
  }

  const contentType = String(body.contentType ?? '');
  if (!ALLOWED_TYPES.has(contentType)) {
    return json({ error: 'Only .mp4 and .webm can be uploaded.' }, 400, origin);
  }
  if (typeof body.size === 'number' && body.size > MAX_BYTES) {
    return json({ error: 'That file is over 1GB.' }, 400, origin);
  }

  /* Hex, and exactly the length of a SHA-256. Validated rather than trusted:
     this becomes part of a key, and a caller-supplied string reaching the path
     unchecked is how an upload lands somewhere it should not. */
  const hash = String(body.hash ?? '');
  if (!/^[0-9a-f]{64}$/i.test(hash)) {
    return json({ error: 'Missing or malformed file hash.' }, 400, origin);
  }

  /* The prefix is chosen here from a fixed set, never taken from the request:
     a caller-supplied path is how an upload ends up overwriting something it
     was never meant to reach. */
  const prefix = body.prefix === 'hero' ? 'video/hero' : 'video/pieces';
  const key = safeKey(prefix, String(body.filename ?? ''), contentType, hash);

  /* ---- Presign (SigV4, query-string form) ------------------------------
     Query-string rather than header signing, because the browser cannot add
     an Authorization header to a cross-origin PUT without it becoming part of
     the preflight. Everything the signature covers has to travel in the URL. */
  const host = `${ACCOUNT}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${BUCKET}/${key}`
    .split('/')
    .map(encodeURIComponent)
    .join('/');

  async function presign(method: string, expires: number): Promise<string> {
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const scope = `${dateStamp}/auto/s3/aws4_request`;

    const query = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${ACCESS_KEY}/${scope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expires),
      'X-Amz-SignedHeaders': 'host',
    });
    query.sort();

    const canonicalRequest = [
      method,
      canonicalUri,
      query.toString(),
      `host:${host}\n`,
      'host',
      /* The body is not known at signing time and R2 accepts this sentinel for
         presigned requests. The URL is scoped to one key and expires anyway. */
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256(canonicalRequest)].join(
      '\n'
    );

    const kDate = await hmac(enc.encode(`AWS4${SECRET}`), dateStamp);
    const kRegion = await hmac(kDate, 'auto');
    const kService = await hmac(kRegion, 's3');
    const kSigning = await hmac(kService, 'aws4_request');
    const signature = hex(await hmac(kSigning, stringToSign));

    return `https://${host}${canonicalUri}?${query.toString()}&X-Amz-Signature=${signature}`;
  }

  const publicUrl = `${PUBLIC_BASE.replace(/\/+$/, '')}/${key}`;

  /*
   * Is it already there?
   *
   * The key is a content hash, so an object sitting at it IS this file — same
   * bytes, already uploaded. Saying so lets the browser skip the transfer
   * entirely, which on a re-drop of a large video is the difference between a
   * minute of waiting and none. It is also what stops the bucket collecting
   * copies of one video under several names.
   */
  try {
    const head = await fetch(await presign('HEAD', 60), { method: 'HEAD' });
    if (head.ok) return json({ publicUrl, contentType, exists: true }, 200, origin);
  } catch {
    /* A failed existence check is not a reason to refuse the upload. Fall
       through and send it again — a duplicate is better than a dead end. */
  }

  return json(
    {
      /* Ten minutes. Long enough for a large upload to start, short enough
         that a URL found in a log is worthless by the time anyone reads it. */
      uploadUrl: await presign('PUT', 600),
      publicUrl,
      contentType,
      exists: false,
    },
    200,
    origin
  );
});
