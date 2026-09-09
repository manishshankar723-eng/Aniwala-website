/**
 * moderate — performs the Approve / Reject action on a blog comment.
 *
 * Uses the service role key, which bypasses RLS. That is the whole point, and
 * it is why the signed token is verified before anything is touched and why
 * this key never leaves the Edge Function environment.
 *
 * Deploy:  supabase functions deploy moderate --no-verify-jwt
 *
 * `--no-verify-jwt` is required because the caller is a moderator's browser
 * with no Supabase session. Authorisation is the HMAC in the request body.
 *
 * ------------------------------------------------------------------
 * WHY THIS RETURNS JSON AND NOT A PAGE
 *
 * It used to render the confirmation page itself, which was the natural design
 * — the function already verifies the token, so it may as well draw the
 * screen. Supabase does not allow it, and not because of anything in our code:
 *
 *   `Content-Type: text/html` is rewritten to `text/plain` on GET responses
 *   from Edge Functions unless the project is on Pro with a custom domain.
 *
 * It is an anti-phishing measure — nobody should be able to serve convincing
 * HTML from a *.supabase.co URL. The symptom was a moderator opening an
 * Approve link and being shown a wall of HTML source with the button as a
 * line of code. Worth knowing before "fixing" this by setting the header
 * again: HEAD responses come back as text/html, which makes it look like the
 * header works, and only GETs are rewritten.
 *
 * So the page moved to the website — `src/pages/moderate.astro`, where HTML is
 * served as HTML — and this function kept the part that cannot be delegated.
 *
 * ------------------------------------------------------------------
 * A GET STILL CHANGES NOTHING, which is the property worth protecting.
 *
 * Mail security scanners follow links. Outlook SafeLinks, Defender's
 * detonation sandbox, corporate URL rewriters and ordinary link previewers all
 * fetch the URLs in a message before a person reads it. When this function
 * acted on GET, every one of those fetches published a comment or permanently
 * deleted one, silently, with the mailbox owner never told.
 *
 * Now the email points at a static page. A scanner fetching that renders some
 * markup and nothing happens. Only the button POSTs here, and only a POST
 * acts. Scanners do not submit forms.
 *
 * Tokens are time-limited too — see MODERATION_TTL_SECONDS — so a link in a
 * forwarded or archived message stops being a key to publishing on the site.
 */
/*
 * The moderation page is served from the website, so this is a genuine
 * cross-origin request and needs CORS. The allow-list is shared with `submit`
 * and `schedule`: the live site from SITE_URL, plus EXTRA_ORIGINS for staging,
 * plus localhost for `astro dev`.
 */
import { verifyAction, allowedOrigin, corsHeaders as cors } from '../_shared/util.ts';

/** `title` and `message` are what the page puts on screen. */
const json = (
  status: number,
  body: { title: string; message: string },
  origin: string | null
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      ...cors(origin),
    }),
  });

Deno.serve(async (req) => {
  const origin = allowedOrigin(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors(origin) });
  }

  /*
   * ONLY POST ACTS. A GET here is a mail scanner following a link, or somebody
   * pasting the endpoint into a browser, and neither is a moderation
   * decision. It gets a flat refusal rather than a redirect, so there is no
   * chance of a scanner being walked onwards into something that does act.
   */
  if (req.method !== 'POST') {
    return json(
      405,
      {
        title: 'Nothing happens here',
        message: 'Open the moderation link from the email instead.',
      },
      origin
    );
  }

  if (!origin) {
    return json(
      403,
      { title: 'Forbidden', message: 'That request came from an unknown origin.' },
      null
    );
  }

  let body: { id?: string; action?: string; exp?: number; token?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { title: 'Bad request', message: 'That request was malformed.' }, origin);
  }

  const id = String(body.id ?? '');
  const action = String(body.action ?? '');
  const token = String(body.token ?? '');
  const exp = Number(body.exp);

  if (!id || !token || (action !== 'approve' && action !== 'reject')) {
    return json(
      400,
      { title: 'Link not valid', message: 'That moderation link is incomplete.' },
      origin
    );
  }

  const secret = Deno.env.get('MODERATION_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !supabaseUrl || !serviceKey) {
    console.error('moderate is missing MODERATION_SECRET / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    return json(
      500,
      { title: 'Not configured', message: 'The moderation endpoint is missing its secrets.' },
      origin
    );
  }

  /* ---------- verify the signature BEFORE touching the database ---------- */
  const verdict = await verifyAction(id, action, exp, token, secret);
  if (verdict === 'invalid') {
    return json(
      403,
      { title: 'Link not valid', message: 'That link has been altered or was not issued by us.' },
      origin
    );
  }
  if (verdict === 'expired') {
    return json(
      403,
      {
        title: 'Link expired',
        message:
          'Moderation links stop working after 30 days. Open the comment in the Supabase dashboard instead.',
      },
      origin
    );
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
        return json(
          404,
          {
            title: 'Nothing to approve',
            message: 'That comment no longer exists — it was already rejected.',
          },
          origin
        );
      }
      return json(
        200,
        { title: 'Published', message: 'The comment is now live on the post. Nothing else to do.' },
        origin
      );
    }

    const res = await fetch(target, { method: 'DELETE', headers });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);

    const rows = (await res.json()) as unknown[];
    if (rows.length === 0) {
      return json(
        200,
        { title: 'Already gone', message: 'That comment had already been deleted.' },
        origin
      );
    }
    return json(
      200,
      { title: 'Deleted', message: 'The comment has been removed and was never published.' },
      origin
    );
  } catch (err) {
    console.error('moderate failed:', err);
    return json(
      500,
      {
        title: 'Something went wrong',
        message: 'The database rejected that change. Try the Supabase dashboard.',
      },
      origin
    );
  }
});
