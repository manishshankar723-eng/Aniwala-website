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
import { FONT_CHOICES, TYPE_ROLES } from '../../src/config/fonts';

/**
 * A typeface picker.
 *
 * A dropdown rather than a text box because the fonts are self-hosted files
 * — see `src/config/fonts.ts`. A typed-in family nothing has loaded would
 * fall silently through to the next name in the stack, so the setting would
 * appear to save and then do nothing.
 */
const face = (name: string, title: string, description: string) =>
  defineField({
    name,
    title,
    type: 'string',
    group: 'type',
    description,
    options: { list: FONT_CHOICES.map((f) => ({ title: f.title, value: f.name })) },
  });

/**
 * The three knobs each type role gets.
 *
 * MULTIPLIERS AND OFFSETS, never absolute values. Every one of the 305 type
 * declarations on this site is now written as `calc(<the designed value> *
 * var(--type-<role>-scale, 1))`, so at 100 / 0 / 0 the page computes exactly
 * what it did before this document existed. That is what makes these safe to
 * expose: the worst an editor can do is scale a relationship, not destroy it.
 *
 * Leaving a field blank is the same as its default. Nothing here is required.
 */
const roleFields = (role: { name: string; title: string; description: string }) => {
  const cap = role.name[0].toUpperCase() + role.name.slice(1);
  return [
    defineField({
      name: `type${cap}Scale`,
      title: `${role.title} — size`,
      type: 'number',
      group: 'type',
      description: `${role.description} 100 is the size the site was designed at; 110 is ten per cent larger.`,
      initialValue: 100,
      validation: (Rule) =>
        Rule.min(50)
          .max(200)
          .warning('Below 70 or above 150 the layout around this text starts to break down.'),
    }),
    defineField({
      name: `type${cap}Weight`,
      title: `${role.title} — weight`,
      type: 'number',
      group: 'type',
      description:
        'Added to the designed weight. 0 leaves it alone; 100 is roughly one step bolder, -100 one step lighter. The fonts carry a real weight axis, so this is smooth rather than snapping.',
      initialValue: 0,
      validation: (Rule) => Rule.min(-300).max(300),
    }),
    defineField({
      name: `type${cap}Track`,
      title: `${role.title} — letter spacing`,
      type: 'number',
      group: 'type',
      description:
        'Added to the designed spacing, in em. 0 leaves it alone. 0.02 opens it up slightly; -0.01 tightens it. Small numbers — 0.1 is already extreme.',
      initialValue: 0,
      validation: (Rule) => Rule.min(-0.1).max(0.5),
    }),
  ];
};

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

