/**
 * One image, filed against a named slot on the site.
 *
 * This is the "Images" list: every replaceable picture on the site in one
 * place, rather than an image field buried inside six unrelated document
 * types. The slots themselves are defined in the website's
 * `src/config/imageSlots.ts` and imported here so the dropdown and the site
 * can never disagree about what exists.
 *
 * WHY THE STRUCTURE ISN'T HERE TOO
 * The portfolio categories and the services stay in code. A new service is a
 * decision about what the studio sells and deserves a diff and a review; the
 * photograph on its page is not. Only the artwork moves.
 *
 * A slot with nothing uploaded falls back to the colour placeholder the site
 * already uses, so this is additive — nothing breaks by being left empty.
 */
import { defineType, defineField } from 'sanity';
import { IMAGE_SLOTS } from '../../src/config/imageSlots';

export default defineType({
  name: 'artwork',
  title: 'Image',
  type: 'document',

  fields: [
    defineField({
      name: 'slot',
      title: 'Where it goes',
      type: 'string',
      description:
        'Which picture on the site this replaces. One image per slot — uploading a second against the same slot means only one of them shows.',
      options: {
        list: IMAGE_SLOTS.map((s) => ({ title: s.title, value: s.name })),
      },
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: { hotspot: true },
      description:
        'Landscape, at least 1600px wide for tiles and hero stills. Use the crop tool to mark what must stay in frame — these are cropped hard on narrow screens.',
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'alt',
      title: 'Alt text',
      type: 'string',
      description:
        'What the image shows, for screen readers and for when it fails to load. Describe the content, not the file — "a stylised forest environment, dusk lighting" beats "portfolio image 3".',
      validation: (Rule) => Rule.required().warning('Every image needs alt text.'),
    }),
  ],

  orderings: [{ title: 'Slot', name: 'slot', by: [{ field: 'slot', direction: 'asc' }] }],

  preview: {
    select: { slot: 'slot', media: 'image', alt: 'alt' },
    prepare: ({ slot, media, alt }) => ({
      title: IMAGE_SLOTS.find((s) => s.name === slot)?.title ?? slot ?? 'Unassigned',
      subtitle: alt,
      media,
    }),
  },
});
