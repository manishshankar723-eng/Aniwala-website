/**
 * The reasoning behind the SEO panel. No React in here on purpose.
 *
 * Every judgement the panel makes is a pure function of the document, which
 * means each one can be read, argued with and corrected without opening a
 * component. The component's job is to draw the answers.
 *
 * WHAT THIS IS NOT. It is not a score. Yoast's traffic light invites people to
 * write for the light rather than for a reader, and the most common way to get
 * it green is to say the keyphrase more times than a human would. So there is
 * no total, no percentage and no colour that means "good enough" — just a list
 * of specific, checkable statements, each of which you are free to ignore.
 *
 * THE KEYPHRASE IS NOT A META TAG. It is stored, and it never reaches the
 * page: `<meta name="keywords">` has been ignored by Google since 2009. It
 * exists only so the checks below have something to check against, which is
 * exactly what Yoast's focus keyphrase does too.
 */

/* ------------------------------------------------------------------ */
/* Limits                                                              */
/* ------------------------------------------------------------------ */

/**
 * Where Google cuts a title and a description.
 *
 * Google truncates by PIXEL WIDTH, not by character count — a title of Ws is
 * cut far earlier than one of Is. Counting characters is an approximation, and
 * it is the approximation every SEO tool uses because the exact width depends
 * on a font nobody outside Google has. Treated as guidance and labelled as
 * such, rather than presented as a rule.
 */
export const TITLE_IDEAL = 60;
export const TITLE_MAX = 70;
export const DESC_IDEAL = 155;
export const DESC_MAX = 165;

/* ------------------------------------------------------------------ */
/* Reading a document                                                  */
/* ------------------------------------------------------------------ */

/** Portable Text block, loosely — enough to pull words out of one. */
interface PtBlock {
  _type?: string;
  style?: string;
  children?: { text?: string }[];
}

const isPtArray = (v: unknown): v is PtBlock[] =>
  Array.isArray(v) && v.some((b) => b && typeof b === 'object' && (b as PtBlock)._type === 'block');

const blockText = (block: PtBlock) => (block.children ?? []).map((c) => c.text ?? '').join('');

/**
 * Keys whose values are never prose.
 *
 * Skipped when collecting the page's text, because otherwise a slug, a hex
 * colour or the SEO fields themselves count as "the page mentions the
 * keyphrase" — which would make the checks agree with you no matter what you
 * wrote in the body.
 */
const NOT_PROSE = new Set([
  'slug',
  'href',
  'url',
  'canonicalUrl',
  'tint',
  'themeColor',
  'themeColorLight',
  'backgroundColor',
  'seoTitle',
  'seoDescription',
  'focusKeyphrase',
  'ogImage',
]);

/**
 * Every word the document actually says, as one string.
 *
 * Walks the whole document rather than naming fields, because the eight types
 * this panel serves keep their prose in eight different shapes — a post has a
 * Portable Text `body`, a service has `intro` plus an array of offerings, a
 * role has three arrays of bullet points. Naming them all would be a list to
 * keep in step with every schema forever.
 */
export function documentText(doc: unknown, depth = 0): string {
  if (depth > 8 || doc == null) return '';

  if (typeof doc === 'string') return doc;
  if (isPtArray(doc)) return (doc as PtBlock[]).map(blockText).join('\n');
  if (Array.isArray(doc)) return doc.map((v) => documentText(v, depth + 1)).join('\n');

  if (typeof doc === 'object') {
    return Object.entries(doc as Record<string, unknown>)
      .filter(([key]) => !key.startsWith('_') && !NOT_PROSE.has(key))
      .map(([, value]) => documentText(value, depth + 1))
      .join('\n');
  }

  return '';
}

/** The first paragraph of a Portable Text body, or '' when there is none. */
export function firstParagraph(body: unknown): string {
  if (!isPtArray(body)) return '';
  const para = (body as PtBlock[]).find(
    (b) => b._type === 'block' && (!b.style || b.style === 'normal') && blockText(b).trim()
  );
  return para ? blockText(para) : '';
}

