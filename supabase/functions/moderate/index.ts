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
 *
 * ------------------------------------------------------------------
 * WHY A GET NEVER CHANGES ANYTHING HERE
 *
 * This used to approve or delete a comment on the GET request the email link
 * produced. That is one hop from a moderation queue that moderates itself.
 *
 * Mail security scanners follow links. Outlook SafeLinks, Defender's
 * detonation sandbox, corporate URL rewriters and ordinary link previewers all
 * fetch the URLs in a message to see where they go — before a person has read
 * anything. Every one of those fetches was an Approve or, worse, a Reject:
 * comments published or permanently deleted by a robot, with the mailbox owner
 * never told it happened.
 *
 * So the two verbs are split, the way they should have been:
 *
 *   GET   verifies the token and renders a confirmation page. Changes nothing.
 *   POST  verifies the token again and performs the action.
 *
 * Scanners issue GETs. They do not submit forms. That difference is the entire
 * defence and it costs the moderator one click.
 *
 * The token is also time-limited now — see MODERATION_TTL_SECONDS — so a link
 * in a forwarded or archived message stops being a key to publishing on the
 * site.
 */
import { verifyAction, esc } from '../_shared/util.ts';

/** Chrome shared by every response this function makes. */
const shell = (title: string, inner: string, status: number) =>
  new Response(
    `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${esc(title)}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
             background:#0b0c10;color:#f4f4f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:32rem;padding:2.5rem;text-align:center">${inner}</div>
</body></html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // A moderation result is never worth caching, and a proxy holding on
        // to one would show a stale outcome on the next click.
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
        'Referrer-Policy': 'no-referrer',
      },
    }
  );

/** A finished outcome, or a refusal. */
const page = (title: string, message: string, ok: boolean) =>
  shell(
    title,
    `<div style="font-size:2.5rem;line-height:1;margin-bottom:1rem">${ok ? '&#10003;' : '&#9888;'}</div>
     <h1 style="margin:0 0 .75rem;font-size:1.4rem">${esc(title)}</h1>
     <p style="margin:0;color:#9aa0ae;line-height:1.6;font-size:.95rem">${esc(message)}</p>`,
    ok ? 200 : 400
  );

/**
 * The confirmation step. The form posts back to this same URL, so the token
 * travels exactly as it arrived and nothing extra has to be carried.
 */
const confirm = (action: 'approve' | 'reject', url: URL) => {
  const approving = action === 'approve';
  const button = approving
    ? { bg: '#14161d', fg: '#e4c24c', label: 'Yes, publish it' }
    : { bg: '#f5f5f3', fg: '#16171b', label: 'Yes, delete it' };

  return shell(
    approving ? 'Publish this comment?' : 'Delete this comment?',
    `<h1 style="margin:0 0 .75rem;font-size:1.4rem">
       ${approving ? 'Publish this comment?' : 'Delete this comment?'}
     </h1>
     <p style="margin:0 0 1.75rem;color:#9aa0ae;line-height:1.6;font-size:.95rem">
       ${
         approving
           ? 'It will appear on the post immediately.'
           : 'It will be removed permanently. This cannot be undone.'
       }
     </p>
     <form method="post" action="${esc(url.pathname + url.search)}">
       <button type="submit" style="display:inline-block;padding:12px 22px;border:0;border-radius:6px;
           background:${button.bg};color:${button.fg};font-size:14px;font-weight:600;cursor:pointer">
         ${button.label}
       </button>
     </form>
     <p style="margin:1.75rem 0 0;color:#6d7285;line-height:1.6;font-size:.8rem">
       Nothing has changed yet. Close this tab to leave the comment as it is.
     </p>`,
    200
  );
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get('id') ?? '';
  const action = url.searchParams.get('action') ?? '';
  const token = url.searchParams.get('token') ?? '';
  const exp = Number(url.searchParams.get('exp') ?? '');

  if (req.method !== 'GET' && req.method !== 'POST') {
    return page('Not allowed', 'That request method is not supported here.', false);
  }

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
  const verdict = await verifyAction(id, action, exp, token, secret);
  if (verdict === 'invalid') {
    return page('Link not valid', 'That link has been altered or was not issued by us.', false);
  }
  if (verdict === 'expired') {
    return page(
      'Link expired',
      'Moderation links stop working after 30 days. Open the comment in the Supabase dashboard instead.',
      false
    );
  }

  /* ---------- a GET only ever asks ---------- */
  if (req.method === 'GET') return confirm(action, url);

  /* ---------- a POST is a person clicking the button ---------- */
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
