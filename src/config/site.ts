/**
 * Homepage content. Everything here is meant to be edited by hand as the
 * studio grows — that is why it is data, not markup.
 *
 * HONESTY RULE: nothing in this file should claim something that is not
 * true yet. Empty arrays render nothing rather than placeholder filler,
 * because a visibly empty "trusted by" row is worse than no row at all.
 */

/* ------------------------------------------------------------------ */
/* Work — organised by craft discipline, the way an art director shops */
/* ------------------------------------------------------------------ */
export interface WorkCategory {
  title: string;
  href: string;
  blurb: string;
  /** Swap for a real import via astro:assets once art exists. */
  image?: string;
  /** Placeholder tint used until `image` is set. */
  tint: string;
  /** Set true to make the tile span two columns. */
  wide?: boolean;
}

export const workCategories: WorkCategory[] = [
  {
    title: 'Character Design',
    href: '/portfolio/character-design/',
    blurb: 'Concept through to production-ready rigs',
    tint: '210 70% 22%',
    wide: true,
  },
  {
    title: 'Environments & Props',
    href: '/portfolio/environments/',
    blurb: 'Worlds, set dressing and hero assets',
    tint: '150 45% 20%',
  },
  {
    title: 'Animation',
    href: '/portfolio/animation/',
    blurb: '2D and 3D performance, gameplay and cinematic',
    tint: '28 75% 26%',
  },
  {
    title: 'VFX',
    href: '/portfolio/vfx/',
    blurb: 'Simulation, compositing and finishing',
    tint: '280 50% 26%',
    wide: true,
  },
  {
    title: 'Concept & 2D Art',
    href: '/portfolio/concept-art/',
    blurb: 'Visual development, key art and storyboards',
    tint: '340 55% 24%',
  },
  {
    title: 'Motion Graphics',
    href: '/portfolio/motion-graphics/',
    blurb: 'Titles, explainers and broadcast design',
    tint: '195 60% 24%',
  },
];

/* ------------------------------------------------------------------ */
/* Process — what a new studio can prove when it has no back catalogue */
/* ------------------------------------------------------------------ */
export interface ProcessStep {
  title: string;
  body: string;
}

/** A real sequence, so these ARE numbered. */
export const processSteps: ProcessStep[] = [
  {
    title: 'Brief & scope',
    body: 'We read the brief, ask the awkward questions early, and come back with a shot count, a crew and a date we actually believe.',
  },
  {
    title: 'Look development',
    body: 'Style frames and a short test before full production, so the look is agreed while changing it is still cheap.',
  },
  {
    title: 'Production',
    body: 'Weekly playblasts and a shared review link. You see the work while it is still wet, not at the end.',
  },
  {
    title: 'Finishing & delivery',
    body: 'Comp, grade, sound sync and delivery in every format you need, with project files handed over on request.',
  },
];

/* ------------------------------------------------------------------ */
/* Marquee — the scrolling strip directly under the hero               */
/*                                                                     */
/* Craft specialisms, NOT the five services. The services grid further */
/* down already sells those; this says what is actually on the desks,  */
/* at the granularity an art director thinks in. Twelve is enough to   */
/* fill a wide screen twice over — fewer and the loop shows a gap.     */
/* ------------------------------------------------------------------ */
export const marqueeItems: string[] = [
  'Character Design',
  'Creature Design',
  'Environment Art',
  'Concept Art',
  'Storyboarding',
  '3D Modelling',
  'Rigging',
  'Cinematics',
  'Simulation & FX',
  'Compositing',
  'Motion Design',
  'UI / UX Art',
];

/* ------------------------------------------------------------------ */
/* Capabilities — the pipeline facts a first client actually asks about */
/* ------------------------------------------------------------------ */
export const capabilities: string[] = [
  'Maya',
  'Blender',
  'Houdini',
  'ZBrush',
  'Substance',
  'Unreal Engine',
  'Nuke',
  'After Effects',
  'Toon Boom Harmony',
  'Photoshop',
];

/* ------------------------------------------------------------------ */
/* Proof — deliberately empty until it is real                         */
/* ------------------------------------------------------------------ */
export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  company: string;
}

