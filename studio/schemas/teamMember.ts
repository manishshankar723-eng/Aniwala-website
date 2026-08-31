/**
 * A team member.
 *
 * Mirrors the Zod schema in the website's `src/content.config.ts`.
 *
 * WHY `order` EXISTS
 * These used to be a hand-written array, so the grid order was whatever the
 * file said. CMS documents have no inherent order, and sorting by name would
 * put the production manager above the creative director on the page a client
 * reads to decide who they would be working with. So the order is a field the
 * editor sets, and the grid follows it.
 *
 * WHY THERE IS NO ALT TEXT FIELD
 * Unlike a blog cover, a member photo's alt text is fully derivable — the page
 * renders `"{name}, {role}"`, which is exactly what a screen reader should
 * say. Asking an editor to type it again would only create a second version
 * to keep in step, and the derived one is better than most people would write.
 */
import { defineType, defineField } from 'sanity';

export default defineType({
  name: 'teamMember',
  title: 'Team member',
  type: 'document',

  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'slug',
      title: 'Identifier',
      type: 'slug',
      description:
        'Generated from the name. Team members have no page of their own, so this is only an internal id — but it has to be unique. Click Generate.',
      options: { source: 'name', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'role',
      title: 'Role',
      type: 'string',
      description:
        'Their discipline and what they own. Two clauses split by a pipe reads well here — "Creative Director | External Game Art".',
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'bio',
      title: 'Bio',
      type: 'text',
      rows: 4,
      description:
        'Two or three sentences: what they actually do here, not adjectives. Concrete beats enthusiastic — "12 years across mobile and console" places someone for a producer; "passionate about quality" does not.',
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'photo',
      title: 'Photo',
      type: 'image',
      options: { hotspot: true },
      description:
        'Landscape, at least 480px wide. Use the crop tool to keep the face in frame. Leave empty and the card shows their initials instead — deliberately, because a stock avatar is a lie about a person.',
    }),

    defineField({
      name: 'href',
      title: 'Link to their work (optional)',
      type: 'url',
      description:
        'ArtStation, LinkedIn, a reel — wherever their work actually lives. Leave blank and no button is rendered; a button that goes nowhere is worse than no button.',
      validation: (Rule) => Rule.uri({ scheme: ['http', 'https'] }),
    }),

    defineField({
      name: 'order',
      title: 'Position in the grid',
      type: 'number',
      description:
        'Lower numbers come first. Leave gaps (10, 20, 30) so someone can be slotted in later without renumbering everyone.',
      initialValue: 50,
      validation: (Rule) => Rule.required().integer(),
    }),
  ],

  orderings: [
    {
      title: 'Grid order',
      name: 'gridOrder',
      by: [{ field: 'order', direction: 'asc' }],
    },
  ],

  preview: {
    select: { title: 'name', subtitle: 'role', media: 'photo', order: 'order' },
    prepare: ({ title, subtitle, media, order }) => ({
      title: `${order != null ? `${order}. ` : ''}${title}`,
      subtitle,
      media,
    }),
  },
});
