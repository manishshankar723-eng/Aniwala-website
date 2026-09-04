/**
 * The parts of hiring that are NOT content.
 *
 * The values, the hiring steps, the FAQs, the careers inbox and the hiring
 * switch all moved to Sanity — see `getCareersContent()` in `lib/studio.ts`,
 * the `faq` documents filed against `careers`, and `contactDetails`. Pausing
 * hiring or rewording a step is now an edit rather than a deploy.
 *
 * What stays here is the shape of the application FORM and the mapping Google
 * needs. Those are not editorial: changing an experience band changes what the
 * form will accept, and `employmentTypeSchema` maps to the exact strings
 * Google's job index expects — a typo there quietly removes every listing from
 * search results, which is not a risk worth handing to an inline edit.
 */
import { DISCIPLINES, EMPLOYMENT_KINDS, type EmploymentKind } from './disciplines';

export type { EmploymentKind };

/**
 * The open-application dropdown.
 *
 * Derived from DISCIPLINES rather than retyped, so renaming a discipline
 * cannot leave the form offering one no role can belong to. "Something else"
 * is form-only on purpose: nobody is hired into it, but plenty of good people
 * arrive through it.
 */
export const disciplines: string[] = [...DISCIPLINES, 'Something else'];

/** Experience bands offered in the application form. */
export const experienceBands: string[] = [
  'Student / final year',
  'Less than 1 year',
  '1–3 years',
  '3–5 years',
  '5–8 years',
  '8+ years',
];

/** Notice period / availability, in the words people actually use. */
export const availabilityOptions: string[] = [
  'Immediately',
  'Within 2 weeks',
  '1 month notice',
  '2 months notice',
  '3 months notice',
  'Only open to contract work',
];

/**
 * schema.org employmentType constants, keyed by our human labels. Google's
 * job listings want the constant, not the prose.
 */
export const employmentTypeSchema: Record<EmploymentKind, string> = {
  'Full-time': 'FULL_TIME',
  'Part-time': 'PART_TIME',
  Contract: 'CONTRACTOR',
  Internship: 'INTERN',
};
