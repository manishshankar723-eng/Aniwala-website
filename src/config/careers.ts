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
import { DISCIPLINES, EMPLOYMENT_KINDS, type EmploymentKind, type SalaryUnit } from './disciplines';

export type { EmploymentKind };

/**
 * The open-application dropdown.
 *
 * Derived from DISCIPLINES rather than retyped, so renaming a discipline
 * cannot leave the form offering one no role can belong to. "Something else"
 * is form-only on purpose: nobody is hired into it, but plenty of good people
 * arrive through it.
 */
/*
 * The form's three dropdown lists moved to Sanity, onto `careersContent`
 * beside the rest of the application form's wording.
 *
 * All except the disciplines, which are still `DISCIPLINES` in
 * `config/disciplines.ts` and are read straight from there by the form. That
 * list validates every role document as well as filling the dropdown, so a
 * discipline removed in a CMS field would leave live listings filed under a
 * value that no longer exists — the same reason blog categories stay in code.
 * Only the "none of these" option at the end of it is copy.
 */
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

/** A role's pay, as validated in `content.config.ts`. */
export interface Salary {
  min: number;
  max?: number;
  currency: string;
  unit: SalaryUnit;
}

/**
 * "₹25,000 – ₹40,000", in the Indian digit grouping (₹6,00,000, not 600,000)
 * because that is how an applicant here reads a CTC. The unit is left to the
 * caller: the role page words it from the CMS, the chatbot in plain English.
 */
export const formatSalaryAmount = ({ min, max, currency }: Salary): string => {
  const money = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });
  return max && max !== min ? `${money.format(min)} – ${money.format(max)}` : money.format(min);
};

/**
 * `JobPosting.baseSalary`. A range when there is one, a single `value` when
 * the pay is fixed — Google accepts either, and a range of X to X says less.
 */
export const baseSalarySchema = (s: Salary) => ({
  '@type': 'MonetaryAmount',
  currency: s.currency,
  value: {
    '@type': 'QuantitativeValue',
    ...(s.max && s.max !== s.min ? { minValue: s.min, maxValue: s.max } : { value: s.min }),
    unitText: s.unit,
  },
});
