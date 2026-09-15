/**
 * How wide the display face draws a headline, per character, in em.
 *
 * WHY THIS EXISTS. Every page hero is meant to be one line — see the note on
 * the title in `PageHero.astro`. CSS cannot ask "what font size would make
 * this text fit?", so the width has to be known before the size can be
 * chosen. It is known here: `displayWidth()` returns a headline's width at
 * 1em, the hero hands that to CSS as `--title-w`, and CSS divides the measure
 * by it.
 *
 * A FLAT AVERAGE PER CHARACTER IS NOT GOOD ENOUGH, which is the whole reason
 * for a table. Measured against the six headlines on the site, one is wrong
 * by -13% to +13%, and the -13% end is the end that matters: an underestimate
 * picks a size too large and the headline wraps, which is the one thing this
 * is here to prevent.
 *
 * GENERATED — do not hand-edit. `python scripts/gen-display-metrics.py`.
 * These are Archivo SemiBold at wght 800, wdth 100 — the weight the hero
 * sets and the width it draws at, having no `font-stretch` of its own. Both
 * have to match `.page-hero-title` exactly: this table converts a headline
 * into a width, and the page then picks a font-size from it, so a table
 * measured at one width and rendered at another sizes every headline wrong.
 *
 * IT FAILS SOFT. A stale table, or a character not listed, means the headline
 * is sized a little wrong: slightly small, or wrapped onto a second line the
 * way it was before. Nothing breaks. That is what makes this worth doing at
 * all — the alternative is measuring text in the browser with JavaScript, on
 * a site that otherwise ships none.
 */

/** Characters grouped by advance width, in em. */
const ADVANCES: ReadonlyArray<readonly [number, string]> = [
  [0.189, ' \u00a0'],
  [0.263, '\''],
  [0.265, '|'],
  [0.279, '’'],
  [0.286, 'j'],
  [0.288, 'il'],
  [0.302, '/'],
  [0.314, '!'],
  [0.318, ',.'],
  [0.329, 'I'],
  [0.333, '-'],
  [0.334, ':;'],
  [0.352, 'f'],
  [0.366, '[]'],
  [0.374, '()'],
  [0.385, 't'],
  [0.407, '*r'],
  [0.473, '"'],
  [0.496, '“”'],
  [0.5, '–'],
  [0.534, '_'],
  [0.535, 'z'],
  [0.574, 'vy'],
  [0.579, '$s'],
  [0.61, 'k'],
  [0.612, '?cx'],
  [0.616, 'a'],
  [0.619, 'e'],
  [0.623, 'L'],
  [0.625, '#012356789'],
  [0.626, '4'],
  [0.627, '£€'],
  [0.629, 'hnu'],
  [0.63, 'J'],
  [0.632, 'g'],
  [0.633, 'bdpq'],
  [0.635, 'o'],
  [0.641, 'F'],
  [0.649, '+<=>~'],
  [0.675, 'T'],
  [0.682, 'Z'],
  [0.697, 'S'],
  [0.698, 'P'],
  [0.699, 'E'],
  [0.729, 'V'],
  [0.732, 'Y'],
  [0.736, 'X'],
  [0.745, 'B'],
  [0.746, 'A'],
  [0.75, 'R'],
  [0.752, 'C'],
  [0.755, 'D'],
  [0.77, 'K'],
  [0.783, 'U'],
  [0.787, 'HN'],
  [0.81, 'OQ'],
  [0.815, 'G'],
  [0.816, '&'],
  [0.859, 'w'],
  [0.914, 'M'],
  [0.937, 'm'],
  [0.979, 'W'],
  [0.984, '%'],
  [1.0, '—'],
  [1.005, '@'],
];

const BY_CHAR: ReadonlyMap<string, number> = new Map(
  ADVANCES.flatMap(([width, chars]) => [...chars].map((c) => [c, width] as const))
);

/**
 * The widest glyph in the face.
 *
 * Anything missing from the table is charged this rather than an average, so
 * an accent, a dash nobody listed or a stray symbol makes the headline a
 * touch SMALLER than it needed to be. That is the harmless direction.
 */
const FALLBACK = 1.005;

/** The hero's letter-spacing, which is part of how wide a line comes out. */
const TRACKING = -0.03;

/**
 * Width of `text` in em, at the hero's weight and tracking.
 *
 * Tracking is counted once per character because that is what a browser does:
 * the space goes after every character, the last one included. Floored above
 * zero so an empty or exotic string can never divide the measure by nothing.
 */
export function displayWidth(text: string): number {
  const chars = [...text];
  let total = 0;
  for (const ch of chars) total += BY_CHAR.get(ch) ?? FALLBACK;
  return Math.max(total + TRACKING * chars.length, 0.1);
}
