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
/* Journal — three on the homepage, not ten                            */
/* ------------------------------------------------------------------ */
export interface Post {
  title: string;
  href: string;
  date: string;
  readingTime: string;
  excerpt: string;
  tag: string;
}

export const featuredPosts: Post[] = [];

/* ------------------------------------------------------------------ */
/* Booking — the multi-step "book a call" widget                       */
/* ------------------------------------------------------------------ */

/**
 * Web3Forms access key. Get a free one at https://web3forms.com — enter
 * the studio inbox and the key arrives by email. Paste it here.
 *
 * While this is left as the placeholder the widget refuses to submit and
 * says so, rather than silently posting enquiries into a void.
 */
export const WEB3FORMS_KEY = 'PASTE-YOUR-WEB3FORMS-ACCESS-KEY-HERE';

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

/** What the enquiry is about. */
export const enquiryTypes = [
  '2D Animation',
  '3D Animation',
  'VFX',
  'Game Art',
  'Motion Graphics',
  'AI + Animation',
  'Not sure yet',
];
