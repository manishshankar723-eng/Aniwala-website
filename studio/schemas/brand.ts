/**
 * The logo and the icons. A SINGLETON.
 *
 * WHY TWO LOGO FIELDS AND NOT ONE
 *
 * The header mark used to be inline SVG using `currentColor`, which is how it
 * flipped between the light and dark themes for free. An uploaded file cannot
 * do that — a PNG is the colour it was exported as — so replacing one inline
 * SVG with one upload would have made the logo invisible in one of the two
 * themes for half the visitors.
 *
 * So there are two. Upload the version meant to sit on a DARK background and
 * the version meant to sit on a LIGHT one, and the header shows whichever the
 * visitor's theme calls for. Leave both blank and the built-in mark is used,
 * still flipping with the theme exactly as it always did — so this document
 * is safe to ignore entirely.
 *
 * BOTH OR NEITHER is enforced below. One uploaded and one blank is the
 * failure worth preventing: the site would look right to whoever uploaded it
 * and show a blank gap to everybody using the other theme, which is the kind
 * of bug that survives for months because the person who could see it never
 * switches themes.
 *
 * THE ICON IS A DIFFERENT PROBLEM. A favicon is not one file — it is a 32px
 * tab icon, a 180px Apple touch icon, two PWA icons and a manifest. Rather
 * than generate and commit five files, the site points every one of those at
 * Sanity's image CDN, resized on the fly from the single square uploaded
 * here. The committed files in `public/` stay as the fallback for when
 * nothing is uploaded, and as the bare `/favicon.ico` that old browsers ask
 * for without being told to.
 */
import { defineType, defineField } from 'sanity';
import { contrastWarning } from '../components/contrast';

