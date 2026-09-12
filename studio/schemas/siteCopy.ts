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
            /* Optional, one per step. A step with nothing uploaded renders as
               text and the ones beside it keep their pictures, so this can be
               filled in over time rather than all at once. */
            defineField({
              name: 'image',
              title: 'Image',
              type: 'image',
              options: { hotspot: true },
              description:
                'Shown above the step. Landscape reads best — it is drawn wide and short.',
              fields: [
                defineField({
                  name: 'alt',
                  title: 'Alt text',
                  type: 'string',
                  description:
                    'What the picture shows, for screen readers and for when it fails to load.',
                  validation: (R) => R.required().error('Every image needs alt text.'),
                }),
              ],
            }),
          ],
          preview: { select: { title: 'title', subtitle: 'body', media: 'image' } },
        }),
      ],
    }),

    /*
     * `categoryBlurbs` was here: one line per blog category, keyed by the
     * category's name. It has moved onto the `postCategory` documents.
     *
     * It was a parallel list — a second place a category had to be added,
     * keyed by a string that had to match another list exactly. A category
     * and its description are one thing, and they now live on one document.
     */
  ],

  preview: {
    prepare: () => ({ title: 'Site copy' }),
  },
});
