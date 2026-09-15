/**
 * How a tool logo reads on each theme's badge — and what to do when it does
 * not.
 *
 * THE PROBLEM THIS EXISTS FOR
 *
 * The "What we run" strip draws every logo on the same badge colour, and the
 * site has two themes. A logo file has one set of colours. So a black mark
 * (Nuke, Unity, Houdini) vanished into the dark badge, and a white one (Toon
 * Boom, TVPaint, 3DEqualizer) vanished into the light badge — and whoever
 * uploaded it saw only whichever theme their own Studio happened to be in.
 * Measured across the 34 logos on 15 September 2026, eleven failed on one
 * theme or the other.
 *
 * THREE TREATMENTS, applied by CSS on the site, per theme:
 *
 *   asIs    As uploaded.
 *   invert  `invert(1) hue-rotate(180deg)`. Lightness flips and hue roughly
 *           survives, so a black mark turns white and KEEPS its inner detail
 *           — Marmoset's skull keeps its eyes, which a "make it solid white"
 *           treatment would fill in. Only offered for near-neutral logos: the
 *           hue rotation is an approximation, and a colourful mark comes out
 *           the wrong colours.
 *   plate   The badge takes the theme's text colour, so the logo sits on a
 *           contrasting disc. The last resort for a colourful mark that
 *           cannot be flipped. It is loud in a strip of quiet badges, which
 *           is why it is never preferred over the other two.
 *
 * A separate light-theme file (`logoLight` on the tool) beats all of these
 * when the brand publishes one; the treatment still applies on top.
 *
 * PURE AND DEPENDENCY-FREE, deliberately: the Studio feeds it pixels from a
 * canvas, and anything else that ever needs the same judgement (a script, a
 * test) can feed it pixels from anywhere.
 */

export type LogoTreatment = 'asIs' | 'invert' | 'plate';
export type Theme = 'dark' | 'light';

/** Studio option lists. Titles differ per theme only for the disc. */
export const TREATMENT_OPTIONS: Record<Theme, { value: LogoTreatment; title: string }[]> = {
  dark: [
    { value: 'asIs', title: 'As uploaded' },
    { value: 'invert', title: 'Flip light and dark' },
    { value: 'plate', title: 'On a light disc' },
  ],
  light: [
    { value: 'asIs', title: 'As uploaded' },
    { value: 'invert', title: 'Flip light and dark' },
    { value: 'plate', title: 'On a dark disc' },
  ],
};

/**
 * The site's own colours for the strip, from `src/styles/global.css`.
 *
 * Defaults only. The brand document can override every one of these, and the
 * Studio preview reads that document so the swatch matches the live site.
 */
export interface ThemeColours {
  ground: string;
  surface: string;
  line: string;
  ink: string;
}

export const THEME_DEFAULTS: Record<Theme, ThemeColours> = {
  dark: { ground: '#0b0c10', surface: '#14161c', line: '#262a35', ink: '#f4f4f2' },
  light: { ground: '#faf9f5', surface: '#ffffff', line: '#e2e0d6', ink: '#16171b' },
};

/** The same filter the site applies, for the Studio's live preview. */
export const INVERT_FILTER = 'invert(1) hue-rotate(180deg)';

/* ------------------------------------------------------------------ */
/* Measuring                                                           */
/* ------------------------------------------------------------------ */

const lin = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (r: number, g: number, b: number) =>
  0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const rgbOf = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/*
 * CSS `hue-rotate(180deg)` from the Filter Effects spec, with cos = -1 and
 * sin = 0 substituted. Applied after `invert(1)`, so what is measured is
 * exactly what the site renders rather than an idealised colour inversion.
 */
const HUE_180 = [
  [-0.574, 1.43, 0.144],
  [0.426, 0.43, 0.144],
  [0.426, 1.43, -0.856],
];

function inverted(r: number, g: number, b: number): [number, number, number] {
  const c = [1 - r / 255, 1 - g / 255, 1 - b / 255];
  return HUE_180.map((row) =>
    Math.round(255 * Math.min(1, Math.max(0, row[0] * c[0] + row[1] * c[1] + row[2] * c[2])))
  ) as [number, number, number];
}

/**
 * A pixel stands out from the badge at 2:1. Not the 3:1 WCAG asks of UI
 * edges: a logo is recognised by shape, and 3:1 flagged Blender's orange on
 * white, which reads perfectly well.
 */
const STANDS_OUT = 2;

