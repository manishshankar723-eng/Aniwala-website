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
<html><body style="margin:0;background:#f5f5f3;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#16171b">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e0d6;border-radius:10px;overflow:hidden">
    <div style="padding:18px 24px;background:#14161d;color:#e4c24c;font-size:12px;letter-spacing:.16em;text-transform:uppercase">
      Aniwala Studios
    </div>
    <div style="padding:24px">
      <h1 style="margin:0 0 16px;font-size:19px;line-height:1.3">${esc(title)}</h1>
      ${bodyHtml}
    </div>
  </div>
</body></html>`;
}

export function row(label: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  return `<tr>
    <td style="padding:6px 12px 6px 0;color:#83879a;font-size:12px;text-transform:uppercase;letter-spacing:.08em;white-space:nowrap;vertical-align:top">${esc(label)}</td>
    <td style="padding:6px 0;font-size:14px;line-height:1.5">${esc(value)}</td>
  </tr>`;
}
