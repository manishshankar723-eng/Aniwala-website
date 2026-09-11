/**
 * submit — the only door the three public forms are meant to come through.
 *
 * WHY THIS EXISTS
 *
 * Until now every form posted straight to PostgREST with the anon key. That is
 * a supported Supabase pattern and RLS made it safe in the sense that mattered
 * — nobody could read a lead back. What it could never do is tell a person
 * from a script, because the anon key is in the JavaScript bundle and the
 * honeypot and timer are client-side:
 *
 *   curl -X POST 'https://<ref>.supabase.co/rest/v1/enquiries' \
 *     -H "apikey: <key from the bundle>" -d '{"name":"x","email":"x@x.com"}'
 *
 * The database rate limiter (schema.sql section 5) already caps the damage
 * from that, and it is the layer that actually protects the Resend quota. This
 * function is the layer in front of it: a Cloudflare Turnstile token, verified
 * server-side, so automated traffic never reaches the database at all.
 *
 * Deploy:  supabase functions deploy submit --no-verify-jwt
 *
 * `--no-verify-jwt` because visitors have no Supabase session. The
 * authorisation is the Turnstile token, checked below before anything else
 * happens.
 *
 * ------------------------------------------------------------------
 * WHY A FIELD ALLOWLIST AND NOT `...body.data`
 *
 * This function holds the SERVICE ROLE KEY, which bypasses RLS and every
 * column grant in schema.sql. Spreading a caller-supplied object into the
 * insert would hand the internet the ability to set `approved = true` on a
 * comment or `handled = true` on a lead — the precise things the column grants
 * were written to prevent, undone by the layer meant to protect them.
 *
 * So each form has an explicit list of fields, and anything not on it is
 * dropped. The lists below mirror the `grant insert (...)` statements in
 * schema.sql deliberately: if you add a column there, add it here too, and if
 * you are ever unsure whether a field belongs, leave it out.
 */
/* The origin allow-list and the CORS headers are shared with `moderate` and
   `schedule`. Three copies of one list is three chances for one of them to go
   quietly stale, and the stale one is a door left the wrong width. */
import { allowedOrigin, corsHeaders as cors } from '../_shared/util.ts';

const TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/* Exactly the columns anon was granted in schema.sql section 4. Nothing that
   drives moderation or triage state appears in any of them. */
const FIELDS: Record<string, string[]> = {
  enquiry: [
    'name', 'email', 'phone', 'company', 'enquiry_type', 'message',
    'duration_mins', 'slot_label', 'slot_utc', 'visitor_tz', 'guest_emails',
    'source_path',
  ],
  application: [
    'kind', 'role_slug', 'role_title', 'discipline', 'desired_role',
    'name', 'email', 'phone', 'location', 'experience', 'availability',
    'portfolio_url', 'cv_url', 'message', 'source_path',
  ],
  comment: ['post_slug', 'author_name', 'author_email', 'body'],
};

const TABLE: Record<string, string> = {
  enquiry: 'enquiries',
  application: 'applications',
  comment: 'comments',
};

const json = (status: number, body: unknown, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(origin) },
  });

/** The visitor's address, as seen by the edge. */
const clientIp = (req: Request): string =>
  (req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0] ??
    req.headers.get('x-real-ip') ??
    '').trim();

