/**
 * WCAG contrast, for the brand-colour fields.
 *
 * WHY A VALIDATOR AND NOT JUST A COLOUR PICKER
 *
 * Handing somebody two colour wells and letting them pick is how a site ends
 * up with white text on yellow buttons. The person choosing is looking at the
 * colour they like on a large calibrated monitor; the person reading is on a
 * phone in daylight. A ratio is the only part of this that is not a matter of
 * taste, so it is the part the Studio checks.
 *
 * WARNINGS, NOT ERRORS. A failing ratio does not block publishing — brand
 * decisions above the fold sometimes genuinely are somebody else's call, and a
 * schema that refuses to save is a schema people work around by putting the
 * colour somewhere it is not checked. It says what the ratio is and what the
 * threshold was, and lets a person decide.
 *
 * The maths is the WCAG 2.1 relative-luminance formula, which is short enough
 * to write out and avoids a dependency for twenty lines.
 */

const HEX = /^#[0-9a-fA-F]{6}$/;

/** One sRGB channel, linearised. */
const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * (n & 255)
  );
}

/**
 * Contrast between two colours, 1 (identical) to 21 (black on white).
 *
 * WCAG AA wants 4.5 for body text and 3 for large text and UI borders.
 */
export function contrastRatio(a: string, b: string): number {
  if (!HEX.test(a) || !HEX.test(b)) return NaN;
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * A validator message, or `true`.
 *
 * `min` is the AA threshold for the thing being checked — 4.5 where the pair
 * carries body-sized text, 3 where it is large type or a UI edge.
 */
export function contrastWarning(
  foreground: string | undefined,
  background: string | undefined,
  min: number,
  what: string
): true | string {
  if (!foreground || !background) return true;
  const ratio = contrastRatio(foreground, background);
  if (Number.isNaN(ratio)) return true;
  if (ratio >= min) return true;
  return `${what} is ${ratio.toFixed(1)}:1. WCAG AA asks for ${min}:1, so this will be hard to read — especially on a phone outdoors.`;
}
