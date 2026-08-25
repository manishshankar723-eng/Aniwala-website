/**
 * notify — turns a new database row into an email.
 *
 * Fired by a Supabase Database Webhook on INSERT into `comments` or
 * `enquiries`. Enquiries are routed to whoever handles that service and are
 * purely a notification. Comments arrive with Approve and Reject buttons, so
 * moderation happens from the inbox rather than the Supabase dashboard.
 *
 * Deploy:  supabase functions deploy notify --no-verify-jwt
 *
 * `--no-verify-jwt` is required because the caller is a database trigger, not
 * a signed-in user. The function is not left open, though: it checks a shared
 * secret header that only the webhook knows. See README for the setup.
 */
import {
  sign,
  sendMail,
  esc,
  recipientFor,
  layout,
  row,
  type Mail,
} from '../_shared/util.ts';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, unknown> | null;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  /* ---------- authenticate the webhook ---------- */
  const expected = Deno.env.get('NOTIFY_SECRET');
  if (!expected) return json(500, { error: 'NOTIFY_SECRET is not set.' });
  if (req.headers.get('x-notify-secret') !== expected) {
    // Deliberately vague: an unauthenticated caller learns nothing about
    // whether the endpoint exists or what it expects.
    return json(401, { error: 'Unauthorized' });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const record = payload.record;
  if (payload.type !== 'INSERT' || !record) return json(200, { skipped: true });

  const siteUrl = (Deno.env.get('SITE_URL') ?? 'https://aniwala.com').replace(/\/$/, '');

  try {
    let mail: Mail;

    /* ---------------------------------------------------------------- */
    if (payload.table === 'enquiries') {
      const type = (record.enquiry_type as string) ?? null;

      mail = {
        to: recipientFor(type),
        subject: `New enquiry — ${type ?? 'general'} — ${record.name}`,
        // So hitting Reply in the mail client writes to the person who asked.
        replyTo: record.email as string,
        html: layout(
          'New enquiry from the website',
          `<table style="border-collapse:collapse;width:100%">
             ${row('Name', record.name)}
             ${row('Email', record.email)}
             ${row('Company', record.company)}
             ${row('About', type)}
             ${row('Slot', record.slot_label)}
             ${row('Duration', record.duration_mins ? `${record.duration_mins} min` : '')}
             ${row('Timezone', record.visitor_tz)}
             ${row('From page', record.source_path)}
           </table>
           ${
             record.message
               ? `<div style="margin-top:20px;padding:16px;background:#f5f5f3;border-radius:8px;
                             font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(record.message)}</div>`
               : ''
           }
           <p style="margin:24px 0 0;font-size:13px;color:#83879a">
             Reply to this email to answer them directly.
           </p>`
        ),
      };

      /* ---------------------------------------------------------------- */
    } else if (payload.table === 'comments') {
      const secret = Deno.env.get('MODERATION_SECRET');
      const fnBase = Deno.env.get('FUNCTIONS_BASE_URL');
      if (!secret || !fnBase) {
        return json(500, { error: 'MODERATION_SECRET or FUNCTIONS_BASE_URL is not set.' });
      }

      const id = String(record.id);
      // The signature covers the action as well as the id, so an approve link
      // cannot be edited into a reject link (or the reverse).
      const approve = `${fnBase}/moderate?id=${id}&action=approve&token=${await sign(`${id}:approve`, secret)}`;
      const reject = `${fnBase}/moderate?id=${id}&action=reject&token=${await sign(`${id}:reject`, secret)}`;

      const postUrl = `${siteUrl}/blog/${record.post_slug}/`;
      const button = (href: string, label: string, bg: string, fg: string) =>
        `<a href="${href}" style="display:inline-block;padding:12px 22px;border-radius:6px;
            background:${bg};color:${fg};font-size:14px;font-weight:600;text-decoration:none">${label}</a>`;

      mail = {
        to: recipientFor(null),
        subject: `Comment awaiting approval — ${record.post_slug}`,
        replyTo: (record.author_email as string) || undefined,
        html: layout(
          'A comment is waiting for you',
          `<table style="border-collapse:collapse;width:100%">
             ${row('From', record.author_name)}
             ${row('Email', record.author_email)}
             ${row('On post', record.post_slug)}
           </table>

           <div style="margin-top:20px;padding:16px;background:#f5f5f3;border-radius:8px;
                       font-size:15px;line-height:1.65;white-space:pre-wrap">${esc(record.body)}</div>

           <p style="margin:26px 0 10px;font-size:13px;color:#83879a">
             Nothing is public until you approve it.
           </p>
           <p style="margin:0">
             ${button(approve, 'Approve &amp; publish', '#14161d', '#e4c24c')}
             <span style="display:inline-block;width:10px"></span>
             ${button(reject, 'Reject &amp; delete', '#f5f5f3', '#16171b')}
           </p>

           <p style="margin:24px 0 0;font-size:13px;color:#83879a">
             <a href="${postUrl}" style="color:#8a6a10">Read the post</a> &middot;
             Reply to this email to answer the commenter directly.
           </p>`
        ),
      };

      /* ---------------------------------------------------------------- */
    } else {
      return json(200, { skipped: true, table: payload.table });
    }

    await sendMail(mail);
    return json(200, { sent: true });
  } catch (err) {
    // Supabase retries a failed webhook three times with backoff and logs it
    // under Database → Webhooks → Logs, so a real error must surface as 5xx
    // rather than being swallowed into a 200.
    console.error('notify failed:', err);
    return json(500, { error: err instanceof Error ? err.message : 'Unknown error' });
  }
});