/** The same, filed under the page-palette tab. */
const phex = (
  name: string,
  title: string,
  description: string,
  validate?: (value: string | undefined, doc: Record<string, unknown>) => true | string
) => ({ ...hex(name, title, description, validate), group: 'palette' });

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
    { name: 'palette', title: 'Page palette' },
    { name: 'type', title: 'Typography' },
    { name: 'layout', title: 'Layout' },
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
      name: 'logoScale',
      title: 'Logo size',
      type: 'number',
      group: 'logo',
      description:
        'A percentage of the size the mark is drawn at now. 100 leaves it exactly as it is; 150 makes it half again as tall. THE HEADER GROWS WITH IT — the bar gets taller and the menu moves down to stay centred, rather than the logo overflowing a fixed strip.',
      initialValue: 100,
      validation: (Rule) =>
        Rule.min(50)
          .max(300)
          .warning('Past about 200 the header eats a large part of a phone screen before anything is read.'),
    }),

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


    /* ================================================================= */
    /* The page palette                                                  */
    /*                                                                   */
    /* Eight colours, twice — once per theme. These are the ones the     */
    /* accent sits ON, and until now they were the only part of the      */
    /* palette that was not editable: you could change the gold and not  */
    /* the near-black behind it.                                         */
    /*                                                                   */
    /* PAIRS, NOT SINGLES. Nothing here is safe to judge on its own. A   */
    /* background is only right relative to the text on it, which is why */
    /* the ink fields warn on contrast against the ground rather than    */
    /* against a fixed guess. Leave a whole theme blank and it keeps the */
    /* palette the site shipped with.                                    */
    /* ================================================================= */

    phex('groundDark', 'Page background — dark', 'The colour behind everything while the site is dark.'),
    phex(
      'surfaceDark',
      'Card background — dark',
      'Cards, panels and the header once it is scrolled. Should sit only slightly above the page background — if you can see a hard edge, it is too far.'
    ),
    phex('surface2Dark', 'Raised card — dark', 'One step above the card background, for a panel inside a panel.'),
    phex('lineDark', 'Borders — dark', 'Dividers and card edges. Nearly always a near-invisible step from the surface it sits on.'),
    phex('lineStrongDark', 'Strong borders — dark', 'The heavier rule, for a border that is meant to be noticed.'),
    phex(
      'inkDark',
      'Text — dark',
      'The main text colour on the dark theme.',
      (v, doc) => contrastWarning(v, (doc.groundDark as string) || '#0b0c10', 4.5, 'Body text on the dark background')
    ),
    phex(
      'inkMutedDark',
      'Secondary text — dark',
      'Intros, captions and meta rows. Still has to be readable — this is the one people set too faint.',
      (v, doc) => contrastWarning(v, (doc.groundDark as string) || '#0b0c10', 4.5, 'Secondary text on the dark background')
    ),
    phex(
      'inkFaintDark',
      'Faint text — dark',
      'Timestamps and disabled states. Held to 3:1 rather than 4.5:1 because it is never the only way anything is communicated.',
      (v, doc) => contrastWarning(v, (doc.groundDark as string) || '#0b0c10', 3, 'Faint text on the dark background')
    ),

    phex('groundLight', 'Page background — light', 'The colour behind everything while the site is light.'),
    phex('surfaceLight', 'Card background — light', 'Cards and panels on the light theme.'),
    phex('surface2Light', 'Raised card — light', 'One step above the card background.'),
    phex('lineLight', 'Borders — light', 'Dividers and card edges on the light theme.'),
    phex('lineStrongLight', 'Strong borders — light', 'The heavier rule.'),
    phex(
      'inkLight',
      'Text — light',
      'The main text colour on the light theme.',
      (v, doc) => contrastWarning(v, (doc.groundLight as string) || '#faf9f5', 4.5, 'Body text on the light background')
    ),
    phex(
      'inkMutedLight',
      'Secondary text — light',
      'Intros, captions and meta rows on the light theme.',
      (v, doc) => contrastWarning(v, (doc.groundLight as string) || '#faf9f5', 4.5, 'Secondary text on the light background')
    ),
    phex(
      'inkFaintLight',
      'Faint text — light',
      'Timestamps and disabled states on the light theme.',
      (v, doc) => contrastWarning(v, (doc.groundLight as string) || '#faf9f5', 3, 'Faint text on the light background')
    ),

    /* The error colour. One field rather than two: it is a warning, and a
       warning that changed hue between themes would read as two different
       states. The two defaults it replaces already differ per theme only in
       lightness, which the contrast checks below keep honest. */
    phex(
      'dangerDark',
      'Error colour — dark',
      'Invalid form fields and error messages while the site is dark.',
      (v, doc) => contrastWarning(v, (doc.groundDark as string) || '#0b0c10', 4.5, 'Error text on the dark background')
    ),
    phex(
      'dangerLight',
      'Error colour — light',
      'The same, dark enough to read on the light theme. An error nobody can read is worse than no error at all.',
      (v, doc) => contrastWarning(v, (doc.groundLight as string) || '#faf9f5', 4.5, 'Error text on the light background')
    ),

    /* ================================================================= */
    /* Typography                                                        */
    /*                                                                   */
    /* FOUR FACES, because the site uses four and always has. They were  */
    /* already CSS variables — 184 of the 190 font-family declarations   */
    /* pointed at one of these tokens — so this exposes a system that    */
    /* existed rather than inventing one.                                */
    /*                                                                   */
    /* Leave them blank and the site keeps the faces it shipped with.    */
    /* ================================================================= */

    face(
      'fontDisplay',
      'Heading font',
      'Page titles, section headings and card titles. The face with the most personality on the site — it is what people read first.'
    ),
    face(
      'fontBody',
      'Body font',
      'Paragraphs and form fields. Choose for legibility at small sizes rather than character; this is the one people read for minutes at a time.'
    ),
    face(
      'fontLabel',
      'Label font',
      'Eyebrows, chips, badges, buttons and meta rows. Used more than any other face on the site — over half of all text set here — so a change is felt on every page.'
    ),
    face('fontMono', 'Code font', 'Inline code and code blocks in posts and case studies.'),

    defineField({
      name: 'textScale',
      title: 'Overall text size',
      type: 'number',
      group: 'type',
      description:
        'Scales EVERY size below at once, as a percentage. 100 is the size the site was designed at. Use this first — it keeps every relationship intact. The per-role sizes underneath then adjust one group relative to the rest.',
      initialValue: 100,
      validation: (Rule) =>
        Rule.min(50)
          .max(200)
          .warning('Below 80 or above 130 the layout starts to fight the text.'),
    }),

    ...TYPE_ROLES.flatMap(roleFields),

    /* ================================================================= */
    /* Layout                                                            */
    /*                                                                   */
    /* Three numbers rather than the dozen the stylesheet actually uses. */
    /* Corner rounding is one scale over three radii, and the page margin */
    /* is one scale over a clamp, for the same reason the type controls   */
    /* are multipliers: the relationships between them were designed, and */
    /* setting each end independently is how you get a floor above a      */
    /* ceiling.                                                          */
    /* ================================================================= */

    defineField({
      name: 'contentWidth',
      title: 'Maximum content width',
      type: 'number',
      group: 'layout',
      description:
        'How wide the site is allowed to grow on a large monitor, in pixels. 2240 is the design. Below about 1200 the wider grids start to feel cramped; above 2600 lines of text get too long to track comfortably.',
      validation: (Rule) => Rule.min(900).max(4000).warning('Outside 1200–2600 the grids stop behaving.'),
    }),
    defineField({
      name: 'radiusScale',
      title: 'Corner rounding',
      type: 'number',
      group: 'layout',
      description:
        'Scales every rounded corner at once, as a percentage. 100 is the design, 0 makes the whole site square-cornered, 200 doubles it.',
      validation: (Rule) => Rule.min(0).max(300),
    }),
    defineField({
      name: 'gutterScale',
      title: 'Page margin',
      type: 'number',
      group: 'layout',
      description:
        'Scales the space between the page content and the edge of the window, as a percentage. 100 is the design. Lower means more content per line; higher gives it more room to breathe.',
      validation: (Rule) => Rule.min(25).max(250).warning('Below 50 the text touches the edge on a phone.'),
    }),


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
