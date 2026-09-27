/**
 * The chat assistant. A SINGLETON.
 *
 * The on/off switch for the widget on the website, and every word the widget
 * itself shows.
 *
 * WHAT THE SWITCH DOES AND DOES NOT DO. It decides whether the widget is
 * BUILT INTO THE PAGES — Publish, and the site rebuilds with it shown or
 * hidden, the same as any other content change. It does not stop the chat
 * backend, which is a Supabase Edge Function with its own daily token budget
 * (CHAT_DAILY_TOKENS); turning the widget off takes away the way visitors
 * reach it, and the budget is what bounds the bill either way. See
 * CHATBOT-PLAN.md.
 *
 * WHAT IS NOT OFFERED HERE, deliberately: what the bot knows (it is built from
 * the pages themselves — services, roles, FAQs — so a fact is changed where
 * the page shows it, and the bot follows), and its rules and fixed replies
 * (prices, promises, the refusal, the daily-limit message), which are part of
 * a security control in code, not copy.
 *
 * THE SUGGESTION LINKS ARE CHECKED AT BUILD TIME, not only here: Studio
 * validation runs in this UI and nowhere else (CLAUDE.md). `Chat.astro` fails
 * the build on a link that is not a page the bot knows about.
 *
 * `CHAT_ENABLED` in a build's environment overrides the switch: `1` forces the
 * widget on (local testing while the site has it off), `0` forces it off.
 */
import { defineType, defineField, defineArrayMember } from 'sanity';

const sitePath = (value: unknown) =>
  typeof value !== 'string' || /^\/(?![/\\])[^\s\\]*$/.test(value)
    ? true
    : 'Use a path on this site, starting with a single / — e.g. /services/vfx/ or /contact/#book.';

export default defineType({
  name: 'chatSettings',
  title: 'Chat assistant',
  type: 'document',

  groups: [
    { name: 'switch', title: 'On / off', default: true },
    { name: 'wording', title: 'Wording' },
    { name: 'suggestions', title: 'Suggestions' },
  ],

  fields: [
    defineField({
      name: 'enabled',
      title: 'Show the chat assistant on the website',
      type: 'boolean',
      group: 'switch',
      description:
        'Publish to apply. The site rebuilds with the chat button shown or hidden — usually live within a few minutes.',
      initialValue: false,
    }),

    /* ---------- wording: every field falls back to the built-in text ---------- */
    defineField({
      name: 'welcome',
      title: 'Opening message',
      type: 'text',
      rows: 3,
      group: 'wording',
      description:
        'The first thing the assistant says when the chat is opened. A sentence or two. Leave empty for the default.',
      validation: (rule) => rule.max(280),
    }),
    defineField({
      name: 'launcherLabel',
      title: 'Button label',
      type: 'string',
      group: 'wording',
      description: 'The text on the floating button. Default: "Ask us". Keep it to two or three words.',
      validation: (rule) => rule.max(24),
    }),
    defineField({
      name: 'title',
      title: 'Panel title',
      type: 'string',
      group: 'wording',
      description: 'Default: "Aniwala assistant".',
      validation: (rule) => rule.max(40),
    }),
    defineField({
      name: 'subtitle',
      title: 'Status line',
      type: 'string',
      group: 'wording',
      description:
        'The small line under the title. Default: "Automated · replies in seconds". Keep the word "automated" or similar — visitors must be told they are not talking to a person.',
      validation: (rule) => rule.max(60),
    }),
    defineField({
      name: 'placeholder',
      title: 'Input placeholder',
      type: 'string',
      group: 'wording',
      description: 'The grey hint in the empty text box. Default: "Ask about services, work or jobs…".',
      validation: (rule) => rule.max(60),
    }),
    defineField({
      name: 'footnote',
      title: 'Footnote',
      type: 'string',
      group: 'wording',
      description:
        'Under the text box. It is followed by a "get in touch" link. Default: "Automated answers may be imperfect. Please don\'t share personal details here —".',
      validation: (rule) => rule.max(160),
    }),

    /* ---------- suggestions ---------- */
    defineField({
      name: 'suggestions',
      title: 'Suggested questions',
      type: 'array',
      group: 'suggestions',
      description:
        'The tappable questions under the opening message. They answer with the fixed text you write here — no AI involved, so they cost nothing. LEAVE EMPTY to use the built-in three (services, booking a call, hiring), whose answers are written automatically from the services and open roles and so never go out of date. Text you write here does not update itself.',
      validation: (rule) => rule.max(4),
      of: [
        defineArrayMember({
          type: 'object',
          name: 'suggestion',
          fields: [
            defineField({
              name: 'question',
              title: 'Question',
              type: 'string',
              validation: (rule) => rule.required().max(60),
            }),
            defineField({
              name: 'answer',
              title: 'Answer',
              type: 'text',
              rows: 3,
              validation: (rule) => rule.required().max(400),
            }),
            defineField({
              name: 'links',
              title: 'Links',
              type: 'array',
              description:
                'Pages to offer under the answer, as paths on this site — /services/vfx/, /careers/, /contact/#book. Up to four.',
              of: [defineArrayMember({ type: 'string', validation: (rule) => rule.custom(sitePath) })],
              validation: (rule) => rule.max(4),
            }),
          ],
          preview: { select: { title: 'question', subtitle: 'answer' } },
        }),
      ],
    }),
  ],

  preview: {
    select: { enabled: 'enabled' },
    prepare: ({ enabled }) => ({
      title: 'Chat assistant',
      subtitle: enabled ? 'Shown on the website' : 'Hidden',
    }),
  },
});
