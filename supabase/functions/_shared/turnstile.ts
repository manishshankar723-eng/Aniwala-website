/**
 * Cloudflare Turnstile, verified server-side. Shared by `submit` and `chat`.
 *
 * ONE copy, for the same reason `allowedOrigin()` is one: the hostname check
 * below was written for `submit`, and a second hand-written copy in `chat` is
 * a second chance for one of them to go quietly stale.
 */

const TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileResult =
  | { ok: true }
  /** Cloudflare could not be reached. Never treated as "allowed". */
  | { ok: false; reason: 'unreachable' }
  | { ok: false; reason: 'rejected' | 'hostname' | 'action'; codes?: string[] };

/**
 * Whether `token` is a fresh solve, made on the same host as `origin`, and —
 * when `action` is given — rendered for that action.
 *
 * WHERE the token was solved, as well as whether. `success` alone is not
 * bound to our pages: a token solved on any page carrying the site key
 * verifies. The Origin check says who sent the request; the hostname says the
 * widget was on the same host. Localhost is exempt because Cloudflare's test
 * keys answer with a fixed placeholder hostname.
 *
 * `action` keeps one door's token out of another: the chat widget renders
 * with `action: 'chat'`, so a token solved for it is refused by any caller
 * asking for something else, and the other way round. `submit` does not pass
 * one, because its three forms were never rendered with an action.
 */
export async function verifyTurnstile(opts: {
  token: string;
  secret: string;
  origin: string;
  ip?: string;
  action?: string;
}): Promise<TurnstileResult> {
  let verdict: { success?: boolean; hostname?: string; action?: string; 'error-codes'?: string[] };
  try {
    const form = new FormData();
    form.append('secret', opts.secret);
    form.append('response', opts.token);
    if (opts.ip) form.append('remoteip', opts.ip);
    const res = await fetch(TURNSTILE_VERIFY, { method: 'POST', body: form });
    verdict = await res.json();
  } catch (err) {
    console.error('turnstile verify failed:', err);
    return { ok: false, reason: 'unreachable' };
  }

  if (!verdict.success) {
    console.warn('turnstile rejected:', verdict['error-codes']);
    return { ok: false, reason: 'rejected', codes: verdict['error-codes'] };
  }

  const originHost = new URL(opts.origin).hostname;
  if (originHost !== 'localhost' && verdict.hostname !== originHost) {
    console.warn('turnstile hostname mismatch:', verdict.hostname);
    return { ok: false, reason: 'hostname' };
  }

  if (opts.action !== undefined && originHost !== 'localhost' && verdict.action !== opts.action) {
    console.warn('turnstile action mismatch:', verdict.action);
    return { ok: false, reason: 'action' };
  }

  return { ok: true };
}

/**
 * The visitor's address, as seen by the edge.
 *
 * `cf-connecting-ip` first: it is set by Cloudflare in front of Supabase and
 * overwritten on the way in. The `x-forwarded-for` fallback is only as good
 * as whatever set it — if the edge header is ever absent, its first entry is
 * a value the CLIENT chose. Callers must treat this as a rate-limit key, never
 * as an identity.
 */
export const clientIp = (req: Request): string =>
  (req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0] ??
    req.headers.get('x-real-ip') ??
    '').trim();
