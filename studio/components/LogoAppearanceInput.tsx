/**
 * Shows a tool's logo on BOTH themes' badges, and sets how it is drawn on each.
 *
 * WHY THE PREVIEW IS THE POINT
 *
 * The person uploading a logo sees it once, in whichever theme their own
 * Studio is in, on the Studio's background rather than the strip's. That is
 * how eleven of the site's logos ended up invisible on one theme: nobody ever
 * saw the other one. So this draws the badge exactly as the site does — the
 * page ground, the badge colour, the same CSS filter, and the brand document's
 * own colours when it overrides the defaults — side by side, before publishing.
 *
 * WHAT IS AUTOMATIC, AND WHAT IS NOT
 *
 * The logo is measured in a canvas (see `logoTheme.ts` for the measurement
 * and the thresholds, which were checked against every logo on the site).
 *
 *   - Uploading or replacing a logo while the document is open APPLIES the
 *     suggestion. A new logo is exactly the moment the old setting stops
 *     meaning anything, and a person dropping in a file should not have to
 *     know this panel exists for the result to look right.
 *   - Merely OPENING a document never writes anything. An auto-patch on open
 *     would turn every published tool into a draft with "unpublished changes"
 *     that nobody made. Instead a differing suggestion is offered as a button.
 *
 * The radio buttons below the previews stay the final word: the measurement
 * is a floor, and a person can see things a ratio cannot.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Card, Flex, Grid, Stack, Text } from '@sanity/ui';
import { set, useClient, useFormValue, type ObjectInputProps } from 'sanity';
import {
  INVERT_FILTER,
  THEME_DEFAULTS,
  TREATMENT_OPTIONS,
  readLogo,
  readsWell,
  suggestFor,
  type LogoReading,
  type LogoTreatment,
  type Theme,
  type ThemeColours,
} from './logoTheme';

interface Appearance {
  onDark?: LogoTreatment;
  onLight?: LogoTreatment;
}

type ImageValue = { asset?: { _ref?: string } } | undefined;

const HEX = /^#[0-9a-fA-F]{6}$/;
const SIZE = 96;
const THEMES: Theme[] = ['dark', 'light'];
const FIELD: Record<Theme, keyof Appearance> = { dark: 'onDark', light: 'onLight' };

/**
 * `image-<hash>-<w>x<h>-<ext>` -> its CDN URL.
 *
 * Built by hand rather than with the image-url builder, which the Studio
 * package does not depend on for anything else. Raster files are asked for
 * small — the measurement only needs 96px — and SVGs as they are, because the
 * CDN does not transform them.
 */
function assetUrl(ref: string | undefined, projectId?: string, dataset?: string): string | null {
  const m = /^image-([a-f0-9]+)-(\d+x\d+)-(\w+)$/.exec(ref ?? '');
  if (!m || !projectId || !dataset) return null;
  const base = `https://cdn.sanity.io/images/${projectId}/${dataset}/${m[1]}-${m[2]}.${m[3]}`;
  return m[3] === 'svg' ? base : `${base}?w=192&fit=max`;
}

/**
 * Draw the logo into a canvas at the size the measurement expects and read it.
 *
 * `crossOrigin` is what makes the pixels readable: cdn.sanity.io answers with
 * CORS headers, and without the attribute the canvas is tainted and
 * `getImageData` throws. Any failure resolves to null — the previews still
 * render, there is just no suggestion to offer.
 */
function measure(url: string, surfaces: Record<Theme, string>): Promise<LogoReading | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(null);
        /* An SVG with no width attribute reports 0 natural size; treat it as
           square, which is what `contain` would do with it anyway. */
        const w = img.naturalWidth || SIZE;
        const h = img.naturalHeight || SIZE;
        const k = Math.min(SIZE / w, SIZE / h);
        ctx.drawImage(img, (SIZE - w * k) / 2, (SIZE - h * k) / 2, w * k, h * k);
        resolve(readLogo(ctx.getImageData(0, 0, SIZE, SIZE).data, surfaces));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

