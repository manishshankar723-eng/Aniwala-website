/**
 * Careers — the parts that are NOT the job listings.
 *
 * The open roles used to live here as a hand-edited array. They moved to the
 * CMS (Sanity) so that posting a job does not require a developer, and they
 * are read through `lib/roles.ts` — see `content.config.ts` for the schema
 * that validates them on every build.
 *
 * WHAT STAYED HERE, AND WHY
 * Everything below describes how the studio hires rather than what it is
 * hiring for: the values, the hiring steps, the FAQs, the employment-type
 * mapping. It changes roughly never, some of it is load bearing for search
 * engines, and none of it is something a person posting a job should be able
 * to change by accident. Content that changes weekly belongs in the CMS;
 * structure that changes yearly belongs in code.
 *
 * HONESTY RULE (same as site.ts and services.ts): nothing here may claim
 * something that is not true yet. Do not list a benefit the studio does not
 * actually provide and do not invent a headcount. The equivalent rule for a
 * listing — do not post a role you are not ready to interview for this month,
 * and close a filled one by unpublishing it — now lives in the Studio schema,
 * where the person writing the listing will actually read it.
 */
import { DISCIPLINES, type EmploymentKind } from './disciplines';

export type { EmploymentKind };


/* ------------------------------------------------------------------ */
/* Open application                                                    */
/*                                                                     */
/* What somebody can register interest in when nothing listed fits.    */
/* Wider than the six services on purpose: a studio is not only its    */
/* artists, and the production and business seats are the ones people  */
/* never think to ask about.                                           */
/* ------------------------------------------------------------------ */
/**
 * The open-application dropdown.
 *
 * Derived from DISCIPLINES rather than retyped, so renaming a discipline
 * cannot leave the form offering one no role can belong to. "Something else"
 * is form-only on purpose: nobody is hired into it, but plenty of good people
 * arrive through it.
 */
export const disciplines: string[] = [...DISCIPLINES, 'Something else'];

/* ------------------------------------------------------------------ */
/* Why the seat is worth taking                                        */
/*                                                                     */
/* Written as facts about how the studio runs, not as perks. A new      */
/* studio cannot out-bid a large one on salary, and pretending          */
/* otherwise only wastes a first round. What it can offer is scope and  */
/* proximity, so that is what this says.                                */
/* ------------------------------------------------------------------ */
export interface Value {
  title: string;
  body: string;
}

export const values: Value[] = [
  {
    title: 'You see the whole shot',
    body: 'Small studio, whole pipeline. You follow your asset from board to delivery instead of throwing it over a wall to a department you have never met.',
  },
  {
    title: 'Reviews are weekly and open',
    body: 'Work goes up while it is still rough, in front of everyone, with the client watching the same playblast. Nobody polishes in private for three weeks and finds out on a Friday.',
  },
  {
    title: 'Credited by name',
    body: 'Your name goes on the work, on the case study and on the reel. Outsourcing studios routinely swallow credit. We do not.',
  },
  {
    title: 'Hours that end',
    body: 'We quote in shots, not in days, precisely so a bad estimate is not paid for with your weekend. Crunch means we scoped it wrong — that is a producer problem, and it gets fixed there.',
  },
  {
    title: 'Software the industry actually uses',
    body: 'Licensed Maya, ZBrush, Houdini, Substance and Adobe on studio machines. Time to learn the one you do not know yet is scheduled, not squeezed in.',
  },
  {
    title: 'A straight answer',
    body: 'On the offer, on the review, and on whether an internship turns into a seat. You will not have to read between the lines here.',
  },
];

/* ------------------------------------------------------------------ */
/* Hiring process — a real sequence, so it renders numbered            */
/* ------------------------------------------------------------------ */
export interface HiringStep {
  title: string;
  body: string;
  /** Rough elapsed time for this step. Sets the expectation up front. */
  when: string;
}

export const hiringSteps: HiringStep[] = [
  {
    title: 'You send the work',
    when: 'Day 0',
    body: 'The form on this page, or an email. A link to a reel or a portfolio is the only thing we genuinely need — the rest is context.',
  },
  {
    title: 'We watch it, and reply',
    when: 'Within 5 working days',
    body: 'Somebody who does the job reviews it — not a recruiter, not a keyword filter. You get an answer either way, including a no. Silence is not something we do.',
  },
  {
    title: 'A conversation',
    when: 'Week 1–2',
    body: 'Forty-five minutes, on a call or at the studio. We walk through two pieces from your portfolio and ask what you would change. Bring questions — the ones you ask tell us as much as the answers.',
  },
  {
    title: 'A short exercise',
    when: 'Week 2',
    body: 'Paid, scoped to under a day, and never anything that ships. It is a design or animation problem with a deliberate ambiguity in it, and we are reading how you handle the ambiguity.',
  },
  {
    title: 'Offer and start date',
    when: 'Week 3',
    body: 'Numbers in writing, with the review cycle and what changes it spelled out. You get a week to decide, and we will not pressure you inside it.',
  },
];

/* ------------------------------------------------------------------ */
/* FAQs                                                                */
/*                                                                     */
/* Shaped to the same `Faq` interface the service pages use, so the    */
/* existing Faq component renders these without a second variant.      */
/* ------------------------------------------------------------------ */
export interface CareerFaq {
  q: string;
  a: string;
}

export const careerFaqs: CareerFaq[] = [
  {
    q: 'Nothing listed matches me. Is it worth applying?',
    a: 'Yes — that is exactly what the open application on this page is for. We read every one and keep them on file for twelve months. A seat here opens because a project lands, not because a plan said it should, so the list above is always slightly behind where the studio is going.',
  },
  {
    q: 'Do you hire remote?',
    a: 'For contract work, yes. For full-time seats, not yet — the studio is small enough that the review culture depends on being in the room, and we would rather say so than hire somebody into a compromise. If that changes, the listing will say so.',
  },
  {
    q: 'What should I send if my portfolio is a Drive folder?',
    a: 'A link is fine. ArtStation, Vimeo, a personal site, a Drive folder or a PDF — whatever you already keep current. Please check the sharing permission before you send it: a link we cannot open is the most common reason a good application stalls.',
  },
  {
    q: 'Is the test unpaid?',
    a: 'No. Every exercise past the first conversation is paid at a day rate, scoped to under a day, and thrown away afterwards. Nothing you make during a hiring process here ends up in a deliverable.',
  },
  {
    q: 'How long until I hear back?',
    a: 'Five working days for the first reply. If we go quiet past that, chase us at the careers address — it will be an oversight, not a signal.',
  },
  {
    q: 'Do you take students or freshers?',
    a: 'Mainly through the internship. It is paid, it runs six months on live projects, and it is the route most of our junior seats come from. Apply to it directly rather than to a mid-level listing.',
  },
  {
    q: 'Will you sponsor a relocation?',
    a: 'We do not have a relocation package. We will be straightforward about what the role pays so you can work out whether the move makes sense, and we will point you at the parts of Pune people usually land in.',
  },
];

/* ------------------------------------------------------------------ */
/* Form vocabulary                                                     */
/* ------------------------------------------------------------------ */

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
 * Where applications are read. Deliberately separate from the general studio
 * inbox in config/contact.ts — a CV filed in among the client briefs is a CV
 * that gets missed.
 *
 * Point this at a real mailbox before the page goes live, or set it to the
 * studio address.
 */
export const careersEmail = 'careers@aniwala.com';

/**
 * Master switch. Set false while hiring is frozen: the listings and the
 * application form both come down and the page says why, which is kinder
 * than leaving up a form that quietly goes nowhere.
 */
export const hiringOpen = true;

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
