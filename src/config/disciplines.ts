/**
 * Disciplines and employment kinds.
 *
 * Its own tiny module for the same reason `categories.ts` is one: both
 * `content.config.ts` (which validates role documents against these lists)
 * and the components that render the filter chips need them, and
 * `content.config.ts` is loaded by Astro in a special context. Importing the
 * whole of `careers.ts` there would work today and is not a contract.
 *
 * Roles now come from the CMS, so this list is what stops an editor typing a
 * near-duplicate. The filter chips on `/careers/` are derived from whatever
 * disciplines the live roles actually use, so a typo does not hide a role —
 * it splits one chip into two ("VFX" and "Vfx" side by side, each with one
 * job under it). Constraining the field to a dropdown keeps the filter row
 * meaning something. Adding a discipline is a code change, on purpose.
 */
export const DISCIPLINES = [
  '3D Art',
  '2D Art',
  'Animation',
  'VFX',
  'Engine / Technical Art',
  'Video Editing',
  'Production & Coordination',
  'Business Development',
  'Internship',
] as const;

export type Discipline = (typeof DISCIPLINES)[number];

/**
 * Employment kinds.
 *
 * These strings are not free text: `employmentTypeSchema` in `careers.ts`
 * maps each one to the value Google expects in `JobPosting.employmentType`.
 * A kind with no mapping emits nothing and the posting loses eligibility for
 * the jobs index, so the two lists must stay in step.
 */
export const EMPLOYMENT_KINDS = ['Full-time', 'Part-time', 'Contract', 'Internship'] as const;

export type EmploymentKind = (typeof EMPLOYMENT_KINDS)[number];