Deno.serve(async (req) => {
  const origin = allowedOrigin(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' }, origin);
  }
  if (!origin) {
    // No Origin header, or one that is not ours. A browser always sends it on
    // a cross-origin POST, so this is a script — and it has no business here.
    return json(403, { error: 'Forbidden' }, null);
  }

  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !supabaseUrl || !serviceKey) {
    console.error('submit is missing TURNSTILE_SECRET_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    return json(500, { error: 'The form is not configured. Please email us instead.' }, origin);
  }

  let body: { form?: string; token?: string; data?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON' }, origin);
  }

  const form = String(body.form ?? '');
  const table = TABLE[form];
  if (!table) return json(400, { error: 'Unknown form' }, origin);

  const token = String(body.token ?? '');
  if (!token) return json(400, { error: 'Please complete the verification and try again.' }, origin);

  /* ---------- verify with Cloudflare BEFORE touching the database ---------- */
  const ip = clientIp(req);
  let verdict: { success?: boolean; 'error-codes'?: string[] };
  try {
    const form_ = new FormData();
    form_.append('secret', secret);
    form_.append('response', token);
    if (ip) form_.append('remoteip', ip);
    const res = await fetch(TURNSTILE_VERIFY, { method: 'POST', body: form_ });
    verdict = await res.json();
  } catch (err) {
    // Cloudflare being unreachable must not silently become "allowed".
    console.error('turnstile verify failed:', err);
    return json(503, { error: 'Could not verify you are human just now. Please try again shortly.' }, origin);
  }

  if (!verdict.success) {
    console.warn('turnstile rejected:', verdict['error-codes']);
    return json(403, { error: 'That verification did not check out. Please try again.' }, origin);
  }

  /* ---------- build the row from the allowlist ONLY ---------- */
  const incoming = (body.data ?? {}) as Record<string, unknown>;
  const row: Record<string, unknown> = {};
  for (const key of FIELDS[form]) {
    const value = incoming[key];
    if (value === undefined || value === null || value === '') continue;

    /*
     * SHAPE, as well as name.
     *
     * The allowlist above decides WHICH keys survive; this decides what may
     * arrive under one. Without it an object or an array is forwarded to
     * PostgREST as-is, and what happens next depends on the column type
     * rather than on anything decided here — which is the wrong place for the
     * decision to be made. Every column in these three tables is text, an
     * int, a timestamp or a boolean, so a scalar is the whole of what is ever
     * legitimate.
     *
     * The DB's own CHECK constraints still cap the lengths; this is about
     * type, and about not handing a caller-shaped object to the layer holding
     * the service role key.
     */
    const t = typeof value;
    if (t !== 'string' && t !== 'number' && t !== 'boolean') {
      return json(400, { error: 'That submission was malformed.' }, origin);
    }

    row[key] = value;
  }
  if (Object.keys(row).length === 0) {
    return json(400, { error: 'Nothing to submit.' }, origin);
  }

  /* ---------- insert as the service role ---------- */
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      /*
       * The visitor's address, for the rate-limit trigger.
       *
       * Without this the trigger would see THIS FUNCTION's egress address on
       * every submission — one shared bucket for the whole internet, so the
       * per-address ceiling would either block everybody or mean nothing.
       *
       * The trigger only trusts this header when the caller is `service_role`
       * (see schema.sql section 5), so it cannot be spoofed by anyone holding
       * the public anon key.
       */
      'x-client-ip': ip,
    },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    const text = await res.text();
    /*
     * ONLY A 429 IS PASSED THROUGH, and the narrowness is the point.
     *
     * The rate limiter raises PT429 with a message written for the person
     * reading it — "please wait a little and try again" — so relaying that one
     * is the whole reason this branch exists.
     *
     * Every OTHER failure here is Postgres talking to itself, and it is
     * specific about the schema in a way nobody outside should see:
     *
     *   permission denied for table enquiries
     *   new row for relation "enquiries" violates check constraint
     *     "enquiries_email_check"
     *
     * That names tables, columns and constraints to anyone who can POST a
     * malformed body — a free map of the database, handed out by the layer
     * holding the service role key. It is not a break on its own; it is the
     * reconnaissance step before one, and there is no reason to help with it.
     *
     * So the generic message stands for everything that is not a 429, and the
     * real text goes to `console.error` below, where the person who needs it
     * can read it in the function logs.
     */
    let message = 'Something went wrong sending that. Please email us instead.';
    if (res.status === 429) {
      try {
        const parsed = JSON.parse(text);
        if (parsed?.message) message = parsed.message;
      } catch { /* non-JSON body — keep the generic message */ }
    }
    console.error(`insert into ${table} failed: ${res.status} ${text}`);
    return json(res.status === 429 ? 429 : 400, { error: message }, origin);
  }

  return json(200, { ok: true }, origin);
});
