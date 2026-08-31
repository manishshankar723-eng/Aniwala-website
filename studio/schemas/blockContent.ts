/**
 * The rich-text editor used for post and case-study bodies.
 *
 * THIS LIST IS A CONTRACT. Every style, mark and block type offered here has
 * a matching serializer in the website's `src/lib/sanity/portableText.ts`.
 * Anything added here without one renders as nothing — silently, on the live
 * site, with no build error, because Portable Text simply skips block types it
 * was not told how to draw. If you add to this file, add to that one.
 *
 * WHAT IS DELIBERATELY MISSING
 * H1 is not offered. The page renders the post title as the only h1, and a
 * second one in the body is a real SEO and screen-reader problem rather than a
 * style preference. Headings therefore start at H2, which is also what the
 * table of contents is built from.
 *
 * Text colour, font size and alignment are not offered either. The site has a
 * type system; an editor who can override it will, and the blog will slowly
 * stop matching the rest of the site.
 */
import { defineType, defineArrayMember } from 'sanity';

export default defineType({
  title: 'Body',
  name: 'blockContent',
  type: 'array',
  of: [
    defineArrayMember({
      type: 'block',

      /* H2 and H3 carry the document outline. H4 exists for the rare deep
         section and is not in the table of contents. */
      styles: [
        { title: 'Normal', value: 'normal' },
        { title: 'Heading', value: 'h2' },
        { title: 'Subheading', value: 'h3' },
        { title: 'Small heading', value: 'h4' },
        { title: 'Quote', value: 'blockquote' },
      ],

      lists: [
        { title: 'Bullet', value: 'bullet' },
        { title: 'Numbered', value: 'number' },
      ],

      marks: {
        decorators: [
          { title: 'Bold', value: 'strong' },
          { title: 'Italic', value: 'em' },
          { title: 'Code', value: 'code' },
        ],

        annotations: [
          {
            title: 'Link',
            name: 'link',
            type: 'object',
            fields: [
              {
                title: 'URL',
                name: 'href',
                type: 'url',
                /* allowRelative: true is what lets an editor link to another
                   page on this site as `/services/` instead of pasting the
                   full https://aniwala.com URL. Without it Sanity rejects the
                   relative path and people paste absolute links, which then
                   break the moment the site moves domain. */
                validation: (Rule) =>
                  Rule.uri({
                    scheme: ['http', 'https', 'mailto', 'tel'],
                    allowRelative: true,
                  }),
              },
            ],
          },
        ],
      },
    }),

    /**
     * An image inside the body.
     *
     * `hotspot` lets the editor say which part of the image matters, which is
     * what keeps a face in frame when the CDN crops for a narrow screen.
     */
    defineArrayMember({
      type: 'image',
      options: { hotspot: true },
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Alt text',
          description:
            'What the image shows, for screen readers and for when it fails to load. Describe the content, not the file — "a rigged character in Maya, viewport shaded" beats "screenshot".',
          validation: (Rule) => Rule.required().warning('Every image needs alt text.'),
        },
        {
          name: 'caption',
          type: 'string',
          title: 'Caption (optional)',
          description: 'Shown under the image. Leave blank for no caption.',
        },
      ],
    }),

    /** Code block. Rendered into `<pre><code>`, which `.prose` already styles. */
    defineArrayMember({
      type: 'object',
      name: 'code',
      title: 'Code block',
      fields: [
        { name: 'code', type: 'text', title: 'Code', rows: 8 },
        {
          name: 'language',
          type: 'string',
          title: 'Language',
          options: {
            list: ['bash', 'python', 'javascript', 'typescript', 'json', 'mel', 'glsl', 'text'],
          },
        },
      ],
      preview: {
        select: { code: 'code', language: 'language' },
        prepare: ({ code, language }) => ({
          title: language ? `Code (${language})` : 'Code',
          subtitle: (code ?? '').split('\n')[0],
        }),
      },
    }),
  ],
});
