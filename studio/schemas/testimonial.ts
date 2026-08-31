/**
 * A client testimonial.
 *
 * The array this replaces was deliberately empty, with the note "add real
 * ones as they arrive". That is exactly the shape of thing that should not
 * need a developer: a quote turns up in an email, and someone should be able
 * to put it on the site that afternoon.
 *
 * The section hides itself when there are none, so this stays invisible until
 * a real quote exists. Do not seed it with an invented one.
 */
import { defineType, defineField } from 'sanity';

export default defineType({
  name: 'testimonial',
  title: 'Testimonial',
  type: 'document',

  fields: [
    defineField({
      name: 'quote',
      title: 'Quote',
      type: 'text',
      rows: 4,
      description:
        'Their words, not a tidied version of them. Two or three sentences reads best; a paragraph gets skimmed.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'Only name someone who has agreed to be named.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'role',
      title: 'Their role',
      type: 'string',
      description: 'What they do — "Producer", "Art Director". It is what makes the quote credible.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'company',
      title: 'Company',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'order',
      title: 'Position',
      type: 'number',
      description: 'Lower first. Leave gaps (10, 20, 30) so one can be slotted in later.',
      initialValue: 50,
    }),
  ],

  preview: {
    select: { title: 'name', company: 'company', quote: 'quote' },
    prepare: ({ title, company, quote }) => ({
      title: [title, company].filter(Boolean).join(' · '),
      subtitle: quote,
    }),
  },
});
