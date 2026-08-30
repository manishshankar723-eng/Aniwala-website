import type { APIRoute } from 'astro';
import { buildSearchDocs } from '../lib/searchDocs';

/**
 * The search index, as one file.
 *
 * Prerendered to `/search.json` at build time like every other route here —
 * `output: 'static'` means this runs during the build, not on a request, so
 * Hostinger is still only serving files.
 *
 * Search.astro fetches it the first time somebody opens the search bar and
 * keeps it for the rest of the session. Most visitors never open search, and
 * they now pay nothing for it.
 */
export const GET: APIRoute = async () => {
  const docs = await buildSearchDocs();

  return new Response(JSON.stringify(docs), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      /* Not fingerprinted, so it cannot be immutable — a deploy has to be
         able to change it. An hour is long enough to cover a session and
         short enough that a new post becomes findable the same morning. */
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
