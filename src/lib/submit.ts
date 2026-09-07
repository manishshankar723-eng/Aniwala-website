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
 * Wait for Turnstile to produce a token, rather than assuming it already has.
 *
 * THE RACE THIS FIXES, which looked exactly like a broken widget.
 *
 * api.js is loaded `async defer`, so the sequence is: page paints, script
 * arrives, widget initialises, challenge runs, token appears. Somebody who
 * types a short comment and hits the button beats all of that — the hidden
 * `cf-turnstile-response` input is still empty, and the form told them to
 * complete a check that was already running invisibly. Cloudflare's own
 * dashboard showed the truth: challenges issued, some solved, and siteverify
 * never called, because the request was never made.
 *
 * A few hundred milliseconds of patience is the entire fix. The caller has
 * already put the button into its "sending" state, so the wait reads as the
 * form working rather than the form hanging.
 *
 * Two ways out other than success, and both matter:
 *   - the widget reported an error, so waiting is pointless and it stops
 *     immediately with the code;
 *   - the deadline passes, and the caller reports something honest.
 *
 * `getResponse()` is consulted as well as the form input because the widget
 * knows it has a token slightly before the input is populated.
 */
async function waitForToken(form: HTMLFormElement, timeoutMs = 8_000): Promise<string> {
  const api = () =>
    (window as unknown as { turnstile?: { getResponse?: (id?: string) => string | undefined } })
      .turnstile;
  const failed = () =>
    (window as unknown as { __aniwalaTurnstileErr?: string }).__aniwalaTurnstileErr;

  const read = (): string => {
    const fromInput = String(new FormData(form).get('cf-turnstile-response') ?? '');
    if (fromInput) return fromInput;
    try {
      const fromApi = api()?.getResponse?.();
      return typeof fromApi === 'string' ? fromApi : '';
    } catch {
      /* widget not ready — that is what the wait is for */
      return '';
    }
  };

  const immediate = read();
  if (immediate) return immediate;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (failed()) return '';
    await new Promise((resolve) => setTimeout(resolve, 250));
    const token = read();
    if (token) return token;
  }
  return '';
}

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

  const token = await waitForToken(form);
  if (!token) {
    /*
     * No token has two completely different causes and they need different
     * messages. Telling somebody to "complete the check below" when the widget
     * failed to load is a dead end: there is nothing below to complete, and no
     * amount of trying again will change it.
     *
     * `Turnstile.astro` records the widget's own error code, so the
     * misconfiguration case says what actually happened. 110200 is a hostname
     * missing from the widget's allow-list, which is the usual one.
     */
    const widgetError = (window as unknown as { __aniwalaTurnstileErr?: string })
      .__aniwalaTurnstileErr;
    if (widgetError) {
      throw new SupabaseError(
        `The human-verification check could not load (error ${widgetError}), so this cannot be sent from here yet. ` +
          `Please email us instead — and if you run this site, check the domain is listed on the Turnstile widget.`
      );
    }
    throw new SupabaseError(
      'The human-verification check has not finished yet. Give it a moment and send again.'
    );
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
