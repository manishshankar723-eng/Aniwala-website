/**
 * Service pages. One record per discipline; `/services/[slug].astro` builds a
 * page from each, so adding a service is a matter of adding an object here.
 *
 * The slugs must match the hrefs in `nav.ts` — that file is what the header
 * links to, this file is what actually renders. They are also referenced by
 * the `services:` array in case study frontmatter, so renaming a slug means
 * grepping `src/content/case-studies/` too.
 *
 * HONESTY RULE (same as site.ts): nothing here may claim something that is not
 * true yet. Describe how the work is done and what is handed over. Do NOT
 * invent client names, shipped titles, headcounts or years of experience.
 */

export interface Offering {
  title: string;
  body: string;
}

export interface PipelineStep {
  title: string;
  body: string;
  /** Software actually touched at this stage. Shown as small print. */
  tools?: string;
}

export interface Faq {
  q: string;
  a: string;
}

export interface Service {
  /** URL segment. `/services/{slug}/` */
  slug: string;
  /** Short name — used in nav, cards and cross-links. */
  label: string;
  /**
   * The service's name as it appears mid-sentence ("a VFX brief", "a 3D art
   * job"). Written out rather than lower-cased from `label`, because
   * toLowerCase() turns VFX into "vfx" and 3D into "3d".
   */
  shortName: string;
  /**
   * The indefinite article that belongs in front of `shortName`.
   *
   * Stored rather than derived, because the rule is about the spoken sound and
   * not the first letter: "a VFX brief" (vee-eff-ex) and "a 3D art brief"
   * (three-dee) both start with consonant sounds despite V and 3, while
   * "an integration brief" needs the other one.
   */
  article: 'a' | 'an';
  /** <title> and <h1>. May differ from `label` when the full name is longer. */
  title: string;
  /** One line under the h1. */
  tagline: string;
  /** Two or three sentences of real positioning. */
  intro: string;
  /** HSL triple driving the page's placeholder art. */
  tint: string;
  /** The work itself, broken into the pieces a client actually orders. */
  offerings: Offering[];
  /** The route a job takes through the studio. A real sequence — numbered. */
  pipeline: PipelineStep[];
  /** Software. Order is roughly pipeline order, not preference. */
  tools: string[];
  /** What lands in the client's folder at the end. */
  deliverables: string[];
  /** Answers to what people ask before they commission. */
  faqs: Faq[];
  /** Slugs of the two or three services that pair with this one. */
  related: string[];
}

/* ------------------------------------------------------------------ */
/* Shared answers.                                                     */
/* Some questions have the same answer whichever discipline you are on. */
/* Keeping them in one place stops the six pages drifting apart.        */
/* ------------------------------------------------------------------ */
const commonFaqs: Faq[] = [
  {
    q: 'How do we start?',
    a: 'Send the brief, or just the problem — a script, a deck, a level, a rough idea and a date. We come back within two working days with a shot or asset count, a crew, a price and a schedule. If the date is not achievable we say so then, not in week six.',
  },
  {
    q: 'Can you match an existing style?',
    a: 'Yes, and it is most of what studio work is. Send the style guide, the shipped assets, or even a screenshot. We produce one paid test piece first so you can judge the match on your own asset before committing to the batch.',
  },
  {
    q: 'How does review work?',
    a: 'A shared review link with frame-accurate comments, updated weekly. Two rounds of revision per stage are in the quote; beyond that we bill by the day and tell you before the clock starts.',
  },
  {
    q: 'Who owns the finished work?',
    a: 'You do, on final payment — full assignment, including the source files. We ask only for the right to show finished work in our portfolio, and we hold that back for as long as you need us to.',
  },
];