const titleOf = (theme: Theme, t: LogoTreatment) =>
  TREATMENT_OPTIONS[theme].find((o) => o.value === t)?.title ?? t;

function Swatch(props: {
  theme: Theme;
  colours: ThemeColours;
  src: string | null;
  treatment: LogoTreatment;
  reading: LogoReading | null;
  measuring: boolean;
}) {
  const { theme, colours: c, src, treatment, reading, measuring } = props;
  const plate = treatment === 'plate';

  const status = !src
    ? 'No logo yet'
    : measuring
      ? 'Measuring…'
      : !reading
        ? 'Could not measure — judge by eye'
        : readsWell(reading, theme, treatment)
          ? 'Reads well'
          : 'Hard to see on this theme';

  return (
    <div
      style={{
        background: c.ground,
        border: `1px solid ${c.line}`,
        borderRadius: 6,
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      {/* The badge, drawn with the site's own rules from TagListBlock.astro. */}
      <div
        style={{
          width: 72,
          height: 72,
          flexShrink: 0,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: plate ? `color-mix(in srgb, ${c.ink} 88%, ${c.surface})` : c.surface,
          border: `1px solid ${plate ? 'transparent' : c.line}`,
        }}
      >
        {src && (
          <img
            src={src}
            alt=""
            style={{
              width: '52%',
              height: '52%',
              objectFit: 'contain',
              filter: treatment === 'invert' ? INVERT_FILTER : undefined,
            }}
          />
        )}
      </div>
      <div style={{ color: c.ink, font: '13px/1.45 system-ui, sans-serif' }}>
        <div style={{ fontWeight: 600 }}>{theme === 'dark' ? 'Dark theme' : 'Light theme'}</div>
        <div style={{ opacity: 0.8 }}>{titleOf(theme, treatment)}</div>
        <div style={{ opacity: 0.65 }}>{status}</div>
      </div>
    </div>
  );
}

export function LogoAppearanceInput(props: ObjectInputProps<Appearance>) {
  const { value, onChange, renderDefault } = props;
  const client = useClient({ apiVersion: '2024-10-01' });
  const { projectId, dataset } = client.config();

  const logo = useFormValue(['logo']) as ImageValue;
  const logoLight = useFormValue(['logoLight']) as ImageValue;
  const logoRef = logo?.asset?._ref;
  const logoLightRef = logoLight?.asset?._ref;

  const srcDark = assetUrl(logoRef, projectId, dataset);
  const srcLight = assetUrl(logoLightRef, projectId, dataset) ?? srcDark;

  /* The brand document may override the strip's colours; the swatches should
     be the live site's, not the defaults, or they preview a site that does
     not exist. */
  const [colours, setColours] = useState<Record<Theme, ThemeColours>>(THEME_DEFAULTS);
  useEffect(() => {
    let live = true;
    client
      .fetch<Record<string, unknown> | null>(
        `*[_type == "brand"][0]{groundDark, surfaceDark, lineDark, inkDark, groundLight, surfaceLight, lineLight, inkLight}`
      )
      .then((b) => {
        if (!live || !b) return;
        const pick = (v: unknown, fallback: string) =>
          typeof v === 'string' && HEX.test(v.trim()) ? v.trim() : fallback;
        const theme = (t: Theme, suffix: 'Dark' | 'Light'): ThemeColours => ({
          ground: pick(b[`ground${suffix}`], THEME_DEFAULTS[t].ground),
          surface: pick(b[`surface${suffix}`], THEME_DEFAULTS[t].surface),
          line: pick(b[`line${suffix}`], THEME_DEFAULTS[t].line),
          ink: pick(b[`ink${suffix}`], THEME_DEFAULTS[t].ink),
        });
        setColours({ dark: theme('dark', 'Dark'), light: theme('light', 'Light') });
      })
      .catch(() => {
        /* The defaults are the site's own — a failed fetch previews those. */
      });
    return () => {
      live = false;
    };
  }, [client]);

  /* Readings are stamped with the logos they measured, so a suggestion is
     never applied from the PREVIOUS file while the new one is still loading. */
  const logosKey = `${logoRef ?? ''}|${logoLightRef ?? ''}`;
  const [readings, setReadings] = useState<{
    key: string;
    dark: LogoReading | null;
    light: LogoReading | null;
  }>({ key: '', dark: null, light: null });

  useEffect(() => {
    let live = true;
    const surfaces = { dark: colours.dark.surface, light: colours.light.surface };
    Promise.all([
      srcDark ? measure(srcDark, surfaces) : Promise.resolve(null),
      srcLight && srcLight !== srcDark ? measure(srcLight, surfaces) : Promise.resolve(undefined),
    ]).then(([dark, light]) => {
      if (live) setReadings({ key: logosKey, dark, light: light === undefined ? dark : light });
    });
    return () => {
      live = false;
    };
  }, [srcDark, srcLight, colours, logosKey]);

  const measuring = readings.key !== logosKey;

  const current: Record<Theme, LogoTreatment> = {
    dark: value?.onDark ?? 'asIs',
    light: value?.onLight ?? 'asIs',
  };

  const suggestion = useMemo(() => {
    if (measuring || !readings.dark || !readings.light) return null;
    return { dark: suggestFor(readings.dark, 'dark'), light: suggestFor(readings.light, 'light') };
  }, [measuring, readings]);

  const differs = !!suggestion && THEMES.some((t) => suggestion[t] !== current[t]);

  const apply = (s: Record<Theme, LogoTreatment>) =>
    onChange(set({ ...(value ?? {}), onDark: s.dark, onLight: s.light }));

  /* Auto-apply only for a logo that changed while this document was open —
     see the header. `openedWith` is the pair of files at mount; `appliedFor`
     stops a re-render re-applying the same suggestion over a manual choice. */
  const openedWith = useRef(logosKey);
  const appliedFor = useRef<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!suggestion || !logoRef) return;
    if (logosKey === openedWith.current || appliedFor.current === logosKey) return;
    appliedFor.current = logosKey;
    if (differs) apply(suggestion);
    setNote(
      `Set for the new logo: ${titleOf('dark', suggestion.dark).toLowerCase()} on dark, ` +
        `${titleOf('light', suggestion.light).toLowerCase()} on light. Change it below if the preview looks wrong.`
    );
    /* `apply` and `differs` derive from the values already listed. */
  }, [suggestion, logosKey, logoRef]);

  return (
    <Stack gap={4}>
      <Grid gridTemplateColumns={[1, 1, 2]} gap={3}>
        {THEMES.map((theme) => (
          <Swatch
            key={theme}
            theme={theme}
            colours={colours[theme]}
            src={theme === 'dark' ? srcDark : srcLight}
            treatment={current[theme]}
            reading={theme === 'dark' ? readings.dark : readings.light}
            measuring={!!logoRef && measuring}
          />
        ))}
      </Grid>

      {note && (
        <Text size={1} muted>
          {note}
        </Text>
      )}

      {differs && suggestion && !note && (
        <Card tone="caution" padding={3} radius={2} border>
          <Flex align="center" gap={3} wrap="wrap">
            <Box flex={1}>
              <Text size={1}>
                Measured suggestion: <strong>{titleOf('dark', suggestion.dark)}</strong> on dark,{' '}
                <strong>{titleOf('light', suggestion.light)}</strong> on light.
              </Text>
            </Box>
            <Button text="Use suggestion" mode="ghost" tone="primary" onClick={() => apply(suggestion)} />
          </Flex>
        </Card>
      )}

      {renderDefault(props)}
    </Stack>
  );
}
