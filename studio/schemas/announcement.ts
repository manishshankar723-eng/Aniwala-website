/**
 * The announcement strip above the header.
 *
 * A SINGLETON: there is exactly one of these, pinned to the document id
 * `announcement` by the Studio structure. That is why it has no slug — it has
 * no URL and there is nothing to disambiguate.
 *
 * WHY THIS ONE IS IN THE CMS AT ALL
 * The rule elsewhere has been that structure stays in code and content moves
 * to Sanity. This is content: a line of marketing copy that changes with
 * whatever the studio is currently pushing, written by whoever is doing the
 * pushing. Needing a developer and a deploy to change one sentence at the top
 * of every page is exactly the friction the CMS exists to remove.
 *
 * THE `id` FIELD IS LOAD BEARING — read its description before changing it.
 */
import { defineType, defineField } from 'sanity';

export default defineType({
  name: 'announcement',
  title: 'Announcement bar',
  type: 'document',

  fields: [
    defineField({
      name: 'enabled',
      title: 'Show the bar',
      type: 'boolean',
      description:
        'Turn it off and the strip disappears and the header moves up to fill the space. Off is a perfectly good default — a bar that has said the same thing for six months is invisible anyway.',
      initialValue: false,
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'text',
      title: 'Message',
      type: 'string',
      description: 'One short line. It shares a single row with the link on mobile.',
      validation: (Rule) =>
        Rule.max(90).warning('Longer than about 90 characters will wrap awkwardly on a phone.'),
    }),

    defineField({
      name: 'cta',
      title: 'Link text',
      type: 'string',
      description: 'The clickable words — "See how we use it", "Read the case study".',
    }),

    defineField({
      name: 'href',
      title: 'Link target',
      type: 'string',
      description:
        'Where it goes. A path on this site like /services/, or a full https:// URL. IT MUST EXIST — the build runs a link checker and a bar pointing at a missing page fails the deploy for all 65 pages at once. That has happened before.',
    }),

    defineField({
      name: 'id',
      title: 'Version',
      type: 'string',
      description:
        'CHANGE THIS WHENEVER YOU CHANGE THE MESSAGE. Dismissing the bar remembers this exact value, so anyone who closed the previous announcement will never see the new one until it changes. A date works well: "spring-2026".',
      validation: (Rule) => Rule.required(),
    }),
  ],

  preview: {
    select: { text: 'text', enabled: 'enabled', id: 'id' },
    prepare: ({ text, enabled, id }) => ({
      title: enabled ? (text ?? 'Announcement') : 'Announcement bar (hidden)',
      subtitle: enabled ? `Live · ${id}` : 'Not shown on the site',
    }),
  },
});
