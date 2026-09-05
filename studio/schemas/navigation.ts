/**
 * The header and footer menus. A SINGLETON.
 *
 * One list drives both, so a link never has to be added in two places — that
 * was true when this lived in `config/nav.ts` and it stays true here.
 *
 * WHY THIS IS SAFE TO HAND OVER, and where the guard rails are. A menu is the
 * one piece of content that can break every page at once: a mistyped path is
 * 65 broken links, not one. Two things catch that. The `href` field refuses
 * anything that is not a site path or a full URL, and `check-links.mjs` fails
 * the build if a path does not resolve to a real page. So the worst an editor
 * can do is fail a deploy loudly, which is the correct worst case.
 *
 * WHAT IT CANNOT DO: add a page. A menu item points at a route that already
 * exists — either a fixed one, or a page built in the Studio. Pointing at
 * something unbuilt fails the link check rather than shipping a 404.
 */
import { defineType, defineField, defineArrayMember } from 'sanity';

const hrefField = (description: string, name = 'href') =>
  defineField({
    name,
    title: 'Link',
    type: 'string',
    description,
    validation: (Rule) =>
      Rule.custom((value) =>
        !value || value.startsWith('/') || /^(https?:\/\/|mailto:)/.test(value)
          ? true
          : 'Use a path starting with / , a full http(s) URL, or a mailto: address.'
      ),
  });

export default defineType({
  name: 'navigation',
  title: 'Menus',
  type: 'document',

  fields: [
    defineField({
      name: 'items',
      title: 'Menu',
      type: 'array',
      description:
        'The header, left to right. Drag to reorder. Six is about the limit before a header starts reading as a directory — put the rest in the footer with "Hide from the header".',
      validation: (Rule) => Rule.required().min(1),
      of: [
        defineArrayMember({
          type: 'object',
          name: 'item',
          fields: [
            defineField({
              name: 'label',
              title: 'Label',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
            hrefField('Where it goes. Leave blank if this item only opens a dropdown.'),
            defineField({
              name: 'hiddenInHeader',
              title: 'Hide from the header',
              type: 'boolean',
              description:
                'Keeps it in the footer and in search, but out of the header. For a page that deserves a link without spending one of the header slots.',
              initialValue: false,
            }),
            defineField({
              name: 'children',
              title: 'Dropdown',
              type: 'array',
              description:
                'An item can have BOTH a link and a dropdown: the label goes to the link, the caret opens the list, and the mobile menu adds an "All …" row at the top automatically.',
              of: [
                defineArrayMember({
                  type: 'object',
                  name: 'child',
                  fields: [
                    defineField({
                      name: 'label',
                      title: 'Label',
                      type: 'string',
                      validation: (Rule) => Rule.required(),
                    }),
                    hrefField('Where it goes.'),
                    defineField({
                      name: 'blurb',
                      title: 'Blurb',
                      type: 'string',
                      description: 'One short line under the label in the dropdown. Optional.',
                    }),
                  ],
                  preview: { select: { title: 'label', subtitle: 'href' } },
                }),
              ],
            }),
          ],
          preview: {
            select: { title: 'label', href: 'href', hidden: 'hiddenInHeader', kids: 'children' },
            prepare: ({ title, href, hidden, kids }) => ({
              title,
              subtitle:
                (href ?? '—') +
                (kids?.length ? `  ·  ${kids.length} in dropdown` : '') +
                (hidden ? '  ·  footer only' : ''),
            }),
          },
        }),
      ],
    }),

    defineField({
      name: 'ctaLabel',
      title: 'Button label',
      type: 'string',
      description: 'The gold button at the end of the header, and in the footer.',
      validation: (Rule) => Rule.required(),
    }),
    hrefField('Where the gold button goes.', 'ctaHref'),

    /*
     * The pages search cannot find on its own.
     *
     * Everything with a document behind it — posts, services, case studies,
     * roles, disciplines — is folded into the index automatically from that
     * document, so it can never fall out of step with the site. These are the
     * ones whose text lives in a template instead, and they have to be listed
     * by hand because there is nothing to read them off.
     *
     * A page missing from here still works; it is simply not findable by
     * search, which is the quietest kind of broken. Adding a page to the menu
     * is usually a reason to add it here too.
     */
    defineField({
      name: 'searchPages',
      title: 'Pages in search',
      type: 'array',
      description:
        'Pages whose text is written into the template rather than into a document. Everything else — posts, services, case studies, roles — is added to search automatically.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'searchPage',
          fields: [
            defineField({
              name: 'title',
              title: 'Title',
              type: 'string',
              description: 'As it should read in the results list.',
              validation: (R) => R.required(),
            }),
            defineField({
              name: 'href',
              title: 'Path',
              type: 'string',
              validation: (R) =>
                R.required().custom((v: string | undefined) =>
                  v === undefined || /^\//.test(v) ? true : 'Use a path starting with /.'
                ),
            }),
            defineField({
              name: 'section',
              title: 'Section',
              type: 'string',
              description: 'The grey label beside the result. Groups results in the list.',
              validation: (R) => R.required(),
            }),
            defineField({
              name: 'keywords',
              title: 'Also matches',
              type: 'text',
              rows: 2,
              description:
                'Words somebody might search that are not in the title — "jobs hiring vacancies" for the careers page. Space-separated, lowercase, never shown.',
            }),
          ],
          preview: { select: { title: 'title', subtitle: 'href' } },
        }),
      ],
    }),
  ],

  preview: { prepare: () => ({ title: 'Menus' }) },
});
