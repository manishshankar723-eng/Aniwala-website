/**
 * schedule — confirms or declines a booking, and puts it on everybody's
 * calendar.
 *
 * WHAT THIS IS FOR
 *
 * A booking used to end at the notification email. The row landed in
 * `enquiries`, the studio inbox got a summary, and everything after that
 * happened by hand: someone read the slot, wrote back, and created a calendar
 * entry — or, on a busy week, did not, and the person who booked was left with
 * a page that said "we will confirm by email" and no email.
 *
 * So the notification now carries two buttons, and this is what stands behind
 * them:
 *
 *   Confirm  — writes the meeting link, marks the row confirmed, and sends
 *              ONE email carrying a real calendar invitation (an .ics with
 *              METHOD:REQUEST) to the person who booked, every guest they
 *              added, and the studio. It lands on calendars rather than in
 *              a paragraph somebody has to retype.
 *   Decline  — marks the row declined and tells them so, with a link back to
 *              the calendar to pick another time. If the booking had already
 *              been confirmed, a METHOD:CANCEL invitation goes with it, so the
 *              event comes off the calendars it was put on.
 *
 * Deploy:  supabase functions deploy schedule --no-verify-jwt
 *
 * `--no-verify-jwt` because the caller is the host's browser, opened from a
 * link in their inbox, with no Supabase session. The authorisation is the HMAC
 * over the row id AND the action, verified below before anything is read or
 * written — the same scheme the comment moderation links use.
 *
 * ------------------------------------------------------------------
 * WHY THIS RETURNS JSON AND NOT A PAGE, and why a GET does nothing.
 *
 * Both properties are inherited from `moderate`, and both were learned the
 * hard way there. In short:
 *
 *   - Supabase rewrites `text/html` to `text/plain` on GET responses from Edge
 *     Functions, so a page rendered here reaches the host as HTML source. The
 *     page therefore lives on the website, at `/schedule/`.
 *   - Mail scanners follow every link in a message before a person reads it.
 *     If a GET confirmed a booking, Outlook SafeLinks would send calendar
 *     invitations to clients on the studio's behalf, silently. Only a POST
 *     acts, and scanners do not submit forms.
 *
 * Read the long version in `moderate/index.ts` before changing either.
 */
import {
  verifyAction,
  allowedOrigin,
  corsHeaders as cors,
  bookingSecret,
  recipientFor,
  sendMail,
  layout,
  row,
  esc,
  button,
  parseGuests,
  MAX_GUESTS,
  icsAttachment,
  calendarLinks,
  fmtWhen,
  studioTz,
  studioName,
  meetingRoomFor,
  type CalendarEvent,
} from '../_shared/util.ts';

/** Exactly the columns this function reads. `select=*` would pull more. */
const COLUMNS =
  'id,name,email,enquiry_type,message,duration_mins,slot_label,slot_utc,visitor_tz,guest_emails,status,meeting_url,invite_seq';

interface Enquiry {
  id: string;
  name: string;
  email: string;
  enquiry_type: string | null;
  message: string | null;
  duration_mins: number | null;
  slot_label: string | null;
  slot_utc: string | null;
  visitor_tz: string | null;
  guest_emails: string | null;
  status: string;
  meeting_url: string | null;
  invite_seq: number;
}

/** `title` and `message` are what the page puts on screen. */
interface Reply {
  title?: string;
  message?: string;
  /** Only on a successful `view` — everything the confirm screen renders. */
  booking?: Record<string, unknown>;
}

const json = (status: number, body: Reply, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      ...cors(origin),
    }),
  });


/**
 * The joining link, refused unless it is one.
 *
 * This string is written by whoever holds the confirmation link and then goes
 * out to clients over the studio's own name, so `javascript:` and `data:` are
 * not merely untidy here. Anything that is not plain http(s) is dropped rather
 * than corrected — a silently rewritten meeting link is worse than a missing
 * one, because a missing one is noticed.
 */
