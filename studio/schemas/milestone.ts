/**
 * A point on the studio timeline.
 *
 * Another empty array in the old config. A timeline only ever grows, and it
 * grows on the day the thing happens — which is precisely when nobody wants
 * to open a code editor.
 */
import { defineType, defineField } from 'sanity';

export default defineType({
  name: 'milestone',
  title: 'Milestone',
  type: 'document',

  fields: [
    defineField({
      name: 'when',
      title: 'When',
      type: 'string',
      description: 'A string, not a date, so a quarter fits: "2026" or "2026 Q1".',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'text',
      rows: 3,
      description: 'A sentence or two. What actually happened, not what it meant.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'order',
      title: 'Position',
      type: 'number',
      description: 'Lower first. The timeline reads top to bottom in this order.',
      initialValue: 50,
    }),
  ],

  preview: {
    select: { title: 'title', when: 'when' },
    prepare: ({ title, when }) => ({ title, subtitle: when }),
  },
});
