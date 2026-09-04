/**
 * Page seeds — the site's fixed pages, as block lists.
 *
 * Split out of `migrate.mjs` because nine pages of block arrays is a data
 * file, not a script, and burying it inside the migration made the actual
 * migration logic impossible to read.
 *
 * These are TRANSCRIPTIONS of what each page rendered before it was converted,
 * taken from the `.astro` templates and the config arrays they read. That is
 * deliberate: the conversion is only correct if the built page comes out
 * identical to the one it replaced, and that can only be checked against a
 * faithful copy of the original.
 *
 * WHAT IS NOT HERE: anything a data block reads for itself. The work tiles,
 * case studies, process steps, tools, team, testimonials, FAQs and milestones
 * all come from their own document types. Only words genuinely typed into a
 * page appear below.
 *
 * Once seeded, this file has done its job — the Studio is the source of truth
 * from then on, and re-running the migration would overwrite whatever has been
 * edited since. See the note on `--only` in migrate.mjs.
 */

/** Blocks are keyed by position; a key only has to be stable and unique. */
export const withKeys = (blocks) => blocks.map((b, i) => ({ _key: `block-${i}`, ...b }));

export const PAGES = [
  {
    slug: 'home',
    title: 'Home',
    seoTitle: 'Aniwala Studios — Animation & Game Art',
    seoDescription:
      'Aniwala Studios produces 2D and 3D animation, VFX and game art for games, film and brands.',
    blocks: [
      {
        _type: 'heroBlock',
        variant: 'video',
        eyebrow: 'Animation & Game Art Studio',
        /* A real non-breaking space, written as an escape so it survives being
           edited. It stops the headline breaking as "We make things / move." */
        headline: 'We make things\u00A0move.',
        sub: '2D, 3D, VFX and game art for games, film and brands. Built by artists who will tell you the truth about your schedule.',
        ctaLabel: 'See the work',
        ctaHref: '/portfolio/',
        posterSlot: 'home-hero-poster',
      },
      { _type: 'marqueeBlock', source: 'marquee' },
      {
        _type: 'statementBlock',
        source: 'custom',
        body: "A new studio, built by artists who have shipped for games and screen. We take a brief, settle the look before full production starts, and show you the work every week while it's still cheap to change.",
      },
      {
        _type: 'workGridBlock',
        eyebrow: 'Selected work',
        title: 'Take a closer look at what we make',
        linkLabel: 'Explore the full portfolio',
        linkHref: '/portfolio/',
      },
      {
        _type: 'caseStudyListBlock',
        eyebrow: 'Case studies',
        title: 'Projects with the working shown',
        limit: 3,
        linkLabel: 'View all',
        linkHref: '/case-studies/',
      },
      { _type: 'serviceGridBlock', eyebrow: 'What we do', title: 'Six disciplines, one pipeline' },
      { _type: 'processBlock', eyebrow: 'How we work', title: 'No surprises at the end' },
      {
        _type: 'tagListBlock',
        eyebrow: 'Pipeline',
        title: 'What we run',
        anchor: 'capabilities',
        source: 'capabilities',
      },
      { _type: 'clientWallBlock', eyebrow: 'Clients', title: 'Studios we work with' },
      { _type: 'testimonialBlock', eyebrow: 'Testimonials', title: 'What our clients say' },
      { _type: 'bookCallBlock' },
      {
        _type: 'ctaPanelBlock',
        eyebrow: 'Careers',
        title: "We're looking for artists",
        anchor: 'careers',
        body: 'Animators, modellers, riggers and FX artists. Send a reel. We watch all of them and reply either way.',
        linkLabel: 'See open roles',
        linkHref: '/careers/',
      },
    ],
  },

  {
    slug: 'about',
    title: 'About us',
    seoTitle: 'About us — Aniwala Studios',
    seoDescription:
      'Aniwala is an animation and game art studio: six disciplines in one pipeline, an honest schedule, and source files handed over on request.',
    blocks: [
      {
        _type: 'heroBlock',
        variant: 'page',
        eyebrow: 'About us',
        headline: 'A new studio. Here is what that means.',
        sub: 'It means we have no back catalogue to point at, so we compete on the things you can check on a first call: the scope, the schedule, and what lands in your folder at the end.',
        crumbLabel: 'About us',
        tint: '210 70% 22%',
      },
      /* Reads the shared positioning statement rather than storing a second
         copy of the line the studio uses to describe itself. */
      { _type: 'statementBlock', source: 'positioning' },
      {
        _type: 'factGridBlock',
        eyebrow: 'At a glance',
        title: 'How the studio is set up',
        anchor: 'glance',
        facts: [
          {
            "label": "Disciplines",
            "value": "Six, one pipeline",
            "note": "3D art, 2D art, animation, VFX, integration and the edit."
          },
          {
            "label": "Work for",
            "value": "Games, film and brands",
            "note": "Asset batches, full sequences and co-development."
          },
          {
            "label": "Engagement",
            "value": "Project, embedded or retained",
            "note": "Whichever suits the brief. We'll tell you which one we think it is."
          },
          {
            "label": "First reply",
            "value": "Two working days",
            "note": "With an actual scope attached."
          }
        ],
      },
      {
        _type: 'principleListBlock',
        eyebrow: 'What we hold to',
        title: "Four things we don't budge on",
        anchor: 'principles',
        variant: 'numbered',
        items: [
          {
            "title": "We tell you if the date is impossible",
            "body": "Before anything else, including whether we want the job. Plenty of studios say yes to every deadline and sort it out later. That's how a project ends up with a rushed final fortnight and a compromise nobody agreed to."
          },
          {
            "title": "We quote in shots, not days",
            "body": "A day rate tells you what we cost. It tells you nothing about how big the job is. So we scope in shots, assets and seconds. If the number comes back higher than your budget, you can see exactly which ten shots to cut and what that saves."
          },
          {
            "title": "The look gets signed off early",
            "body": "Style frames and a short test before full production starts. Changing the look at animatic stage costs a conversation. Changing it in comp costs a renegotiation, and everyone on the job knows it, which is exactly why nobody wants to be the one to raise it."
          },
          {
            "title": "You get the source files",
            "body": "Project files, scene files, source assets, on request. Some studios keep hold of them so you have to come back. We would rather you came back because the work was good."
          }
        ],
      },
      {
        _type: 'principleListBlock',
        eyebrow: 'Working with us',
        title: 'What the week actually looks like',
        anchor: 'practices',
        variant: 'compact',
        items: [
          {
            "title": "You see it every week",
            "body": "A playblast or a render on a shared review link, starting the first week. If something is going wrong you find out while it's still a week of work rather than a month."
          },
          {
            "title": "You talk to the artist",
            "body": "The person you brief has the scene open in front of them. There is no account layer in the middle, so nothing gets lost being relayed twice."
          },
          {
            "title": "Notes stay in one place",
            "body": "Timecoded, on the review link, not spread across three email threads. Every round is written down. That mostly matters six weeks later, when someone asks why a shot changed."
          },
          {
            "title": "Handover is part of the job",
            "body": "Masters, cutdowns, engine-ready assets, and a readme covering budgets and naming conventions. We would rather spend the extra half day on it than have you email us in March asking what a file was called."
          }
        ],
      },
      { _type: 'milestoneBlock', eyebrow: 'History', title: 'How we got here', anchor: 'history' },
      {
        _type: 'teamGridBlock',
        eyebrow: 'The studio',
        title: 'Your production team',
        anchor: 'team',
      },
      {
        _type: 'tagListBlock',
        eyebrow: 'Pipeline',
        title: 'What we run',
        anchor: 'pipeline',
        source: 'capabilities',
        linkLabel: 'See the disciplines',
        linkHref: '/services/',
      },
      {
        _type: 'ctaPanelBlock',
        eyebrow: 'Careers',
        title: "We're looking for artists",
        anchor: 'careers',
        body: 'Animators, modellers, riggers and FX artists. Being early at a small studio is a genuine trade-off: more say in how things get done, less certainty about next year. If that sounds like a good deal, send a reel. We watch all of them and reply either way.',
        linkLabel: 'Send a reel',
        linkHref: 'mailto:contact@aniwala.com?subject=Reel',
      },
      {
        _type: 'ctaBandBlock',
        eyebrow: 'Next step',
        title: 'Test any of this.',
        body: 'Send a brief and see how much of the above survives contact with it. You get a shot or asset count, a note on which decisions will cost money, and a date we actually believe. Two working days.',
      },
    ],
  },
  {
    slug: 'services',
    title: 'Services',
    seoTitle: 'Services — Aniwala Studios',
    seoDescription:
      '3D art, 2D art, animation, VFX, engine integration and video editing. One pipeline, six disciplines, an honest schedule.',
    blocks: [
      {
        _type: 'heroBlock',
        variant: 'page',
        eyebrow: 'What we do',
        headline: 'Six disciplines, one pipeline.',
        sub: 'Most studios sell you a department. We run the whole route from board to delivery, so the handoffs that usually lose a week happen inside one building instead of between three vendors.',
        crumbLabel: 'Services',
        tint: '210 70% 22%',
      },
      { _type: 'serviceGridBlock', layout: 'rows', anchor: 'disciplines' },
      {
        _type: 'engagementBlock',
        eyebrow: 'Engagement',
        title: 'Three ways to work with us',
        anchor: 'engagement',
      },
      {
        _type: 'processBlock',
        eyebrow: 'How we work',
        title: 'No surprises at the end',
        anchor: 'process',
      },
      {
        _type: 'tagListBlock',
        eyebrow: 'Pipeline',
        title: 'What we run',
        anchor: 'pipeline',
        source: 'serviceTools',
        linkLabel: 'Ask about yours',
        linkHref: '/contact/',
      },
      {
        _type: 'ctaBandBlock',
        eyebrow: 'Start a project',
        title: 'Not sure which one you need?',
        body: 'Describe the problem rather than the discipline. Half the briefs we get are labelled as one service and are really another — we would rather sort that out on a call than sell you the wrong thing.',
      },
    ],
  },

  {
    slug: 'case-studies',
    title: 'Case studies',
    seoTitle: 'Case studies — Aniwala Studios',
    seoDescription:
      'Projects taken apart: the brief, the pipeline decisions, what worked and what did not. Animation, game art and VFX.',
    blocks: [
      {
        _type: 'heroBlock',
        variant: 'page',
        eyebrow: 'Selected work',
        headline: 'Case studies',
        sub: 'Projects with the working shown — what the brief was, which decisions were expensive, and what we would tell the next client who asks for something similar.',
        crumbLabel: 'Case studies',
        tint: '150 45% 20%',
        compact: true,
      },
      {
        _type: 'caseStudyListBlock',
        layout: 'featured',
        emptyTitle: 'No case studies published yet.',
        emptyBody:
          'They go up as projects wrap and clients clear them. In the meantime, the fastest way to judge how we work is to ask us about a brief.',
        emptyCtaLabel: 'Talk to the studio',
        emptyCtaHref: '/contact/',
      },
      {
        _type: 'ctaBandBlock',
        eyebrow: 'Start a project',
        title: 'Want this level of detail on your brief?',
        body: 'Send the cut, the asset list or just the problem. You get the same working — a shot or asset count, the decisions that will cost money, and a date we believe.',
      },
    ],
  },
  {
    slug: 'portfolio',
    title: 'Portfolio',
    seoTitle: 'Portfolio — Aniwala Studios',
    seoDescription:
      'Animation, game art, VFX and design work by Aniwala Studios, filed by discipline. Characters, environments, animation, VFX, concept art and motion graphics.',
    blocks: [
      {
        _type: 'heroBlock',
        variant: 'page',
        eyebrow: 'Selected work',
        headline: 'Portfolio',
        sub: "Filed by craft rather than by client, so you can go straight to the discipline you're hiring for. Every piece says who it was for and what it was made to prove.",
        crumbLabel: 'Portfolio',
        tint: '210 70% 22%',
        compact: true,
      },
      {
        _type: 'pieceGridBlock',
        anchor: 'work',
        showFilter: true,
        emptyTitle: 'Nothing published here yet.',
        emptyBody:
          'Pieces go up as projects wrap and clients clear them. Until then the honest way to judge us is the case studies — those take a project apart and show the decisions, which is more use than a thumbnail anyway.',
        emptyCtaLabel: 'Read the case studies',
        emptyCtaHref: '/case-studies/',
      },
      {
        _type: 'caseStudyListBlock',
        eyebrow: 'Case studies',
        title: 'Projects with the working shown',
        limit: 3,
        linkLabel: 'View all',
        linkHref: '/case-studies/',
      },
      {
        _type: 'ctaBandBlock',
        eyebrow: 'Start a project',
        title: "Need something that's not up here yet?",
        body: "Most of what a studio makes never clears for public use. Tell us the brief and we'll send relevant work over directly, with a shot or asset count and a date we believe.",
      },
    ],
  },

  {
    slug: 'blog',
    title: 'Blog',
    seoTitle: 'Blog — Aniwala Studios',
    seoDescription:
      'Notes on animation, VFX and game art production: how the work is scheduled, quoted and reviewed, from the people doing it.',
    blocks: [
      {
        _type: 'heroBlock',
        variant: 'page',
        eyebrow: 'Blog',
        headline: 'Notes from inside the pipeline.',
        sub: 'Craft and production writing about how animation actually gets made — what we approve when, what things cost, and the decisions that are cheap now and expensive later. No thought leadership.',
        crumbLabel: 'Blog',
        tint: '195 60% 24%',
        compact: true,
      },
      {
        _type: 'postListBlock',
        showFilter: true,
        emptyTitle: 'Nothing published yet.',
        emptyBody:
          'The first posts are being written. In the meantime, the fastest way to hear how we work is to ask.',
        emptyCtaLabel: 'Talk to the studio',
        emptyCtaHref: '/contact/',
      },
      {
        _type: 'ctaBandBlock',
        eyebrow: 'Start a project',
        title: 'Reading is cheaper than a bad brief.',
        body: 'If something here matched a problem you are having, that conversation is free. Send the brief and the deadline and we will tell you what we would actually do.',
      },
    ],
  },
  {
    slug: 'contact',
    title: 'Contact',
    seoTitle: 'Contact — Aniwala Studios',
    seoDescription:
      'Talk to Aniwala Studios about an animation, game art or VFX brief. Email contact@aniwala.com, book a call, or visit the studio in Wakad, Pimpri-Chinchwad.',
    blocks: [
      {
        _type: 'heroBlock',
        variant: 'page',
        eyebrow: 'Contact',
        headline: 'Tell us the deadline first.',
        sub: "We'll tell you straight whether we can hit it, and what it would take if we can. No deck, no discovery phase. Just an answer within two working days.",
        crumbLabel: 'Contact',
        tint: '28 75% 26%',
      },
      {
        _type: 'reachBlock',
        anchor: 'reach',
        note: 'The fastest route. Send the cut, the asset list, the script, or just the problem. Whatever you have is enough to get a useful answer back, and every enquiry is read by someone who could do the work.',
        hints: [
          'Attach or link anything: boards, refs, a rough edit, a spec.',
          "Say the date you need it by, even if it's uncomfortable.",
          'You get a scope and a straight yes or no within two working days.',
        ],
      },
      {
        _type: 'tagListBlock',
        eyebrow: 'What to write about',
        title: 'Briefs we can scope quickly',
        anchor: 'about-what',
        source: 'enquiryTypes',
        linkLabel: 'See the services',
        linkHref: '/services/',
      },
      { _type: 'bookCallBlock' },
    ],
  },
];
