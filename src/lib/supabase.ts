/**
 * Minimal Supabase client.
 *
 * Deliberately raw `fetch` against PostgREST rather than @supabase/supabase-js.
 * All this site does is insert a row and select a few — the SDK would add
 * ~40KB to a bundle whose whole point is being static and fast, and would
 * bring auth and realtime machinery nothing here uses.
 *
 * SECURITY: the anon key is PUBLIC. It ships in the JavaScript bundle and
 * anyone can read it, by design. What stops it being a problem is Row Level
 * Security on every table — see `supabase/schema.sql`, which is the real
 * security boundary. Never put the SERVICE key anywhere in this repo; it
 * bypasses RLS entirely.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/site';

export const supabaseConfigured =
  Boolean(SUPABASE_URL) &&
  Boolean(SUPABASE_ANON_KEY) &&
  !SUPABASE_URL.startsWith('PASTE') &&
  !SUPABASE_ANON_KEY.startsWith('PASTE');

const restUrl = (table: string) => `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}`;

const headers = () => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
});

export class SupabaseError extends Error {}

/**
 * Insert one row.
 *
 * Returns nothing: `Prefer: return=minimal` stops PostgREST echoing the row
 * back, which matters for `enquiries` — anon has no SELECT policy there, so
 * asking for the row back would fail the request even though the insert
 * itself succeeded.
 */
export async function insertRow(table: string, row: Record<string, unknown>): Promise<void> {
  if (!supabaseConfigured) throw new SupabaseError('Supabase is not configured.');

  const res = await fetch(restUrl(table), {
    method: 'POST',
    headers: { ...headers(), Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    // PostgREST returns a JSON body with `message`; a policy rejection shows
    // up here as a 401/403 rather than a network error.
    let detail = `${res.status}`;
    try {
      const json = await res.json();
      if (json?.message) detail = json.message;
    } catch {
      /* non-JSON error body — the status code is all we have */
    }
    throw new SupabaseError(detail);
  }
}

/**
 * Select rows. `query` is a PostgREST query string, e.g.
 * `select=id,body&post_slug=eq.my-post&order=created_at.asc`.
 */
export async function selectRows<T>(table: string, query: string): Promise<T[]> {
  if (!supabaseConfigured) throw new SupabaseError('Supabase is not configured.');

  const res = await fetch(`${restUrl(table)}?${query}`, { headers: headers() });
  if (!res.ok) throw new SupabaseError(`${res.status}`);
  return (await res.json()) as T[];
}
