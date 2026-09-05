/**
 * The SEO panel — a Google preview and a set of checks, inside the Studio.
 *
 * WHAT IT IS FOR
 *
 * Every SEO field on this site is a text box whose effect you cannot see until
 * the page is live and somebody searches for it. This draws the result before
 * you publish: the blue title, the green URL, the grey paragraph, cut where
 * they get cut. Most of its value is that first line — the moment somebody
 * watches their 78-character title lose its last four words, they write a
 * different title.
 *
 * WHY IT STORES NOTHING
 *
 * This is a synthetic field. It reads the whole document through
 * `useFormValue([])` and writes nothing back, which is why its schema entry
 * has no meaningful type and why `onChange` is never called. Storing a
 * computed preview would mean a stale copy in the dataset the moment anybody
 * edited a title.
 *
 * THE ONE STORED FIELD is the focus keyphrase, which lives beside this in the
 * schema. It is never published — `<meta name="keywords">` has been ignored by
 * Google since 2009 — and exists purely so the checks have something to check
 * against. That is exactly what Yoast's focus keyphrase does too, and it
 * surprises people every time.
 *
 * NO SCORE, DELIBERATELY. There is no percentage and no traffic light. A
 * single number invites writing for the number, and the cheapest way to move
 * one is to repeat the keyphrase until a human would notice. The checks are
 * statements you can read and disagree with; several of them are routinely
 * worth ignoring.
 */
import { Badge, Box, Card, Flex, Stack, Text } from '@sanity/ui';
import { useFormValue } from 'sanity';
import {
  analyse,
  truncate,
  DESC_IDEAL,
  TITLE_IDEAL,
  type Check,
  type CheckTone,
} from './seoAnalysis';
import { pathFor, sectionFor } from '../resolve';

/* The live site. Only ever used to draw the grey URL line in the preview, so
   a wrong value here is cosmetic. */
const SITE = (process.env.SANITY_STUDIO_SITE_URL ?? 'https://aniwala.com').replace(/\/+$/, '');

const TONE_BADGE: Record<CheckTone, 'positive' | 'caution' | 'critical' | 'default'> = {
  good: 'positive',
  warn: 'caution',
  bad: 'critical',
  idle: 'default',
};

const TONE_LABEL: Record<CheckTone, string> = {
  good: 'OK',
  warn: 'Look',
  bad: 'Fix',
  idle: '—',
};

/** The document, loosely — this panel is shown on eight different types. */
type Doc = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * What the page will ACTUALLY say, after the fallbacks.
 *
 * The SEO fields are overrides: blank means "derive it from the content", and
 * a preview that showed the blank rather than the derived value would be
 * lying about the common case. So this mirrors the fallback chain the
 * templates use — which is the one thing here that has to be kept in step
 * with the website by hand.
 */
function resolved(doc: Doc) {
  const title = str(doc.seoTitle) || str(doc.title) || '';
  const description =
    str(doc.seoDescription) || str(doc.description) || str(doc.summary) || str(doc.intro) || str(doc.lead) || '';
  return { title, description };
}

function CheckRow({ check }: { check: Check }) {
  return (
    <Flex align="flex-start" gap={3}>
      <Box style={{ flexShrink: 0, minWidth: '3.2rem' }}>
        <Badge tone={TONE_BADGE[check.tone]} fontSize={0}>
          {TONE_LABEL[check.tone]}
        </Badge>
      </Box>
      <Text size={1} muted={check.tone === 'idle'}>
        {check.text}
      </Text>
    </Flex>
  );
}

/**
 * A length meter.
 *
 * The bar is the honest part and the number is the precise one, because
 * Google truncates by pixel width rather than by character count — a title of
 * Ws is cut far earlier than one of Is. Every SEO tool approximates this the
 * same way, and saying "about" in the label is the difference between guidance
 * and a rule somebody follows off a cliff.
 */
