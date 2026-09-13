import type { APIRoute } from 'astro';
import { getPosts } from '../../lib/posts';
import { getUiCopy } from '../../lib/studio';
import { esc } from '../../lib/copy';

/**
 * The blog, as a feed.
 *
 * WHY THIS EXISTS
 *
 * The site had no feed at all. That is a distribution channel left switched
 * off: a feed is how a reader's app, an aggregator, a newsletter service or
 * somebody else's "what we're reading" page subscribes to the writing without
 * anyone having to be asked. For a studio whose blog is currently its only
 * real content, that is the cheapest syndication there is — and every place
 * it gets picked up is a potential link, which is the thing the site has
 * least of.
 *
 * WHY HAND-WRITTEN rather than `@astrojs/rss`
 *
 * The same reason `lib/supabase.ts` is a PostgREST client and not the SDK.
 * RSS 2.0 is a fixed, frozen format — there is no version of this file that
 * needs maintaining — and the dependency would exist to concatenate strings
 * that are concatenated below in about thirty lines. One fewer thing to
 * upgrade, audit and explain.
 *
 * PRERENDERED like every other route here: `output: 'static'` means this runs
 * during the build, so Hostinger still only serves files.
 *
 * EVERY VALUE IS ESCAPED. A post title with an ampersand in it — "2D & 3D",
 * which is a phrase this studio uses constantly — produces XML a reader
 * refuses to parse, and it fails as a parse error rather than as a missing
 * character, so the whole feed goes dark over one title. `esc()` is the same
 * helper the templates use; it covers the five XML entities.
 */
export const GET: APIRoute = async (context) => {
  const ui = await getUiCopy();
  const posts = await getPosts();

  /* `context.site` is `site` from astro.config.mjs. Every URL in a feed has
     to be absolute — a reader has no page to resolve a path against. */
  const site = context.site?.href ?? 'https://aniwala.com/';
  const feedUrl = new URL('/blog/rss.xml', site).href;

  /* RFC-822, which is what RSS 2.0 specifies and what `toUTCString()`
     already produces. Not ISO-8601 — that is Atom's format, and a reader
     handed the wrong one usually shows no date rather than an error. */
  const rfc822 = (date: Date) => date.toUTCString();

  const items = posts
    .map((post) => {
      const { title, description, pubDate, updatedDate, category } = post.data;
      const url = new URL(`/blog/${post.id}/`, site).href;

      return `    <item>
      <title>${esc(title)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="true">${esc(url)}</guid>
      <pubDate>${rfc822(updatedDate ?? pubDate)}</pubDate>
      <category>${esc(category)}</category>
      <description>${esc(description)}</description>
    </item>`;
    })
    .join('\n');

  /* `atom:link rel="self"` is the feed naming its own address. Validators
     warn without it, and an aggregator that has been handed the feed by a
     third party uses it to work out where to poll. */
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(ui.siteName)}</title>
    <link>${esc(new URL('/blog/', site).href)}</link>
    <description>${esc(ui.defaultDescription)}</description>
    <language>en-IN</language>
    <atom:link href="${esc(feedUrl)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      /* Same reasoning as /search.json: not fingerprinted, so it cannot be
         immutable, and an hour means a new post reaches subscribers the
         same morning. */
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
