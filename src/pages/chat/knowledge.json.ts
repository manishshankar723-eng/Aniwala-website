import type { APIRoute } from 'astro';
import { buildChatKnowledge, knowledgeStats } from '../../lib/chatKnowledge';

/**
 * The chatbot's knowledge base, as one file.
 *
 * Prerendered at build time like `/search.json`. The `chat` Edge Function
 * fetches it from SITE_URL — never from a request's origin — and keeps a last
 * good copy. Everything in it is already on a public page; see
 * `lib/chatKnowledge.ts` for why that is guaranteed rather than hoped.
 */
export const GET: APIRoute = async () => {
  const file = await buildChatKnowledge();
  console.info(knowledgeStats(file));

  /* No caching headers here: this is written to dist/ as a static file, and
     Hostinger serves it with whatever `public/.htaccess` says. The function
     does its own ten-minute caching. */
  return new Response(JSON.stringify(file), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
