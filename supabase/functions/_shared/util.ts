/**
 * Shared helpers for the notify, moderate, schedule and submit Edge Functions.
 *
 * These run on Supabase (Deno), never in the browser. Anything imported here
 * has access to real secrets — keep it that way and never import it from
 * `src/`.
 */

/* ------------------------------------------------------------------ */
/* Signed moderation links                                             */
/* ------------------------------------------------------------------ */

/**
 * The approve/reject links in a notification email are the only thing standing
 * between a comment and publication, and they travel through email in plain
 * text. So they carry an HMAC over the exact action, not a bare row id — a
 * guessed or edited URL fails the check.
 *
 * MODERATION_SECRET must be a long random string. Generate one with:
 *   openssl rand -base64 48
 */
export async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));

  // base64url: survives being pasted into a mail client without escaping.
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Constant-time comparison.
 *
 * `a === b` on strings short-circuits at the first differing character, which
 * leaks how much of a forged token was correct. Irrelevant for most things;
 * not for the token that publishes text on your site.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ------------------------------------------------------------------ */
/* Moderation tokens: signed AND time-limited                          */
/* ------------------------------------------------------------------ */

/**
 * How long a moderation link stays usable.
 *
 * Long enough that a comment arriving on a Friday can still be dealt with
 * after a holiday; short enough that a link sitting in an old mailbox, an
 * archived thread or a forwarded message is not a permanent key to publishing
 * on the site. Past the window the Supabase dashboard still works, so nothing
 * becomes unmoderatable — it just stops being one click from an inbox.
 */
export const MODERATION_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Seconds since the epoch. */
export const nowSeconds = (): number => Math.floor(Date.now() / 1000);

/**
 * The exact string an approve/reject token is an HMAC over.
 *
 * The expiry is INSIDE the signed payload, which is the whole point — a value
 * carried alongside the signature but not covered by it can simply be edited,
 * which is the same as having no expiry at all.
 */
const payloadFor = (id: string, action: string, exp: number) => `${id}:${action}:${exp}`;

/** Build a token and the expiry it is bound to. */
export async function signAction(
  id: string,
  action: string,
  secret: string,
  ttl = MODERATION_TTL_SECONDS
): Promise<{ token: string; exp: number }> {
  const exp = nowSeconds() + ttl;
  return { token: await sign(payloadFor(id, action, exp), secret), exp };
}

/**
 * Check a token against the id, action and expiry it claims to cover.
 *
 * Order matters: the signature is verified BEFORE the clock is consulted, so
 * an unsigned request cannot learn anything from the difference between "that
 * expired" and "that was never valid". Both come back as the same failure.
 */
export async function verifyAction(
  id: string,
  action: string,
  exp: number,
  token: string,
  secret: string
): Promise<'ok' | 'invalid' | 'expired'> {
  if (!Number.isFinite(exp)) return 'invalid';
  const expected = await sign(payloadFor(id, action, exp), secret);
  if (!safeEqual(token, expected)) return 'invalid';
  return exp < nowSeconds() ? 'expired' : 'ok';
}

/* ------------------------------------------------------------------ */
/* Email                                                               */
/* ------------------------------------------------------------------ */

export interface MailAttachment {
  filename: string;
  /** Base64. Use `toBase64` — Resend rejects raw text here. */
  content: string;
  /**
   * Worth setting for a calendar invite and irrelevant for anything else.
   * `text/calendar; method=REQUEST` is what makes a mail client offer
   * Accept / Decline instead of a file to download.
   */
  contentType?: string;
}

export interface Mail {
  to: string[];
  /**
   * Guests. Separate from `to` so the person who booked stays the addressee
   * and everyone can see who else is coming — a calendar invite where the
   * other attendees are invisible is one people reply-all to in confusion.
   */
  cc?: string[];
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: MailAttachment[];
}

