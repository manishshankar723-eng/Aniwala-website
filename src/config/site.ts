/**
 * The parts of the site that are NOT content.
 *
 * The process steps, the marquee, the tools list, the testimonials, the
 * clients and the whole booking widget have all moved to Sanity. What is left
 * is infrastructure — the Supabase credentials the forms post to — and the one
 * setting that is dangerous to expose.
 */

/* ------------------------------------------------------------------ */
/* Supabase — the one place visitor-submitted data lives               */
/* ------------------------------------------------------------------ */

/**
 * Read a build-time variable.
 *
 * The same helper `lib/sanity/client.ts` uses, and for the same reason: this
 * file is imported from component frontmatter, which runs in Node during the
 * build where `process.env` is the reliable source. `astro.config.mjs` loads
 * `.env` into `process.env` before anything else runs, so both paths see the
 * same values. `import.meta.env` is checked second for the dev server.
 *
 * TRIMMED, and it is not tidiness.
 *
 * `astro.config.mjs` trims what it parses out of `.env`, but a value arriving
 * from the JOB ENVIRONMENT in CI never passes through that — it is whatever
 * was pasted into the GitHub secret, newline and all. `SUPABASE_ANON_KEY` was
 * pasted with a trailing newline, so the key went into `window.__aniwalaConfig`
 * as "eyJ...DPiI\n" and shipped that way in the HTML of every page.
 *
 * It happened to work: the Fetch spec normalises header values, so the browser
 * stripped it before it reached the wire. That is the entire reason nobody
 * noticed — a whitespace bug surviving on a technicality in one consumer, in a
 * value that is also string-compared, logged and pasted elsewhere. Trim it at
 * the source, where it is one call and covers every reader, rather than at the
 * three or four places that would each have to remember.
 */
const env = (key: string): string => {
  const fromNode = typeof process !== 'undefined' ? process.env?.[key] : undefined;
  return (fromNode ?? (import.meta.env as Record<string, string | undefined>)[key] ?? '').trim();
};

/**
 * Enquiries, bookings and blog comments all land in one Supabase project,
 * so there is a single dashboard to check and a single export to take.
 *
 * THESE USED TO BE STRING LITERALS IN THIS FILE, and they sat as
 * `PASTE-YOUR-SUPABASE-PROJECT-URL` from the day the forms were written until
 * the day somebody audited them. That is the predictable outcome: connecting
 * the forms meant editing a tracked source file, which meant a commit, a
 * review and a deploy for two values that are configuration rather than code
 * — so it never happened, and three forms sat dead on the live site while
 * every page that rendered them looked finished.
 *
 * As environment variables they are set once in `.env` locally and in the CI
 * environment for the deploy, alongside the Sanity credentials they sit
 * beside in every other respect.
 *
 * SETUP
 *   1. Create a free project at https://supabase.com.
 *   2. SQL Editor -> New query -> paste ALL of `supabase/schema.sql` -> Run.
 *      That creates both tables AND the Row Level Security policies. Do not
 *      skip it: the policies are the only thing protecting the data.
 *   3. Project Settings -> API. Copy "Project URL" and the "anon public" key
 *      into `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env`, and add the
 *      same two to the deploy environment.
 *
 * THE ANON KEY IS PUBLIC. It ships inside the JavaScript bundle and anyone
 * can read it — that is how Supabase is designed. Security comes entirely
 * from the RLS policies, which let anon INSERT and nothing else (comments
 * can additionally read rows you have approved). It is in `.env` because that
 * is where configuration belongs, NOT because it is a secret.
 *
 * NEVER put the `service_role` key here. It bypasses RLS completely, and
 * whatever is in these two constants is compiled into a public website.
 *
 * While either is unset, the booking form, the application form and the
 * comment form all refuse to submit and say so, rather than dropping data
 * into a void.
 */
export const SUPABASE_URL = env('SUPABASE_URL');
export const SUPABASE_ANON_KEY = env('SUPABASE_ANON_KEY');

/**
 * Cloudflare Turnstile — the check that a submission came from a person.
 *
 * PUBLIC, like the anon key, and for the same reason: it identifies the widget
 * to Cloudflare and has to be in the page for the widget to render. The half
 * that matters is TURNSTILE_SECRET_KEY, which lives only in the Edge Function
 * environment (`supabase secrets set`) and never appears in this repo or in
 * the bundle. Never put the secret key here.
 *
 * UNSET IS A SUPPORTED STATE, and deliberately so. Empty means the three forms
 * behave exactly as they did before Turnstile existed: they post straight to
 * PostgREST under the anon key, protected by RLS and by the database rate
 * limiter. Set it and they switch to posting through the `submit` Edge
 * Function, which verifies the token before writing anything.
 *
 * That fallback is what makes this safe to ship before the keys exist. Get
 * them at dash.cloudflare.com -> Turnstile -> Add site, then put the site key
 * here (and in the CI environment) and the secret key on the function:
 *
 *   supabase secrets set TURNSTILE_SECRET_KEY=0x4AAA... --project-ref <ref>
 */
export const TURNSTILE_SITE_KEY = env('TURNSTILE_SITE_KEY');

/**
 * Where the Edge Functions live. Derived rather than configured — it is always
 * the project URL plus `/functions/v1`, so a second environment variable would
 * only be a second thing to get wrong.
 */
export const FUNCTIONS_BASE_URL = SUPABASE_URL
  ? `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1`
  : '';

/*
 * `commentsEnabled` was here. It is now a switch on the Interface copy
 * document, under Comments — turning a comment form off was a deploy, a
 * review and a developer, for a decision that is entirely editorial.
 *
 * What did NOT move, because it is not a setting: comments are held for
 * approval before they appear, always. Flip `approved` in the Supabase Table
 * Editor to publish one. That is the actual spam control — the honeypot and
 * time-gate on the form are speed bumps that stop naive bots, and the
 * moderation queue is what stops the rest. It is enforced by the RLS policy
 * in supabase/schema.sql, which is deliberately hard to loosen by accident,
 * and it is not reachable from the CMS on purpose.
 */

/* ------------------------------------------------------------------ */
/* Timezone — deliberately NOT editable                                */
/*                                                                     */
/* IST is +5:30 and observes no daylight saving, so a fixed offset is   */
/* exact. That is also the reason it stays here: point this at a        */
/* timezone that DOES observe DST and every slot the booking widget     */
/* offers is an hour wrong for half the year, silently, until a client  */
/* dials in to an empty room. Everything else about the widget — the    */
/* host, the hours, the durations — is in the Studio.                   */
/* ------------------------------------------------------------------ */
export const studioUtcOffsetMinutes = 330;
export const studioTimezone = 'Asia/Kolkata';
