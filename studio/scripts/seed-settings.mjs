/**
 * Process steps, blog category descriptions and the booking widget, as they
 * stood before they moved to the CMS.
 *
 * The timezone is deliberately NOT here — it stays in code. IST observes no
 * daylight saving, which is why a fixed offset is exact and why nobody should
 * be able to point it at a timezone that does.
 */
export const PROCESS_STEPS = [
  {
    "title": "Brief & scope",
    "body": "We read the brief and ask the awkward questions early. You get back a shot count, a crew, and a date we actually believe."
  },
  {
    "title": "Look development",
    "body": "Style frames and a short test before full production starts. The look gets signed off while changing it is still cheap."
  },
  {
    "title": "Production",
    "body": "Weekly playblasts and a shared review link. You see the work while it's still wet."
  },
  {
    "title": "Finishing & delivery",
    "body": "Comp, grade, sound sync and delivery in every format you need, with project files handed over on request."
  }
];

export const CATEGORY_BLURBS = [
  {
    "category": "Craft",
    "blurb": "How the work is actually made — technique, timing and the decisions animators argue about."
  },
  {
    "category": "Pipeline",
    "blurb": "The technical spine: budgets, formats, hand-offs and the specifications that stop a project drifting."
  },
  {
    "category": "Studio",
    "blurb": "How we run — quoting, scheduling, reviewing, and the promises we are willing to make."
  },
  {
    "category": "Industry",
    "blurb": "The wider trade: tools, shifts in how production works, and what is worth adopting."
  }
];

export const BOOKING = {
  "hostName": "Manish Shankar Kumar",
  "hostRole": "Founder, Aniwala Studios",
  "callDurations": [
    15,
    30,
    45
  ],
  "dayStart": "09:00",
  "dayEnd": "18:00",
  "stepMinutes": 30,
  "closedDays": [
    0
  ],
  "bookingWindowDays": 60,
  "whatToExpect": [
    "Quick introductions",
    "Understanding your vision, goals and project scope",
    "Exploring creative direction, style and references",
    "Answering your questions and sharing insights"
  ],
  "enquiryTypes": [
    "3D Art",
    "2D Art",
    "Animation",
    "VFX",
    "Integration",
    "Video Editing",
    "AI + Animation",
    "Not sure yet"
  ]
};
