/**
 * Portable Text -> HTML.
 *
 * WHY PORTABLE TEXT AND NOT MARKDOWN-IN-A-TEXTAREA
 * The whole reason this site moved off Markdown files was to let someone who
 * does not write code publish a post. Storing Markdown in a Sanity field
 * would have kept this file trivial and handed that person a textarea where
 * a stray `*` silently changes the layout. Portable Text gives them a real
 * editor; the cost is that the HTML has to be produced here instead of by
 * Astro's Markdown pipeline.
 *
 * THE CONTRACT WITH THE CSS
 * `.prose` in `styles/global.css` styles plain semantic tags — h2, p, ul,
 * blockquote, pre, table, img — with no wrapper divs and no classes. So this
 * renderer emits exactly that. If you add a serializer below, emit the same
 * bare tags Markdown would have produced, or it will render unstyled.
 *
 * HEADING IDs
 * Astro's Markdown pipeline slugged headings with `github-slugger`, and the
 * sticky table of contents in `blog/[slug].astro` links to those anchors.
 * The same slugger is used here so anchors that were shared or indexed before
 * the migration still resolve to the same heading.
 */
import { toHTML, type PortableTextComponents } from '@portabletext/to-html';
import GithubSlugger from 'github-slugger';
import { imageUrl, imageSrcSet, type SanityImage } from './client';

export interface Heading {
  depth: number;
  slug: string;
  text: string;
}

/** Minimal Portable Text block shape — enough to walk without pulling types. */
interface PTBlock {
  _type: string;
  style?: string;
  children?: Array<{ _type?: string; text?: string }>;
  [key: string]: unknown;
}

/** Escape text destined for an HTML attribute or text node. */
const esc = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** The visible text of one block, used for headings and word counting. */
const blockText = (block: PTBlock): string =>
  (block.children ?? []).map((child) => child.text ?? '').join('');

/**
 * Headings for the table of contents.
 *
 * Returns the same `{ depth, slug, text }` shape Astro's `render()` produced,
 * because `blog/[slug].astro` filters it by `depth === 2` and does not care
 * where it came from. A fresh slugger per call keeps the de-duplication
 * counter (`heading`, `heading-1`) scoped to one post.
 */
export function extractHeadings(blocks: PTBlock[] = []): Heading[] {
  const slugger = new GithubSlugger();
  const headings: Heading[] = [];

  for (const block of blocks) {
    if (block._type !== 'block') continue;
    const match = /^h([2-4])$/.exec(block.style ?? '');
    if (!match) continue;

    const text = blockText(block).trim();
    if (!text) continue;

    headings.push({ depth: Number(match[1]), slug: slugger.slug(text), text });
  }

  return headings;
}

/**
 * Plain text of the whole body.
 *
 * `readingTime()` in `lib/posts.ts` counts words in `post.body`. Under the
 * Markdown loader that was the raw file, so the count quietly included
 * frontmatter keys and syntax characters. Feeding it prose only makes the
 * estimate slightly more accurate than it used to be, not less.
 */
export function toPlainText(blocks: PTBlock[] = []): string {
  return blocks
    .filter((block) => block._type === 'block')
    .map(blockText)
    .join('\n\n');
}

/**
 * Serializers. Every one of these emits the tag Markdown would have emitted.
 *
 * `headingIds` is a queue, not a slugger. Headings are slugged once in
 * `renderBody` and consumed here in document order, so the id in the article
 * and the id in the table of contents are the same string by construction.
 * Re-slugging here would mean two independent de-duplication counters that
 * agree only as long as both walks visit exactly the same blocks — true
 * today, and silently false the first time one of them learns to skip
 * something.
 */
function components(headingIds: string[]): PortableTextComponents {
  const heading = (level: number) =>
    (({ children }: any) => {
      const id = headingIds.shift() ?? '';
      return `<h${level} id="${esc(id)}">${children}</h${level}>`;
    }) as any;

  return {
    block: {
      h2: heading(2),
      h3: heading(3),
      h4: heading(4),
      blockquote: ({ children }) => `<blockquote><p>${children}</p></blockquote>`,
      normal: ({ children }) => `<p>${children}</p>`,
    },

    marks: {
      /**
       * Links. External ones get `rel="noopener noreferrer"` and open in a new
       * tab; internal ones do neither, because opening your own site in a new
       * tab is a dark pattern and breaks the back button.
       */
      link: ({ children, value }) => {
        const href = String((value as { href?: string })?.href ?? '');
        if (!href) return String(children);
        const external = /^https?:\/\//i.test(href) && !href.includes('aniwala.com');
        const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `<a href="${esc(href)}"${attrs}>${children}</a>`;
      },
    },

    types: {
      /**
       * Body images. Emits a real `srcset` so a phone downloads a 480px file
       * instead of the 3000px original the art team uploaded.
       *
       * `alt` is REQUIRED by the Studio schema, so this should always be set.
       * The fallback to empty string is correct rather than lazy: an image with
       * no alt text must be `alt=""` (decorative) and not carry a filename,
       * which is what screen readers otherwise read aloud.
       */
      image: ({ value }) => {
        const image = value as SanityImage & { caption?: string };
        const src = imageUrl(image, 1200);
        if (!src) return '';

        const img =
          `<img src="${esc(src)}" srcset="${esc(imageSrcSet(image))}"` +
          ` sizes="(min-width: 900px) 800px, 100vw"` +
          ` alt="${esc(image.alt ?? '')}" loading="lazy" decoding="async">`;

        return image.caption
          ? `<figure>${img}<figcaption>${esc(image.caption)}</figcaption></figure>`
          : img;
      },

      /** Code blocks. `.prose pre code` is already styled for this. */
      code: ({ value }) => {
        const { code = '', language = '' } = value as { code?: string; language?: string };
        const cls = language ? ` class="language-${esc(language)}"` : '';
        return `<pre><code${cls}>${esc(code)}</code></pre>`;
      },
    },
  };
}

/**
 * Render a body to HTML plus the headings found in it.
 *
 * Headings are slugged once, then handed to the serializers as a queue — see
 * the note on `components` for why that matters.
 */
export function renderBody(blocks: PTBlock[] = []): { html: string; headings: Heading[] } {
  const headings = extractHeadings(blocks);
  const html = toHTML(blocks as never, {
    components: components(headings.map((h) => h.slug)),
  });

  return { html, headings };
}
