/**
 * What the social card is supposed to look like — in one place, because two
 * scripts need the same answer and disagreeing about it is the entire bug this
 * file exists downstream of.
 *
 * `generate-og-image.mjs` uses this to PAINT the card. `check-og.mjs` uses it
 * to ask whether the committed card is still right. If they each worked the
 * palette out for themselves, the check could pass a card the generator would
 * now draw differently — a checker that certifies its own blind spot, which is
 * worse than no checker at all.
 *
 * Neither the logo bytes nor sharp appear here. This is the part that is pure
 * arithmetic over text, so the check can import it with no native dependencies
 * and run in CI.
 */
import { readFileSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);

/**
 * The palette fields on the `brand` document, as a GROQ projection.
 *
 * Named once so the two scripts cannot ask for different subsets — the failure
 * there would be a check that reads five colours, a generator that draws six,
 * and a sixth that is free to drift forever.
 */
export const PALETTE_PROJECTION =
  'groundDark, surfaceDark, accentDark, inkDark, inkMutedDark, inkFaintDark';

/**
 * A CMS colour override, or null.
 *
 * Same rule `Base.astro` applies to these very fields: blank means "keep the
 * value the site shipped with", so it must never overwrite anything. Validated
 * rather than trusted — they are free-text fields, and a typo would produce an
 * invalid `fill` that SVG silently drops, taking the element with it.
 */
export const hex = (value) =>
  /^#[0-9a-fA-F]{6}$/.test(String(value ?? '').trim()) ? String(value).trim() : null;

/**
 * The site's dark palette, READ OUT OF THE STYLESHEET rather than copied.
 *
 * The card used to carry six hardcoded hexes and they had gone wrong two
 * different ways at once. Five matched `global.css` by luck. One did not — the
 * domain line was `#6b7185` against a real `--color-ink-faint` of `#61677a`,
 * close enough that nobody would catch it by eye and wrong all the same. And a
 * seventh colour, a `#4a3080` purple washed across the corner, was not in the
 * palette at all: not in `global.css`, not in the Studio, not on any page. It
 * existed only in the generator, so the card everybody shares was the one
 * surface painting the studio a colour it does not use.
 *
 * The stylesheet's first `:root` block is the dark theme and is the site's
 * actual answer to all of it, so it is parsed. A hex can now only be wrong
 * here by being wrong on the site too.
 */
export function shippedPalette() {
  const css = readFileSync(new URL('src/styles/global.css', ROOT), 'utf8');
  const start = css.indexOf(':root {');
  if (start === -1) throw new Error('no :root block in src/styles/global.css');

  /* Up to the first closing brace in column 0. The light theme lives in its
     own `[data-theme]` block well below this one. */
  const block = css.slice(start, css.indexOf('\n}', start));

  const token = (name) => {
    /* The colon has to bind tightly, or `--color-ink` also matches
       `--color-ink-muted` and the three ink levels collapse into one. */
    const hit = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`));
    if (!hit) throw new Error(`--${name} not found in the :root block of global.css`);
    return hit[1];
  };

  return {
    ground: token('color-ground'),
    surface: token('color-surface'),
    accent: token('color-accent'),
    ink: token('color-ink'),
    inkMuted: token('color-ink-muted'),
    inkFaint: token('color-ink-faint'),
  };
}

/**
 * The colours the card should be drawn in: what the site ships, with whatever
 * the Studio overrides on top.
 *
 * `doc` is the `brand` document, or anything falsy when Sanity is not
 * configured — in which case the shipped palette stands, which is exactly what
 * a site built without credentials renders.
 */
export function resolvePalette(doc) {
  const shipped = shippedPalette();
  const cms = {
    ground: hex(doc?.groundDark),
    surface: hex(doc?.surfaceDark),
    accent: hex(doc?.accentDark),
    ink: hex(doc?.inkDark),
    inkMuted: hex(doc?.inkMutedDark),
    inkFaint: hex(doc?.inkFaintDark),
  };

  return Object.fromEntries(
    Object.entries(shipped).map(([key, value]) => [key, cms[key] ?? value])
  );
}
