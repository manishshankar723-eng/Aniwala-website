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
 * Enquiries, bookings and blog comments all land in one Supabase project,
 * so there is a single dashboard to check and a single export to take.
 *
 * SETUP
 *   1. Create a free project at https://supabase.com.
 *   2. SQL Editor -> New query -> paste ALL of `supabase/schema.sql` -> Run.
 *      That creates both tables AND the Row Level Security policies. Do not
 *      skip it: the policies are the only thing protecting the data.
 *   3. Project Settings -> API. Copy "Project URL" and the "anon public"
 *      key into the two constants below.
 *
 * THE ANON KEY IS PUBLIC. It ships inside the JavaScript bundle and anyone
 * can read it — that is how Supabase is designed. Security comes entirely
 * from the RLS policies, which let anon INSERT and nothing else (comments
 * can additionally read rows you have approved).
 *
 * NEVER put the `service_role` key here. It bypasses RLS completely, and
 * this file is compiled into a public website.
 *
 * While these are left as placeholders, the booking form and comment form
 * both refuse to submit and say so, rather than dropping data into a void.
 */
export const SUPABASE_URL = 'PASTE-YOUR-SUPABASE-PROJECT-URL';
export const SUPABASE_ANON_KEY = 'PASTE-YOUR-SUPABASE-ANON-PUBLIC-KEY';

/**
 * Comments are held for approval before they appear. Flip `approved` to true
 * in the Supabase Table Editor to publish one.
 *
 * This is the actual spam control. The honeypot and time-gate on the form are
 * speed bumps that stop naive bots; the moderation queue is what stops the
 * rest. Set this to false only if you are willing to have unreviewed text
 * appear on the site immediately — you would also have to loosen the RLS
 * policy in schema.sql, which is deliberately hard to do by accident.
 */
export const commentsEnabled = true;

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