function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.protocol === 'http:' ? trimmed : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const origin = allowedOrigin(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (req.method !== 'POST') {
    return json(
      405,
      {
        title: 'Nothing happens here',
        message: 'Open the confirmation link from the email instead.',
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

  let body: {
    id?: string;
    action?: string;
    exp?: number;
    token?: string;
    op?: string;
    meetingUrl?: string;
    guests?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json(400, { title: 'Bad request', message: 'That request was malformed.' }, origin);
  }

  const id = String(body.id ?? '');
  const action = String(body.action ?? '');
  const token = String(body.token ?? '');
  const exp = Number(body.exp);
  /*
   * `op` is NOT part of the signature, and does not need to be. The signature
   * proves the caller holds a link this studio issued for this row and this
   * action; `op` only says whether they are looking at the booking or acting
   * on it. Anyone who can pass the first test could do both anyway.
   */
  const op = body.op === 'commit' ? 'commit' : 'view';

  if (!id || !token || (action !== 'confirm' && action !== 'decline')) {
    return json(
      400,
      { title: 'Link not valid', message: 'That booking link is incomplete.' },
      origin
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  let secret: string;
  try {
    secret = bookingSecret();
  } catch {
    console.error('schedule is missing BOOKING_SECRET / MODERATION_SECRET');
    return json(
      500,
      { title: 'Not configured', message: 'The booking endpoint is missing its secrets.' },
      origin
    );
  }
  if (!supabaseUrl || !serviceKey) {
    console.error('schedule is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    return json(
      500,
      { title: 'Not configured', message: 'The booking endpoint is missing its secrets.' },
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
        message: 'That booking link has passed its window. Answer them by email instead.',
      },
      origin
    );
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };
  const target = `${supabaseUrl}/rest/v1/enquiries?id=eq.${encodeURIComponent(id)}`;

  try {
    /* ---------- read the booking ---------- */
    const read = await fetch(`${target}&select=${COLUMNS}`, { headers });
    if (!read.ok) throw new Error(`read ${read.status} ${await read.text()}`);

    const rows = (await read.json()) as Enquiry[];
    const booking = rows[0];
    if (!booking) {
      return json(
        404,
        { title: 'Not found', message: 'That booking is no longer in the database.' },
        origin
      );
    }

    const duration = booking.duration_mins ?? 30;
    /* `new Date('nonsense')` is an Invalid Date, not null, and every reading
       of one prints "Invalid Date" instead of failing — into a calendar
       invitation, in this case. Treated as no time at all. */
    const parsed = booking.slot_utc ? new Date(booking.slot_utc) : null;
    const start = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
    const visitorTz = booking.visitor_tz || studioTz();
    const studio = recipientFor(booking.enquiry_type);
    /* Never invite somebody twice: the booker and the studio are already
       addressees, and a duplicate reads as a second, conflicting invitation. */
    const guests = parseGuests(booking.guest_emails, [booking.email, ...studio]);

    /*
     * WHERE THE CALL HAPPENS, in order of who gets to decide.
     *
     *   1. Whatever the host typed on the confirmation screen — including
     *      clearing it, which means "no link at all".
     *   2. What was written the last time this booking was confirmed, so a
     *      re-send never moves the room out from under people already holding
     *      the invitation.
     *   3. MEETING_URL, for a studio that would rather have one standing room.
     *   4. A room of this booking's own, derived from its id.
     *
     * The fourth is the one that does the work. Before it, confirming meant
     * remembering to go and make a meeting somewhere else, paste the link, and
     * hope it was the right one — which is most of what "confirm" was supposed
     * to stop being.
     */
    const defaultMeetingUrl = safeUrl(Deno.env.get('MEETING_URL')) ?? '';
    const autoRoom = await meetingRoomFor(booking.id, secret);
    const suggestedUrl = booking.meeting_url || defaultMeetingUrl || autoRoom;

    /* ---------- op: view — what the confirmation page renders ---------- */
    if (op === 'view') {
      return json(
        200,
        {
          booking: {
            name: booking.name,
            email: booking.email,
            enquiryType: booking.enquiry_type,
            message: booking.message,
            durationMins: duration,
            slotLabel: booking.slot_label,
            slotUtc: booking.slot_utc,
            visitorTz,
            /* Both readings, because the host is not in the visitor's
               timezone and "11:00" alone is how calls get missed. */
            whenVisitor: start ? fmtWhen(start, duration, visitorTz) : null,
            whenStudio: start ? fmtWhen(start, duration, studioTz()) : null,
            past: start ? start.getTime() < Date.now() : false,
            guests,
            maxGuests: MAX_GUESTS,
            status: booking.status,
            /* Pre-filled on the screen, so confirming really is one press —
               and so the host sees the room before anyone is invited to it. */
            meetingUrl: suggestedUrl,
            studioName: studioName(),
          },
        },
        origin
      );
    }

    /* ================= op: commit ================= */

    if (!start) {
      // A contact-form enquiry carries no slot, so there is nothing to put on
      // a calendar. The notification for those never grows these buttons; this
      // is the guard for a link that was somehow made anyway.
      return json(
        400,
        {
          title: 'Not a booking',
          message: 'That enquiry has no time attached, so there is nothing to confirm.',
        },
        origin
      );
    }

    const bookPage = `${(Deno.env.get('SITE_URL') ?? 'https://aniwala.com').replace(/\/$/, '')}/contact/#book`;

    /* ---------- decline ---------- */
    if (action === 'decline') {
      const wasConfirmed = booking.status === 'confirmed';
      const seq = (Number(booking.invite_seq) || 0) + 1;

      const patch = await fetch(target, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'declined', invite_seq: seq }),
      });
      if (!patch.ok) throw new Error(`patch ${patch.status} ${await patch.text()}`);

      /*
       * A cancellation goes out ONLY if something was actually put on a
       * calendar. Sending METHOD:CANCEL for an event nobody ever accepted
       * produces a "this meeting was cancelled" notice for a meeting the
       * recipient never had — which reads as a mistake, because it is one.
       */
      const cancelEvent: CalendarEvent | null = wasConfirmed
        ? {
            uid: `booking-${booking.id}@aniwala.com`,
            start,
            durationMins: duration,
            summary: `${studioName()} × ${booking.name}`,
            description: 'This call has been cancelled.',
            location: booking.meeting_url ?? undefined,
            organizerName: studioName(),
            organizerEmail: studio[0],
            attendees: [booking.email, ...guests],
            sequence: seq,
            method: 'CANCEL',
            status: 'CANCELLED',
          }
        : null;

      await sendMail({
        to: [booking.email],
        cc: guests,
        subject: `About your call with ${studioName()}`,
        replyTo: studio[0],
        html: layout(
          wasConfirmed ? 'That call has been cancelled' : 'That time did not work',
          `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">
             Hello ${esc(booking.name)} — thank you for asking for
             ${esc(booking.slot_label ?? fmtWhen(start, duration, visitorTz))}.
             We are not able to make that one after all.
           </p>
           <p style="margin:0 0 22px;font-size:15px;line-height:1.6">
             Please pick another time that suits you and we will confirm it.
           </p>
           <p style="margin:0">
             ${button(bookPage, 'Choose another time', '#14161d', '#e4c24c')}
           </p>
           <p style="margin:24px 0 0;font-size:13px;color:#83879a">
             Reply to this email if it is easier to sort out in writing.
           </p>`
        ),
        ...(cancelEvent
          ? { attachments: [icsAttachment(cancelEvent)] }
          : {}),
      });

      return json(
        200,
        {
          title: 'Declined',
          message: wasConfirmed
            ? 'They have been told, and the meeting has been taken off the calendars it was on.'
            : 'They have been told, with a link back to the calendar to pick another time.',
        },
        origin
      );
    }

    /* ---------- confirm ---------- */

    /*
     * A slot that has already passed cannot be confirmed, whatever the token
     * says. Confirming one puts an event in somebody's past and tells them it
     * is on, which is worse than the silence it was meant to fix — and it is
     * an easy mistake to make from an email opened a week late.
     */
    if (start.getTime() < Date.now()) {
      return json(
        409,
        {
          title: 'That time has passed',
          message:
            'This slot is in the past, so confirming it would put a meeting on their calendar that has already been and gone. Email them a new time instead.',
        },
        origin
      );
    }

    /*
     * The joining link, in three cases rather than one.
     *
     * A single `safeUrl(body.meetingUrl) ?? booking.meeting_url ?? default`
     * reads well and is wrong twice over: it cannot tell a field left alone
     * from a field deliberately CLEARED — so a host removing a stale link
     * would silently get the old one back — and it swallows a typo'd address
     * into the same fallback, sending an invitation whose link goes somewhere
     * nobody meant. An unusable link is refused out loud instead.
     */
    let meetingUrl = suggestedUrl;
    if (typeof body.meetingUrl === 'string') {
      const typed = body.meetingUrl.trim();
      if (!typed) {
        meetingUrl = '';
      } else {
        const checked = safeUrl(typed);
        if (!checked) {
          return json(
            400,
            {
              title: 'That joining link is not a link',
              message:
                'It needs to start with https:// (or http://). Nothing has been sent — go back and fix it, or clear the field to send the invitation without one.',
            },
            origin
          );
        }
        meetingUrl = checked;
      }
    }
    /*
     * Guests added on the confirmation screen, merged with the ones the
     * visitor asked for. Capped by `parseGuests` at MAX_GUESTS over the
     * combined list, so the host cannot walk past the ceiling one save at a
     * time.
     */
    const allGuests = parseGuests(
      [booking.guest_emails ?? '', String(body.guests ?? '')].filter(Boolean).join(','),
      [booking.email, ...studio]
    );
    const seq = (Number(booking.invite_seq) || 0) + 1;

    const patch = await fetch(target, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        meeting_url: meetingUrl || null,
        guest_emails: allGuests.join(',') || null,
        invite_seq: seq,
      }),
    });
    if (!patch.ok) throw new Error(`patch ${patch.status} ${await patch.text()}`);

    const type = booking.enquiry_type ?? null;
    const summary = `${studioName()} × ${booking.name}${type ? ` — ${type}` : ''}`;
    const description = [
      `A call with ${studioName()}, booked through the website.`,
      meetingUrl ? `Join here: ${meetingUrl}` : '',
      type ? `About: ${type}` : '',
      `If anything needs to change, reply to the confirmation email.`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const event: CalendarEvent = {
      /* The row id, so a re-send UPDATES the entry instead of creating a
         second meeting beside the first. */
      uid: `booking-${booking.id}@aniwala.com`,
      start,
      durationMins: duration,
      summary,
      description,
      location: meetingUrl || undefined,
      organizerName: studioName(),
      organizerEmail: studio[0],
      attendees: [booking.email, ...allGuests],
      sequence: seq,
      method: 'REQUEST',
      status: 'CONFIRMED',
    };

    const cal = calendarLinks(event);
    const resend = booking.status === 'confirmed';

    /*
     * ONE email to everybody, rather than one each.
     *
     * Resend charges per call, not per recipient, and — more to the point — a
     * calendar invitation whose attendees cannot see each other is one that
     * gets replied-to all round in confusion. The studio is copied so the
     * event lands on the host's calendar from the same file the client got.
     */
    await sendMail({
      to: [booking.email],
      cc: [...allGuests, ...studio],
      subject: `${resend ? 'Updated' : 'Confirmed'}: your call with ${studioName()}`,
      replyTo: studio[0],
      attachments: [icsAttachment(event)],
      html: layout(
        resend ? 'Your call has been updated' : 'Your call is confirmed',
        `<p style="margin:0 0 20px;font-size:15px;line-height:1.6">
           Hello ${esc(booking.name)} — this is confirmed. The invitation is
           attached, so accepting it will put the call straight on your calendar.
         </p>

         <table style="border-collapse:collapse;width:100%">
           ${row('When', fmtWhen(start, duration, visitorTz))}
           ${
             visitorTz !== studioTz()
               ? row('Our time', fmtWhen(start, duration, studioTz()))
               : ''
           }
           ${row('Duration', `${duration} min`)}
           ${row('About', type)}
           ${row('Guests', allGuests.join(', '))}
         </table>

         ${
           meetingUrl
             ? `<p style="margin:24px 0 0">
                  ${button(meetingUrl, 'Join the call', '#14161d', '#e4c24c')}
                </p>
                <p style="margin:10px 0 0;font-size:13px;color:#83879a;overflow-wrap:anywhere">
                  ${esc(meetingUrl)}
                </p>`
             : ''
         }

         <p style="margin:26px 0 0;font-size:13px;color:#83879a">
           Not seeing the attachment?
           <a href="${esc(cal.google)}" style="color:#8a6a10">Add to Google Calendar</a> &middot;
           <a href="${esc(cal.outlook)}" style="color:#8a6a10">Add to Outlook</a>
         </p>
         <p style="margin:14px 0 0;font-size:13px;color:#83879a">
           Reply to this email if you need to move it, and we will find another time.
         </p>`
      ),
    });

    return json(
      200,
      {
        title: resend ? 'Invitation re-sent' : 'Confirmed',
        message: allGuests.length
          ? `The invitation has gone to ${booking.email} and ${allGuests.length} guest${allGuests.length === 1 ? '' : 's'}, with a copy on your own calendar.`
          : `The invitation has gone to ${booking.email}, with a copy on your own calendar.`,
      },
      origin
    );
  } catch (err) {
    /*
     * A failure AFTER the row was patched is the one worth thinking about: the
     * booking reads as confirmed and nobody was told. Pressing Confirm again
     * is the recovery — the row is already in the state the second attempt
     * would write, and the invitation is rebuilt and re-sent with a higher
     * SEQUENCE, which is precisely how a calendar wants to receive it.
     */
    console.error('schedule failed:', err);
    return json(
      500,
      {
        title: 'Something went wrong',
        message: 'That did not go through. Try the button again in a moment.',
      },
      origin
    );
  }
});
