/**
 * moderate — the Approve / Reject buttons in a notification email.
 *
 * Opened in a browser from the email, so it answers with a small HTML page
 * rather than JSON. Uses the service role key, which bypasses RLS — that is
 * the whole point, and it is why the signed token is checked first and why
 * this key never leaves the Edge Function environment.
 *
 * Deploy:  supabase functions deploy moderate --no-verify-jwt
 *
 * `--no-verify-jwt` is required because the caller is a mail client with no
 * Supabase session. Authorisation comes from the HMAC in the link.
 */
import { sign, safeEqual, esc } from '../_shared/util.ts';

const page = (title: string, message: string, ok: boolean) =>
  new Response(
    `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(title)}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
             background:#0b0c10;color:#f4f4f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:30rem;padding:2.5rem;text-align:center">
    <div style="font-size:2.5rem;line-height:1;margin-bottom:1rem">${ok ? '&#10003;' : '&#9888;'}</div>
    <h1 style="margin:0 0 .75rem;font-size:1.4rem">${esc(title)}</h1>
    <p style="margin:0;color:#9aa0ae;line-height:1.6;font-size:.95rem">${esc(message)}</p>
  </div>
</body></html>`,
    {
      status: ok ? 200 : 400,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // A moderation result is never worth caching, and a proxy holding on
        // to one would show a stale outcome on the next click.
        'Cache-Control': 'no-store',
      },
    }
  );

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get('id') ?? '';
  const action = url.searchParams.get('action') ?? '';
  const token = url.searchParams.get('token') ?? '';

  if (!id || !token || (action !== 'approve' && action !== 'reject')) {
    return page('Link not valid', 'That moderation link is incomplete.', false);
  }

  const secret = Deno.env.get('MODERATION_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !supabaseUrl || !serviceKey) {
    return page('Not configured', 'The moderation endpoint is missing its secrets.', false);
  }

  /* ---------- verify the signature BEFORE touching the database ---------- */
  const expected = await sign(`${id}:${action}`, secret);
  if (!safeEqual(token, expected)) {
    return page('Link not valid', 'That link has been altered or was not issued by us.', false);
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  const target = `${supabaseUrl}/rest/v1/comments?id=eq.${encodeURIComponent(id)}`;

  try {
    if (action === 'approve') {
      const res = await fetch(target, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ approved: true }),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);

      const rows = (await res.json()) as unknown[];
      // Zero rows means the comment was already rejected and deleted. Saying
      // so is more useful than a generic failure.
      if (rows.length === 0) {
        return page('Nothing to approve', 'That comment no longer exists — it was already rejected.', false);
      }
      return page('Published', 'The comment is now live on the post. Nothing else to do.', true);
    }

    const res = await fetch(target, { method: 'DELETE', headers });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);

    const rows = (await res.json()) as unknown[];
    if (rows.length === 0) {
      return page('Already gone', 'That comment had already been deleted.', true);
    }
    return page('Deleted', 'The comment has been removed and was never published.', true);
  } catch (err) {
    console.error('moderate failed:', err);
    return page('Something went wrong', 'The database rejected that change. Try the Supabase dashboard.', false);
  }
});