/**
 * UTF-8 safe base64.
 *
 * `btoa` takes a binary string, so a name with an accent in it throws
 * "InvalidCharacterError" rather than encoding — which would take out the
 * whole invite for the one attendee whose name is not ASCII. Chunked because
 * spreading a large array into `String.fromCharCode` overflows the argument
 * limit; an .ics is small, but the helper should not have a size at which it
 * silently starts failing.
 */
export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

/**
 * Send through Resend.
 *
 * Supabase's own SMTP only sends auth emails, so notification mail needs a
 * transactional provider. Resend is one API call and has a free tier that
 * comfortably covers a studio site.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('MAIL_FROM');
  if (!apiKey || !from) throw new Error('RESEND_API_KEY or MAIL_FROM is not set.');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      ...(mail.cc?.length ? { cc: mail.cc } : {}),
      ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
      ...(mail.attachments?.length
        ? {
            attachments: mail.attachments.map((a) => ({
              filename: a.filename,
              content: a.content,
              ...(a.contentType ? { content_type: a.contentType } : {}),
            })),
          }
        : {}),
    }),
  });

  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

/**
 * Escape text for HTML.
 *
 * Everything interpolated into these emails is attacker-controlled: a
 * commenter chooses their own name and body. Without this, a comment
 * containing markup would render as markup inside your inbox.
 */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ------------------------------------------------------------------ */
/* Recipient routing                                                   */
/* ------------------------------------------------------------------ */

/**
 * Who gets which enquiry.
 *
 * Set MAIL_ROUTES to a JSON object mapping enquiry_type to an address, e.g.
 *   {"3D Art":"art@aniwala.com","VFX":"vfx@aniwala.com"}
 * Anything unmatched — and every comment — goes to MAIL_DEFAULT.
 */
export function recipientFor(enquiryType?: string | null): string[] {
  const fallback = Deno.env.get('MAIL_DEFAULT') ?? '';
  if (!fallback) throw new Error('MAIL_DEFAULT is not set.');

  if (!enquiryType) return [fallback];

  try {
    const routes = JSON.parse(Deno.env.get('MAIL_ROUTES') ?? '{}') as Record<string, string>;
    const match = routes[enquiryType];
    return match ? [match] : [fallback];
  } catch {
    // A malformed MAIL_ROUTES must not swallow the enquiry.
    return [fallback];
  }
}

/* ------------------------------------------------------------------ */
/* Shared email chrome                                                 */
/* ------------------------------------------------------------------ */

export function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<!--
  THE VIEWPORT TAG IS THE WHOLE FIX, and its absence was the whole bug.

  These emails had no <head> at all. A phone mail client with nothing to tell
  it otherwise lays the message out at desktop width and then scales it down,
  so the two-column rows below were rendered at roughly 600px and shrunk into
  a strip — labels and values collided, and long values ran off the side where
  nothing could scroll to them.
-->
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<style>
  /*
   * An ENHANCEMENT, never the only defence. Several clients strip <style>
   * entirely — Gmail's web view historically among them — so everything here
   * has to be a nicety on top of inline styles that already work. The base
   * layout below is fluid on its own; this only improves the narrow case.
   */
  @media only screen and (max-width: 480px) {
    /* Stack each label above its value. Side by side, a label like
       "Applications close" leaves almost nothing for the value on a 320px
       screen. */
    .r-label, .r-value {
      display: block !important;
      width: 100% !important;
      padding: 0 !important;
    }
    .r-label { padding-top: 10px !important; }
    .r-value { padding-bottom: 2px !important; }
    /* Reclaim the horizontal padding — 48px of it on a 320px screen left
       barely 270px for content. */
    .wrap { padding: 10px !important; }
    .pad  { padding: 18px !important; }
    /* Full-width buttons, one per line. Two 22px-padded buttons side by side
       do not fit, and a half-wrapped pair reads like a rendering fault. */
    .btn {
      display: block !important;
      width: auto !important;
      text-align: center !important;
      margin: 0 0 10px !important;
    }
    .btn-gap { display: none !important; }
  }
