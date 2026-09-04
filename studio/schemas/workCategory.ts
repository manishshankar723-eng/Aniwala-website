/**
 * A portfolio discipline. `/portfolio/{slug}/` is built from each.
 *
 * These are how an art director shops: they arrive wanting a character
 * designer or an FX artist, not "3D art". That is why they are their own
 * taxonomy rather than a view of the services — a craft and a service are
 * genuinely different things, and character design draws on three services.
 *
 * THE SLUG IS THE URL and the key the artwork slots and the pieces are filed
 * against. Renaming one breaks that page's links, orphans its image, and
 * detaches every piece filed under it. It is the one field here worth being
 * frightened of.
 */
import { defineType, defineField, defineArrayMember } from 'sanity';
import { seoFields } from './seoFields';

export default defineType({
  name: 'workCategory',
  title: 'Portfolio discipline',
  type: 'document',

  groups: [
    { name: 'main', title: 'Content', default: true },
    { name: 'seo', title: 'Search' },
  ],

  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      group: 'main',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'URL',
      type: 'slug',
      group: 'main',
      description: 'Becomes /portfolio/<this>/. Pieces and images are filed against it.',
      options: { source: 'title', maxLength: 60 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'shortName',
      title: 'Name mid-sentence',
      type: 'string',
      group: 'main',
      description:
        'How it reads inside a sentence — "Have VFX on your brief?". Typed out rather than lower-cased from the title, because lower-casing turns VFX into "vfx".',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'blurb',
      title: 'Blurb',
      type: 'string',
      group: 'main',
      description: 'One line on the homepage tile. What the discipline covers, not how good it is.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'intro',
      title: 'Intro',
      type: 'text',
      rows: 4,
      group: 'main',
      description: 'One or two sentences at the top of the discipline page.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'tint',
      title: 'Tint',
      type: 'string',
      group: 'main',
      description: 'HSL triple behind the tile until real art exists, e.g. "210 70% 22%".',
      validation: (Rule) =>
        Rule.required().custom((v) =>
          /^\d{1,3} \d{1,3}% \d{1,3}%$/.test(String(v)) ? true : 'Three parts, like "210 70% 22%".'
        ),
    }),
    defineField({
      name: 'services',
      title: 'Hired as',
      type: 'array',
      group: 'main',
      description:
        'The services somebody actually commissions to get this work. Stated rather than derived, because a craft and a service are not the same thing.',
      of: [defineArrayMember({ type: 'reference', to: [{ type: 'service' }] })],
      validation: (Rule) => Rule.unique(),
    }),
    defineField({
      name: 'wide',
      title: 'Wide tile',
      type: 'boolean',
      group: 'main',
      description: 'Spans two columns on the homepage grid. Use sparingly — one in three at most.',
      initialValue: false,
    }),
    defineField({
      name: 'order',
      title: 'Position',
      type: 'number',
      group: 'main',
      initialValue: 50,
    }),

    ...seoFields,
  ],

  orderings: [{ title: 'Position', name: 'order', by: [{ field: 'order', direction: 'asc' }] }],

  preview: {
    select: { title: 'title', slug: 'slug.current', order: 'order' },
    prepare: ({ title, slug, order }) => ({ title, subtitle: `/portfolio/${slug}/  ·  ${order}` }),
  },
});
