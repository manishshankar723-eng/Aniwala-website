---
title: 'Texel density is a design decision, not a technical one'
description: 'Deciding how many pixels per centimetre your world gets is an art-direction call disguised as a spreadsheet. Get it wrong and no amount of texturing skill will save the look.'
pubDate: 2026-07-28
category: 'Pipeline'
tags: ['game art', 'texturing', 'optimisation']
tint: '150 45% 20%'
---

Ask a technical artist what texel density is and you will get a number:
512 pixels per metre, maybe 1024 for hero assets. Ask an environment artist what
it *does* and you will get something more useful — it decides whether your world
feels crisp or muddy, and it decides it before anyone has painted a single
material.

## What the number means

Texel density is how many texture pixels land on a fixed amount of surface. At
512 px/m, a one-metre crate gets a 512×512 patch of texture. At 1024, it gets four
times the data for the same crate.

That is the whole idea. Everything interesting comes from what happens when the
number is inconsistent.

## Inconsistency reads as a mistake, even to players who cannot name it

Nobody in your audience will ever say "the texel density on that door frame is
half the density of the wall next to it." What they will say is that the level
looks cheap, or that something feels off, or — most commonly — nothing at all,
while quietly finding the space less convincing than the one in the game they
played last month.

The eye is very good at spotting relative sharpness. Two surfaces meeting at a
corner, one noticeably softer than the other, reads as an error even when neither
surface is bad on its own. This is why a consistent, lower density will almost
always beat an inconsistent, higher one. A world that is uniformly 512 looks
deliberate. A world that swings between 256 and 1024 looks broken.

## Where the art direction comes in

Once you accept that consistency matters more than magnitude, the real decision
becomes: **where do you spend the inconsistency you can afford?**

Because you cannot be uniform everywhere. A skybox does not need the density of a
door handle. So you pick tiers, and picking tiers is art direction:

- **What does the camera get close to?** A first-person game spends its budget on
  hands, weapons and anything at waist height. A top-down game spends almost
  nothing there and everything on ground materials.
- **What does the player look at while waiting?** Loading areas, elevators, cover
  positions. Players stare at cover for a surprising amount of time.
- **What carries the story?** The desk with the note on it earns density that the
  identical desk across the room does not.

We ask for these answers before modelling starts, and we write them into the
brief as bands — hero, standard, background — with a number attached to each. That
turns a vague instruction ("make it look good") into an acceptance criterion
("hero assets at 1024 px/m, standard at 512, background at 256, and nothing sits
next to something more than one band away from it").

That last clause is the one that saves you. **Adjacency rules matter more than
the bands themselves.** A background rock touching a hero rock is the problem; a
background rock forty metres away is not.

## The trim sheet conversation

Every environment brief eventually arrives at the same fork: unique textures or
trim sheets?

Unique textures give an artist total control and cost memory in direct proportion
to surface area. Trim sheets give you enormous reuse — one 2048 sheet dressing an
entire building — at the cost of visible repetition and a modelling discipline
that not every artist enjoys.

The honest answer is almost always: trims for the architecture, unique for the
things the story cares about. But it is a decision that has to be made *before*
the blockout is approved, because the modelling approach is different from the
first polygon. Retrofitting trims onto a set of unique-textured buildings is not
an optimisation pass. It is a rebuild.

## What we do about it

On any game art job, before we model anything, we ask for four numbers and one
list:

1. Target platform, and specifically the memory budget for textures.
2. Texel density bands, with the adjacency rule.
3. Channel packing convention — which map lives in which channel.
4. Maximum material count per asset.
5. A list of the ten things in the level the player will look at longest.

The first four come from your technical artist. The fifth comes from your creative
director, and it is the one people forget to ask for. It is also the one that
decides whether the budget gets spent where anyone will notice.

> Optimisation is not the thing you do at the end. It is the thing that decides
> what you build at the beginning.

If a vendor takes your asset list and starts modelling without asking for any of
this, you will get assets that look good in a Marmoset render and disappointing in
your engine. That gap is not a skill problem. It is a briefing problem, and it is
entirely preventable.