export const services: Service[] = [
  /* ---------------------------------------------------------------- */
  {
    slug: '3d-art',
    label: '3D Art',
    shortName: '3D art',
    article: 'a',
    title: '3D Art',
    tagline: 'Characters, environments, props and vehicles — built game-ready.',
    intro:
      'The full 3D pipeline, from blockout to a textured asset sitting in your engine. Everything arrives on your naming convention, inside your triangle and texture budgets, and screenshotted in your build before we call it done.',
    tint: '210 70% 22%',
    offerings: [
      {
        title: 'Characters',
        body: 'Blockout, sculpt, retopology, UVs, bake and texture — heroes, NPCs and creatures, delivered rigged or ready to rig.',
      },
      {
        title: 'Environments',
        body: 'Modular kits, hero pieces and set dressing built for reuse, with trim sheets and material budgets planned before modelling starts.',
      },
      {
        title: 'Props and weapons',
        body: 'Hard-surface assets at any LOD, with first-person-grade detail where the camera gets close and none where it does not.',
      },
      {
        title: 'Vehicles',
        body: 'Interior and exterior, built to the level of separation your gameplay needs — doors, turrets, damage states and destructible parts.',
      },
      {
        title: 'Sculpting and high poly',
        body: 'Detail authored to the level the bake will actually carry, whether for a game-ready bake or for print and cinematic use.',
      },
      {
        title: 'Optimisation and LODs',
        body: 'Existing assets brought inside a budget — retopology, LOD chains, texture atlasing and material reduction, profiled on target hardware.',
      },
    ],
    pipeline: [
      {
        title: 'Scope and style match',
        body: 'We read your art bible, count the assets, and produce one paid test piece so the style match is proven on your asset before the batch begins.',
        tools: 'Photoshop, PureRef',
      },
      {
        title: 'Blockout',
        body: 'Proportions and silhouette approved in grey, in engine, at gameplay camera distance — before a single detail gets sculpted.',
        tools: 'Blender, Maya, your engine',
      },
      {
        title: 'High poly',
        body: 'Sculpt and hard-surface detailing to the level the bake will actually carry, with detail placed where the camera goes.',
        tools: 'ZBrush, Blender, 3ds Max',
      },
      {
        title: 'Game-ready mesh',
        body: 'Retopology to your triangle budget, LODs, UVs packed to your texel density, and a clean bake with no visible seams.',
        tools: 'Maya, Blender, Marmoset Toolbag',
      },
      {
        title: 'Texture and engine test',
        body: 'PBR materials authored to your channel packing, then imported, lit and screenshotted in your engine, so you approve what you will ship.',
        tools: 'Substance 3D Painter, Unreal Engine, Unity',
      },
    ],
    tools: [
      'ZBrush',
      'Blender',
      'Maya',
      '3ds Max',
      'Substance 3D Painter',
      'Substance 3D Designer',
      'RizomUV',
      'Marmoset Toolbag',
      'Unreal Engine',
      'Unity',
    ],
    deliverables: [
      'Game-ready meshes with LODs, on your naming convention',
      'PBR texture sets at your channel packing',
      'High-poly sources and bake cages',
      'An engine-imported test scene with screenshots',
      'UV layouts documented to your texel density',
      'A short technical readme per asset batch',
    ],
    faqs: [
      {
        q: 'Will the assets match our existing art?',
        a: 'That is what the paid test piece is for. We build one asset to your bible, you compare it side by side with your own, and the batch only starts once it holds up. If it does not match, you have spent one asset finding that out instead of thirty.',
      },
      {
        q: 'Can you hit a specific performance budget?',
        a: 'Give us the triangle count, texel density, material count and target platform, and those become acceptance criteria rather than aspirations. We test on the target hardware before delivery, not on a workstation.',
      },
      {
        q: 'Do you work inside our engine and tracker?',
        a: 'Yes. We take a seat in your Perforce or Git repo, your Jira or Hansoft board, and your Slack — or we work at arm’s length and deliver packaged drops, if that suits your security review better. Both are normal.',
      },
      ...commonFaqs,
    ],
    related: ['animation', 'integration', 'vfx'],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: '2d-art',
    label: '2D Art',
    shortName: '2D art',
    article: 'a',
    title: '2D Art',
    tagline: 'Concept, illustration, UI and key art — drawn to be built from.',
    intro:
      'Visual development that a modeller can actually work from, and finished 2D that ships. We draw to answer questions rather than to decorate a deck — silhouettes, callouts and orthographics, not just a handsome illustration.',
    tint: '340 55% 24%',
    offerings: [
      {
        title: 'Concept art and visual development',
        body: 'Silhouette exploration, colour keys and callout sheets that settle a look while changing it still costs an afternoon.',
      },
      {
        title: 'Character design',
        body: 'Turnarounds, expression sheets and orthographics built to production standard, so the 3D team is not guessing at the back of the head.',
      },
      {
        title: 'Environment and prop concepts',
        body: 'Layouts, mood pieces and callouts with the scale and modularity already thought through, not invented later by a modeller.',
      },
      {
        title: 'UI, HUD and icons',
        body: 'In-game interface, icon sets and menu systems produced as a system with states and specs, not a flat mockup.',
      },
      {
        title: 'Key art and marketing',
        body: 'Store assets, capsule art, banners and campaign illustration, delivered in every crop and ratio a platform demands.',
      },
      {
        title: 'Storyboards and backgrounds',
        body: 'Boards for animation and cinematics, plus painted backgrounds and matte layers ready for camera and compositing.',
      },
    ],
    pipeline: [
      {
        title: 'Brief and reference',
        body: 'A shared reference board agreed before anything is drawn. Most style disagreements are visible here, and here they are free.',
        tools: 'PureRef, Figma',
      },
      {
        title: 'Thumbnails and silhouettes',
        body: 'Many small, fast options. The point is to kill directions cheaply, so you see the ones that did not work as well as the one that did.',
        tools: 'Photoshop, Procreate',
      },
      {
        title: 'Rough and colour key',
        body: 'The chosen direction taken to a readable rough with colour established. Approval here covers composition and palette.',
        tools: 'Photoshop, Clip Studio Paint',
      },
      {
        title: 'Final render',
        body: 'Finish, detail and polish on an approved rough — the only stage where we are not asking you to imagine anything.',
        tools: 'Photoshop, Procreate',
      },
      {
        title: 'Production sheets',
        body: 'Orthographics, callouts, material notes and scale references — the paperwork that lets someone else build it correctly.',
        tools: 'Photoshop, Illustrator',
      },
    ],
    tools: [
      'Photoshop',
      'Procreate',
      'Clip Studio Paint',
      'Illustrator',
      'Figma',
      'Blender',
      'PureRef',
      'Storyboard Pro',
    ],
    deliverables: [
      'Layered PSD sources at print resolution',
      'Flattened PNG and JPG at your delivery sizes',
      'Turnarounds, orthographics and callout sheets',
      'Colour keys and material notes',
      'UI kits with states, specs and exported assets',
      'Key art versioned to every required crop',
    ],
    faqs: [
      {
        q: 'How many concept options do we get?',
        a: 'The quote names a number per asset — usually six to ten thumbnails, then two developed roughs, then one final. You see the rejected directions too. A vendor who only shows you the one they liked is making your decision for you.',
      },
      {
        q: 'Can the concepts actually be built?',
        a: 'That is the difference between concept art and illustration, and we treat it as a requirement. If a design cannot be modelled inside your budget we will say so at the rough stage, when the drawing can still change.',
      },
      {
        q: 'Do you use AI in the process?',
        a: 'Not in delivered artwork, and not without telling you. Where it genuinely helps — early ideation boards, upscaling our own work, background cleanup — we will say exactly where it was used, and every delivered file is drawn by an artist.',
      },
      ...commonFaqs,
    ],
    related: ['3d-art', 'animation', 'video-editing'],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: 'animation',
    label: 'Animation',
    shortName: 'animation',
    article: 'an',
    title: 'Animation',
    tagline: '2D and 3D performance — gameplay, cinematics and everything between.',
    intro:
      'Character, creature and camera work in both 2D and 3D. We approve the performance at blocking, before anything is lit or cleaned up, because a beautiful shot with the wrong acting in it is still the wrong shot.',
    tint: '28 75% 26%',
    offerings: [
      {
        title: 'Cinematics and cutscenes',
        body: 'Story sequences with camera, staging and performance, delivered as rendered video or assembled in your engine as a playable sequence.',
      },
      {
        title: 'Gameplay animation',
        body: 'Locomotion sets, combat, traversal and reaction states — built to your root-motion rules, frame budgets and blend requirements.',
      },
      {
        title: '3D character and creature performance',
        body: 'Acting shots with weight and readable silhouettes, from bipeds to quadrupeds to things with the wrong number of legs.',
      },
      {
        title: '2D animation',
        body: 'Frame-by-frame where the performance is the point, rigged and cut-out where the volume is — or the hybrid that gets you both.',
      },
      {
        title: 'Rigging',
        body: 'Production rigs with clean controls, working deformation and animator-facing documentation, tested by the people who will animate on them.',
      },
      {
        title: 'Facial animation and lip sync',
        body: 'Blendshape or joint-based setups, keyed by hand or solved from capture and then cleaned, in any language you deliver audio for.',
      },
    ],
    pipeline: [
      {
        title: 'Boards, previs and layout',
        body: 'Cameras, timing and staging blocked cheaply and cut to length. The edit gets approved here, when a change costs an afternoon.',
        tools: 'Storyboard Pro, Maya, Unreal Engine',
      },
      {
        title: 'Rig and setup',
        body: 'Rigs built or adopted, tested on a representative shot, and documented before a whole crew starts animating on them.',
        tools: 'Maya, Blender, Toon Boom Harmony',
      },
      {
        title: 'Blocking',
        body: 'Stepped keys or roughs showing the full performance. This is the approval that matters most: acting is signed off before anyone splines a curve or cleans a line.',
        tools: 'Maya, Blender, Harmony',
      },
      {
        title: 'Spline, polish and clean-up',
        body: 'Curves smoothed, arcs fixed, overlap and contacts cleaned — or final line and inbetweens in 2D. Weekly playblasts throughout.',
        tools: 'Maya, Blender, Harmony, TVPaint',
      },
      {
        title: 'Integration and delivery',
        body: 'Caches exported, clips imported and tested in engine, or rendered and cut against the approved edit.',
        tools: 'Unreal Engine, Unity, After Effects',
      },
    ],
    tools: [
      'Maya',
      'Blender',
      'Toon Boom Harmony',
      'Spine',
      'TVPaint',
      'Storyboard Pro',
      'MotionBuilder',
      'Unreal Engine',
      'After Effects',
    ],
    deliverables: [
      'Animation caches — Alembic, FBX, USD',
      'Engine-ready clips at your frame budget',
      'Rendered masters in ProRes or EXR sequences',
      'Rigged scene files with documentation',
      'Sprite sheets and Spine skeletons for 2D',
      'A playblast archive of every approval stage',
    ],
    faqs: [
      {
        q: 'Can you animate on rigs we already have?',
        a: 'Yes, and it is usually cheaper than rebuilding. Send the rig and one test shot; we come back with a short animated pass and an honest note on anything in the rig that will slow the work down or limit the performance.',
      },
      {
        q: '2D or 3D — which suits our project?',
        a: 'It is a question about volume and revision more than taste. High volume that will be revised often favours 3D or 2D rigs; a small number of hero moments where the performance is the product favours frame-by-frame. We will tell you which your budget actually buys.',
      },
      {
        q: 'How do you handle motion capture?',
        a: 'We clean and retarget capture onto your rig, then hand-animate the parts capture never gets right — fingers, faces, contacts, and the beats that need to be bigger than life. Capture is a starting point, not a delivery.',
      },
      ...commonFaqs,
    ],
    related: ['3d-art', 'vfx', 'integration'],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: 'vfx',
    label: 'VFX',
    shortName: 'VFX',
    article: 'a',
    title: 'VFX',
    tagline: 'Simulation, compositing and the finishing that sells the shot.',
    intro:
      'Effects that serve the shot rather than announce themselves. Smoke, fire, water and destruction — plus the invisible work, cleanup, roto and integration, that decides whether an audience believes what it is looking at.',
    tint: '280 50% 26%',
    offerings: [
      {
        title: 'Simulation and FX',
        body: 'Fire, smoke, water, sand, cloth and destruction, art-directed to the shot rather than left to whatever the solver happens to produce.',
      },
      {
        title: 'Compositing and integration',
        body: 'CG married into plates with matched grain, lens behaviour and light response, so nothing sits on top of the frame.',
      },
      {
        title: 'Real-time VFX for games',
        body: 'Niagara and particle systems for gameplay and combat, authored to a performance budget and profiled on target hardware.',
      },
      {
        title: 'Cleanup, roto and paint',
        body: 'Rig removal, markers, wires and unwanted reality, plus the roto and matte work that makes everything else possible.',
      },
      {
        title: 'Matte painting and set extension',
        body: 'Environments extended beyond what was built, projected onto geometry so the camera can still move through them.',
      },
      {
        title: 'Camera tracking and match-move',
        body: 'Solves, lens de-distortion and object tracks, with the scale reference sorted out so anything with physics behaves.',
      },
    ],
    pipeline: [
      {
        title: 'Breakdown and bid',
        body: 'Every shot watched and classified — what it needs, how long it takes, what could go wrong. You get a per-shot count, not a lump sum.',
        tools: 'A spreadsheet and some honesty',
      },
      {
        title: 'Plate prep',
        body: 'Conform, camera solve, lens distortion and roto. Unglamorous, and the stage that quietly decides whether everything after it works.',
        tools: '3DEqualizer, Mocha Pro, Nuke',
      },
      {
        title: 'Look development',
        body: 'One representative shot taken to near-final, so the effect is agreed on screen before it is multiplied across a sequence.',
        tools: 'Houdini, Nuke',
      },
      {
        title: 'Simulation and render',
        body: 'Sims run at final resolution with cached versions kept, so a note on shot 12 does not force a re-run of the entire sequence.',
        tools: 'Houdini, Karma, Redshift',
      },
      {
        title: 'Comp and finishing',
        body: 'Passes assembled, grain matched, grade applied, and every shot reviewed in the context of the cut rather than on its own.',
        tools: 'Nuke, DaVinci Resolve',
      },
    ],
    tools: [
      'Houdini',
      'Nuke',
      'Unreal Niagara',
      'Maya',
      'Blender',
      'Mocha Pro',
      '3DEqualizer',
      'DaVinci Resolve',
      'After Effects',
    ],
    deliverables: [
      'Linear EXR sequences at plate resolution',
      'Graded masters to your delivery spec',
      'Nuke scripts and Houdini scene files',
      'Cached sims — VDB, Alembic, bgeo',
      'Niagara systems profiled on target hardware',
      'A per-shot breakdown reel on request',
    ],
    faqs: [
      {
        q: 'How do you price VFX?',
        a: 'Per shot, after watching the cut. A count of shots by complexity band is far more honest than a day rate, because it tells you what the number becomes if the shot count changes — and it usually does.',
      },
      {
        q: 'What do you need from the shoot?',
        a: 'Ideally a clean plate, an HDRI or a chrome and grey ball, lens and height data, and a tracking pass. Realistically we often get none of it and solve from the plate instead. Tell us early and we will send a one-page on-set list — it costs nothing on the day and saves a great deal afterwards.',
      },
      {
        q: 'Can you take over a sequence another vendor started?',
        a: 'Yes. Send the scripts and caches. We audit them first and tell you plainly whether continuing is cheaper than rebuilding — sometimes it is not, and you should hear that before you pay for it.',
      },
      ...commonFaqs,
    ],
    related: ['animation', '3d-art', 'video-editing'],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: 'integration',
    label: 'Integration',
    shortName: 'integration',
    article: 'an',
    title: 'Integration',
    tagline: 'Getting the art into the engine, running at frame rate.',
    intro:
      'The work between a finished asset and a shipping build. Import, materials, lighting, collision, state machines and the profiling pass that catches what a workstation hides — done by people who read your budgets as requirements rather than suggestions.',
    tint: '150 45% 20%',
    offerings: [
      {
        title: 'Asset integration',
        body: 'Import, scale, pivots, collision, LOD chains and naming — assets that drop into your project without a technical artist rescuing them.',
      },
      {
        title: 'Materials and shaders',
        body: 'Master materials and instances built to your channel packing, with the parameters your artists actually need exposed and the rest hidden.',
      },
      {
        title: 'Lighting and post',
        body: 'Scene lighting, reflection and post-process setup in Unreal or Unity, tuned to hold the look at your target frame rate.',
      },
      {
        title: 'Animation setup',
        body: 'State machines, blend spaces, retargeting and blueprint or C# wiring, so animation behaves in the build the way it did in the DCC.',
      },
      {
        title: 'Performance profiling',
        body: 'Draw calls, overdraw, shader complexity and memory measured on the target platform, with a written list of what to fix and in what order.',
      },
      {
        title: 'Pipeline and tooling',
        body: 'Import scripts, validation checks and small editor tools that stop the same mistake being made forty more times by hand.',
      },
    ],
    pipeline: [
      {
        title: 'Project audit',
        body: 'We open your project, read the conventions and measure a representative scene before recommending anything. Advice given without doing this is guesswork.',
        tools: 'Unreal Engine, Unity, RenderDoc',
      },
      {
        title: 'Standards and budgets',
        body: 'Naming, folder structure, LOD rules, texel density and per-scene budgets written down as acceptance criteria both sides can check against.',
        tools: 'Your wiki, our checklist',
      },
      {
        title: 'Setup pass',
        body: 'Master materials, import presets and validation rules built first, so every asset after this one costs less to bring in than the last.',
        tools: 'Unreal Engine, Unity, Python',
      },
      {
        title: 'Integration',
        body: 'Assets brought in, wired up, lit and placed, with a screenshot pass in the build so you approve what you will actually ship.',
        tools: 'Unreal Engine, Unity, Perforce',
      },
      {
        title: 'Profile and fix',
        body: 'Measured on target hardware, not a workstation, with the fixes prioritised by what they actually buy back in milliseconds.',
        tools: 'RenderDoc, Unreal Insights, platform tools',
      },
    ],
    tools: [
      'Unreal Engine',
      'Unity',
      'Godot',
      'Blueprint',
      'C#',
      'Python',
      'Perforce',
      'Git',
      'RenderDoc',
      'Unreal Insights',
    ],
    deliverables: [
      'A working branch or packaged project drop',
      'Master materials with documented parameters',
      'Import presets and validation scripts',
      'A written profiling report with prioritised fixes',
      'Before-and-after captures on target hardware',
      'Hand-over notes your team can maintain from',
    ],
    faqs: [
      {
        q: 'We have artists but no technical artist. Is that the gap you fill?',
        a: 'Usually, yes — it is the most common version of this brief. Good art that nobody has budgeted, wired up or profiled is the single most common reason a build looks worse than the portfolio it came from.',
      },
      {
        q: 'Can you integrate assets we bought or made elsewhere?',
        a: 'Yes, and we will audit them first. Sometimes bought assets need more work to bring inside a budget than they saved by being bought, and you should hear that before we start rather than in the invoice.',
      },
      {
        q: 'Do you need access to our repository?',
        a: 'It is faster, but not required. We can work in a branch of your Perforce or Git repo, or take a packaged export and hand back a drop with written integration notes. Whichever your security review is happier with.',
      },
      ...commonFaqs,
    ],
    related: ['3d-art', 'animation', 'vfx'],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: 'video-editing',
    label: 'Video Editing',
    shortName: 'video editing',
    article: 'a',
    title: 'Video Editing',
    tagline: 'Trailers, cutdowns, titles and grade — cut to hold attention.',
    intro:
      'Editorial and finishing for everything that ends up as a video file. Trailers, gameplay captures, explainers and social versions, cut to the beat and delivered in every ratio, duration and codec a platform will ask for.',
    tint: '195 60% 24%',
    offerings: [
      {
        title: 'Trailers and reveals',
        body: 'Announce, gameplay and launch cuts built around a beat, with the structure agreed as an edit before a frame is finished.',
      },
      {
        title: 'Gameplay capture and edit',
        body: 'Clean capture direction, then an edit that shows the game rather than the menus — the footage a publisher can actually use.',
      },
      {
        title: 'Titles and motion graphics',
        body: 'Opening titles, lower thirds, callouts and end cards, typeset properly and animated to the cut rather than laid over it.',
      },
      {
        title: 'Social and performance cutdowns',
        body: 'One master versioned to every aspect ratio and duration a platform demands, without rebuilding the layout each time.',
      },
      {
        title: 'Colour grade and finishing',
        body: 'Conform, grade and delivery to broadcast, cinema or platform spec, with the masters your distributor will actually accept.',
      },
      {
        title: 'Sound design and mix',
        body: 'Effects, music sync, voiceover and a mix that survives a phone speaker as well as it survives headphones.',
      },
    ],
    pipeline: [
      {
        title: 'Assembly and selects',
        body: 'Everything watched and logged, the usable material pulled out. Most edits are won or lost by what gets found at this stage.',
        tools: 'Premiere Pro, DaVinci Resolve',
      },
      {
        title: 'Rough cut',
        body: 'Structure and pacing at final duration with scratch audio. Approval here covers the shape of the piece, while changing it is still free.',
        tools: 'Premiere Pro',
      },
      {
        title: 'Fine cut and lock',
        body: 'Frame-accurate trims, music sync and transitions settled. Nothing gets graded or titled until the edit is locked, for the obvious reason.',
        tools: 'Premiere Pro, DaVinci Resolve',
      },
      {
        title: 'Titles, grade and sound',
        body: 'Graphics built on the locked cut, colour matched across sources, and a mix balanced for the platform it will play on.',
        tools: 'After Effects, DaVinci Resolve, Audition',
      },
      {
        title: 'Versioning and delivery',
        body: 'Every ratio, duration, language and codec exported from one master project, checked against your delivery spec before it is sent.',
        tools: 'Media Encoder, DaVinci Resolve',
      },
    ],
    tools: [
      'Premiere Pro',
      'DaVinci Resolve',
      'After Effects',
      'Audition',
      'Media Encoder',
      'Illustrator',
      'Figma',
    ],
    deliverables: [
      'Masters in every ratio and duration you need',
      'Platform-spec exports with correct codecs and loudness',
      'Project files with organised, labelled sequences',
      'Editable title comps for future versioning',
      'Sound-design stems and the final mix',
      'Subtitle and caption files where required',
    ],
    faqs: [
      {
        q: 'Can you cut from footage we already have?',
        a: 'Yes, and that is most of this work. Send everything, including the material you think is unusable — the shot that saves an edit is very often one someone had already discarded.',
      },
      {
        q: 'Do you capture gameplay, or do we?',
        a: 'Either. If you capture, we will send a short spec first — resolution, HUD state, frame rate, what to record and what to avoid. Five minutes of direction there prevents a recapture later.',
      },
      {
        q: 'How many versions are included?',
        a: 'The master is built to version. Additional ratios and durations are priced per set and are cheap; new copy, a new language or a new structure is a new edit. We spell out which is which in the quote so nothing is a surprise.',
      },
      ...commonFaqs,
    ],
    related: ['vfx', 'animation', '2d-art'],
  },
];

