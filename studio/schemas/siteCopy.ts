/**
 * Standalone lines of copy. A SINGLETON.
 *
 * These are the sentences that sit on their own — the positioning statement
 * on the about page, the line above the team grid, the scrolling marquee, the
 * tools list. Each was a lone `export const` in a config file, and rewording
 * one meant a code change, a review and a deploy for a sentence.
 *
 * WHAT IS NOT HERE, on purpose: the principles, the practices, the studio
 * values and the hiring steps. Those are fixed-count blocks that drive
 * layout, and they describe who the studio is rather than what is new. They
 * stay in code where they get a diff. The line between the two is roughly:
 * would you change this because something happened this month?
 */
import { defineType, defineField, defineArrayMember } from 'sanity';
import { CATEGORIES } from '../../src/config/categories';

export default defineType({
  name: 'siteCopy',
  title: 'Site copy',
  type: 'document',

  fields: [
    defineField({
      name: 'positioning',
      title: 'Positioning statement',
      type: 'text',
      rows: 4,
      description:
        'The paragraph near the top of the about page. What the studio does and why that arrangement is worth something — the pitch, in prose.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'teamIntro',
      title: 'Team intro',
      type: 'text',
      rows: 3,
      description: 'One line above the team grid on the about page.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'marqueeItems',
      title: 'Marquee',
      type: 'array',
      of: [{ type: 'string' }],
      description:
        'The scrolling strip of disciplines. Short noun phrases — "Character Design", "Environment Art". Ten to twenty reads best; too few and the loop is obvious.',
      options: { layout: 'tags' },
    }),
    defineField({
      name: 'capabilities',
      title: 'Tools',
      type: 'array',
      of: [{ type: 'string' }],
      description:
        'Software the studio actually works in. A client scans this for the one package they care about, so do not pad it with things nobody here opens.',
      options: { layout: 'tags' },
    }),

    defineField({
      name: 'processSteps',
      title: 'Process steps',
      type: 'array',
      description:
        'The numbered "how we work" sequence, shown on the homepage AND the services page. One list, so the two can never describe different processes. It is a real sequence, so the order is the order.',
      validation: (Rule) => Rule.min(1),
      of: [
        defineArrayMember({
          type: 'object',
          name: 'step',
          fields: [
            defineField({ name: 'title', title: 'Title', type: 'string', validation: (R) => R.required() }),
            defineField({ name: 'body', title: 'Body', type: 'text', rows: 3, validation: (R) => R.required() }),
          ],
          preview: { select: { title: 'title', subtitle: 'body' } },
        }),
      ],
    }),

    defineField({
      name: 'categoryBlurbs',
      title: 'Blog category descriptions',
      type: 'array',
      description:
        'One line per blog category, shown at the top of its archive page and used as the search-result description for it. The categories themselves are set in code, because they drive the URLs and validate every post.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'categoryBlurb',
          fields: [
            defineField({
              name: 'category',
              title: 'Category',
              type: 'string',
              options: { list: [...CATEGORIES] },
              validation: (R) => R.required(),
            }),
            defineField({ name: 'blurb', title: 'Description', type: 'text', rows: 2, validation: (R) => R.required() }),
          ],
          preview: { select: { title: 'category', subtitle: 'blurb' } },
        }),
      ],
    }),
  ],

  preview: {
    prepare: () => ({ title: 'Site copy' }),
  },
});