</style>
</head>
<body class="wrap" style="margin:0;background:#f5f5f3;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#16171b;-webkit-text-size-adjust:100%">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e0d6;border-radius:10px;overflow:hidden">
    <div style="padding:18px 24px;background:#14161d;color:#e4c24c;font-size:12px;letter-spacing:.16em;text-transform:uppercase">
      Aniwala Studios
    </div>
    <div class="pad" style="padding:24px">
      <h1 style="margin:0 0 16px;font-size:19px;line-height:1.3">${esc(title)}</h1>
      ${bodyHtml}
    </div>
  </div>
</body></html>`;
}

/**
 * One label/value pair.
 *
 * `white-space:nowrap` used to sit on the label. It was there to stop "On
 * post" breaking across two lines, and on a phone it did the opposite of what
 * was wanted: the label column refused to shrink, so the value column took
 * every pixel of the squeeze and long values were clipped.
 *
 * The label now wraps if it must, and is capped at 38% so it can never take
 * the row. Values get `overflow-wrap:anywhere`, which is what lets a CV link
 * or a long address break instead of running off the side of a screen that
 * cannot scroll sideways.
 */
export function row(label: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  return `<tr>
    <td class="r-label" style="width:38%;padding:6px 12px 6px 0;color:#83879a;font-size:12px;text-transform:uppercase;letter-spacing:.08em;vertical-align:top;overflow-wrap:anywhere">${esc(label)}</td>
    <td class="r-value" style="padding:6px 0;font-size:14px;line-height:1.5;overflow-wrap:anywhere;word-break:break-word">${esc(value)}</td>
  </tr>`;
}

/**
 * One button, styled for email.
 *
 * `.btn` and `.btn-gap` are what the media query in `layout()` turns into
 * full-width stacked buttons; the inline styles carry the whole desktop
 * appearance, so a client that strips `<style>` loses only the stacking.
 */
export function button(href: string, label: string, bg: string, fg: string): string {
  return `<a class="btn" href="${esc(href)}" style="display:inline-block;padding:12px 22px;border-radius:6px;
      background:${bg};color:${fg};font-size:14px;font-weight:600;text-decoration:none">${label}</a>`;
}

/** The gap between two side-by-side buttons, collapsed on a phone. */
export const BUTTON_GAP = '<span class="btn-gap" style="display:inline-block;width:10px"></span>';

/* ------------------------------------------------------------------ */
/* CORS                                                                */
/* ------------------------------------------------------------------ */

/**
 * Where a browser is allowed to call these functions from.
 *
 * A wildcard would let any site drive the endpoints with its own Turnstile
 * token, or with a link lifted out of a forwarded email. The live origin comes
 * from SITE_URL; localhost is here so the forms still work under `astro dev`.
 *
 * EXTRA_ORIGINS exists for the staging site, and it is a list rather than a
 * wildcard on purpose. The obvious shortcut — allowing anything under
 * *.aniwala.com, or worse reflecting whatever Origin arrives — would open the
 * door to any page that can obtain a token. Naming each host keeps the door
 * the width of the things that are actually meant to come through it.
 *
 *   supabase secrets set EXTRA_ORIGINS=https://new.aniwala.com
 *
 * Comma-separated for more than one. Unset is the normal production state.
 */
