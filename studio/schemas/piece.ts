/**
 * A portfolio piece.
 *
 * The nine of these lived in `config/portfolio.ts` with a `tint` placeholder
 * and a comment reading "swap for a real import once art exists". This is
 * that swap: the art now comes from the CMS, and so does everything else
 * about a piece, because a portfolio entry is content by any definition — it
 * is added the week the work clears.
 *
 * WHAT DID NOT MOVE: the CATEGORIES. Those drive the /portfolio/ URLs and the
 * filter chips, so they stay in code and this picks from them.
 */
import { defineType, defineField } from 'sanity';
import { workCategories } from '../../src/config/portfolio';

export default defineType({
  name: 'piece',
  title: 'Portfolio piece',
  type: 'document',

  groups: [
    { name: 'main', title: 'The piece', default: true },
    { name: 'meta', title: 'Credits & display' },
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
      title: 'Identifier',
      type: 'slug',
      group: 'main',
      description:
        'Used in the lightbox link, so it appears in the address bar when a piece is opened. Click Generate.',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      group: 'main',
      description: 'Which discipline it is filed under on /portfolio/.',
      options: { list: workCategories.map((c) => ({ title: c.title, value: c.slug })) },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'blurb',
      title: 'Blurb',
      type: 'string',
      group: 'main',
      description:
        'One line: what the piece actually is, not how good it looks. "Rigged hero character, 42k tris" tells a producer more than "stunning character work".',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      group: 'main',
      options: { hotspot: true },
      description:
        'The artwork. Leave empty and the tile falls back to its colour placeholder, which is fine for a piece not yet shot.',
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Alt text',
          description: 'What the image shows, for screen readers.',
          validation: (Rule) => Rule.required().warning('Every image needs alt text.'),
        },
      ],
    }),

    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      group: 'meta',
      description:
        'Be accurate. "Client project" on a self-directed piece is a claim about your track record that a prospective client may check.',
      options: {
        list: [
          { title: 'Client project', value: 'Client project' },
          { title: 'Studio project', value: 'Studio project' },
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'client',
      title: 'Client',
      type: 'string',
      group: 'meta',
      description:
        'Use the studio own name on a self-directed piece. Only name a real client who has agreed to be named.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'year',
      title: 'Year',
      type: 'number',
      group: 'meta',
      validation: (Rule) => Rule.required().integer().min(2000).max(2100),
    }),
    defineField({
      name: 'tools',
      title: 'Tools',
      type: 'array',
      of: [{ type: 'string' }],
      group: 'meta',
      description: 'A few, not the whole pipeline. Shown as small print on the card.',
      options: { layout: 'tags' },
    }),
    defineField({
      name: 'caseStudy',
      title: 'Linked case study',
      type: 'string',
      group: 'meta',
      description:
        'The URL of a case study, if one has been written — the part after /case-studies/. Leave blank and the tile is deliberately not clickable: a dead end is worse than a tile that plainly does not link anywhere.',
    }),
    defineField({
      name: 'tint',
      title: 'Placeholder colour',
      type: 'string',
      group: 'meta',
      description: 'Shown when there is no image. An HSL triple like "210 70% 22%".',
      initialValue: '210 70% 22%',
    }),
    defineField({
      name: 'wide',
      title: 'Wide tile',
      type: 'boolean',
      group: 'meta',
      description:
        'Spans two columns. Use sparingly — about one in four, or the grid stops reading as a grid.',
      initialValue: false,
    }),
    defineField({
      name: 'order',
      title: 'Position',
      type: 'number',
      group: 'meta',
      description: 'Lower first. Leave gaps (10, 20, 30) so one can be slotted in later.',
      initialValue: 50,
    }),
  ],

  orderings: [
    { title: 'Grid order', name: 'gridOrder', by: [{ field: 'order', direction: 'asc' }] },
  ],

  preview: {
    select: { title: 'title', client: 'client', year: 'year', media: 'image', order: 'order' },
    prepare: ({ title, client, year, media, order }) => ({
      title: order != null ? order + '. ' + title : title,
      subtitle: [client, year].filter(Boolean).join(' · '),
      media,
    }),
  },
});