/** Lookup used by cross-links, case studies and the dynamic route. */
export const serviceBySlug = (slug: string) => services.find((s) => s.slug === slug);

/* ------------------------------------------------------------------ */
/* Engagement models — the "how do we actually hire you" question that  */
/* every outsourcing studio answers and most agency sites skip.         */
/* ------------------------------------------------------------------ */
export interface EngagementModel {
  title: string;
  body: string;
  bestFor: string;
}

export const engagementModels: EngagementModel[] = [
  {
    title: 'Fixed-scope project',
    body: 'An agreed shot or asset count, a fixed price and a fixed date. We absorb the overruns that are our fault; changes to the brief are quoted as changes rather than absorbed silently.',
    bestFor: 'A defined deliverable — a trailer, a cinematic, an asset batch.',
  },
  {
    title: 'Team extension',
    body: 'Named artists reserved for you by the month, working in your pipeline, your tracker and your reviews. You direct the work; we handle employment, kit and cover.',
    bestFor: 'An in-house team that needs capacity, not a vendor.',
  },
  {
    title: 'Co-development',
    body: 'We take a whole vertical — all the environments, the full cinematic, the entire effects package — and run it to a milestone plan with our own leads.',
    bestFor: 'A slice of production you would rather hand over entirely.',
  },
];
