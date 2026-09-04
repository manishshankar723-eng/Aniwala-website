/**
 * Optional search-result overrides, shared by every content type that has a
 * page of its own.
 *
 * WHY OPTIONAL, and why a fallback rather than a required field.
 *
 * Most pages get a perfectly good title and description from the content
 * itself — a blog post's own title and summary are usually the right thing to
 * show in a search result, and forcing an editor to retype them into two more
 * boxes produces the same words on a good day and a stale copy on a bad one.
 *
 * But sometimes they are NOT the right thing. A service's tagline reads well
 * under a heading and badly in Google, where it is competing for a click and
 * has 160 characters to earn it. A job title makes a fine `<h1>` and a weak
 * search result without the location beside it.
 *
 * So: leave both blank and the page derives them, exactly as before. Fill one
 * in and it wins. The derived value is shown as a placeholder in the Studio,
 * so an editor can see what they are overriding before they override it.
 */
import { defineField } from 'sanity';

export const seoFields = [
  defineField({
    name: 'seoTitle',
    title: 'Search-result title',
    type: 'string',
    group: 'seo',
    description:
      'Overrides the automatic one. Google truncates around 60 characters, so lead with the thing people search for and put the studio name last. Leave blank to use the page title.',
    validation: (Rule) =>
      Rule.max(70).warning('Over ~60 characters usually gets cut off in search results.'),
  }),
  defineField({
    name: 'seoDescription',
    title: 'Search-result description',
    type: 'text',
    rows: 3,
    group: 'seo',
    description:
      'The grey paragraph under the title in Google. It is not a ranking factor — it is the sentence that decides whether somebody clicks, so write it as a reason to. Leave blank to use the page summary.',
    validation: (Rule) =>
      Rule.max(300).warning('Google cuts this around 160 characters — the rest is indexed, just not shown.'),
  }),
];
