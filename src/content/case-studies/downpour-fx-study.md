---
title: 'Downpour'
description: 'Six shots of rain, standing water and structural collapse, built as an FX study to find where a Houdini sim stops being worth its render time.'
kind: 'Studio project'
client: 'Aniwala Studios'
sector: 'VFX study'
year: 2026
services: ['vfx', 'animation']
deliverables:
  - 'Six graded shots, linear EXR at 2K'
  - 'Houdini scene files with cached sims'
  - 'Nuke comp scripts'
  - 'Per-shot breakdown reel'
tools: ['Houdini', 'Nuke', 'Karma', 'Blender', 'DaVinci Resolve']
results:
  - { label: 'Shots', value: '6' }
  - { label: 'Longest sim', value: '9 hours, cached' }
  - { label: 'Comp layers', value: '11–24 per shot' }
tint: '280 50% 26%'
---

*Downpour* is an internal effects study. Six shots, no story, no client — a
deliberately narrow test of one question: **at what point does a full
simulation stop earning its render time against a cheaper approach that reads
the same on screen?**

## The brief we set ourselves

Rain falling on and running off a collapsing concrete structure. Six shots at
increasing complexity, from a locked-off wide with rain and standing water, to
a moving camera through active structural failure with debris and secondary
splash.

Each shot had to be built twice where it was practical: once as a full
simulation, once with the cheapest approach that could plausibly sell it. Then
watched side by side at speed, in the cut, rather than paused.

## What came out of it

The honest answer is: **most of it does not need to be simulated, and the
exceptions are predictable.**

- **Rain in the air** never justified a sim in any shot. Instanced cards with
  good motion blur and a proper falloff read identically at 24fps and cost
  effectively nothing. Every frame spent simulating airborne rain was wasted.
- **Rain interacting with a surface** is the opposite. Splash, run-off,
  pooling, the way water finds an edge and sheets off it — that is where the
  eye goes, and a cheat reads as a cheat immediately. This is worth the sim
  every time.
- **Debris** splits by scale. Large pieces need real dynamics because their
  rotation and contact behaviour is what sells the weight. Small debris does
  not; it is over too fast to inspect.
- **Secondary splash on debris impact** was the biggest surprise. Cheap in the
  sim, enormously effective, and the single thing that most improved the shots
  that were not working.

> Simulate what the camera lingers on and what touches something. Fake what is
> in the air and what is over in three frames.

## How it was built

Shot 3 was taken to near-final before the other five were started. That is
standard practice on any effects sequence and it is standard for a reason: it
settles the look while there is one shot to change rather than six.

Sims were cached at final resolution with every version kept. On shot 5 a note
arrived that changed the collapse timing, and the earlier cache meant
re-running one layer rather than the whole shot. That is not a clever technique,
it is just discipline, and it is the difference between a note costing an hour
and a note costing a day.

Comps ran from 11 layers on the simplest shot to 24 on the most complex, and
every shot was reviewed in the assembled sequence rather than on its own. A
shot that works in isolation and does not work in the cut is a shot that does
not work.

## What it is for

When someone sends us a cut to bid on, the shot bands in our quote come from
having actually built these comparisons. We can say which shots need a sim and
which do not, and give a reason rather than a rate.

It is also, plainly, the piece we show when someone asks what our effects work
looks like. A new studio has to make something before it can show something,
and this is us doing that rather than describing work we have not done.