export function allowedOrigin(req: Request): string | null {
  const origin = req.headers.get('origin');
  if (!origin) return null;

  const site = (Deno.env.get('SITE_URL') ?? 'https://aniwala.com').replace(/\/$/, '');
  const extra = (Deno.env.get('EXTRA_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const ok = [site, ...extra, 'http://localhost:4321', 'http://localhost:4322'];
  return ok.includes(origin) ? origin : null;
}

export const corsHeaders = (origin: string | null): Record<string, string> => ({
  'Access-Control-Allow-Origin': origin ?? 'null',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
});

/* ------------------------------------------------------------------ */
/* Guests                                                              */
/* ------------------------------------------------------------------ */

/**
 * The ceiling on one booking's guest list, enforced HERE and not only in the
 * browser.
 *
 * The widget caps its own field at five, which is a courtesy to the person
 * filling it in. This is the number that matters: every address on the list is
 * one more recipient on a mail plan somebody is paying for, and the field
 * arrives as a string a script can write anything into. The host may add a few
 * more when confirming, which is why this is not five.
 */
export const MAX_GUESTS = 10;

/**
 * The width of `enquiries.guest_emails`, repeated here on purpose.
 *
 * The column carries `check (char_length(guest_emails) <= 500)`, and ten
 * addresses of the length the loop below tolerates would be four times that.
 * Hitting a CHECK constraint is a 500 and a lost confirmation, not a message
 * anybody can act on — so the list is trimmed to fit before it is ever
 * written, and the constraint stays what it should be: the backstop, not the
 * error handler. Change one and change the other.
 */
const MAX_GUEST_CHARS = 500;

/** Deliberately loose — a mail server, not a regex, decides what delivers. */
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/**
 * Turn whatever arrived in `guest_emails` into a list worth sending to.
 *
 * Stored as one comma-separated string rather than an array because `submit`
 * refuses anything that is not a scalar — see the shape check there, which
 * exists so a caller-shaped object never reaches the layer holding the service
 * role key. A string keeps that rule intact and costs one split.
 *
 * `exclude` is how the person who booked, and the studio's own inbox, stay off
 * their own guest list: a duplicate address turns one invite into two, and
 * some clients read the second as an update to an event the recipient has not
 * accepted yet.
 */
export function parseGuests(value: unknown, exclude: string[] = []): string[] {
  if (typeof value !== 'string' || !value.trim()) return [];

  const skip = new Set(exclude.map((e) => e.trim().toLowerCase()).filter(Boolean));
  const seen = new Set<string>();
  const out: string[] = [];
  let chars = 0;

  for (const raw of value.split(/[,;\s]+/)) {
    const email = raw.trim().toLowerCase();
    if (!email || email.length > 200 || !EMAIL.test(email)) continue;
    if (skip.has(email) || seen.has(email)) continue;

    // +1 for the comma this one will be joined with.
    const width = email.length + (out.length ? 1 : 0);
    if (chars + width > MAX_GUEST_CHARS) break;

    seen.add(email);
    out.push(email);
    chars += width;
    if (out.length >= MAX_GUESTS) break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Calendar invites                                                    */
/* ------------------------------------------------------------------ */

export interface CalendarEvent {
  /**
   * Stable for the life of the booking — the enquiry's row id.
   *
   * THIS IS WHAT MAKES A SECOND SEND AN UPDATE RATHER THAN A SECOND MEETING.
   * A fresh UID on every confirmation would leave the attendee's calendar
   * holding both the old time and the new one, with nothing to say which is
   * real.
   */
  uid: string;
  start: Date;
  durationMins: number;
  summary: string;
  description: string;
  /** The joining link. Also written to URL, which is where clients look. */
  location?: string;
  organizerName: string;
  organizerEmail: string;
  attendees: string[];
  /**
   * Bumped on every re-send. A client that has already accepted ignores an
   * update whose SEQUENCE has not moved, so without this a corrected time is
   * silently dropped by the calendar it was corrected for.
   */
  sequence: number;
  method: 'REQUEST' | 'CANCEL';
  status: 'CONFIRMED' | 'CANCELLED';
}

/** `20260922T053000Z`, which is the only form every client agrees on. */
const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** RFC 5545 escaping: these are structural characters inside a value. */
const icsText = (value: string) =>
  String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

/**
 * Fold at 75 octets, because the spec says so and because Outlook means it.
 *
 * An over-long line is not a cosmetic problem: strict parsers reject the whole
 * VEVENT, so a description with a couple of sentences in it can be the
 * difference between an invite that lands on a calendar and one that arrives
 * as an unopenable attachment. Counted in BYTES, not characters — a fold that
 * splits a multi-byte character mid-sequence produces a corrupt file.
 */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const out: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    // 74 on continuation lines: the leading space counts toward the 75.
    let end = Math.min(start + (out.length === 0 ? 75 : 74), bytes.length);
    // Never cut inside a UTF-8 sequence: 0b10xxxxxx is a continuation byte.
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    out.push(new TextDecoder().decode(bytes.subarray(start, end)));
    start = end;
  }
  return out.join('\r\n ');
}

/**
 * Build the .ics that gets attached to a confirmation.
 *
 * METHOD:REQUEST is what turns a file into an invitation — the difference
 * between "here is an attachment" and a calendar entry with Accept and Decline
 * on it. METHOD:CANCEL, with the same UID and a higher SEQUENCE, is what takes
 * it back off the calendar again.
 */
export function buildIcs(ev: CalendarEvent): string {
  const end = new Date(ev.start.getTime() + ev.durationMins * 60000);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aniwala Studios//Booking//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${ev.method}`,
    'BEGIN:VEVENT',
    `UID:${ev.uid}`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(ev.start)}`,
    `DTEND:${icsStamp(end)}`,
    `SEQUENCE:${ev.sequence}`,
    `STATUS:${ev.status}`,
    `SUMMARY:${icsText(ev.summary)}`,
    `DESCRIPTION:${icsText(ev.description)}`,
    `ORGANIZER;CN=${icsText(ev.organizerName)}:mailto:${ev.organizerEmail}`,
    ...ev.attendees.map(
      (a) => `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${a}`
    ),
    ...(ev.location ? [`LOCATION:${icsText(ev.location)}`, `URL:${icsText(ev.location)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  // CRLF, not LF. Several clients treat a bare LF as a malformed file.
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** The attachment shape `sendMail` wants, from an event. */
export function icsAttachment(ev: CalendarEvent): MailAttachment {
  return {
    filename: 'invite.ics',
    content: toBase64(buildIcs(ev)),
    contentType: `text/calendar; charset=UTF-8; method=${ev.method}`,
  };
}

/**
 * Add-to-calendar links, for the clients that ignore the attachment.
 *
 * Gmail's web view is the one that matters: it renders an .ics inline for some
 * senders and not others, and somebody who cannot see a button assumes nothing
 * was sent. These always work, cost nothing, and land on the same instant.
 */
export function calendarLinks(ev: CalendarEvent): { google: string; outlook: string } {
  const end = new Date(ev.start.getTime() + ev.durationMins * 60000);
  const q = (o: Record<string, string>) =>
    Object.entries(o)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');

  return {
    google:
      'https://calendar.google.com/calendar/render?' +
      q({
        action: 'TEMPLATE',
        text: ev.summary,
        dates: `${icsStamp(ev.start)}/${icsStamp(end)}`,
        details: ev.description,
        location: ev.location ?? '',
      }),
    outlook:
      'https://outlook.office.com/calendar/0/deeplink/compose?' +
      q({
        path: '/calendar/action/compose',
        rru: 'addevent',
        subject: ev.summary,
        startdt: ev.start.toISOString(),
        enddt: end.toISOString(),
        body: ev.description,
        location: ev.location ?? '',
      }),
  };
}

/**
 * "11:00 – 11:30, Tuesday 22 September 2026 (Asia/Kolkata)".
 *
 * Written out per timezone rather than once, because the two people reading
 * the email are not in the same one, and "11:00" on its own has caused more
 * missed calls than any other line in a booking confirmation.
 */
export function fmtWhen(start: Date, durationMins: number, tz: string): string {
  const end = new Date(start.getTime() + durationMins * 60000);
  const time = (d: Date) =>
    d.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  const day = start.toLocaleDateString('en-GB', {
    timeZone: tz,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `${time(start)} – ${time(end)}, ${day} (${tz.replace(/_/g, ' ')})`;
}

/**
 * A meeting room belonging to this booking and no other.
 *
 * WHY THIS IS DERIVED RATHER THAN CONFIGURED
 *
 * The obvious design is one standing room — a Zoom personal ID, a permanent
 * Meet link — pasted into a setting and reused. It is one press to confirm,
 * and it breaks on the day the calendar does its job: two bookings an hour
 * apart share the room, the first call overruns, and the second client walks
 * into the middle of somebody else's project discussion. A booking widget
 * that offers 15-minute slots through a working day makes that likely, not
 * hypothetical.
 *
 * So the room comes from the booking. Same booking, same room, every time —
 * which matters because a re-confirmation must not move the link out from
 * under everyone holding the invitation. Different booking, different room,
 * always.
 *
 * IT IS AN HMAC AND NOT THE ROW ID, because a public meeting room named after
 * a database key is a room anybody can sit in by guessing the key. Twelve
 * base64 characters is about seventy bits, which is not worth anybody's time.
 *
 * The host can still overwrite it per call on the confirmation screen, and
 * MEETING_URL still pins a fixed room for a studio that would rather have
 * one. This is only what happens when neither of those says otherwise.
 */
export async function meetingRoomFor(id: string, secret: string): Promise<string> {
  /* Any service whose rooms are just a name in a URL works here: the public
     Jitsi instance needs no account, which is why it is the default. Point it
     at a self-hosted one, or a Whereby team subdomain, with one secret. */
  const base = (Deno.env.get('MEETING_ROOM_BASE') ?? 'https://meet.jit.si').replace(/\/+$/, '');
  const studio = studioName()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  /* Stripped to alphanumerics: base64url's `-` and `_` are legal in a room
     name but turn into visual noise in a link somebody reads aloud. */
  const slug = (await sign(`room:${id}`, secret)).replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
  return `${base}/${studio}-${slug}`;
}

/** The name on the invitation. Also the readable half of a generated room. */
export const studioName = (): string => Deno.env.get('STUDIO_NAME') ?? 'Aniwala Studios';

/**
 * The studio's own timezone, for the second line of every "when".
 *
 * Defaults to IST because that is where the studio is; an env var rather than
 * a constant so a studio that moves is one secret away from correct rather
 * than a deploy. DISPLAY ONLY — the instant itself is stored in UTC, which is
 * what makes the two readings agree.
 */
export const studioTz = (): string => Deno.env.get('STUDIO_TZ') ?? 'Asia/Kolkata';

/**
 * How long a booking action link stays usable.
 *
 * Much shorter than the 30 days a moderation link gets, and for a reason that
 * has nothing to do with security: the link confirms a meeting at a FIXED
 * TIME. A confirmation arriving after the slot has passed is worse than no
 * confirmation at all — it puts an event in somebody's past and tells them it
 * is on. The window closes with the booking itself; `schedule` refuses a slot
 * that has already gone regardless of what the token says.
 */
export const BOOKING_TTL_SECONDS = 90 * 24 * 60 * 60;

/**
 * The secret that signs Confirm / Decline links.
 *
 * Falls back to MODERATION_SECRET so an existing deployment keeps working
 * without a new secret being set — the signed payload names the row AND the
 * action, so a comment's approve token cannot be replayed as a booking's
 * confirm token even when one secret covers both. Set BOOKING_SECRET anyway if
 * you would rather the two rotate independently.
 */
export function bookingSecret(): string {
  const secret = Deno.env.get('BOOKING_SECRET') ?? Deno.env.get('MODERATION_SECRET');
  if (!secret) throw new Error('BOOKING_SECRET (or MODERATION_SECRET) is not set.');
  return secret;
}
