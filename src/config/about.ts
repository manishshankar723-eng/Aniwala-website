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
/* Moved to Sanity                                                     */
/*                                                                     */
/* `positioning` and `teamIntro` are now fields on the `siteCopy`       */
/* singleton; the timeline is the `milestone` document type; the team   */
/* members are the `teamMember` type. Read them with `getSiteCopy()`,   */
/* `getMilestones()` (lib/studio.ts) and `getTeam()` (lib/team.ts).     */
/*                                                                     */
/* The empty-timeline rule survived the move and is now enforced by the */
/* page rather than by this file: the section hides itself when nothing */
/* is published. A history timeline is the single most tempting place   */
/* to pad a young studio, and no timeline is more honest than a padded  */
/* one.                                                                 */
/* ------------------------------------------------------------------ */

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

