/**
 * notify — turns a database row into an email, and into a Studio document.
 *
 * Fired by a Supabase Database Webhook on INSERT into `comments`,
 * `enquiries` or `applications`. Every submission is also mirrored into
 * Sanity, where the whole intake can be read in one place instead of two
 * dashboards — see `_shared/sanity.ts`, which is careful about what that copy
 * is and is not. Run `supabase/mirror-events.sql` and the webhooks fire on
 * UPDATE and DELETE too, so the copy keeps up with the row rather than
 * freezing at the moment it arrived. Only an INSERT ever sends mail. Enquiries are routed to whoever handles that
 * service. Applications go to MAIL_CAREERS if it is set, with the portfolio
 * link as a one-click open. Comments arrive with Approve and Reject buttons,
 * so moderation happens from the inbox rather than the Supabase dashboard.
 *
 * AN ENQUIRY WITH A TIME ON IT IS A BOOKING, and it gets more than a
 * notification:
 *
 *   - the studio's copy carries Confirm and Decline buttons, which stand in
 *     front of the `schedule` function — one press sends a real calendar
 *     invitation to the person who booked and every guest they added;
 *   - the person who booked gets an acknowledgement immediately, so the wait
 *     for that confirmation is not silence.
 *
 * A contact-form enquiry has no `slot_utc` and is left exactly as it was: one
 * email, no buttons, nothing to acknowledge.
 *
 * Each table needs its own webhook in Database → Webhooks. Adding the
 * `applications` branch here does nothing until that third hook exists.
 *
 * Deploy:  supabase functions deploy notify --no-verify-jwt
 *
 * `--no-verify-jwt` is required because the caller is a database trigger, not
 * a signed-in user. The function is not left open, though: it checks a shared
 * secret header that only the webhook knows. See README for the setup.
 */
import {
  signAction,
  safeEqual,
  sendMail,
  esc,
  recipientFor,
  layout,
  row,
  button,
  BUTTON_GAP,
  parseGuests,
  fmtWhen,
  studioTz,
  studioName,
  bookingSecret,
  BOOKING_TTL_SECONDS,
  type Mail,
} from '../_shared/util.ts';

