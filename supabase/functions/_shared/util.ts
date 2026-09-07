/**
 * Shared helpers for the notify and moderate Edge Functions.
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

export interface Mail {
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
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
      ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
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
