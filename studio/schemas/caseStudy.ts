/**
 * A case study — one project.
 *
 * `kind` is the field to be careful with. A new studio's own pieces belong in
 * the portfolio, but a visitor must never mistake one for commissioned work,
 * so every card and page renders this as a badge. Set 'Client project' only
 * when there was a client, and only when they have agreed to be named.
 *
 * Mirrors the Zod schema in the website's `src/content.config.ts`.
 */
import { defineType, defineField } from 'sanity';


export default defineType({
  name: 'caseStudy',
  title: 'Case study',
  type: 'document',

  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'slug',
      title: 'URL',
      type: 'slug',
      description: 'aniwala.com/case-studies/THIS-BIT/. Click Generate.',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
      description:
        'One line. Shown on the card and used as the meta description in search results. Google cuts it off after about 160 characters.',
      validation: (Rule) =>
        Rule.required()
          .max(160)
          .warning('Over 160 characters gets truncated in Google. Tighten it if you can.'),
    }),

    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
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
      description:
        'Who it was for. Use the studio’s own name on a self-directed piece. Only name a real client who has agreed to be named.',
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'sector',
      title: 'Sector',
      type: 'string',
      description: 'Their industry, or the format — "Mobile game", "Broadcast", "Short film".',
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'year',
      title: 'Year',
      type: 'number',
      validation: (Rule) => Rule.required().integer().min(2000).max(2100),
    }),

    defineField({
      name: 'services',
      title: 'Services',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Drives the cross-links back to the service pages.',
      options: {
        /* Was a hardcoded list built from config/services.ts. Services are
           documents now, so the list would go stale the moment one was added.
           Left free-text rather than switched to a reference because the
           field stores slugs and existing studies already hold them; the
           site drops a slug that matches no service rather than rendering a
           dead cross-link. */
      },
    }),

    defineField({
      name: 'deliverables',
      title: 'Deliverables',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Plain English — what was actually handed over.',
    }),

    defineField({
      name: 'tools',
      title: 'Tools',
      type: 'array',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
    }),

    defineField({
      name: 'results',
      title: 'Results',
      type: 'array',
      description:
        'Two or three FACTUAL outcomes — shot counts, asset counts, runtimes. Things that can be pointed at. Not invented percentages: "40% faster" with nothing behind it is the kind of claim a producer will ask you to substantiate in a meeting.',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'label', type: 'string', title: 'Label' },
            { name: 'value', type: 'string', title: 'Value' },
          ],
          preview: {
            select: { title: 'value', subtitle: 'label' },
          },
        },
      ],
    }),

    defineField({
      name: 'cover',
      title: 'Cover image',
      type: 'image',
      options: { hotspot: true },
      description: 'Landscape, at least 1200px wide. Leave empty to use the colour placeholder.',
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Alt text',
          validation: (Rule) => Rule.required().warning('Every image needs alt text.'),
        },
      ],
    }),

    defineField({
      name: 'tint',
      title: 'Placeholder colour',
      type: 'string',
      initialValue: '210 70% 22%',
    }),

    defineField({
      name: 'featured',
      title: 'Featured',
      type: 'boolean',
      description: 'Pins this study to the top of every listing.',
      initialValue: false,
    }),

    defineField({
      name: 'body',
      title: 'Body',
      type: 'blockContent',
      validation: (Rule) => Rule.required(),
    }),
  ],

  preview: {
    select: { title: 'title', client: 'client', year: 'year', media: 'cover' },
    prepare: ({ title, client, year, media }) => ({
      title,
      subtitle: [client, year].filter(Boolean).join(' · '),
      media,
    }),
  },
});
