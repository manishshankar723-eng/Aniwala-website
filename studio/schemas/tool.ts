/**
 * A tool in the pipeline, for the "What we run" strip.
 *
 * WHY THIS IS A DOCUMENT AND NOT AN IMAGE SLOT.
 *
 * `config/imageSlots.ts` sets the test: does the picture belong to something
 * somebody can create? A logo belongs to a tool, and the tool list changes
 * whenever the pipeline does — so a fixed list of `tool-<name>` slots would
 * have meant a code change plus a Studio redeploy every time an artist
 * started using something new. It goes on a document, like `client`.
 *
 * WHAT THE NAME IS FOR, and it is doing more work here than on a client.
 *
 * The strip does not read its list from these documents. It reads it from
 * wherever that page's list already lives — the shared `capabilities` on
 * `siteCopy`, or the tools named on the service documents — and looks a logo
 * up BY NAME. That is deliberate: a service page's tool list and the logo
 * strip beneath it can never disagree, because there is only one list. The
 * cost is that `name` here has to match the spelling used there exactly, so
 * the field says so and the site falls back to text rather than dropping a
 * tool whose name has drifted.
 *
 * So a document here is only ever "this tool has a logo", and a row with no
 * logo yet changes nothing on the site — the strip already shows that tool as
 * text. Every name the site currently uses was written in as an empty row for
 * exactly that reason: the join key is then never typed by hand, and the only
 * thing left to do is drop a file onto the row.
 *
 * ADDING A TOOL: put it in the pipeline list (Site copy) or on the service
 * that uses it, which is what puts it on the strip. Come here only if it has
 * a logo, and copy the name across exactly.
 */
import { defineType, defineField } from 'sanity';
import { LogoAppearanceInput } from '../components/LogoAppearanceInput';
import { TREATMENT_OPTIONS } from '../components/logoTheme';

export default defineType({
  name: 'tool',
  title: 'Tool',
  type: 'document',

  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description:
        'Must match the spelling in the pipeline list exactly — "Unreal Engine", not "Unreal". That is how the logo finds its tool. A mismatch shows the name as text rather than hiding it.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'logo',
      title: 'Logo',
      type: 'image',
      description:
        'Square-ish, transparent PNG or SVG, no background — the strip draws the circle. Without one the name renders as a text pill, which is a perfectly good strip.',
    }),
    /*
     * BOTH THEMES, because the site has two and a logo file has one set of
     * colours. A black mark vanished on the dark badge and a white one on the
     * light badge, and the person uploading only ever saw one of them. See
     * `components/logoTheme.ts` for the treatments and how they are chosen.
     */
    defineField({
      name: 'logoLight',
      title: 'Logo for the light theme (optional)',
      type: 'image',
      description:
        "Only if the brand publishes a separate version for light backgrounds — usually the dark-ink wordmark of a white logo. When set it replaces the logo above on the light theme only. Most logos don't need one: the setting below fixes them.",
      hidden: ({ parent }) => !parent?.logo,
    }),
    defineField({
      name: 'appearance',
      title: 'How it shows on each theme',
      type: 'object',
      description:
        'Previewed exactly as the strip draws it. Uploading a new logo sets this automatically from a measurement; change it if the preview looks wrong. "Flip light and dark" suits black, white and grey logos and keeps their detail. A disc is the last resort for a colourful logo that is hard to see.',
      hidden: ({ parent }) => !parent?.logo,
      components: { input: LogoAppearanceInput },
      fields: [
        defineField({
          name: 'onDark',
          title: 'On the dark theme',
          type: 'string',
          initialValue: 'asIs',
          options: { list: TREATMENT_OPTIONS.dark, layout: 'radio', direction: 'horizontal' },
        }),
        defineField({
          name: 'onLight',
          title: 'On the light theme',
          type: 'string',
          initialValue: 'asIs',
          options: { list: TREATMENT_OPTIONS.light, layout: 'radio', direction: 'horizontal' },
        }),
      ],
    }),
    defineField({
      name: 'order',
      title: 'Position',
      type: 'number',
      description: 'Only used when the strip is showing tools that have logos.',
      initialValue: 50,
    }),
  ],

  preview: {
    select: { title: 'name', media: 'logo' },
  },
});
