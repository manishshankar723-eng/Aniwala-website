/**
 * Careers.
 *
 * One record per opening. `/careers/` lists them and `/careers/[slug].astro`
 * builds a full page from each, so hiring for a new seat is a matter of adding
 * an object to `openRoles` — no markup to touch, no second place to update.
 *
 * Closing a role means DELETING its object, not leaving it up with a note. A
 * listing still live three months after it was filled is the fastest way to
 * lose the next good applicant, and applicants talk.
 *
 * HONESTY RULE (same as site.ts and services.ts): nothing here may claim
 * something that is not true yet. Do not list a benefit the studio does not
 * actually provide, do not invent a headcount, and do not post a role you are
 * not ready to interview for this month. If there is nothing open, empty the
 * array — the page handles that state deliberately and pushes people to the
 * open application instead, which is a better outcome than a fake listing.
 */

export type EmploymentKind = 'Full-time' | 'Part-time' | 'Contract' | 'Internship';

export interface Role {
  /** URL segment. `/careers/{slug}/` */
  slug: string;
  /** The job title as it would appear on a contract. */
  title: string;
  /**
   * Which discipline it sits under. Should match a label in `disciplines`
   * below, so the filter chips and the open-application dropdown agree.
   */
  discipline: string;
  kind: EmploymentKind;
  /** Human-readable. Say "on-site" or "remote" plainly — people filter on it. */
  location: string;
  /** A band, not a number. "2–5 years" is honest; "3 years" is a lie by precision. */
  experience: string;
  /** How many seats. Rendered as "2 openings" — set 1 for a single seat. */
  openings: number;
  /**
   * ISO date the listing went up. Shown on the page AND emitted as
   * `datePosted` in the JobPosting structured data, which is what puts the
   * role into Google's job results.
   *
   * KEEP THIS CURRENT. A posting dated eight months ago reads as abandoned,
   * and Google drops stale postings from the jobs index on its own.
   */
  posted: string;
  /** Optional ISO date the listing expires. Emitted as `validThrough`. */
  closes?: string;
  /** HSL triple driving the page tint, same as the service pages. */
  tint: string;
  /** One line under the title, in listings and cards. */
  summary: string;
  /** Two or three sentences of real context: the work, not the adjectives. */
  about: string;
  /** What the person actually does, day to day. */
  responsibilities: string[];
  /** The floor. If someone missing one of these should still apply, say so. */
  requirements: string[];
  /** Genuinely optional. Never park a real requirement here. */
  niceToHave?: string[];
  /** Software they will be in every day. */
  software: string[];
  /**
   * What to put in the portfolio for THIS role.
   *
   * The single most useful line on a creative job ad and the one almost
   * nobody writes. An animator and a character artist are judged on entirely
   * different things, and saying which saves everyone a round.
   */
  reelNote: string;
}

