---
title: 'Real-time is not a shortcut'
description: 'Unreal removes the render queue. It does not remove the work — it moves it earlier, into decisions you used to be able to defer. That trade is often worth making, but only if you know you are making it.'
pubDate: 2026-03-19
category: 'Industry'
tags: ['unreal engine', '3d animation', 'production']
tint: '210 70% 22%'
---

The pitch for real-time production is seductive and mostly true: no render farm,
no overnight queue, change a light and see it immediately, iterate as many times
as you like at no marginal cost.

All of that is real. What gets left out is that the cost did not vanish. It moved
to the front of the schedule, and it changed shape.

## What actually goes away

Render time genuinely goes away, and it takes some real pain with it:

- **The overnight cycle.** In an offline pipeline the feedback loop on a lighting
  change is measured in hours. In engine it is measured in seconds, and that
  changes what an artist is willing to try.
- **The end-of-project crunch on the farm.** Offline projects concentrate their
  compute demand into the last fortnight, which is exactly when nobody has slack.
- **The cost of a late look note.** Not free, but far cheaper. A grade change that
  would have meant a full re-render is a parameter adjustment.

For anything with high iteration — previs, virtual production, a cinematic that
will be revised repeatedly, a sequence that has to match the game it sits inside —
this is transformative, and we reach for it first.

## What replaces it

Real-time engines get their speed by requiring the scene to already be in a state
they can draw quickly. Everything that offline renderers do lazily at render time,
the engine needs sorted out in advance:

- **Assets must be optimised before they look finished.** Offline, you can throw a
  twelve-million-polygon sculpt at the renderer and go home. In engine that asset
  has to be retopologised, LOD'd, baked and budgeted before you can even judge it
  properly in context. Nanite has changed this substantially, but "substantially"
  is not "entirely" — and it does nothing for skinned meshes.
- **Lighting has to be set up as a system.** Lumen is remarkable and it is also
  opinionated. Getting a specific look often means understanding why the engine is
  doing what it is doing, which is a different skill from lighting a scene in an
  offline renderer.
- **Materials have to obey the budget.** A shader that costs four milliseconds is
  fine in one hero shot and ruinous applied to a hundred objects.
- **Somebody has to own the project file.** Engine projects are software. They
  need version control, they need a branching strategy, and they break in ways a
  Maya scene does not.

None of this is a reason not to use the engine. It is a reason to staff for it. A
real-time cinematic needs a technical artist in a way an offline one does not, and
projects that skip that role tend to discover why in week five.

## The decision, honestly

We recommend real-time when:

- The work will be iterated on many times, by people who need to see the result
  immediately.
- It has to match or live inside a game built in the same engine.
- There is a camera-in-hand element — virtual production, previs on a stage,
  anything where someone is directing live.
- The schedule is short and the look is achievable within what the engine does
  well.

We recommend offline when:

- The shot needs render quality that real time still cannot reach — genuinely
  complex refraction, heavy volumetrics, extremely fine detail at close range.
- There is significant simulation whose final result matters more than its
  interactivity.
- The deliverable is a small number of hero frames or shots, where iteration count
  is low and quality ceiling is everything.

And often: both. Previs and layout in engine, final render offline, with the
engine version staying alive as the reference the offline shot is matched to.
That is a genuinely common shape now and it gets the best of each.

> The question is not which is better. It is whether your project's cost is
> dominated by iteration or by the quality ceiling. Real time wins the first.
> Offline still wins the second.

## What we will tell you

If you ask us for a cinematic, we will recommend one of the two before quoting,
and we will say why in one paragraph — not because the choice is difficult, but
because it changes what we staff, what we charge and what you can change later.
Finding out in week six that the pipeline cannot accommodate a note is the failure
mode, and it is always avoidable at the start.