function Meter({ label, length, ideal }: { label: string; length: number; ideal: number }) {
  const ratio = Math.min(length / ideal, 1.35);
  const tone = length === 0 ? 'default' : length > ideal * 1.08 ? 'critical' : 'positive';
  const colour =
    tone === 'critical' ? 'var(--card-badge-critical-bg-color)' : 'var(--card-badge-positive-bg-color)';

  return (
    <Stack space={2}>
      <Flex justify="space-between">
        <Text size={0} muted>
          {label}
        </Text>
        <Text size={0} muted>
          {length} / about {ideal}
        </Text>
      </Flex>
      <Box
        style={{
          height: 4,
          borderRadius: 2,
          background: 'var(--card-border-color)',
          overflow: 'hidden',
        }}
      >
        <Box
          style={{
            height: '100%',
            width: `${Math.min(ratio / 1.35, 1) * 100}%`,
            background: colour,
            transition: 'width 120ms ease',
          }}
        />
      </Box>
    </Stack>
  );
}

export function SeoPanel() {
  /* The whole document. `[]` is the root path — this panel is attached to a
     field but is about everything around it. */
  const doc = (useFormValue([]) ?? {}) as Doc;

  const { title, description } = resolved(doc);
  const keyphrase = str(doc.focusKeyphrase);

  const slug = (doc.slug as { current?: string } | undefined)?.current;
  const path = pathFor(str(doc._type), slug);
  const section = sectionFor(str(doc._type));

  const hasImage = Boolean(doc.ogImage || doc.cover);

  const checks = analyse({ title, description, path: path ?? '', keyphrase, doc, hasImage });

  return (
    <Stack space={4}>
      {/* ---------- the result, as Google draws it ---------- */}
      <Card padding={4} radius={2} shadow={1} tone="transparent">
        <Stack space={3}>
          <Text size={0} muted weight="semibold">
            HOW THIS LOOKS IN GOOGLE
          </Text>

          <Stack space={2}>
            <Text size={0} style={{ color: '#5f6368' }}>
              {SITE.replace(/^https?:\/\//, '')}
              {path ? ` › ${path.replace(/^\/|\/$/g, '').split('/').join(' › ')}` : ''}
            </Text>

            <Text
              size={2}
              weight="regular"
              style={{ color: '#1a0dab', lineHeight: 1.3 }}
            >
              {title ? truncate(title, TITLE_IDEAL) : 'No title yet'}
            </Text>

            <Text size={1} style={{ color: '#4d5156', lineHeight: 1.5 }}>
              {description
                ? truncate(description, DESC_IDEAL)
                : 'No description yet — Google will write one from the page, and it will not be the one you would have chosen.'}
            </Text>
          </Stack>

          {!path && (
            <Text size={0} muted>
              {section
                ? 'This document has no slug yet, so there is no URL to show.'
                : 'This document has no page of its own.'}
            </Text>
          )}
        </Stack>
      </Card>

      {/* ---------- lengths ---------- */}
      <Card padding={4} radius={2} shadow={1}>
        <Stack space={4}>
          <Meter label="Title" length={title.length} ideal={TITLE_IDEAL} />
          <Meter label="Description" length={description.length} ideal={DESC_IDEAL} />
          <Text size={0} muted>
            Google cuts by the WIDTH of the text, not the number of characters, so these are
            approximate — a title full of Ws is cut sooner than one full of Is.
          </Text>
        </Stack>
      </Card>

      {/* ---------- the checks ---------- */}
      <Card padding={4} radius={2} shadow={1}>
        <Stack space={3}>
          <Text size={0} muted weight="semibold">
            CHECKS
          </Text>
          {checks.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
          <Text size={0} muted>
            No score on purpose. These are things worth looking at, not a target — several are
            routinely worth ignoring, and repeating a keyphrase to satisfy one is how a page ends
            up reading badly to the person you wrote it for.
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}

export default SeoPanel;
