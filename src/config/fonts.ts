/**
 * The typefaces an editor may choose, and the type roles they apply to.
 *
 * WHY A FIXED LIST AND NOT A TEXT BOX
 *
 * The fonts on this site are self-hosted `.woff2` files in `public/fonts/`,
 * declared as `@font-face` in `global.css`. That was a deliberate move away
 * from a Google Fonts `<link>`, which cost a DNS lookup, a TLS handshake and
 * a render-blocking request to a third party before a single glyph could
 * paint — and handed every visitor's IP address to Google, which the privacy
 * policy then had to disclose.
 *
 * A free-text font name would not survive that. Typing "Futura" into the
 * Studio would emit a family nothing has loaded, and the browser would fall
 * silently through to the next name in the stack — so the site would keep
 * working, look unchanged, and quietly ignore the setting. A dropdown of what
 * is actually installed is the only version of this that cannot lie.
 *
 * ADDING A FACE: drop the `.woff2` in `public/fonts/`, add an `@font-face`
 * block in `global.css`, add an entry here, and redeploy the Studio
 * (`cd studio && npm run deploy`) so the dropdown offers it. The stack below
 * must name the family exactly as the `@font-face` does.
 *
 * The two system entries need no file: they resolve to whatever the visitor's
 * OS provides, which is the fastest possible option and a genuinely good
 * choice for body text.
 */

export interface FontChoice {
  /** Stored in Sanity. Changing it orphans whatever was selected. */
  name: string;
  /** How it reads in the Studio dropdown. */
  title: string;
  /** The full CSS stack, fallbacks included. Never stored in the CMS. */
  stack: string;
}

export const FONT_CHOICES: FontChoice[] = [
  {
    name: 'bricolage',
    title: 'Bricolage Grotesque',
    stack: '"Bricolage Grotesque", "Archivo", "Helvetica Neue", Arial, sans-serif',
  },
  {
    name: 'instrument',
    title: 'Instrument Sans',
    stack: '"Instrument Sans", ui-sans-serif, system-ui, sans-serif',
  },
  {
    name: 'jetbrains',
    title: 'JetBrains Mono',
    stack: '"JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace',
  },
  {
    name: 'system-sans',
    title: 'System sans — no download',
    stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  },
  {
    name: 'system-serif',
    title: 'System serif — no download',
    stack: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  },
];

export const FONT_CHOICE_NAMES = FONT_CHOICES.map((f) => f.name);

/** `bricolage` -> the full stack, or undefined for an unknown key. */
export const fontStack = (name?: string): string | undefined =>
  FONT_CHOICES.find((f) => f.name === name)?.stack;

/* ------------------------------------------------------------------ */
/* Type roles                                                          */
/* ------------------------------------------------------------------ */

/**
 * The five roles every piece of text on this site belongs to.
 *
 * These are not new. They are the grouping the stylesheet already used — the
 * four `--font-*` tokens plus a split of the display face into "big" and
 * "not big" — made explicit so it can be adjusted rather than only read.
 *
 * WHY ROLES AND NOT 313 FIELDS. There are 313 `font-size` declarations across
 * 51 component stylesheets, holding 84 distinct values. Exposing those one by
 * one would be a Studio document nobody could navigate and a licence for the
 * blog to stop matching the rest of the site. Grouped, every heading moves
 * together, which is what a type system is for.
 *
 * WHY MULTIPLIERS AND NOT SIZES. Each role scales what the design already
 * says rather than replacing it. At 100% the emitted CSS computes to exactly
 * the values that were there before, so the default is provably a no-op — and
 * the careful relationships between, say, a card title and the section
 * heading above it survive being scaled, which they would not if an editor
 * typed absolute sizes into both.
 */
export interface TypeRole {
  name: string;
  title: string;
  description: string;
}

export const TYPE_ROLES: TypeRole[] = [
  {
    name: 'display',
    title: 'Big headings',
    description:
      'Page titles and the large heading at the top of a section — the biggest text on any page.',
  },
  {
    name: 'heading',
    title: 'Small headings',
    description: 'Card titles, sub-headings and anything set in the heading face below about 26px.',
  },
  {
    name: 'body',
    title: 'Body text',
    description: 'Paragraphs, intros, form fields — the text people actually read.',
  },
  {
    name: 'label',
    title: 'Labels & small print',
    description:
      'Eyebrows, chips, badges, meta rows, breadcrumbs, buttons and captions. By far the most common role on the site, so a change here is felt everywhere.',
  },
  {
    name: 'mono',
    title: 'Code',
    description: 'Inline code and code blocks in blog posts and case studies.',
  },
];

export const TYPE_ROLE_NAMES = TYPE_ROLES.map((r) => r.name);
