/**
 * Contact details and social links. A SINGLETON.
 *
 * The address, the email and the social row appear in the footer of every
 * page and in the contact page's structured data. They change rarely — and
 * when they do (a move, a new account), needing a developer is absurd.
 *
 * THE SOCIAL LINKS ARE CURRENTLY PLACEHOLDERS, by design rather than by
 * accident: the old config pointed each one at the platform's own homepage so
 * the row rendered and looked right before the studio accounts existed.
 * Nobody lands on a 404, but nobody reaches an Aniwala profile either.
 * Replace each URL as the accounts are created — or clear it, which drops the
 * icon from the live site rather than leaving a link that goes nowhere useful.
 *
 * The map link is NOT stored. It is built from the address at render time,
 * because a pasted share link expires and can silently start pointing
 * somewhere else, whereas one derived from the address cannot.
 */
import { defineType, defineField } from 'sanity';

const ICONS = ['whatsapp', 'linkedin', 'x', 'youtube', 'facebook', 'artstation'];

export default defineType({
  name: 'contactDetails',
  title: 'Contact details',
  type: 'document',

  groups: [
    { name: 'office', title: 'Office', default: true },
    { name: 'social', title: 'Social links' },
  ],

  fields: [
    defineField({
      name: 'email',
      title: 'Contact email',
      type: 'string',
      group: 'office',
      validation: (Rule) => Rule.required().email(),
    }),
    defineField({
      name: 'careersEmail',
      title: 'Careers email',
      type: 'string',
      group: 'office',
      description: 'Where job applications are sent. Can be the same address.',
      validation: (Rule) => Rule.required().email(),
    }),
    defineField({
      name: 'addressLines',
      title: 'Address',
      type: 'array',
      of: [{ type: 'string' }],
      group: 'office',
      description:
        'One line per line, so the footer breaks it where it should break rather than wherever it happens to wrap.',
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({
      name: 'country',
      title: 'Country',
      type: 'string',
      group: 'office',
      initialValue: 'India',
      validation: (Rule) => Rule.required(),
    }),

    /* ---------------------------------------------------------------
       THE SAME ADDRESS, SPLIT UP.

       `addressLines` above is for HUMANS — it is printed in the footer and
       breaks where somebody decided it should break. The five fields below
       are the same facts for MACHINES, and a search engine needs them apart
       to place the studio on a map.

       Why not derive one from the other: there is no reliable way to look at
       ["Crossroads Building, Bhumkar Chowk", "Wakad, Pimpri-Chinchwad",
       "Maharashtra 411057"] and know which fragment is the city, which is the
       state and which is the postcode. Guessing it wrong puts the business in
       the wrong place, silently. Every one of these is optional and the
       structured data simply omits what is blank, so filling them in is an
       improvement rather than a prerequisite.
       --------------------------------------------------------------- */
    defineField({
      name: 'phone',
      title: 'Phone',
      type: 'string',
      group: 'office',
      description:
        'Full international form, e.g. +91 20 1234 5678. Published in the structured data — a local business result without a phone number is a weaker result.',
    }),
    defineField({
      name: 'streetAddress',
      title: 'Street address (for search engines)',
      type: 'string',
      group: 'office',
      description:
        'Building and street only — no city, state or postcode, those are their own fields below. Leave blank to fall back to the printed address above.',
    }),
    defineField({
      name: 'locality',
      title: 'City',
      type: 'string',
      group: 'office',
      description: 'The city a customer would search for. "Pune", not "Wakad".',
    }),
    defineField({
      name: 'region',
      title: 'State',
      type: 'string',
      group: 'office',
      description: 'e.g. Maharashtra.',
    }),
    defineField({
      name: 'postalCode',
      title: 'Postcode',
      type: 'string',
      group: 'office',
    }),
    defineField({
      name: 'latitude',
      title: 'Latitude',
      type: 'number',
      group: 'office',
      description:
        'Optional. Right-click the office in Google Maps and the first item in the menu is the pair — latitude first. Both must be filled in or neither is published.',
      validation: (Rule) => Rule.min(-90).max(90),
    }),
    defineField({
      name: 'longitude',
      title: 'Longitude',
      type: 'number',
      group: 'office',
      validation: (Rule) => Rule.min(-180).max(180),
    }),
    defineField({
      name: 'openingHours',
      title: 'Opening hours',
      type: 'array',
      of: [{ type: 'string' }],
      group: 'office',
      description:
        'One line per block, in the format search engines read: "Mo-Fr 10:00-19:00". Days are Mo Tu We Th Fr Sa Su; times are 24-hour.',
      validation: (Rule) =>
        Rule.custom((lines: string[] | undefined) => {
          const bad = (lines ?? []).filter(
            (l) => !/^(Mo|Tu|We|Th|Fr|Sa|Su)(-(Mo|Tu|We|Th|Fr|Sa|Su))?( \d{2}:\d{2}-\d{2}:\d{2})$/.test(l.trim())
          );
          return bad.length ? `Not a readable opening-hours line: ${bad.join(', ')}` : true;
        }),
    }),
    defineField({
      name: 'areaServed',
      title: 'Areas served',
      type: 'array',
      of: [{ type: 'string' }],
      group: 'office',
      description:
        'Where the studio takes work from, broadest last — e.g. Pune, Maharashtra, India. Leave empty for a studio that genuinely sells everywhere and nowhere in particular.',
    }),

    defineField({
      name: 'socials',
      title: 'Social links',
      type: 'array',
      group: 'social',
      description:
        'Clear a URL to drop that icon from the live site. Better an absent icon than one that goes to a platform homepage.',
      of: [
        {
          type: 'object',
          fields: [
            {
              name: 'icon',
              title: 'Platform',
              type: 'string',
              options: { list: ICONS.map((i) => ({ title: i, value: i })) },
              validation: (Rule: any) => Rule.required(),
            },
            {
              name: 'label',
              title: 'Label',
              type: 'string',
              description: 'Screen-reader name for the icon.',
              validation: (Rule: any) => Rule.required(),
            },
            {
              name: 'href',
              title: 'URL',
              type: 'string',
              description:
                'WhatsApp wants a wa.me link with the number in full international form and no punctuation, e.g. https://wa.me/919876543210',
            },
          ],
          preview: {
            select: { title: 'label', subtitle: 'href' },
          },
        },
      ],
    }),

    /**
     * The trading name.
     *
     * Printed as the copyright holder in the footer base, and named in the
     * first line of the privacy policy as the party the policy covers. It
     * lives here rather than in either of those places because it is the same
     * legal fact twice, and two copies of it is how the footer and the policy
     * end up naming different entities.
     */
    defineField({
      name: 'legalName',
      title: 'Trading name',
      type: 'string',
      group: 'office',
      description:
        'The copyright holder in the footer, and the party the privacy policy covers. Use the name you would put on a contract.',
      validation: (Rule) => Rule.required(),
    }),
  ],

  preview: {
    prepare: () => ({ title: 'Contact details' }),
  },
});
