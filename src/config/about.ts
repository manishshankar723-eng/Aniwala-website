/**
 * The About page.
 *
 * HONESTY RULE (same as site.ts, services.ts and portfolio.ts, and it bites
 * hardest here): an about page is where studios reach for headcounts, years
 * in business and shipped-title counts. We do not have those yet, so nothing
 * in this file invents them.
 *
 * What goes here instead is the set of things a visitor can actually check:
 * how the work is run, what is handed over, and what we will tell you before
 * you have paid anything. Sections whose arrays are empty render nothing
 * rather than filler — an about page with a stubbed-out team grid reads worse
 * than one without a team grid.
 */

/* ------------------------------------------------------------------ */
/* The one-paragraph version                                           */
/* ------------------------------------------------------------------ */
export const positioning =
  'Aniwala is an animation and game art studio. We handle a brief from board to delivery: 2D, 3D, VFX, engine integration and the edit, all in one pipeline. Most of the time a project loses is spent in the gaps between vendors. There are fewer gaps here.';

/* ------------------------------------------------------------------ */
/* At a glance                                                         */
/*                                                                     */
/* Deliberately not a stat counter. Every row here is a fact about how  */
/* the studio is set up, not a number that grows to flatter us — a new  */
/* studio putting "0 years" or "1 client" on a big serif number is the  */
/* exact failure this section is shaped to avoid.                      */
/* ------------------------------------------------------------------ */
export interface Fact {
  label: string;
  value: string;
  /** One line of context under the value. Optional. */
  note?: string;
}

export const studioFacts: Fact[] = [
  {
    label: 'Disciplines',
    value: 'Six, one pipeline',
    note: '3D art, 2D art, animation, VFX, integration and the edit.',
  },
  {
    label: 'Work for',
    value: 'Games, film and brands',
    note: 'Asset batches, full sequences and co-development.',
  },
  {
    label: 'Engagement',
    value: 'Project, embedded or retained',
    note: 'Whichever suits the brief. We\'ll tell you which one we think it is.',
  },
  {
    label: 'First reply',
    value: 'Two working days',
    note: 'With an actual scope attached.',
  },
];

/* ------------------------------------------------------------------ */
/* What we hold to                                                     */
/*                                                                     */
/* Four, and they are commitments rather than adjectives. "Passionate   */
/* about quality" is not a principle; "we quote in shots, not days" is  */
/* a thing you can hold us to on the first call.                       */
/* ------------------------------------------------------------------ */
export interface Principle {
  title: string;
  body: string;
}

export const principles: Principle[] = [
  {
    title: 'We tell you if the date is impossible',
    body: 'Before anything else, including whether we want the job. Plenty of studios say yes to every deadline and sort it out later. That\'s how a project ends up with a rushed final fortnight and a compromise nobody agreed to.',
  },
  {
    title: 'We quote in shots, not days',
    body: 'A day rate tells you what we cost. It tells you nothing about how big the job is. So we scope in shots, assets and seconds. If the number comes back higher than your budget, you can see exactly which ten shots to cut and what that saves.',
  },
  {
    title: 'The look gets signed off early',
    body: 'Style frames and a short test before full production starts. Changing the look at animatic stage costs a conversation. Changing it in comp costs a renegotiation, and everyone on the job knows it, which is exactly why nobody wants to be the one to raise it.',
  },
  {
    title: 'You get the source files',
    body: 'Project files, scene files, source assets, on request. Some studios keep hold of them so you have to come back. We would rather you came back because the work was good.',
  },
];

/* ------------------------------------------------------------------ */
/* Working practices — what the week actually looks like               */
/*                                                                     */
/* Distinct from the four-step process on the homepage and the services */
/* page. That one is the shape of a job; this is what you experience    */
/* while one is running.                                                */
/* ------------------------------------------------------------------ */
export const practices: Principle[] = [
  {
    title: 'You see it every week',
    body: 'A playblast or a render on a shared review link, starting the first week. If something is going wrong you find out while it\'s still a week of work rather than a month.',
  },
  {
    title: 'You talk to the artist',
    body: 'The person you brief has the scene open in front of them. There is no account layer in the middle, so nothing gets lost being relayed twice.',
  },
  {
    title: 'Notes stay in one place',
    body: 'Timecoded, on the review link, not spread across three email threads. Every round is written down. That mostly matters six weeks later, when someone asks why a shot changed.',
  },
  {
    title: 'Handover is part of the job',
    body: 'Masters, cutdowns, engine-ready assets, and a readme covering budgets and naming conventions. We would rather spend the extra half day on it than have you email us in March asking what a file was called.',
  },
];

/* ------------------------------------------------------------------ */
/* Milestones                                                          */
/*                                                                     */
/* Empty on purpose. A history timeline is the single most tempting     */
/* place to pad a young studio, and a two-entry timeline is more honest */
/* than a padded twelve-entry one. Add a row when something genuinely   */
/* happened — first client shipped, a studio opened, a title released.  */
/* The section hides itself while this is empty.                        */
/* ------------------------------------------------------------------ */
export interface Milestone {
  /** '2026' or '2026 Q1'. Kept as a string so a quarter fits. */
  when: string;
  title: string;
  body: string;
}

export const milestones: Milestone[] = [];

/* ------------------------------------------------------------------ */
/* Team                                                                */
/*                                                                     */
/* The section a client scrolls to when they have decided the work is   */
/* good enough and now want to know who would actually be doing it.     */
/*                                                                     */
/* The MEMBERS moved to the CMS — see the `team` collection in          */
/* content.config.ts and the accessor in lib/team.ts. Hiring someone    */
/* should not require a developer, a commit and a deploy, and their     */
/* photo now gets CDN resizing and hotspot cropping instead of being    */
/* served from /public at whatever size it was exported at.             */
/*                                                                     */
/* The intro line below stayed here because it is not about any         */
/* particular person — it is a claim the studio makes about how it      */
/* works, and it belongs with the rest of the positioning copy.         */
/*                                                                     */
/* The draft rule survived the move intact: an unpublished member       */
/* renders under `astro dev` and is dropped from the production build,  */
/* so the layout can be judged with realistic content while it stays    */
/* impossible to publish a team page full of people who do not exist.   */
/* ------------------------------------------------------------------ */
export const teamIntro =
  'Small studio, so the person you brief is usually the person building it. Worth knowing who that would be before you hand over a budget.';
