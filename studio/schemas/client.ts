/**
 * A client, for the logo wall.
 *
 * Replaces another deliberately empty array whose note read "an empty logo
 * wall is worse than none". That rule still holds and the site still enforces
 * it: the section does not render while this is empty.
 *
 * Only add a client who has agreed to be named. A logo wall is a claim about
 * who you have worked for, and it is the first thing a prospective client
 * checks.
 */
import { defineType, defineField } from 'sanity';

export default defineType({
  name: 'client',
  title: 'Client',
  type: 'document',

  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'Used as the alt text when a logo is set, so it is required either way.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'logo',
      title: 'Logo',
      type: 'image',
      description:
        'Ideally a transparent PNG or SVG on no background. Without one the name renders as text, which is a perfectly good logo wall.',
    }),
    defineField({
      name: 'order',
      title: 'Position',
      type: 'number',
      initialValue: 50,
    }),
  ],

  preview: {
    select: { title: 'name', media: 'logo' },
  },
});
