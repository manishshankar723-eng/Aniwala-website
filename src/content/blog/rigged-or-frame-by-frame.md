---
title: 'Rigged or frame-by-frame: how to decide in ten minutes'
description: 'The 2D technique question is really a question about volume and revision. A short decision guide, and the honest trade you make either way.'
pubDate: 2026-05-27
category: 'Craft'
tags: ['2d animation', 'rigging', 'budgeting']
tint: '28 75% 26%'
---

Every 2D project starts with the same fork, and it is almost always framed as an
aesthetic one: do we want the hand-drawn look, or the rigged look?

That is the wrong question, because both can look like almost anything now. The
right question is about volume and revision, and it takes about ten minutes to
answer honestly.

## Ask these four things

**1. How many minutes of animation, in total?**

Under two minutes, frame-by-frame is viable at almost any budget. Over ten, rigged
is usually the only version that finishes. Between the two, it depends on the
other three answers.

**2. How many times will each shot be revised?**

This is the one people underestimate. A rig absorbs revision almost for free —
move the keys, re-export. Frame-by-frame does not: changing a performance means
redrawing every affected frame, twice if it is already been cleaned up.

If the piece has three stakeholders and a legal review, choose a rig. Not because
the drawing would be worse, but because you will change it four times and the
fourth change will be the one that runs out of budget.

**3. How much does each character repeat?**

A character who walks, runs, jumps and idles across two hundred game states is a
rig, unambiguously. A character who appears in one shot for four seconds and does
something no rig would predict is frame-by-frame.

**4. Does anything need to be genuinely impossible?**

Smear frames, squash that breaks the model, a character folding into a shape their
own construction does not permit. Rigs can be built to do a surprising amount of
this, but every extra capability costs rig time up front, and past a point you are
paying rigging rates to approximate drawing.

## What you are actually trading

Frame-by-frame gives you total freedom per frame and no leverage across frames.
Every second costs roughly what the last second cost. The hundredth shot is as
expensive as the first.

Rigging inverts that. The first shot is expensive — the rig has to exist before
anything moves — and every shot after it is cheap. Somewhere around the fourth or
fifth minute, the lines cross.

This is why the technique choice is really a shape-of-budget choice. Frame-by-frame
is a flat cost curve. Rigging is a big fixed cost and a shallow one. Neither is
better; they suit different projects and, importantly, different cash flows.

## The middle that most projects actually want

In practice most work we do is neither purely one nor the other:

- **Rigged bodies, drawn faces.** The rig handles locomotion and staging, and
  mouths, eyes and expressions are drawn. It gets you most of the life of
  frame-by-frame at a fraction of the volume, and it is where a lot of modern
  series work sits.
- **Rigged base with drawn accents.** Rigged animation everywhere, with hand-drawn
  smear frames and effects added on top at the moments that need them. Three drawn
  frames in a two-second action can carry the whole shot.
- **Drawn hero shots, rigged everything else.** Spend the drawing budget on the
  eight shots people will remember and rig the connective tissue.

If a studio tells you it is one or the other, they are describing their pipeline,
not your project.

## For games specifically

Games skew rigged for a structural reason: the animation is not a fixed sequence.
It is a set of states that blend into each other at runtime in orders nobody
authored. Frame-by-frame sprite work still exists and still looks wonderful, but
it means authoring every transition explicitly, and the state count grows faster
than anyone expects.

Spine and similar tools also give you something drawing cannot: the ability to
change a character's outfit, weapon or palette without redrawing a single frame.
For a game with cosmetics, that is not a preference. It is a requirement.

> Choose frame-by-frame when the performance is the product. Choose a rig when the
> volume is the product. Choose the hybrid when — as usual — it is both.

## What we ask for

Before quoting any 2D job we ask for the total runtime or state count, the number
of approval rounds you expect, and one reference of the movement quality you want.
Those three answers settle the technique in about ten minutes, and settling it
early is worth more than settling it correctly later.
