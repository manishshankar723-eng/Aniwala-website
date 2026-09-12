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
 * These are Bricolage Grotesque 96pt ExtraBold at wght 800, opsz 96: the hero's weight, and its
 * optical size, which the hero pins with `font-optical-sizing: none` for
 * exactly this reason. Left on `auto`, opsz tracks font-size and glyphs grow
 * up to 12.8% wider as the text gets smaller — which would make the size this
 * table chooses change the width it was chosen from.
 *
 * IT FAILS SOFT. A stale table, or a character not listed, means the headline
 * is sized a little wrong: slightly small, or wrapped onto a second line the
 * way it was before. Nothing breaks. That is what makes this worth doing at
 * all — the alternative is measuring text in the browser with JavaScript, on
 * a site that otherwise ships none.
 */

/** Characters grouped by advance width, in em. */
const ADVANCES: ReadonlyArray<readonly [number, string]> = [
  [0.174, '\''],
  [0.193, ',’'],
  [0.203, ' \u00a0'],
  [0.218, '|'],
  [0.234, 'il'],
  [0.235, ';'],
  [0.243, 'I'],
  [0.244, 'j'],
  [0.246, '.'],
  [0.25, ':'],
  [0.268, '!'],
  [0.295, '[]'],
  [0.303, '()'],
  [0.31, '1'],
  [0.313, '-'],
  [0.323, 'J'],
  [0.34, '"'],
  [0.349, '/'],
  [0.368, 't'],
  [0.376, 'f'],
  [0.382, '“”'],
  [0.396, '?'],
  [0.4, 'r'],
  [0.457, '*'],
  [0.46, 'L'],
  [0.483, 'z'],
  [0.486, '+<=>~'],
  [0.498, '7'],
  [0.5, '–'],
  [0.51, 'F'],
  [0.516, 'T'],
  [0.517, 's'],
  [0.527, '_'],
  [0.53, 'v'],
  [0.537, 'e'],
  [0.539, 'cy'],
  [0.54, 'E'],
  [0.541, 'k'],
  [0.543, 'ax'],
  [0.549, 'g'],
  [0.55, 'Z'],
  [0.551, '2'],
  [0.557, 'u'],
  [0.562, 'hn'],
  [0.565, '35'],
  [0.567, 'o'],
  [0.574, 'pq'],
  [0.575, '$'],
  [0.576, 'bd'],
  [0.585, 'S'],
  [0.586, 'P'],
  [0.592, '6'],
  [0.594, '0'],
  [0.595, 'Y'],
  [0.603, '9'],
  [0.607, '4'],
  [0.608, '8B'],
  [0.613, '#'],
  [0.615, 'R'],
  [0.621, 'D'],
  [0.623, 'KX'],
  [0.627, 'U'],
  [0.631, 'C'],
  [0.632, 'V'],
  [0.637, 'H'],
  [0.649, 'G'],
  [0.659, 'AQ'],
  [0.661, 'O'],
  [0.68, '€'],
  [0.687, '£'],
  [0.694, 'N'],
  [0.697, '&'],
  [0.775, '—'],
  [0.799, 'w'],
  [0.822, 'M'],
  [0.86, 'm'],
  [0.915, 'W'],
  [0.936, '@'],
  [0.948, '%'],
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
const FALLBACK = 0.948;

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
