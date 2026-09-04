/**
 * Engagement models — the shapes a client can hire the studio in.
 *
 * The six SERVICES that used to fill this file are now documents in Sanity;
 * see `lib/services.ts` for the accessors and `studio/schemas/service.ts` for
 * the fields. 734 lines of offerings, pipeline stages, tools and deliverables
 * needed a developer and a deploy to reword, which was exactly the friction
 * the CMS exists to remove.
 *
 * These three stayed. "Fixed-scope / team extension / co-development" is how
 * the business is structured rather than copy about any one discipline: the
 * words describe a contract, they appear identically wherever they appear, and
 * changing one is a decision that deserves a diff and a review rather than an
 * inline edit. The line is roughly — would changing this change what we sell,
 * or only how we describe it?
 */

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
