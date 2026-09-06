/**
 * One image that belongs to a PAGE rather than to a document.
 *
 * The slots are defined in the website's `src/config/imageSlots.ts` and
 * imported here, so the dropdown and the site can never disagree about what
 * exists. There is one left: the still behind the homepage's video hero,
 * which is chosen on the hero block and has no document of its own to sit on.
 *
 * THIS USED TO HOLD THIRTEEN, and the other twelve — a slot per portfolio
 * discipline and a slot per service — have moved onto the documents they
 * depict. The header on this file used to argue that "the portfolio
 * categories and the services stay in code", which was true when it was
 * written and stopped being true the day both became documents an editor can
 * create. From that day a seventh service had no slot to file a picture
 * against, and getting it one meant a code change plus a Studio redeploy.
 * `src/config/imageSlots.ts` carries the full argument.
 *
 * The Studio's "Images" list is unaffected: it already gathered the images
 * that live on `post`, `caseStudy`, `piece`, `teamMember` and `client` by
 * listing those types, and now lists `service` and `workCategory` the same
 * way. One place to see every picture, without pretending every picture is
 * its own document.
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
