/**
 * The privacy policy. A SINGLETON.
 *
 * WHY THIS ONE IS RICH TEXT AND NOT FIFTY STRING FIELDS
 *
 * The page was fifty-seven separate sentences in `privacy.astro`. Modelling
 * that as fifty-seven fields would have produced a Studio form nobody could
 * read and a schema that has to change every time a solicitor adds a clause.
 * A policy is prose: it gets a body.
 *
 * WHAT STAYS OUT OF THE BODY, on purpose:
 *
 *   - The postal address. It is already structured data on `contactDetails`,
 *     and a second copy typed into a paragraph here is the one that goes
 *     stale the day the studio moves.
 *   - The email address. Same reason — write `{{email}}` anywhere in the body
 *     or in the contact lead and the site substitutes the real one as a
 *     mailto link. `{{legalName}}` works the same way.
 *
 * KEEP THIS IN STEP WITH THE CODE. Moving the policy into the CMS did not
 * change what the policy has to be true about. If someone adds analytics, a
 * pixel, a chat widget or a new form, editing this document is part of that
 * change — and now it is an edit rather than a deploy, which removes the
 * excuse for putting it off. The claims the current text makes:
 *
 *   - no analytics, no advertising, no third-party tracking of any kind
 *   - localStorage holds exactly the functional keys the page lists
 *   - visitor-submitted data lives in Supabase (see supabase/schema.sql)
 *   - three forms collect data: enquiry/booking, job application, comment
 *   - fonts are self-hosted; there is no third-party request on any page
 *
 * NOT LEGAL ADVICE. This is an honest description of the site's behaviour
 * written by the people who built it. Have a solicitor read it before you
 * rely on it, particularly if you take work from the EU or UK.
 */
import { defineType, defineField } from 'sanity';
import { seoFields } from './seoFields';

export default defineType({
  name: 'privacyPage',
  title: 'Privacy policy',
  type: 'document',

  groups: [
    { name: 'hero', title: 'Hero', default: true },
    { name: 'body', title: 'Policy' },
    { name: 'seo', title: 'Search' },
  ],

  fields: [
    defineField({
      name: 'eyebrow',
      title: 'Eyebrow',
      type: 'string',
      group: 'hero',
      description: 'The small line above the title. "Legal".',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      group: 'hero',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'lead',
      title: 'Lead',
      type: 'text',
      rows: 3,
      group: 'hero',
      description: 'One or two sentences under the title.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'tint',
      title: 'Tint',
      type: 'string',
      group: 'hero',
      description: 'HSL triple washing the hero background, e.g. "210 70% 22%".',
      initialValue: '210 70% 22%',
      validation: (Rule) => Rule.required(),
    }),

    /**
     * The "last updated" line.
     *
     * A real date field rather than a typed string, and it is the field most
     * worth being strict about on this document: the policy itself promises
     * that this date changes whenever the policy does. A hand-typed line is
     * the one that gets forgotten at the next edit, which turns that promise
     * into a lie the page tells about itself.
     */
    defineField({
      name: 'lastUpdated',
      title: 'Last updated',
      type: 'date',
      group: 'hero',
      description:
        'Shown in the hero. The policy promises this changes whenever the text does — so change it whenever you change anything below.',
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'lastUpdatedLabel',
      title: 'Last-updated label',
      type: 'string',
      group: 'hero',
      description: 'Printed before the date — "Last updated 30 August 2026".',
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'body',
      title: 'Policy',
      type: 'blockContent',
      group: 'body',
      description:
        'The policy itself. Headings, paragraphs and lists. Write {{email}} for the studio inbox and {{legalName}} for the trading name — both are filled in from Contact details, so neither can go stale here.',
      validation: (Rule) => Rule.required(),
    }),

    /**
     * The contact tail, kept out of the body because the address under it is
     * rendered from `contactDetails` rather than typed.
     */
    defineField({
      name: 'contactHeading',
      title: 'Contact heading',
      type: 'string',
      group: 'body',
      description: 'The heading above the postal address at the foot of the page.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'contactLead',
      title: 'Contact line',
      type: 'text',
      rows: 2,
      group: 'body',
      description:
        'The sentence above the address. {{email}} becomes a mailto link. The address itself comes from Contact details and is not typed here.',
      validation: (Rule) => Rule.required(),
    }),

    ...seoFields,
  ],

  preview: {
    select: { subtitle: 'lastUpdated' },
    prepare: ({ subtitle }) => ({
      title: 'Privacy policy',
      subtitle: subtitle ? `Last updated ${subtitle}` : 'No date set',
    }),
  },
});
