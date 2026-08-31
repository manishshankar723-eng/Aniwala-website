/**
 * A question and its answer.
 *
 * One type covers the service FAQs and the careers FAQs, separated by
 * `scope`. They were two different shapes in two different config files and
 * are the same thing: a question people actually ask, and the answer.
 *
 * FAQs are the most-edited copy on a site like this — every few weeks
 * somebody asks something new, and the answer should go up the same day.
 */
import { defineType, defineField } from 'sanity';
import { services } from '../../src/config/services';

const SCOPES = [
  { title: 'Careers page', value: 'careers' },
  ...services.map((s) => ({ title: 'Service — ' + s.label, value: 'service:' + s.slug })),
];

export default defineType({
  name: 'faq',
  title: 'FAQ',
  type: 'document',

  fields: [
    defineField({
      name: 'scope',
      title: 'Where it appears',
      type: 'string',
      description: 'Which page this question shows on.',
      options: { list: SCOPES },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'question',
      title: 'Question',
      type: 'string',
      description:
        'Phrase it the way somebody actually asks it, not the way you would title it. "How much does a shot cost?" beats "Pricing".',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'answer',
      title: 'Answer',
      type: 'text',
      rows: 5,
      description:
        'Answer it straight, including when the answer is no. An FAQ that dodges is worse than no FAQ — people read these looking for the catch.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'order',
      title: 'Position',
      type: 'number',
      description: 'Lower first. Put the question people ask most at the top.',
      initialValue: 50,
    }),
  ],

  orderings: [
    {
      title: 'Scope, then order',
      name: 'scopeOrder',
      by: [
        { field: 'scope', direction: 'asc' },
        { field: 'order', direction: 'asc' },
      ],
    },
  ],

  preview: {
    select: { title: 'question', scope: 'scope', order: 'order' },
    prepare: ({ title, scope, order }) => {
      const label = SCOPES.find((s) => s.value === scope)?.title ?? scope;
      return { title, subtitle: label + ' · ' + order };
    },
  },
});