export interface ThemeReading {
  /** Share of the mark, by opacity, that stands out from the badge as uploaded. */
  visible: number;
  /** The same, after the flip. */
  visibleInverted: number;
}

export interface LogoReading {
  /** Mean HSV saturation of the opaque pixels. 0 is black, white or grey. */
  saturation: number;
  dark: ThemeReading;
  light: ThemeReading;
}

/**
 * Read an RGBA pixel buffer (a canvas's `ImageData.data`, or any raw decode)
 * against both badge colours.
 */
export function readLogo(
  rgba: ArrayLike<number>,
  surfaces: Record<Theme, string> = {
    dark: THEME_DEFAULTS.dark.surface,
    light: THEME_DEFAULTS.light.surface,
  }
): LogoReading {
  let satSum = 0;
  let solid = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;
    const mx = Math.max(rgba[i], rgba[i + 1], rgba[i + 2]);
    const mn = Math.min(rgba[i], rgba[i + 1], rgba[i + 2]);
    satSum += mx ? (mx - mn) / mx : 0;
    solid++;
  }

  const readTheme = (hex: string): ThemeReading => {
    const s = rgbOf(hex);
    const sl = luminance(...s);
    let weight = 0;
    let vis = 0;
    let visInv = 0;
    for (let i = 0; i < rgba.length; i += 4) {
      const a = rgba[i + 3] / 255;
      if (a === 0) continue;
      /* Composited onto the badge, because a half-transparent edge is seen
         as the blend, not as the colour in the file. */
      const over = (c: [number, number, number]) =>
        luminance(a * c[0] + (1 - a) * s[0], a * c[1] + (1 - a) * s[1], a * c[2] + (1 - a) * s[2]);
      const px: [number, number, number] = [rgba[i], rgba[i + 1], rgba[i + 2]];
      weight += a;
      if (ratio(over(px), sl) >= STANDS_OUT) vis += a;
      if (ratio(over(inverted(...px)), sl) >= STANDS_OUT) visInv += a;
    }
    return weight
      ? { visible: vis / weight, visibleInverted: visInv / weight }
      : { visible: 0, visibleInverted: 0 };
  };

  return {
    saturation: solid ? satSum / solid : 0,
    dark: readTheme(surfaces.dark),
    light: readTheme(surfaces.light),
  };
}

/* ------------------------------------------------------------------ */
/* Deciding                                                            */
/* ------------------------------------------------------------------ */

/*
 * THE THRESHOLDS, and the logos that set them. Every number here was checked
 * against the real strip rather than chosen in the abstract.
 *
 * READABLE AT 12%, NOT HIGHER. The Adobe icons are a coloured tile with bright
 * letters, and on the dark badge only the letters stand out: 13% to 24% of the
 * mark. They read perfectly. The black marks that genuinely vanish measure 0%,
 * and Procreate's dark tile 9%.
 *
 * FLIP ONLY WHAT IS NEAR-NEUTRAL (saturation under 0.35), and only when the
 * flip actually helps. Spine on the light badge is 22% visible — above the
 * readable line, because its orange dot survives — but the wordmark itself is
 * gone, and flipping takes it to most of the mark. Hence the second condition:
 * a flip that adds 40 points of visibility is worth making even when the
 * original technically passes — but only while the original is still MOSTLY
 * lost (under 30%). Mocha Pro on the light badge reads at 36% and would gain
 * 42 points by flipping; it looks right as uploaded, and a flip would recolour
 * a brand mark for nothing. Unreal, a white disc with a black U, gains nothing
 * from flipping and is left alone.
 */
const READABLE = 0.12;
const MOSTLY_LOST = 0.3;
const NEUTRAL = 0.35;
const FLIP_RESULT = 0.5;
const FLIP_GAIN = 0.4;

export function suggestFor(reading: LogoReading, theme: Theme): LogoTreatment {
  const { visible, visibleInverted } = reading[theme];
  const flipHelps =
    reading.saturation < NEUTRAL &&
    visibleInverted >= FLIP_RESULT &&
    (visible < READABLE || (visible < MOSTLY_LOST && visibleInverted - visible >= FLIP_GAIN));

  if (flipHelps) return 'invert';
  if (visible < READABLE) return 'plate';
  return 'asIs';
}

/** How the chosen treatment will read, for the preview's status line. */
export function readsWell(reading: LogoReading, theme: Theme, treatment: LogoTreatment): boolean {
  if (treatment === 'plate') return true;
  const r = reading[theme];
  return (treatment === 'invert' ? r.visibleInverted : r.visible) >= READABLE;
}