/** Add real ones as they arrive. The section hides itself while empty. */
export const testimonials: Testimonial[] = [];

export interface Client {
  name: string;
  logo?: string;
}

/** Same rule: an empty logo wall is worse than none. */
export const clients: Client[] = [];

/* ------------------------------------------------------------------ */
/* Blog and case studies                                               */
/*                                                                     */
/* Both are Markdown collections, not data here — see                   */
/* src/content.config.ts for their frontmatter schemas, and             */
/* src/lib/posts.ts / src/lib/caseStudies.ts for the read helpers.      */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Supabase — the one place visitor-submitted data lives               */
/* ------------------------------------------------------------------ */

/**
 * Enquiries, bookings and blog comments all land in one Supabase project,
 * so there is a single dashboard to check and a single export to take.
 *
 * SETUP
 *   1. Create a free project at https://supabase.com.
 *   2. SQL Editor -> New query -> paste ALL of `supabase/schema.sql` -> Run.
 *      That creates both tables AND the Row Level Security policies. Do not
 *      skip it: the policies are the only thing protecting the data.
 *   3. Project Settings -> API. Copy "Project URL" and the "anon public"
 *      key into the two constants below.
 *
 * THE ANON KEY IS PUBLIC. It ships inside the JavaScript bundle and anyone
 * can read it — that is how Supabase is designed. Security comes entirely
 * from the RLS policies, which let anon INSERT and nothing else (comments
 * can additionally read rows you have approved).
 *
 * NEVER put the `service_role` key here. It bypasses RLS completely, and
 * this file is compiled into a public website.
 *
 * While these are left as placeholders, the booking form and comment form
 * both refuse to submit and say so, rather than dropping data into a void.
 */
export const SUPABASE_URL = 'PASTE-YOUR-SUPABASE-PROJECT-URL';
export const SUPABASE_ANON_KEY = 'PASTE-YOUR-SUPABASE-ANON-PUBLIC-KEY';

/**
 * Comments are held for approval before they appear. Flip `approved` to true
 * in the Supabase Table Editor to publish one.
 *
 * This is the actual spam control. The honeypot and time-gate on the form are
 * speed bumps that stop naive bots; the moderation queue is what stops the
 * rest. Set this to false only if you are willing to have unreviewed text
 * appear on the site immediately — you would also have to loosen the RLS
 * policy in schema.sql, which is deliberately hard to do by accident.
 */
export const commentsEnabled = true;

/* ------------------------------------------------------------------ */
/* Booking — the multi-step "book a call" widget                       */
/* ------------------------------------------------------------------ */

/** Whose calendar this is. Shown in the left panel. */
export const bookingHost = {
  name: 'Manish Shankar Kumar',
  role: 'Founder, Aniwala Studios',
  /** Drop a square image in /public and set e.g. '/manish.jpg'. */
  photo: '',
};

/** Call lengths offered, in minutes. The middle one is the default. */
export const callDurations = [15, 30, 45];

/** Studio working hours, in studio-local time. */
export const workingHours = { start: '09:00', end: '18:00', stepMinutes: 30 };

/**
 * Studio offset from UTC in minutes. IST is +5:30 and observes no DST,
 * so a fixed offset is exact here — do NOT reuse this pattern for a
 * timezone with daylight saving.
 */
export const studioUtcOffsetMinutes = 330;
export const studioTimezone = 'Asia/Kolkata';

/** Weekday indexes the studio does not take calls. 0 = Sunday. */
export const closedDays = [0];

/** How far ahead someone may book. */
export const bookingWindowDays = 60;

/** The numbered list in the left panel — a real sequence. */
export const whatToExpect = [
  'Quick introductions',
  'Understanding your vision, goals and project scope',
  'Exploring creative direction, style and references',
  'Answering your questions and sharing insights',
];

/**
 * What the enquiry is about. Mirrors the six services in config/services.ts —
 * keep them in step, or someone picks a service off the dropdown that has no
 * page behind it.
 */
export const enquiryTypes = [
  '3D Art',
  '2D Art',
  'Animation',
  'VFX',
  'Integration',
  'Video Editing',
  'AI + Animation',
  'Not sure yet',
];
