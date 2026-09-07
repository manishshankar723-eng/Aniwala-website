/**
 * The public configuration, resolved for whichever side is asking.
 *
 * THE BUG THIS EXISTS TO FIX, because it is invisible and it has bitten twice.
 *
 * `config/site.ts` reads variables with a dynamic lookup:
 *
 *     (import.meta.env as Record<string, string | undefined>)[key]
 *
 * That is correct in Astro FRONTMATTER, which runs in Node during the build
 * where `process.env` has everything. It yields an EMPTY STRING in a bundled
 * browser script, for two compounding reasons:
 *
 *   1. Astro/Vite only expose `PUBLIC_`-prefixed variables to client code, and
 *      these are not prefixed.
 *   2. Even if they were, Vite replaces `import.meta.env.NAME` statically. A
 *      dynamic `[key]` lookup is not a literal it can find, so nothing is
 *      substituted and the browser is left reading an object that holds only
 *      MODE, DEV, PROD, BASE_URL and SSR.
 *
 * Nothing warns about this. `supabaseConfigured` simply comes out false in the
 * browser, and a form that renders perfectly refuses to submit with "Supabase
 * is not configured" — a message that reads like a missing .env file rather
 * than a bundling boundary.
 *
 * That is why `BookCall.astro` and `ApplyForm.astro` hand their config to the
 * page through `define:vars` instead of importing it, and their comments say
 * so. `Comments.astro` did NOT, which is why its thread and its form had
 * quietly never worked.
 *
 * SO: the values are emitted once into `window.__aniwalaConfig` by
 * `components/SiteConfig.astro` — an inline script, evaluated in frontmatter
 * where the variables exist — and everything client-side reads them from here.
 * The build-time import stays as the fallback so frontmatter, `astro dev` and
 * any server-side use keep working unchanged.
 *
 * Resolved at CALL time, never captured into a module-level constant: bundled
 * modules are deferred, so a constant evaluated at import time can run before
 * the inline script has set the global.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY, TURNSTILE_SITE_KEY } from '../config/site';

export interface PublicConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  turnstileSiteKey: string;
  /** Derived, so there is no second variable to set and get wrong. */
  functionsBaseUrl: string;
}

interface ConfigWindow {
  __aniwalaConfig?: Partial<PublicConfig>;
}

/**
 * Everything the browser is allowed to know.
 *
 * All three values are public by design: the anon key ships in the bundle and
 * is protected by RLS, the Turnstile site key has to be in the page for the
 * widget to render, and the project URL is in every request. Nothing secret
 * belongs in this object — if you find yourself wanting to add something that
 * is, it belongs on an Edge Function instead.
 */
export function publicConfig(): PublicConfig {
  const fromPage =
    typeof window !== 'undefined'
      ? ((window as unknown as ConfigWindow).__aniwalaConfig ?? {})
      : {};

  const supabaseUrl = (fromPage.supabaseUrl || SUPABASE_URL || '').replace(/\/$/, '');

  return {
    supabaseUrl,
    supabaseAnonKey: fromPage.supabaseAnonKey || SUPABASE_ANON_KEY || '',
    turnstileSiteKey: fromPage.turnstileSiteKey || TURNSTILE_SITE_KEY || '',
    functionsBaseUrl: supabaseUrl ? `${supabaseUrl}/functions/v1` : '',
  };
}

/** Whether there is somewhere to send a submission. Checked at call time. */
export function isConfigured(): boolean {
  const c = publicConfig();
  return Boolean(c.supabaseUrl) && Boolean(c.supabaseAnonKey);
}
