/**
 * One way for the three public forms to send what somebody typed.
 *
 * TWO PATHS, AND WHICH ONE RUNS IS A DEPLOYMENT DECISION, not a code one.
 *
 *   Turnstile NOT configured — post straight to PostgREST with the anon key,
 *     exactly as the forms always did. Row Level Security and the database
 *     rate limiter (schema.sql section 5) are the protection.
 *
 *   Turnstile configured — post to the `submit` Edge Function instead. It
 *     verifies the token with Cloudflare, then writes with the service role
 *     key. Automated traffic never reaches the database at all.
 *
 * The fallback is not laziness. The site is deployed separately from the Edge
 * Functions and from the Cloudflare account, and those three things do not
 * land at the same moment. A build made before the keys exist has to keep
 * working, or the forms go dark on the live site in the gap — which is a worse
 * outcome than the spam this is meant to stop.
 *
 * So: unset TURNSTILE_SITE_KEY is byte-for-byte the old behaviour. Setting it
 * is the switch, and it can be flipped without touching this file.
 */
import { publicConfig } from './clientConfig';
import { insertRow, SupabaseError } from './supabase';

/** Which form is being sent. The Edge Function maps these to tables. */
export type FormKind = 'enquiry' | 'application' | 'comment';

/** Same mapping, for the direct-to-PostgREST fallback. */
const TABLE: Record<FormKind, string> = {
  enquiry: 'enquiries',
  application: 'applications',
  comment: 'comments',
};

/**
 * Whether the verified path is available.
 *
 * A FUNCTION, not a constant, and resolved from the page rather than from a
 * build-time import — see `lib/clientConfig.ts`. As a module constant reading
 * `config/site.ts` this was always `false` in the browser, which sent every
 * submission down the fallback path and then failed that too, because the
 * fallback needs the same values.
 */
export const turnstileEnabled = (): boolean => {
  const c = publicConfig();
  return Boolean(c.turnstileSiteKey) && Boolean(c.functionsBaseUrl);
};

/**
 * Send one submission.
 *
 * `form` is needed only to read the token: the Turnstile widget injects a
 * hidden `cf-turnstile-response` input into whatever form contains it, so the
 * token is read from the form rather than passed around by hand.
 *
 * Throws `SupabaseError` with a message meant to be shown to the person. Every
 * caller already renders `err.message`, so a rate-limit refusal or a failed
 * challenge arrives as readable text rather than a status code.
 */
export async function submitForm(
  kind: FormKind,
  form: HTMLFormElement,
  data: Record<string, unknown>
): Promise<void> {
  if (!turnstileEnabled()) {
    await insertRow(TABLE[kind], data);
    return;
  }

  const token = String(new FormData(form).get('cf-turnstile-response') ?? '');
  if (!token) {
    throw new SupabaseError('Please complete the "I am human" check below, then send again.');
  }

  let res: Response;
  try {
    res = await fetch(`${publicConfig().functionsBaseUrl}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ form: kind, token, data }),
    });
  } finally {
    /*
     * A Turnstile token is single use. Without this reset, a submission that
     * fails for ANY reason — a validation error, a rate limit, a dropped
     * connection — leaves a spent token in the form, and the next attempt is
     * rejected as invalid. The person then sees a challenge failure for what
     * was really a typo, and no amount of correcting it helps.
     *
     * In `finally` so it runs on the network-error path too.
     */
    try {
      (window as unknown as { turnstile?: { reset: () => void } }).turnstile?.reset();
    } catch {
      /* widget not mounted — nothing to reset */
    }
  }

  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const json = await res.json();
      if (json?.error) detail = json.error;
    } catch {
      /* non-JSON body — the status is all we have */
    }
    throw new SupabaseError(detail);
  }
}
