"""
Regenerate src/config/displayMetrics.ts from the shipped font file.

    pip install fonttools brotli
    python scripts/gen-display-metrics.py

WHEN TO RUN IT: when the display face changes, when the hero's font-weight
changes, or when `font-optical-sizing: none` comes off `.page-hero-title`.
Nothing else moves these numbers, and nothing runs this automatically — a
build does not need it, because the table it writes is checked in.

WHY IT IS PYTHON in a Node project: reading advance widths out of a variable
font means instancing it at a point on the weight and optical-size axes, and
fontTools is the tool that does that. It is a dev-only dependency of a script
that runs roughly never, so it is not worth a package.json entry; `npm run
verify` neither needs it nor calls it.

See the header of the generated file for what the numbers are for.
"""

from collections import defaultdict
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / 'public' / 'fonts' / 'bricolage-grotesque-latin.woff2'
OUT = ROOT / 'src' / 'config' / 'displayMetrics.ts'

# Must match `.page-hero-title` in PageHero.astro.
WGHT = 800
OPSZ = 96

# Everything a headline can plausibly contain, plus NBSP, which the Studio
# actively tells editors to type to control where a line breaks.
CHARS = (
    'abcdefghijklmnopqrstuvwxyz'
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    '0123456789'
    '  .,:;!?\'’"“”-–—()[]&/@#%+*=_<>|~$£€'
)

font = instancer.instantiateVariableFont(
    TTFont(FONT), {'wght': WGHT, 'opsz': OPSZ}, inplace=True
)
upem, hmtx, cmap = font['head'].unitsPerEm, font['hmtx'], font.getBestCmap()

advances = {
    ch: round(hmtx[cmap[ord(ch)]][0] / upem, 4) for ch in CHARS if ord(ch) in cmap
}

groups = defaultdict(list)
for ch, width in advances.items():
    groups[width].append(ch)

ESCAPES = {'\\': '\\\\', "'": "\\'", ' ': '\\u00a0'}
rows = '\n'.join(
    "  [%s, '%s']," % (w, ''.join(ESCAPES.get(c, c) for c in sorted(groups[w])))
    for w in sorted(groups)
)
widest = max(advances.values())

OUT.write_text(
    f'''/**
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
 * These are {font["name"].getDebugName(1) or "the display face"} at wght {WGHT}, opsz {OPSZ}: the hero's weight, and its
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
{rows}
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
const FALLBACK = {widest};

/** The hero's letter-spacing, which is part of how wide a line comes out. */
const TRACKING = -0.03;

/**
 * Width of `text` in em, at the hero's weight and tracking.
 *
 * Tracking is counted once per character because that is what a browser does:
 * the space goes after every character, the last one included. Floored above
 * zero so an empty or exotic string can never divide the measure by nothing.
 */
export function displayWidth(text: string): number {{
  const chars = [...text];
  let total = 0;
  for (const ch of chars) total += BY_CHAR.get(ch) ?? FALLBACK;
  return Math.max(total + TRACKING * chars.length, 0.1);
}}
''',
    encoding='utf-8',
    newline='\n',
)

print(f'{OUT.relative_to(ROOT)}: {len(advances)} characters, {len(groups)} widths')