import { mirrorRow, sanityConfigured } from '../_shared/sanity.ts';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, unknown> | null;
  /** Set on DELETE, where `record` is null — it is the row that just went. */
  old_record?: Record<string, unknown> | null;
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
  // `safeEqual`, not `!==`. A plain string comparison returns as soon as it
  // finds a differing character, so how long it takes reveals how much of a
  // guessed secret was right — which turns an infeasible search for the whole
  // value into a feasible one, character by character. The constant-time
  // compare was already in _shared/util.ts for the moderation token; this
  // check is no less worth it.
  if (!safeEqual(req.headers.get('x-notify-secret') ?? '', expected)) {
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

  /*
   * ---------- everything that is not a new row ----------
   *
   * UPDATE and DELETE reach this function for one reason: keeping the Studio
   * mirror honest. A booking you confirm, a comment you approve, a lead you
   * tick off in the dashboard — each of those is an UPDATE, and a copy that
   * still says "new" a week later is worse than no copy, because somebody
   * will act on it.
   *
   * NO EMAIL IS EVER SENT ON ONE. That is what makes it safe to add these
   * events to the webhooks that already exist rather than standing up a
   * second function beside this one.
   *
   * A failure here IS allowed to 5xx, unlike on the INSERT path below. There
   * is no email to send twice, `mirrorRow` writes the same document whatever
   * happens, and Supabase's three retries are then a free second attempt at a
   * copy that would otherwise be silently stale.
   */
  if (payload.type !== 'INSERT') {
    const row = payload.type === 'DELETE' ? payload.old_record : payload.record;
    if (!row) return json(200, { skipped: true });
    try {
      await mirrorRow(payload.table, payload.type, row);
      return json(200, { mirrored: sanityConfigured() });
    } catch (err) {
      console.error(`mirror of ${payload.type} on ${payload.table} failed:`, err);
      return json(500, { error: err instanceof Error ? err.message : 'Mirror failed' });
    }
  }

  const record = payload.record;
  if (!record) return json(200, { skipped: true });

  const siteUrl = (Deno.env.get('SITE_URL') ?? 'https://aniwala.com').replace(/\/$/, '');

  try {
    let mail: Mail;
    /*
     * A second email, sent AFTER the first and allowed to fail on its own.
     *
     * Only bookings get one: an acknowledgement, so the person who picked a
     * time has something in their inbox rather than a page that said "we will
     * confirm by email" and then nothing. It is deliberately not part of
     * `mail` — see the send at the bottom for why its failure must not take
     * the studio's own notification down with it.
     */
    let ack: Mail | null = null;

    /* ---------------------------------------------------------------- */
    if (payload.table === 'enquiries') {
      const type = (record.enquiry_type as string) ?? null;
      const id = String(record.id);
      const name = String(record.name ?? '');
      const email = String(record.email ?? '');
      const duration = Number(record.duration_mins) || 30;
      const studio = recipientFor(type);
      const guests = parseGuests(record.guest_emails, [email, ...studio]);

      /*
       * A BOOKING or a CONTACT ENQUIRY, and the difference is one column.
       *
       * `slot_utc` is written only by the booking widget — the contact form
       * leaves it null. Everything that follows from having a time attached
       * (the Confirm and Decline buttons, the calendar invitation, the
       * acknowledgement) hangs off this one test, so a plain enquiry keeps
       * arriving exactly as it always did rather than growing buttons that
       * would have nothing to act on.
       */
      const parsed = record.slot_utc ? new Date(String(record.slot_utc)) : null;
      /* An unparseable timestamp is treated as no timestamp. `new Date('x')`
         is not null, it is an Invalid Date, and every reading of it prints
         "Invalid Date" rather than failing — including into the subject line
         of an email to a client. */
      const start = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
      const visitorTz = (record.visitor_tz as string) || studioTz();

      /*
       * No signing secret means no buttons — NOT no notification.
       *
       * The comments branch below refuses outright when MODERATION_SECRET is
       * missing, because a moderation email without its two buttons is an
       * email with nothing in it to do. A booking notification is different:
       * it is a lead, and a lead must reach a human whatever else is
       * misconfigured. So this degrades to the email that was being sent
       * before the buttons existed, and says so in the log.
       */
      let secret: string | null = null;
      try {
        secret = bookingSecret();
      } catch {
        console.error(
          'BOOKING_SECRET / MODERATION_SECRET is not set — sending the enquiry without Confirm buttons.'
        );
      }

      let actions = '';
      if (start && secret) {
        /*
         * The links point at the WEBSITE, not at this function, and the token
         * covers the row id AND the action — so a Confirm link cannot be
         * edited into a Decline one, replayed on another booking, or acted on
         * by the mail scanner that fetches it before you have read a word.
         * `moderate/index.ts` carries the long version of both arguments.
         */
        const c = await signAction(id, 'confirm', secret, BOOKING_TTL_SECONDS);
        const d = await signAction(id, 'decline', secret, BOOKING_TTL_SECONDS);
        const url = (act: string, e: number, t: string) =>
          `${siteUrl}/schedule/?id=${id}&action=${act}&exp=${e}&token=${t}`;

        actions = `<p style="margin:26px 0 10px;font-size:13px;color:#83879a">
             Nothing is in anyone's calendar until you say so.
           </p>
           <p style="margin:0">
             ${button(url('confirm', c.exp, c.token), 'Confirm &amp; send invite', '#14161d', '#e4c24c')}
             ${BUTTON_GAP}
             ${button(url('decline', d.exp, d.token), 'Cannot make it', '#f5f5f3', '#16171b')}
           </p>`;
      }

      mail = {
        to: studio,
        subject: `${start ? 'New call request' : 'New enquiry'} — ${type ?? 'general'} — ${name}`,
        // So hitting Reply in the mail client writes to the person who asked.
        replyTo: email,
        html: layout(
          start ? 'Somebody has asked for a call' : 'New enquiry from the website',
          `<table style="border-collapse:collapse;width:100%">
             ${row('Name', record.name)}
             ${row('Email', record.email)}
             ${row('Phone', record.phone)}
             ${row('Company', record.company)}
             ${row('About', type)}
             ${row('Slot', record.slot_label)}
             ${/* The same instant in the studio's own timezone. Reading a
                  client's local time and diarising it unconverted is the
                  single most common way one of these gets missed. */ ''}
             ${
               start && visitorTz !== studioTz()
                 ? row('Your time', fmtWhen(start, duration, studioTz()))
                 : ''
             }
             ${row('Duration', record.duration_mins ? `${record.duration_mins} min` : '')}
             ${row('Timezone', record.visitor_tz)}
             ${row('Guests', guests.join(', '))}
             ${row('From page', record.source_path)}
           </table>
           ${
             record.message
               ? `<div style="margin-top:20px;padding:16px;background:#f5f5f3;border-radius:8px;
                             font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(record.message)}</div>`
               : ''
           }
           ${actions}
           <p style="margin:24px 0 0;font-size:13px;color:#83879a">
             Reply to this email to answer them directly.
           </p>`
        ),
      };

      if (start) {
        ack = {
          to: [email],
          /* The guests are copied so they know the request exists at all —
             otherwise the first they hear of the call is an invitation to
             one they were never told about. */
          cc: guests,
          subject: `We have your call request — ${studioName()}`,
          replyTo: studio[0],
          html: layout(
            'Thanks — we have your request',
            `<p style="margin:0 0 20px;font-size:15px;line-height:1.6">
               Hello ${esc(name)}, thank you for asking for a call. Nothing is
               booked yet: we confirm each one by hand, usually within a working
               day, and you will get a calendar invitation as soon as we do.
             </p>

             <table style="border-collapse:collapse;width:100%">
               ${row('You asked for', fmtWhen(start, duration, visitorTz))}
               ${row('Duration', `${duration} min`)}
               ${row('About', type)}
               ${row('Guests', guests.join(', '))}
             </table>

             <p style="margin:24px 0 0;font-size:13px;color:#83879a">
               If that time has stopped working, just reply to this email and
               we will find another.
             </p>`
          ),
        };
      }

      /* ---------------------------------------------------------------- */
    } else if (payload.table === 'applications') {
      /*
       * Applications go to their own address where one is configured. A CV
       * filed in among the client briefs is a CV that gets missed, and the
       * person who reads briefs is rarely the person who should be watching
       * a reel. Falls back to the default inbox rather than failing.
       */
      const careers = Deno.env.get('MAIL_CAREERS');
      const open = record.kind === 'open';
      const what = open
        ? (record.desired_role as string) || 'an unlisted role'
        : (record.role_title as string) || 'a role';

      const link = (url: unknown, label: string) =>
        url
          ? `<a href="${esc(String(url))}" style="color:#8a6a10">${label}</a>`
          : '';

      mail = {
        to: careers ? [careers] : recipientFor(null),
        // The kind is in the subject line so the two queues are filterable
        // from the inbox without opening anything.
        subject: `${open ? 'Open application' : 'Application'} — ${what} — ${record.name}`,
        // So hitting Reply writes to the applicant.
        replyTo: record.email as string,
        html: layout(
          open ? 'Open application from the website' : 'New application from the website',
          `<table style="border-collapse:collapse;width:100%">
             ${row('Name', record.name)}
             ${row('Email', record.email)}
             ${row('Phone', record.phone)}
             ${row('Based in', record.location)}
             ${open ? row('Area', record.discipline) : row('Role', record.role_title)}
             ${open ? row('Role wanted', record.desired_role) : ''}
             ${row('Experience', record.experience)}
             ${row('Available', record.availability)}
             ${row('From page', record.source_path)}
           </table>

           <p style="margin:20px 0 0;font-size:15px">
             ${link(record.portfolio_url, 'Open the portfolio / reel')}
             ${record.cv_url ? ' &middot; ' : ''}
             ${link(record.cv_url, 'Open the CV')}
           </p>

           ${
             record.message
               ? `<div style="margin-top:20px;padding:16px;background:#f5f5f3;border-radius:8px;
                             font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(String(record.message))}</div>`
               : ''
           }

           <p style="margin:24px 0 0;font-size:13px;color:#83879a">
             We promise an answer within five working days on the careers page.
             Reply to this email to give them one.
           </p>`
        ),
      };

      /* ---------------------------------------------------------------- */
    } else if (payload.table === 'comments') {
      const secret = Deno.env.get('MODERATION_SECRET');
      if (!secret) {
        return json(500, { error: 'MODERATION_SECRET is not set.' });
      }

      const id = String(record.id);
      // The signature covers the action AND an expiry as well as the id, so an
      // approve link cannot be edited into a reject link (or the reverse), and
      // neither one works forever. See MODERATION_TTL_SECONDS in _shared.
      const a = await signAction(id, 'approve', secret);
      const r = await signAction(id, 'reject', secret);
      /*
       * These point at the WEBSITE, not at the Edge Function, and that is not
       * a cosmetic choice.
       *
       * Supabase rewrites `text/html` to `text/plain` on GET responses from
       * Edge Functions (anti-phishing on *.supabase.co), so a confirmation
       * page served from there reaches the moderator as raw HTML source with
       * the button rendered as a line of code. The page therefore lives at
       * SITE_URL/moderate/ and POSTs to the function when the button is
       * pressed.
       *
       * SITE_URL has to be the host actually serving the site — staging while
       * that is where it lives, production after cutover — or these links go
       * somewhere with no page on it.
       */
      const modUrl = (act: string, e: number, t: string) =>
        `${siteUrl}/moderate/?id=${id}&action=${act}&exp=${e}&token=${t}`;
      const approve = modUrl('approve', a.exp, a.token);
      const reject = modUrl('reject', r.exp, r.token);

      const postUrl = `${siteUrl}/blog/${record.post_slug}/`;

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
             ${BUTTON_GAP}
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

    /*
     * The acknowledgement is sent SECOND and its failure is swallowed, and
     * both halves of that are deliberate.
     *
     * A failed webhook is retried three times by Supabase, and a retry re-runs
     * this whole handler — including the notification that already arrived. So
     * a bounced acknowledgement (a typo'd address, a full mailbox, a Resend
     * hiccup) would otherwise turn one enquiry into four copies in the studio
     * inbox, in exchange for a courtesy email that was never going to deliver.
     *
     * The lead reaching a human is what this function exists for. The
     * acknowledgement is the nicety, so it is the one that gives way.
     */
    if (ack) {
      try {
        await sendMail(ack);
      } catch (err) {
        console.error('acknowledgement failed (the notification was sent):', err);
      }
    }

    /*
     * The Studio copy, last and swallowed, for the same reason as the
     * acknowledgement above and one more.
     *
     * A 5xx from here would make Supabase retry the webhook, and a retry
     * re-runs this whole handler — so a Sanity outage, an expired token or a
     * typo'd project id would turn one enquiry into four emails, in exchange
     * for a convenience copy of a row that is already safely in the database.
     * Getting the lead in front of a person is what this function is for.
     *
     * An UPDATE gets the opposite treatment (see the top of the handler): no
     * email is at stake there, so a failed mirror is allowed to fail loudly
     * and be retried.
     */
    try {
      await mirrorRow(payload.table, 'INSERT', record);
    } catch (err) {
      console.error('Studio mirror failed (the email was sent):', err);
    }

    return json(200, { sent: true });
  } catch (err) {
    // Supabase retries a failed webhook three times with backoff and logs it
    // under Database → Webhooks → Logs, so a real error must surface as 5xx
    // rather than being swallowed into a 200.
    console.error('notify failed:', err);
    return json(500, { error: err instanceof Error ? err.message : 'Unknown error' });
  }
});
