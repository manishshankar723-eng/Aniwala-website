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
 *
 * THE SHARING IMAGE follows the same rule. A post or a case study already has
 * a cover, and that cover is the right card for it nine times out of ten — so
 * leaving this blank uses it. Fill it in only when the cover is wrong for
 * SHARING specifically: a wide still that crops badly to 1200x630, or a piece
 * whose cover is beautiful in a grid and unreadable as a thumbnail. Anything
 * with no cover at all falls back to the studio's default card.
 *
 * NOINDEX is the one field here that can do damage, which is why its
 * description says so rather than describing what it does.
 */
import { defineField } from 'sanity';
import { SeoPanel } from '../components/SeoPanel';

export const seoFields = [
  /**
   * The focus keyphrase.
   *
   * STORED, NEVER PUBLISHED. `<meta name="keywords">` has been ignored by
   * Google since 2009, and this does not become one — it exists so the panel
   * below has something to check the page against. Yoast's focus keyphrase
   * works exactly the same way, which surprises almost everybody.
   *
   * One phrase, not a list. The checks ask whether the page is ABOUT this
   * thing — is it in the title, the first paragraph, a heading — and a comma-
   * separated list of six makes every one of those questions meaningless.
   */
  defineField({
    name: 'focusKeyphrase',
    title: 'Focus keyphrase',
    type: 'string',
    group: 'seo',
    description:
      'What somebody would type into Google to find this page — "3d character art outsourcing", not "art". Never published: it only drives the checks below.',
    validation: (Rule) =>
      Rule.max(60).warning('That reads more like a sentence than something anybody searches for.'),
  }),

  /**
   * The preview and the checks.
   *
   * A synthetic field: it stores nothing, and its input component reads the
   * whole document instead. `readOnly` keeps the form machinery from
   * expecting a value, and the empty title stops the Studio drawing a label
   * above a panel that is clearly its own thing.
   */
  defineField({
    name: 'seoPreview',
    title: 'Preview and checks',
    type: 'string',
    group: 'seo',
    readOnly: true,
    components: { input: SeoPanel },
  }),

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
  /**
   * The canonical override.
   *
   * Left blank — which is almost always right — the page is its own canonical.
   * Fill it in only when this page deliberately covers the same ground as
   * another and you want the OTHER one to collect the ranking: a campaign
   * landing page duplicating a service, say. Pointing a page at an unrelated
   * URL asks a search engine to drop it entirely.
   */
  defineField({
    name: 'canonicalUrl',
    title: 'Canonical URL',
    type: 'string',
    group: 'seo',
    description:
      'Leave blank unless this page duplicates another on purpose. Then put the URL of the one that should rank — a full https:// address, or a path on this site.',
    validation: (Rule) =>
      Rule.custom((v: string | undefined) =>
        !v || /^(\/|https?:\/\/)/.test(v)
          ? true
          : 'Use a path starting with / or a full http(s) URL.'
      ),
  }),
  defineField({
    name: 'ogImage',
    title: 'Sharing image',
    type: 'image',
    group: 'seo',
    options: { hotspot: true },
    description:
      'Shown when the link is pasted into WhatsApp, Slack or LinkedIn. Cropped to 1200x630, so set the hotspot on the part that must survive the crop. Leave blank to use this page’s own cover, or the studio default if it has none.',
  }),
  defineField({
    name: 'noindex',
    title: 'Hide from search engines',
    type: 'boolean',
    group: 'seo',
    description:
      'Asks Google to drop this page. It does NOT make it private — anyone with the link still opens it. On a job listing this also removes it from Google’s jobs results, which is usually where the applicants come from.',
    initialValue: false,
  }),
];
