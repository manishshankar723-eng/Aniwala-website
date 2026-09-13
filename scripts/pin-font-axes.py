"""
Drop a variable font axis nobody uses. Run by hand; the output is committed.

WHY THIS EXISTS
---------------
`bricolage-grotesque-latin.woff2` was 128 KB — four times what a latin subset
of a display face should cost, and it is one of the two fonts PRELOADED in
`layouts/Base.astro`, so it sits on the critical path of every first paint.

The usual advice ("subset it to latin") was already done: the faces are split
latin / latin-ext with a `unicode-range` on each. The weight was somewhere
else. Bricolage ships THREE variable axes:

    opsz  12..96     optical size
    wght  200..800   weight
    wdth  75..100    width

and a variable font pays for every axis in the `gvar` table, whether or not
anything asks for it.

THE SITE NEVER ASKS FOR A WIDTH. There are ~55 `font-stretch` declarations
across the components and they are all between 104% and 118% — left over from
when the display face was Archivo, whose axis ran 100..125. Bricolage's tops
out at 100, so every one of them clamps to the default and draws normal width.
Both `global.css` and `PageHero.astro` already carry notes saying exactly this.

So pinning `wdth` at 100 removes the axis and changes nothing that renders.
That is the whole argument for this script, and it is why the other two axes
are LEFT ALONE:

  - `wght` is used constantly — 200 through 800 across headings and labels.
  - `opsz` is live too, and less obviously. `font-optical-sizing` defaults to
    `auto`, so the browser varies it with font-size on every heading on the
    site. `PageHero.astro` pins it to `none` in ONE place, deliberately, and
    explains why: on `auto` the face draws up to 12.8% wider as text gets
    smaller, which would make its fit-to-width calculation chase itself.
    Pinning opsz globally here would silently change every other heading.

USAGE
-----
    pip install fonttools brotli
    python scripts/pin-font-axes.py          # rewrites the fonts in place
    python scripts/pin-font-axes.py --check  # report only, touch nothing

Re-running is safe: a font whose axis is already gone is reported and skipped.
"""

import os
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(ROOT, "public", "fonts")

# Only the display face has a width axis, and only its width axis is unused.
# Named explicitly rather than "any axis with one value in the CSS", because
# that inference is exactly the kind of cleverness that removes `opsz`.
TARGETS = {
    "bricolage-grotesque-latin.woff2": {"wdth": 100},
    "bricolage-grotesque-latin-ext.woff2": {"wdth": 100},
}

check_only = "--check" in sys.argv


def axes_of(font):
    return [a.axisTag for a in font["fvar"].axes] if "fvar" in font else []


def kb(path):
    return os.path.getsize(path) / 1024


def main():
    saved_total = 0.0

    for name, pins in TARGETS.items():
        path = os.path.join(FONT_DIR, name)
        if not os.path.exists(path):
            print(f"  SKIP  {name} — not found")
            continue

        font = TTFont(path)
        before_axes = axes_of(font)
        before_kb = kb(path)

        missing = [tag for tag in pins if tag not in before_axes]
        if missing:
            print(f"  SKIP  {name} — no {', '.join(missing)} axis (already pinned?)")
            font.close()
            continue

        print(f"  {name}")
        print(f"        axes {before_axes}  {before_kb:.0f} KB")

        if check_only:
            font.close()
            continue

        # `inplace` mutates the TTFont we already loaded; `optimize` drops the
        # now-redundant deltas that made the axis cost what it did.
        instancer.instantiateVariableFont(font, pins, inplace=True, optimize=True)

        # NO BACKUP FILE IS WRITTEN, and that is deliberate.
        #
        # The obvious version of this dropped a `.woff2.orig` beside each
        # font. Both of them are inside `public/`, which Astro copies into
        # `dist/` verbatim — so the "safety" copies would have been uploaded
        # to the web server on the next deploy, restoring the 75 KB this
        # script exists to remove, in files nothing references.
        #
        # The original is in git, which is a better backup than a sibling
        # file: `git checkout public/fonts/` puts it back exactly.
        os.remove(path)

        # woff2 in, woff2 out — the <link rel=preload> and @font-face both
        # name this exact file, so the format has to survive the round trip.
        font.flavor = "woff2"
        font.save(path)
        font.close()

        after = TTFont(path)
        after_axes = axes_of(after)
        after.close()

        after_kb = kb(path)
        saved_total += before_kb - after_kb
        pct = (before_kb - after_kb) / before_kb * 100
        print(f"        axes {after_axes}  {after_kb:.0f} KB  (-{before_kb - after_kb:.0f} KB, -{pct:.0f}%)")

    if not check_only:
        print(f"\n  Total saved: {saved_total:.0f} KB")
        print("  Originals are in git — `git checkout public/fonts/` to undo.")


if __name__ == "__main__":
    main()
