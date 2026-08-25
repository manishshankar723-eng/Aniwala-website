---
title: 'Ferrous'
description: 'A modular sci-fi corridor kit built to a fixed memory budget, to find out how far trim sheets go before repetition starts showing.'
kind: 'Studio project'
client: 'Aniwala Studios'
sector: 'Game environment'
year: 2026
services: ['3d-art']
deliverables:
  - 'Game-ready meshes with LOD0–LOD2, on a documented naming convention'
  - 'Four 2K trim sheets and two unique hero material sets'
  - 'Unreal Engine test level, lit and screenshotted'
  - 'Per-asset technical readme with budgets and texel density'
tools: ['Blender', 'ZBrush', 'Substance 3D Designer', 'Substance 3D Painter', 'Unreal Engine', 'Marmoset Toolbag']
results:
  - { label: 'Unique meshes', value: '34' }
  - { label: 'Trim sheets', value: '4 × 2K' }
  - { label: 'Texel density', value: '512 px/m, uniform' }
tint: '150 45% 20%'
---

*Ferrous* is an internal environment build. We set it up to answer a question
we get asked on almost every game art call and had been answering from
experience rather than from something we could show: **how much of a space can
four trim sheets dress before a player starts seeing the repetition?**

## The brief we set ourselves

A corridor junction and two connected rooms, built as a modular kit, at a fixed
memory budget, on a uniform texel density of 512 px/m. Two hero props allowed
unique materials. Everything else had to come off trims.

The budget was chosen to be uncomfortable. A generous one would have proved
nothing.

## What we made

Thirty-four unique meshes making up a kit that assembles into roughly four
times its own footprint: wall sections, floor and ceiling panels, structural
ribs, door frames, pipe runs, cable trays, and the greeble that hides where
modules meet.

Four trim sheets carry all of the architecture. The two hero pieces — a
bulkhead door and a wall-mounted control unit — get unique texture sets,
because those are the two things a player walks up to.

## How it was built

The decision that shaped everything came before any modelling: **the module
grid.** We settled on it, built three test pieces against it, assembled them in
engine, and only then committed to the full kit.

That order is not optional. Retrofitting a grid onto modules that were built
without one is a rebuild, not a fix.

After that the pipeline was ordinary:

- **Blockout in engine first**, at eye height, walking through it. A corridor
  that reads well in a viewport orbit can feel wrong at walking pace, and you
  only find that out by walking it.
- **Trims authored before the meshes that use them.** Modelling to an existing
  trim sheet is fast. Authoring a trim to fit meshes that already exist means
  compromising one or the other.
- **Bakes checked at LOD1, not LOD0.** LOD0 always looks fine. The seams show
  one step down, at the distance most of the kit will actually be seen from.

## Where the repetition showed

This is the part worth writing down.

Four trim sheets held up further than expected in the corridor sections — the
combination of varied module lengths and rotated pieces broke up the pattern
well past the point we thought it would fail.

Where it fell apart was **the ceiling.** Long uninterrupted runs, viewed at a
shallow angle, with nothing to break the eye. That is where the repeat became
obvious, and it became obvious at a distance where nothing else did.

The fix was not another trim sheet. It was geometry — structural ribs at
irregular intervals, which cost almost nothing in memory and removed the
problem entirely.

> The repetition budget is spent in the places the eye travels furthest without
> interruption. Ceilings and long walls, not the props people stand next to.

## What it is for

Two things. It is the piece we send when someone asks whether we can work to a
technical brief rather than to a mood board. And it is the reason the numbers
in our game art quotes are numbers rather than estimates — we built this at a
fixed budget to find out what a fixed budget actually costs to hit.