/* ------------------------------------------------------------------ */
/* Open roles                                                          */
/* ------------------------------------------------------------------ */
export const openRoles: Role[] = [
  {
    slug: '3d-character-artist',
    title: '3D Character Artist',
    discipline: '3D Art',
    kind: 'Full-time',
    location: 'Wakad, Pune — on-site',
    experience: '2–5 years',
    openings: 2,
    posted: '2026-08-11',
    tint: '265 60% 28%',
    summary: 'Sculpt, retopo and texture characters and creatures for games and cinematics.',
    about:
      'You would own characters end to end — block-out through to a textured, game-ready or render-ready asset. Most of the work is stylised rather than photoreal, and most of it ships into an engine, so the polycount conversation happens at the start instead of at the end.',
    responsibilities: [
      'Take a character from concept sheet to final asset: sculpt, retopologise, UV, bake and texture.',
      'Hold the silhouette and the style through the technical passes — clean topology that no longer looks like the concept is a failed asset.',
      'Work to a budget: agreed polycount, texel density and material count, set before you start.',
      'Hand off to rigging with clean naming, sensible groups and a turntable.',
      'Take notes in the weekly review and turn them around without needing the brief re-explained.',
    ],
    requirements: [
      'A portfolio with at least three finished characters, showing wireframes and texture flats — not only beauty renders.',
      'Fluent in ZBrush, and in one of Maya or Blender.',
      'Substance Painter, and a working understanding of PBR: what roughness actually does, why your metal reads as plastic.',
      'Anatomy that holds up when the model is turned. We will rotate it in the interview.',
      'Enough English to argue about a note in a review. Written and spoken.',
    ],
    niceToHave: [
      'Marvelous Designer for cloth.',
      'Hair cards, or grooming in XGen or Ornatrix.',
      'A character shipped into Unreal, LOD set included.',
    ],
    software: ['ZBrush', 'Maya', 'Blender', 'Substance Painter', 'Marmoset', 'Unreal Engine'],
    reelNote:
      'Show wireframes and UV layouts beside the renders, and say which parts of each piece were yours. One character taken all the way through tells us more than nine sculpts.',
  },
  {
    slug: 'concept-artist',
    title: 'Concept Artist (2D)',
    discipline: '2D Art',
    kind: 'Full-time',
    location: 'Wakad, Pune — on-site',
    experience: '3+ years',
    openings: 1,
    posted: '2026-08-04',
    tint: '190 65% 24%',
    summary: 'Characters, environments and key art the 3D floor can actually build from.',
    about:
      'This is production concept, not personal illustration. The measure of the work is whether a modeller can build from it without a phone call — orthographics that line up, callouts for the parts a hero angle hides, and a value structure that survives being turned into geometry.',
    responsibilities: [
      'Take a brief to thumbnails, thumbnails to a chosen direction, and that direction to a paint-over the floor can build from.',
      'Produce turnarounds, callouts and material reference, not just the hero angle.',
      'Build and keep a project’s reference boards so the look holds across artists.',
      'Style frames for look-dev, and key art for the client-facing side of a pitch.',
      'Take direction in the open, in review, without defending the first idea.',
    ],
    requirements: [
      'A portfolio that shows process — thumbnails and iterations, not only finished frames.',
      'Photoshop, and drawing that holds up: perspective, form, and a value read at thumbnail size.',
      'Design that answers a brief rather than a personal preference. We will give you one in the second round.',
      'Three years or more of work somebody else commissioned.',
    ],
    niceToHave: [
      'Blender, or any 3D package used for block-outs and perspective.',
      'Storyboarding.',
      'A stylistic range wider than the one look you are known for.',
    ],
    software: ['Photoshop', 'Procreate', 'Blender', 'Figma'],
    reelNote:
      'We want the messy middle. Ten thumbnails and the reasoning behind the one you took forward beat a gallery of finished pieces with no visible thinking.',
  },
  {
    slug: '3d-animator',
    title: '3D Animator',
    discipline: 'Animation',
    kind: 'Full-time',
    location: 'Wakad, Pune — on-site',
    experience: '1–4 years',
    openings: 2,
    posted: '2026-08-18',
    tint: '28 75% 26%',
    summary: 'Character performance and gameplay animation, for cinematics and in-engine work.',
    about:
      'Split roughly between cinematic shot work and gameplay cycles, and which half you get depends on where you are strongest. Both go through the same weekly playblast review with the client watching, so the work is seen while it is still rough.',
    responsibilities: [
      'Block, spline and polish shots against a boarded sequence and a fixed shot length.',
      'Build gameplay sets — locomotion, attacks, transitions — that loop cleanly and hit their frame budgets.',
      'Work on rigs you did not build, and report what is broken instead of animating around it.',
      'Post a playblast every week, whatever state it is in.',
      'Hand over scenes named and organised well enough that someone else could pick up the shot.',
    ],
    requirements: [
      'A reel under two minutes, cut to the work, with a breakdown of what was yours.',
      'Maya, with graph editor fluency — if you only animate on the timeline, this is not the seat.',
      'The fundamentals visible in the work: weight, timing, arcs, anticipation. We will name the one that is missing.',
      'A year or more on work that shipped or was delivered to a client. Strong student reels are read.',
    ],
    niceToHave: [
      'Unreal Sequencer, or gameplay animation set up inside an engine.',
      'Motion capture cleanup.',
      'An acting or life-drawing background.',
    ],
    software: ['Maya', 'Unreal Engine', 'Blender', 'After Effects'],
    reelNote:
      'Cut it short and lead with your best shot — we watch the first fifteen seconds properly and the rest in context. Put the playblast next to the final if the polish pass is the part you are proud of.',
  },
  {
    slug: 'fx-compositing-artist',
    title: 'FX & Compositing Artist',
    discipline: 'VFX',
    kind: 'Contract',
    location: 'Remote, or Wakad, Pune — project-based',
    experience: '3+ years',
    openings: 1,
    posted: '2026-07-29',
    tint: '340 60% 28%',
    summary: 'Simulation, comp and finishing on a per-project contract, renewed by project.',
    about:
      'A contract seat, labelled honestly: engaged per project, with a scope and an end date agreed in writing before you start. It suits somebody who already has their own thing running and wants a defined block of work rather than a desk.',
    responsibilities: [
      'Build FX — smoke, fire, destruction, particles — to a look agreed at style-frame stage.',
      'Comp the render layers, hold the grade, and deliver in the formats the client actually needs.',
      'Keep sim caches and Nuke scripts organised enough that a revision three weeks later is an hour, not a day.',
      'Flag when a note would cost a re-sim, rather than absorbing it silently.',
    ],
    requirements: [
      'A reel of your own FX work, with the setup described.',
      'Houdini, and Nuke or After Effects for the comp side.',
      'Experience taking a shot from sim to final delivery without a supervisor in the middle.',
      'A working invoice setup — this is a contract, and we pay against invoices on 30-day terms.',
    ],
    niceToHave: [
      'Niagara, or in-engine FX for real-time delivery.',
      'A colour-managed pipeline you have actually run, ACES or otherwise.',
    ],
    software: ['Houdini', 'Nuke', 'After Effects', 'Unreal Engine', 'DaVinci Resolve'],
    reelNote:
      'Say what was simulated and what was stock, and name the software per shot. Owning up to a stock element costs nothing; being caught costs the job.',
  },
  {
    slug: 'video-editor',
    title: 'Video Editor',
    discipline: 'Video Editing',
    kind: 'Full-time',
    location: 'Wakad, Pune — on-site',
    experience: '2+ years',
    openings: 1,
    posted: '2026-08-11',
    tint: '150 55% 22%',
    summary: 'Trailers, cutdowns, titles and grade — and the studio reel that sells the studio.',
    about:
      'Half client work — trailers, cutdowns, social versions — and half our own: the studio reel, case study films, and the breakdown videos that go on the blog. The second half matters more than it looks, because it is what brings the first half in.',
    responsibilities: [
      'Cut trailers and promos from supplied footage and rendered animation, to a brief and a runtime.',
      'Produce the whole format set — 16:9, vertical, square — without letting the vertical cut become an afterthought.',
      'Titles and motion graphics in After Effects, on the studio type and colour.',
      'Grade and sound sync, and export to whatever spec the platform demands.',
      'Keep the project files and the media in an order somebody else can open.',
    ],
    requirements: [
      'A showreel, and at least two full pieces we can watch end to end.',
      'Premiere Pro or DaVinci Resolve, and After Effects.',
      'A sense of pace that survives the runtime being cut in half. We will ask you to do exactly that.',
      'Two years or more of commissioned work.',
    ],
    niceToHave: [
      'Sound design beyond dropping in a music bed.',
      'Colour grading as a discipline rather than a LUT.',
      'Some 3D — even just enough to open a scene and pull a camera.',
    ],
    software: ['Premiere Pro', 'DaVinci Resolve', 'After Effects', 'Audition'],
    reelNote:
      'Link two complete pieces as well as the reel. A reel proves you can cut a montage; a full piece proves you can hold structure for ninety seconds.',
  },
  {
    slug: 'art-intern',
    title: 'Art Intern — 2D or 3D',
    discipline: 'Internship',
    kind: 'Internship',
    location: 'Wakad, Pune — on-site',
    experience: 'Final year or recent graduate',
    openings: 4,
    posted: '2026-08-20',
    closes: '2026-10-15',
    tint: '210 70% 22%',
    summary: 'Six months, paid, on real production — with a real chance of a seat at the end.',
    about:
      'A six-month paid internship on live projects, not a shadowing exercise. You get small pieces of real shots with real deadlines and a mentor who reviews your work weekly. We hire from this pool first when a junior seat opens, and we will tell you honestly at month four whether that is likely.',
    responsibilities: [
      'Production support on live projects: props, set dressing, cleanup passes, secondary animation.',
      'Your own small piece of a shot each sprint, reviewed alongside everybody else’s.',
      'Reference gathering, asset naming, and the unglamorous library work that keeps a pipeline usable.',
      'Show your work in the weekly review from week one. Everyone does.',
    ],
    requirements: [
      'A student portfolio. Rough is fine — we are reading for potential and taste, not polish.',
      'One package you are comfortable in: Blender, Maya, ZBrush or Photoshop.',
      'Available on-site in Pune for the full six months.',
      'You can take a note without going quiet for a day.',
    ],
    software: ['Blender', 'Maya', 'ZBrush', 'Photoshop'],
    reelNote:
      'Personal work counts here, and so do studies. Show the piece you learned the most from, and tell us what you would do differently now.',
  },
];

/* ------------------------------------------------------------------ */
/* Open application                                                    */
/*                                                                     */
/* What somebody can register interest in when nothing listed fits.    */
/* Wider than the six services on purpose: a studio is not only its    */
/* artists, and the production and business seats are the ones people  */
/* never think to ask about.                                           */
/* ------------------------------------------------------------------ */
export const disciplines: string[] = [
  '3D Art',
  '2D Art',
  'Animation',
  'VFX',
  'Engine / Technical Art',
  'Video Editing',
  'Production & Coordination',
  'Business Development',
  'Internship',
  'Something else',
];

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

/** Lookup used by the detail route. */
export const roleBySlug = (slug: string): Role | undefined =>
  openRoles.find((r) => r.slug === slug);

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
