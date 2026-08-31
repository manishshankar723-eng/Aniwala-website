/**
 * A blog post.
 *
 * MIRRORS THE ZOD SCHEMA in the website's `src/content.config.ts`. That schema
 * runs at build time and fails the build on a mismatch, so the two must agree.
 * The validation here exists to catch the same problems earlier and in plain
 * language — an editor should find out that a description is too long while
 * they are typing it, not from a red CI job an hour later that they cannot read.
 *
 * The `CATEGORIES` list is imported from the website rather than copied. It is
 * a plain TypeScript module with no Astro imports, precisely so both sides can
 * share it; a copy here would drift the first time a category is renamed and
 * the drift would only show up as a failed build.
 */
import { defineType, defineField } from 'sanity';
import { CATEGORIES } from '../../src/config/categories';

export default defineType({
  name: 'post',
  title: 'Blog post',
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
      description:
        'The web address of this post: aniwala.com/blog/THIS-BIT/. Generated from the title — click Generate. Changing it after publishing breaks every existing link to the post, so avoid editing it later.',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
      description:
        'One or two sentences. This is what shows on the blog listing card AND what Google prints under the title in search results — so write it for someone deciding whether to click, not as a summary. Google cuts it off after about 160 characters.',
      /* A warning, not an error: it shows in the Studio while you type but
         does not block saving. Somebody who has a good reason for 165
         characters should not be stopped by a linter. */
      validation: (Rule) =>
        Rule.required()
          .max(160)
          .warning('Over 160 characters gets truncated in Google. Tighten it if you can.'),
    }),

    defineField({
      name: 'pubDate',
      title: 'Publish date',
      type: 'date',
      options: { dateFormat: 'YYYY-MM-DD' },
      description: 'Drives the ordering on the blog and the monthly archive.',
      initialValue: () => new Date().toISOString().split('T')[0],
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'updatedDate',
      title: 'Last updated (optional)',
      type: 'date',
      options: { dateFormat: 'YYYY-MM-DD' },
      description:
        'Only set this if you have meaningfully revised the post. It is shown to readers and emitted as dateModified for search engines, so setting it after a typo fix is noise.',
    }),

    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      description: 'One only. Drives which filter page the post appears under.',
      options: {
        list: CATEGORIES.map((c) => ({ title: c, value: c })),
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'tags',
      title: 'Tags',
      type: 'array',
      of: [{ type: 'string' }],
      description:
        'Free text, lowercase, a few per post — "3d animation", "process", "unreal". Reused tags group posts together, so check an existing spelling before inventing a new one.',
      options: { layout: 'tags' },
    }),

    defineField({
      name: 'cover',
      title: 'Cover image',
      type: 'image',
      options: { hotspot: true },
      description:
        'Shown on the blog card and at the top of the post. Landscape, at least 1200px wide. Leave it empty to use the colour placeholder instead.',
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Alt text',
          description: 'What the image shows, for screen readers.',
          validation: (Rule) => Rule.required().warning('Every image needs alt text.'),
        },
      ],
    }),

    defineField({
      name: 'tint',
      title: 'Placeholder colour',
      type: 'string',
      description:
        'Used on the card when there is no cover image. An HSL triple like "210 70% 22%". Leave the default unless you have a reason.',
      initialValue: '210 70% 22%',
    }),

    defineField({
      name: 'author',
      title: 'Author',
      type: 'string',
      initialValue: 'Aniwala Studios',
    }),

    defineField({
      name: 'body',
      title: 'Body',
      type: 'blockContent',
      validation: (Rule) => Rule.required(),
    }),
  ],

  /**
   * The list preview. Shows the cover, the title, and the category and date —
   * enough to find the right post in a list of fifty without opening any.
   */
  preview: {
    select: { title: 'title', category: 'category', date: 'pubDate', media: 'cover' },
    prepare: ({ title, category, date, media }) => ({
      title,
      subtitle: [category, date].filter(Boolean).join(' · '),
      media,
    }),
  },
});
