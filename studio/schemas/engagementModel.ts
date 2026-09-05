/**
 * How a client can hire the studio. One document per model.
 *
 * WHY A DOCUMENT TYPE AND NOT FIELDS ON THE BLOCK
 *
 * These three — fixed-scope, team extension, co-development — describe how
 * the business is actually structured, and the same three have to mean the
 * same thing on every page that mentions them. Fields on the block would let
 * the services page and a landing page each carry their own edited copy of
 * "team extension", which is how a client ends up quoting one page's terms
 * back at you while you are reading the other.
 *
 * So: one list, like testimonials and milestones, and every Engagement block
 * on the site draws the same three.
 *
 * THE HONESTY RULE, which no schema can enforce: each of these is a
 * commercial promise about how the studio takes work on. Do not add a fourth
 * because it sounds good in a pitch — add it when the studio will actually
 * work that way.
 */
import { defineType, defineField } from 'sanity';

export default defineType({
  name: 'engagementModel',
  title: 'Engagement model',
  type: 'document',

  fields: [
    defineField({
      name: 'title',
      title: 'Name',
      type: 'string',
      description: 'What a producer would call it — "Fixed-scope project".',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'body',
      title: 'How it works',
      type: 'text',
      rows: 4,
      description:
        'What the client gets and what the studio takes on. The sentence worth keeping is the one about what happens when things go wrong — that is the part nobody else writes down.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'bestFor',
      title: 'Best for',
      type: 'string',
      description:
        'One line naming the situation this suits. It is what lets a reader rule the other two out quickly, so be specific rather than flattering.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'order',
      title: 'Order',
      type: 'number',
      description:
        'Lower first. Gaps are intentional, so one can be slotted between two later without renumbering both.',
      initialValue: 50,
      validation: (Rule) => Rule.required().integer(),
    }),
  ],

  orderings: [
    {
      name: 'order',
      title: 'Display order',
      by: [{ field: 'order', direction: 'asc' }],
    },
  ],

  preview: {
    select: { title: 'title', subtitle: 'bestFor' },
  },
});
