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
/* DRAFT MEMBERS: the entries below are marked `draft: true`, which     */
/* means they render under `astro dev` and are dropped from the         */
/* production build — the same rule case study drafts follow in         */
/* lib/caseStudies.ts. That is deliberate. It lets the layout be judged */
/* with realistic content while making it impossible to accidentally    */
/* publish a team page full of people who do not exist.                 */
/*                                                                     */
/* To go live: replace a card\'s name, role and bio with a real person,  */
/* drop a photo into /public/team/, and delete its `draft` line.        */
/* ------------------------------------------------------------------ */
export const teamIntro =
  'Small studio, so the person you brief is usually the person building it. Worth knowing who that would be before you hand over a budget.';

export interface Member {
  name: string;
  /**
   * Their discipline, and what they own. The reference studios run two
   * clauses split by a pipe — "Creative Director | External Game Art" — and
   * it reads well, so the separator is written into the string rather than
   * imposed by the component.
   */
  role: string;
  /** Two or three sentences. What they actually do here, not adjectives. */
  bio: string;
  /** Path in /public, e.g. '/team/asha.jpg'. Falls back to initials. */
  photo?: string;
  /** ArtStation, LinkedIn, a reel — wherever their work lives. */
  href?: string;
  /**
   * Visible under `astro dev`, dropped from the production build. Every
   * placeholder below carries it. Remove it once the card is a real person.
   */
  draft?: boolean;
}

export const team: Member[] = [
  {
    name: 'Creative Director',
    role: 'Placeholder card | replace in config/about.ts',
    bio: 'Name, then what they own and where they came from. Two or three sentences is the right length — enough for a producer to place them, short enough that six of these still scan as a grid.',
    draft: true,
  },
  {
    name: 'Art Director',
    role: 'Placeholder card | replace in config/about.ts',
    bio: 'Name the shipped work if there is any, and the disciplines they cover. Concrete titles and studios beat adjectives: "12 years across mobile and console" tells a client more than "passionate about quality".',
    draft: true,
  },
  {
    name: 'Lead Animator',
    role: 'Placeholder card | replace in config/about.ts',
    bio: 'What they specialise in — performance, gameplay, cinematic — and which pipeline they run it through. This is the card an animation client reads first.',
    draft: true,
  },
  {
    name: 'Lead 3D Artist',
    role: 'Placeholder card | replace in config/about.ts',
    bio: 'Characters or environments, and the technical side they own: topology, budgets, texel density, engine handoff. Say which engines they have actually shipped into.',
    draft: true,
  },
  {
    name: 'FX Supervisor',
    role: 'Placeholder card | replace in config/about.ts',
    bio: 'Simulation, comp and finishing. Worth naming the packages here — a VFX client is checking for Houdini and Nuke before they read anything else on the page.',
    draft: true,
  },
  {
    name: 'Production Manager',
    role: 'Placeholder card | replace in config/about.ts',
    bio: 'Scheduling, budgets and the review cadence. The person who makes the weekly playblast actually happen, which is the promise the rest of this page keeps making.',
    draft: true,
  },
];

/**
 * The team as the site should show it.
 *
 * Drafts stay visible under `astro dev` so the layout can be worked on, and
 * are dropped from the production build. If every member is a draft, the
 * live site renders no team section at all rather than an empty grid.
 */
export const publishedTeam = (): Member[] =>
  team.filter((m) => (import.meta.env.DEV ? true : !m.draft));
