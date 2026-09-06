/**
 * A blog category. `/blog/category/{slug}/` is built from each.
 *
 * WHY THIS IS A DOCUMENT NOW
 *
 * These were four strings in `src/config/categories.ts`, and the argument for
 * keeping them there was real: a category drives a URL and validates every
 * post, so renaming one in a CMS field could break every link anybody has
 * shared and orphan the posts filed under it.
 *
 * That argument was already being ignored one directory over. The portfolio
 * disciplines have exactly the same properties — they drive `/portfolio/<slug>/`
 * and every piece is filed against one — and they became documents. So adding
 * a portfolio discipline was an edit and adding a blog category was a code
 * change, for two lists that are the same shape and carry the same risk.
 *
 * WHAT ACTUALLY MAKES IT SAFE is not where the list lives. It is that posts
 * REFERENCE a category rather than naming it: Sanity will not let you delete
 * a category a post still points at, and renaming the title cannot detach
 * anything because the reference is by id. The slug is the only field here
 * that can break a link, which is why it says so.
 *
 * THE BLURB moved here from `siteCopy.categoryBlurbs`, where it was a
 * parallel list keyed by category name — a second place to add a category,
 * and one nobody would remember. A category and its description are the same
 * thing; they belong on the same document.
 */
import { defineType, defineField } from 'sanity';

export default defineType({
  name: 'postCategory',
  title: 'Blog category',
  type: 'document',

  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'How it reads on the filter row and at the top of its archive page.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'URL',
      type: 'slug',
      description:
        'Becomes /blog/category/<this>/. THE ONE FIELD HERE WORTH BEING CAREFUL WITH: changing it breaks every link anybody has shared to this archive page. Renaming the title above is safe — posts point at this document, not at its name.',
      options: { source: 'title', maxLength: 40 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'blurb',
      title: 'Description',
      type: 'text',
      rows: 2,
      description:
        'One line, shown at the top of the archive page and used as its search-result description. Say what a reader will find here, not that it is a category.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'order',
      title: 'Position',
      type: 'number',
      description: 'Lower first. Sets the order of the filter row above the blog.',
      initialValue: 50,
      validation: (Rule) => Rule.required().integer(),
    }),
  ],

  orderings: [{ title: 'Position', name: 'order', by: [{ field: 'order', direction: 'asc' }] }],

  preview: {
    select: { title: 'title', slug: 'slug.current', order: 'order' },
    prepare: ({ title, slug, order }) => ({
      title,
      subtitle: `/blog/category/${slug}/  ·  ${order}`,
    }),
  },
});