/** Every heading in a Portable Text body. */
export function headings(body: unknown): string[] {
  if (!isPtArray(body)) return [];
  return (body as PtBlock[])
    .filter((b) => b._type === 'block' && /^h[2-4]$/.test(b.style ?? ''))
    .map(blockText)
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/* ------------------------------------------------------------------ */

/**
 * Does `haystack` contain the phrase?
 *
 * Case- and punctuation-insensitive, and whitespace-normalised, so
 * "3D character art" matches "3D Character Art," and "3D  character
 * art". Not stemmed: matching "animate" against "animation" needs a stemmer
 * per language, and getting that subtly wrong is worse than being predictable.
 */
const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const contains = (haystack: string, phrase: string): boolean =>
  Boolean(phrase.trim()) && normalise(haystack).includes(normalise(phrase));

/** How many times the phrase appears. */
export function countOccurrences(haystack: string, phrase: string): number {
  const p = normalise(phrase);
  if (!p) return 0;
  const h = normalise(haystack);
  let count = 0;
  let at = h.indexOf(p);
  while (at !== -1) {
    count++;
    at = h.indexOf(p, at + p.length);
  }
  return count;
}

/* ------------------------------------------------------------------ */
/* The checks                                                          */
/* ------------------------------------------------------------------ */

export type CheckTone = 'good' | 'warn' | 'bad' | 'idle';

export interface Check {
  id: string;
  tone: CheckTone;
  text: string;
}

export interface AnalysisInput {
  /** What the search result will actually say, after any fallback. */
  title: string;
  description: string;
  /** The path this document publishes at, e.g. `/blog/pipeline-notes/`. */
  path: string;
  keyphrase: string;
  /** The whole document, for the body checks. */
  doc: Record<string, unknown>;
  /** Whether a sharing image or a usable cover exists. */
  hasImage: boolean;
}

/**
 * Length guidance for the two fields that get truncated.
 *
 * Empty is `bad` rather than `warn` on the description, and only on pages that
 * derive nothing — but this cannot tell which those are, so both read as a
 * prompt rather than an error. The build is what enforces required fields.
 */
function lengthChecks({ title, description }: AnalysisInput): Check[] {
  const out: Check[] = [];

  if (!title.trim()) {
    out.push({ id: 'title-empty', tone: 'warn', text: 'No title yet — the page will derive one.' });
  } else if (title.length > TITLE_MAX) {
    out.push({
      id: 'title-long',
      tone: 'bad',
      text: `Title is ${title.length} characters. Google shows roughly ${TITLE_IDEAL}, so the end will be cut.`,
    });
  } else if (title.length > TITLE_IDEAL) {
    out.push({
      id: 'title-longish',
      tone: 'warn',
      text: `Title is ${title.length} characters — a little over the ~${TITLE_IDEAL} Google usually shows.`,
    });
  } else if (title.length < 25) {
    out.push({
      id: 'title-short',
      tone: 'warn',
      text: `Title is only ${title.length} characters. There is room to say more.`,
    });
  } else {
    out.push({ id: 'title-ok', tone: 'good', text: `Title length is about right (${title.length}).` });
  }

  if (!description.trim()) {
    out.push({
      id: 'desc-empty',
      tone: 'warn',
      text: 'No description yet — the page will derive one, or Google will invent one from the body.',
    });
  } else if (description.length > DESC_MAX) {
    out.push({
      id: 'desc-long',
      tone: 'bad',
      text: `Description is ${description.length} characters. Google cuts around ${DESC_IDEAL}.`,
    });
  } else if (description.length < 70) {
    out.push({
      id: 'desc-short',
      tone: 'warn',
      text: `Description is only ${description.length} characters — short enough that Google may write its own instead.`,
    });
  } else {
    out.push({
      id: 'desc-ok',
      tone: 'good',
      text: `Description length is about right (${description.length}).`,
    });
  }

  return out;
}

/** Everything that depends on a keyphrase having been set. */
function keyphraseChecks(input: AnalysisInput): Check[] {
  const { title, description, path, keyphrase, doc } = input;

  if (!keyphrase.trim()) {
    return [
      {
        id: 'kp-none',
        tone: 'idle',
        text: 'Set a focus keyphrase to check the page against it. It is never published — it only drives these checks.',
      },
    ];
  }

  const body = (doc as { body?: unknown }).body;
  const text = documentText(doc);
  const intro = firstParagraph(body);
  const heads = headings(body);
  const uses = countOccurrences(text, keyphrase);

  const out: Check[] = [
    {
      id: 'kp-title',
      tone: contains(title, keyphrase) ? 'good' : 'bad',
      text: contains(title, keyphrase)
        ? 'The keyphrase is in the search-result title.'
        : 'The keyphrase is not in the search-result title — the single place it matters most.',
    },
    {
      id: 'kp-desc',
      tone: contains(description, keyphrase) ? 'good' : 'warn',
      text: contains(description, keyphrase)
        ? 'The keyphrase is in the description.'
        : 'The keyphrase is not in the description. Google bolds matches there, which earns the click.',
    },
    {
      id: 'kp-url',
      tone: contains(path, keyphrase) ? 'good' : 'warn',
      text: contains(path, keyphrase)
        ? 'The keyphrase is in the URL.'
        : 'The keyphrase is not in the URL. Worth fixing BEFORE publishing — changing a slug later breaks every link already shared.',
    },
  ];

  if (intro) {
    out.push({
      id: 'kp-intro',
      tone: contains(intro, keyphrase) ? 'good' : 'warn',
      text: contains(intro, keyphrase)
        ? 'The keyphrase appears in the first paragraph.'
        : 'The keyphrase is not in the first paragraph — where a reader decides whether this is the page they wanted.',
    });
  }

  if (heads.length) {
    const inHeading = heads.some((h) => contains(h, keyphrase));
    out.push({
      id: 'kp-heading',
      tone: inHeading ? 'good' : 'warn',
      text: inHeading
        ? 'The keyphrase appears in a heading.'
        : `The keyphrase is in none of the ${heads.length} headings.`,
    });
  }

  /*
   * Usage, deliberately not "density".
   *
   * A percentage invites tuning a number; a count invites reading the page.
   * The upper bound matters more than the lower one — the failure mode of
   * these tools is somebody padding a paragraph to make a meter go green,
   * which reads badly to a person and is what search engines penalise.
   */
  out.push({
    id: 'kp-uses',
    tone: uses === 0 ? 'bad' : uses > 12 ? 'warn' : 'good',
    text:
      uses === 0
        ? 'The keyphrase does not appear in the page text at all.'
        : uses > 12
          ? `The keyphrase appears ${uses} times. That is more often than anybody writes naturally — read it aloud.`
          : `The keyphrase appears ${uses} time${uses === 1 ? '' : 's'} in the page text.`,
  });

  return out;
}

export function analyse(input: AnalysisInput): Check[] {
  return [
    ...lengthChecks(input),
    ...keyphraseChecks(input),
    {
      id: 'image',
      tone: input.hasImage ? 'good' : 'warn',
      text: input.hasImage
        ? 'A sharing image is set, so a pasted link shows a card.'
        : 'No sharing image. A pasted link falls back to the studio’s default card.',
    },
  ];
}

/** Cut a string for the preview, the way a result list does. */
export const truncate = (s: string, max: number) =>
  s.length <= max ? s : `${s.slice(0, max).replace(/\s+\S*$/, '')}…`;
