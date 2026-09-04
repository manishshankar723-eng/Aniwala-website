/**
 * The first-load screen. A SINGLETON.
 *
 * The curtain that covers the page while it loads, with the studio mark
 * filling from the baseline. Everything about it that is a judgement call —
 * whether it appears at all, what it shows, how long it may last — was
 * hardcoded, which meant turning it off for a campaign, or swapping the mark
 * after a rebrand, needed a developer.
 *
 * WHAT IS NOT OFFERED HERE, deliberately:
 *
 *   The animation itself. The reveal is a height-animated block box chosen
 *   precisely because it has no edge cases across engines; exposing easing or
 *   keyframes would hand an editor the one part most likely to look broken.
 *
 *   Whether it shows on internal navigation. It does not, and that is not a
 *   preference — the site swaps pages client-side, so a loader on every page
 *   VIEW would be a toll rather than an arrival.
 *
 *   Whether it respects reduced motion. It always does. That is an
 *   accessibility guarantee, not a setting.
 */
import { defineType, defineField } from 'sanity';

export default defineType({
  name: 'loaderSettings',
  title: 'Loading screen',
  type: 'document',

  fields: [
    defineField({
      name: 'enabled',
      title: 'Show the loading screen',
      type: 'boolean',
      description:
        'Turn it off and the site paints straight away. Worth trying — a loader is a moment of brand on arrival, and it is also a second somebody waits.',
      initialValue: true,
    }),

    defineField({
      name: 'image',
      title: 'Mark',
      type: 'image',
      description:
        'The logo that fills in. Leave empty to use the built-in Aniwala mark. A square, transparent PNG or SVG works best — it is shown at about 128px, so it does not need to be large.',
      hidden: ({ document }) => !document?.enabled,
    }),
    defineField({
      name: 'alt',
      title: 'Description',
      type: 'string',
      description:
        'Only used if the mark ever becomes visible to a screen reader. The loader is decorative and hidden from assistive tech, so this is rarely read — but leaving it blank is worse than filling it in.',
      hidden: ({ document }) => !document?.enabled || !document?.image,
    }),

    defineField({
      name: 'maxDuration',
      title: 'Longest it may stay',
      type: 'number',
      description:
        'Milliseconds. The curtain lifts as soon as the page is ready; this is the ceiling for when something on the network hangs. A loader that can strand somebody behind a blank screen is worse than no loader, so this cannot be turned off — 1500–2500 is sensible.',
      initialValue: 2200,
      validation: (Rule) =>
        Rule.required()
          .min(500)
          .max(5000)
          .warning('Over about 3 seconds and people assume the site is broken.'),
      hidden: ({ document }) => !document?.enabled,
    }),
  ],

  preview: {
    select: { enabled: 'enabled', media: 'image' },
    prepare: ({ enabled, media }) => ({
      title: 'Loading screen',
      subtitle: enabled ? 'On' : 'Off',
      media,
    }),
  },
});