/** A hex field, with the same shape and message every time. */
const hex = (
  name: string,
  title: string,
  description: string,
  validate?: (value: string | undefined, doc: Record<string, unknown>) => true | string
) =>
  defineField({
    name,
    title,
    type: 'string',
    group: 'colour',
    description,
    validation: (Rule) =>
      Rule.custom((v: string | undefined, ctx) => {
        if (!v) return true;
        if (!/^#[0-9a-fA-F]{6}$/.test(v)) return 'Use a six-digit hex colour, like #e4c24c.';
        return validate ? validate(v, (ctx.document ?? {}) as Record<string, unknown>) : true;
      }),
  });

/**
 * Neither logo needs alt text.
 *
 * The link around it already carries "Aniwala Studios — home" as its
 * accessible name (see Interface copy), so a screen reader announces the
 * destination correctly. Alt text here would make it announce the same thing
 * twice, which is why these are marked decorative in the markup instead.
 */
const logoField = (name: string, title: string, description: string) =>
  defineField({
    name,
    title,
    type: 'image',
    group: 'logo',
    description,
    options: { hotspot: false },
  });

export default defineType({
  name: 'brand',
  title: 'Logo & icons',
  type: 'document',

  groups: [
    { name: 'logo', title: 'Header logo', default: true },
    { name: 'colour', title: 'Brand colour' },
    { name: 'icon', title: 'Browser icon' },
  ],

  fields: [
    logoField(
      'logoDark',
      'Logo — for dark theme',
      'Shown while the site is in its dark theme, so this one needs to read on a DARK background: pale mark, transparent PNG or SVG. Roughly 40px tall as rendered — upload at 3x or larger, or an SVG.'
    ),
    logoField(
      'logoLight',
      'Logo — for light theme',
      'The same mark for a LIGHT background. Upload both or neither: one on its own leaves a blank gap for everybody using the other theme.'
    ),

    defineField({
      name: 'showWordmark',
      title: 'Show the studio name beside the logo',
      type: 'boolean',
      group: 'logo',
      description:
        'Turn this off if your uploaded logo already includes the name — otherwise the header says it twice.',
      initialValue: true,
    }),
    defineField({
      name: 'wordmark',
      title: 'Studio name',
      type: 'string',
      group: 'logo',
      description: 'The large line beside the mark.',
    }),
    defineField({
      name: 'wordmarkSub',
      title: 'Studio name, second line',
      type: 'string',
      group: 'logo',
      description: 'The smaller line under it.',
    }),

    /* ================================================================= */
    /* Brand colour                                                      */
    /*                                                                   */
    /* FOUR fields rather than one, and the reason is contrast.          */
    /*                                                                   */
    /* The site has two themes. A gold that reads well as text on the    */
    /* near-black dark theme is too pale to read on the cream light one, */
    /* and a gold dark enough for cream looks muddy as a button fill.    */
    /* One colour cannot do all of it, which is why the palette already  */
    /* used different values per theme before any of this was editable.  */
    /*                                                                   */
    /* Leave them all blank and the site keeps its own gold. Every       */
    /* shade the CSS needs beyond these — the button hover, mixes and    */
    /* transparencies — is derived from them.                            */
    /* ================================================================= */

    hex(
      'accentDark',
      'Accent — dark theme',
      'Links, eyebrows, active states and the button fill while the site is dark. This is THE brand colour; the three below adjust it for the places it cannot be used as-is. Also used on the video hero and the portfolio tiles, which stay dark in both themes.'
    ),
    hex(
      'accentLight',
      'Accent — light theme',
      'The same colour, dark enough to READ as text on the cream light theme. Usually a deeper version of the one above — the bright original is unreadable on pale backgrounds.',
      (v, doc) =>
        contrastWarning(v, (doc.groundLight as string) || '#faf9f5', 4.5, 'Accent text on the light background')
    ),
    hex(
      'buttonFill',
      'Button fill — light theme',
      'Buttons in the light theme, where the accent above is too dark to work as a filled block. Can be brighter than the accent, because the text on it is dark rather than pale.',
      (v, doc) => contrastWarning((doc.buttonInk as string) || '#14161d', v, 4.5, 'Button text on the fill')
    ),
    hex(
      'buttonInk',
      'Button text',
      'The text and icon colour inside a filled button, in both themes. Nearly always a very dark or very light neutral — this is the one that decides whether a button can be read at all.',
      (v, doc) => contrastWarning(v, (doc.accentDark as string) || '#e4c24c', 4.5, 'Button text on the dark-theme fill')
    ),

    /* ---------------------------------------------------------------- */

    defineField({
      name: 'favicon',
      title: 'Browser icon',
      type: 'image',
      group: 'icon',
      options: { hotspot: false },
      description:
        'The icon in the browser tab, on the phone home screen and in bookmarks. Upload ONE square image, 512×512 or larger — every other size is generated from it. It is shown as small as 16px, so a full logo with a wordmark turns to mush: use the mark alone, and give it a little breathing room from the edges.',
    }),
    /*
     * Two chrome colours, not one.
     *
     * Android and iOS Safari tint the browser bar to match the page, and the
     * site has two palettes — so a single value gives somebody in light mode
     * a black bar above a cream page. These should match the page background
     * of each theme.
     */
    defineField({
      name: 'themeColor',
      title: 'Browser bar — dark theme',
      type: 'string',
      group: 'icon',
      description:
        'Tints the browser bar for visitors in the dark theme, and the title bar of an installed app. Match the dark page background. A hex value like #0b0c10.',
      validation: (Rule) =>
        Rule.regex(/^#[0-9a-fA-F]{6}$/, { name: 'hex' }).error('Use a hex colour, like #0b0c10.'),
    }),
    defineField({
      name: 'themeColorLight',
      title: 'Browser bar — light theme',
      type: 'string',
      group: 'icon',
      description: 'The same, for visitors in the light theme. Match the light page background.',
      validation: (Rule) =>
        Rule.regex(/^#[0-9a-fA-F]{6}$/, { name: 'hex' }).error('Use a hex colour, like #faf9f5.'),
    }),
    defineField({
      name: 'backgroundColor',
      title: 'Splash background',
      type: 'string',
      group: 'icon',
      description:
        'The colour behind the icon on the splash screen of an installed app. Usually the same as the theme colour.',
      validation: (Rule) =>
        Rule.regex(/^#[0-9a-fA-F]{6}$/, { name: 'hex' }).error('Use a hex colour, like #0b0c10.'),
    }),

    defineField({
      name: 'appName',
      title: 'Installed-app name',
      type: 'string',
      group: 'icon',
      description: 'Shown when somebody adds the site to their home screen.',
    }),
    defineField({
      name: 'appShortName',
      title: 'Installed-app short name',
      type: 'string',
      group: 'icon',
      description:
        'Used under the icon, where there is room for about twelve characters before it is cut off.',
    }),
    defineField({
      name: 'appDescription',
      title: 'Installed-app description',
      type: 'text',
      rows: 2,
      group: 'icon',
    }),
  ],

  /**
   * Both logos or neither.
   *
   * A document-level rule rather than two field-level ones, because the thing
   * being checked is the RELATIONSHIP between them — and because a message on
   * the document says what is wrong once instead of twice.
   */
  validation: (Rule) =>
    Rule.custom((doc: Record<string, unknown> | undefined) => {
      const dark = Boolean(doc?.logoDark);
      const light = Boolean(doc?.logoLight);
      if (dark === light) return true;
      return dark
        ? 'Upload a light-theme logo too, or remove the dark-theme one. With only one, the header is blank for everybody using the other theme.'
        : 'Upload a dark-theme logo too, or remove the light-theme one. With only one, the header is blank for everybody using the other theme.';
    }),

  preview: {
    select: { media: 'logoDark', subtitle: 'wordmark' },
    prepare: ({ media, subtitle }) => ({ title: 'Logo & icons', subtitle, media }),
  },
});
