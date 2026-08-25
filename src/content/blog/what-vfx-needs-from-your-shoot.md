---
title: 'What VFX needs from your shoot — the one-page list'
description: 'Five minutes on set saves five days in post. A practical list of what to capture, why each item matters, and what it costs us when you cannot get it.'
pubDate: 2026-06-18
category: 'Pipeline'
tags: ['vfx', 'on set', 'production']
tint: '280 50% 26%'
---

Most of the difficulty in visual effects is not simulation or compositing. It is
reconstructing information that existed for free on the day and was not written
down.

This is the list we send before a shoot. It costs almost nothing on the day. Print
it, give it to whoever is closest to the camera, and post gets meaningfully
cheaper.

## The five-minute list

**1. A clean plate.** Roll the same shot with the actors and any rigs removed,
camera untouched. Ten seconds is plenty.

*Why:* Anything we need to remove or replace has to be reconstructed from
somewhere. With a clean plate, that is a copy-and-paste. Without one, it is hand
painting, frame by frame, and the cost scales with the length of the shot rather
than being flat.

**2. A chrome ball and a grey ball.** Held in the scene, in the same light, shot
at the top or tail of the setup.

*Why:* The chrome ball tells us where every light in the room is. The grey ball
tells us how bright and what colour they are. Together they let CG match the plate
lighting on the first attempt instead of the fifth. If you can also shoot a
bracketed HDRI panorama, better still — but the two balls get you most of the way
for thirty seconds of work.

**3. Lens data.** Focal length, aperture, filters, and whether anything changed
mid-shot.

*Why:* Lens distortion has to be undone before a camera solve and reapplied
afterwards. Knowing the lens turns that into a lookup. Not knowing it turns it
into a solve with an extra unknown, which is slower and less accurate.

**4. Camera height and tilt, plus a tape measure to something in frame.**

*Why:* A camera track with no scale reference produces a scene that is
geometrically correct but sized arbitrarily. Every CG element then has to be
scaled by eye, which mostly works until something is dropped, thrown, or has
gravity applied to it — at which point it falls at visibly the wrong speed.

**5. Tracking markers, and a photo of where they were.**

*Why:* Markers on a featureless surface make a solve possible at all. The photo
matters because we need to remove them afterwards, and knowing exactly where they
were saves the painter finding each one by hand.

**6. Reference stills of the set from four angles.**

*Why:* Set extension, matte painting and any digital double of the environment all
start here. Phone photos are fine.

**7. A note on frame rate, shutter and any speed ramps.**

*Why:* Motion blur has to match, and a ramp that nobody flagged will produce
effects that blur wrongly in exactly the moments people are looking hardest.

## What it costs when you cannot get it

Sometimes the shot is stolen, the location is a live street, or the schedule
collapses. That is normal, and it is not a disaster. But the cost moves rather
than disappearing:

| Missing | Roughly what it adds |
| --- | --- |
| Clean plate | Hand paint per frame — scales with shot length |
| Chrome and grey ball | An extra lighting iteration on every CG shot in the setup |
| Lens data | Slower, less stable camera solve |
| Scale reference | Guessed scale; visible in anything with physics |
| Marker positions | Manual marker removal |

We would rather quote knowing you have none of it than quote assuming you have all
of it and discover otherwise in week two. Tell us what you got and what you did
not, and the number will be right the first time.

## The one that matters most

If you can only do one thing on the list, shoot the clean plate. It is the
cheapest item, takes the least time, requires no equipment, and it removes the
single most expensive category of post work there is.

> Nothing in visual effects is as costly as recreating something that was standing
> in front of the camera and nobody photographed.

## Ask us before, not after

The other half of this is timing. A five-minute call during prep is worth more
than a week of consultancy in post. We will tell you which shots are cheap, which
are expensive, and — occasionally — which practical effect would be better and
cheaper than anything we could do afterwards. That is a real answer we give, and
we would rather give it before the money is spent.
