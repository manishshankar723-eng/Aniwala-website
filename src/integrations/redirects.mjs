/**
 * Write the CMS's redirects into `dist/.htaccess`.
 *
 * WHY AN INTEGRATION AND NOT A LOADER
 *
 * Every other piece of content on this site becomes a page. Redirects become
 * server configuration, which Astro has no concept of under `output: 'static'`
 * — so they are read here, at `astro:build:done`, and spliced into the
 * `.htaccess` that `public/` has already copied into the output.
 *
 * Sanity is queried directly rather than through the content layer. An Astro
 * integration runs in the config context, where `astro:content` is not
 * available; the query is four lines and the alternative is a loader whose
 * output nothing renders.
 *
 * THE FENCE. Everything is written between two marker comments and nothing
 * outside them is touched, so the hand-written rules — HTTPS, the canonical
 * hostname, the 404 handler, the caching block — stay exactly as they are and
 * stay reviewable in git. Re-running replaces the fenced block wholesale.
 *
 * WHERE THE BLOCK GOES, and it is not cosmetic: immediately after
 * `RewriteEngine On` and before the HTTPS rule would be wrong, because those
 * rules end in `[L]` and a redirect placed under them would never be reached
 * for an http:// request. It goes after them, which is where a request that
 * has already been normalised to https://aniwala.com arrives.
 *
 * WHAT IT REFUSES TO BUILD. Apache does not validate this file; a bad rule is
 * discovered by the site returning 500 to everybody. So the checks are here,
 * and each of them fails the build rather than shipping:
 *
 *   - a `from` that matches a page the build just produced, which would make a
 *     real page unreachable;
 *   - two redirects claiming the same `from`;
 *   - a `to` that is another redirect's `from`, which is a chain at best and a
 *     loop at worst.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@sanity/client';

const START = '# --- Redirects, managed from the Studio. Do not edit by hand. ---';
const END = '# --- End of managed redirects ------------------------------------';

/** The rule that has to run before any redirect can be reached. */
const ANCHOR = 'RewriteRule ^(.*)$ https://aniwala.com/$1 [R=301,L]';

/** Escape a path for the left-hand side of a RewriteRule. */
const escapeRule = (path) => path.replace(/[.\\+*?[\]^$(){}|]/g, '\\$&');

/** `/a/b/` and `/a/b` are the same page to a visitor and to Apache. */
const normalise = (path) => path.replace(/\/+$/, '') || '/';

export default function redirects() {
  return {
    name: 'aniwala:redirects',
    hooks: {
      'astro:build:done': async ({ dir, pages, logger }) => {
        const projectId = process.env.SANITY_PROJECT_ID;
        if (!projectId) {
          logger.warn('Sanity is not configured — no redirects written.');
          return;
        }

        const client = createClient({
          projectId,
          dataset: process.env.SANITY_DATASET || 'production',
          apiVersion: '2026-01-01',
          useCdn: false,
          perspective: 'published',
          token: process.env.SANITY_READ_TOKEN || undefined,
        });

        const rows = await client.fetch(
          `*[_type == "redirect" && !(_id in path("drafts.**"))]{ from, to, permanent } | order(from asc)`
        );

        /* ---------- the checks ---------- */

        /* `pages` is what the build actually produced, so this cannot go stale
           the way a hand-kept exclusion list would. */
        const built = new Set(pages.map((p) => normalise(`/${p.pathname}`)));
        const froms = new Set(rows.map((r) => normalise(r.from)));

        for (const row of rows) {
          const from = normalise(row.from);

          if (built.has(from)) {
            throw new Error(
              `Redirect from "${row.from}" would hide a real page.\n\n` +
                `  That path is a page this build just produced, and Apache applies a\n` +
                `  redirect before it looks for a file — so the page would become\n` +
                `  unreachable and the redirect would win forever.\n\n` +
                `  Delete the redirect in the Studio, or change the page's slug.`
            );
          }

          if (froms.has(normalise(row.to))) {
            throw new Error(
              `Redirect "${row.from}" → "${row.to}" points at another redirect.\n\n` +
                `  "${row.to}" is itself redirected somewhere else. Browsers give up after a\n` +
                `  few hops and search engines pass less ranking through each one, so point\n` +
                `  this at the final destination instead.`
            );
          }
        }

        const seen = new Map();
        for (const row of rows) {
          const from = normalise(row.from);
          const first = seen.get(from);
          if (first) {
            throw new Error(
              `Two redirects both claim "${row.from}".\n\n` +
                `  One sends it to "${first}", the other to "${row.to}". Apache would use\n` +
                `  whichever came first, which is not a decision anybody made.`
            );
          }
          seen.set(from, row.to);
        }

        /* ---------- the block ---------- */

        const body = rows.length
          ? rows
              .map((row) => {
                const code = row.permanent === false ? 302 : 301;
                /* `^/?` and an optional trailing slash, so a link shared
                   without the slash redirects too. */
                const pattern = `^${escapeRule(normalise(row.from)).replace(/^\//, '')}/?$`;
                return `RewriteRule ${pattern} ${row.to} [R=${code},L]`;
              })
              .join('\n')
          : '# (none yet — add them under Redirects in the Studio)';

        const block = `${START}\n${body}\n${END}`;

        const file = fileURLToPath(new URL('.htaccess', dir));
        let htaccess = readFileSync(file, 'utf8');

        const fenced = new RegExp(
          `${START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
          )}`
        );

        if (fenced.test(htaccess)) {
          htaccess = htaccess.replace(fenced, block);
        } else if (htaccess.includes(ANCHOR)) {
          htaccess = htaccess.replace(ANCHOR, `${ANCHOR}\n\n${block}`);
        } else {
          throw new Error(
            'Could not find where to put the redirects in .htaccess.\n\n' +
              '  Expected the canonical-hostname rule to anchor them to. If that rule was\n' +
              '  reworded, update ANCHOR in src/integrations/redirects.mjs — placement\n' +
              '  matters, because a redirect above those rules never runs for an http://\n' +
              '  request.'
          );
        }

        writeFileSync(file, htaccess);
        logger.info(
          rows.length
            ? `${rows.length} redirect(s) written into .htaccess.`
            : 'No redirects to write.'
        );
      },
    },
  };
}
