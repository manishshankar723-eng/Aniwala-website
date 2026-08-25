---
title: 'Approve the blocking, not the render'
description: 'The most expensive note in animation is a performance note given after lighting. Here is why we lock acting at stepped keys, and what that costs you if we do not.'
pubDate: 2026-08-12
category: 'Craft'
tags: ['3d animation', 'process', 'review']
tint: '210 70% 22%'
---

There is a moment on almost every animation project where a client sees a finished,
lit, graded shot for the first time and says: *"I love it — but could he be a bit
more hesitant when he picks up the box?"*

It is a completely reasonable note. It is also, at that point in the schedule, one
of the most expensive sentences in the English language.

## What a performance note actually costs

Changing how a character picks up a box means changing the keys. Changing the keys
means resplining the curves around them, which means re-checking the arcs, which
means the contact points drift, which means the hand now intersects the box for
four frames, which means the simulation on his coat has to run again, which means
the cache is invalid, which means the shot re-renders, which means it goes back
through comp and grade.

An hour of animation work at the blocking stage becomes three days of work at
final. Nothing about the note got harder. Everything downstream of it got heavier.

This is not a client problem. Clients are not supposed to know which notes are
cheap and which are ruinous — that is our job. The problem is a review process
that shows people the wrong thing at the wrong time and then acts surprised when
they respond to what they were shown.

## Stepped keys are a feature, not an apology

Blocking is the version of the shot with the performance in it and nothing else.
Stepped keys, grey models, no lighting, no effects, often no final camera. It
looks unfinished because it is unfinished. That is exactly the point.

When you watch a blocking pass, there is nothing to react to except the acting.
You cannot be distracted by a beautiful rim light or annoyed by a placeholder
texture, because neither exists yet. Every note you give is a note about
performance, and performance is the only thing that is still cheap to change.

We ask for one specific thing at this stage: **is this the performance?** Not
"does this look good" — it does not, it is grey and it pops between poses. Is the
timing right? Does he hesitate enough? Is the beat where you wanted it?

## The three approvals

Every shot we run passes three gates, and each one closes a category of note:

1. **Layout** closes the camera and the edit. After this, "can we see more of the
   room" is a change request, not a note.
2. **Blocking** closes the performance. After this, "can he be more hesitant" is a
   change request.
3. **Final** closes the look — lighting, effects, grade.

Each gate exists because the work after it is expensive to undo, and the work
before it is not. A note given inside its own gate costs hours. The same note
given one gate late costs days. Two gates late, it is a new shot.

We say this out loud at kickoff, and we say it again in the review invite, because
the failure mode is never that a client refuses to give notes at blocking. It is
that they do not realise they are allowed to — that stepped keys look so rough
they assume we are not ready for opinions yet.

You are always allowed to. Blocking is when we most want them.

## What we do when a late note arrives anyway

Sometimes the note is right and the schedule is wrong. A film gets recut. A
publisher changes the character. Someone senior sees the shot for the first time
in week nine, and they are correct.

When that happens we do not pretend it is free, and we do not quietly absorb it
into the schedule and deliver late while saying nothing. We price it, we say what
it does to the date, and we let you decide. Sometimes the answer is yes, take the
week. Sometimes it is no, ship it as it is. Both are fine. What is not fine is
finding out in week eleven that the answer was never going to work.

> A note is only late if nobody told you when early was.

## If you are commissioning animation

Three things make the difference between a project where notes are cheap and one
where they are not:

- **Ask to see blocking.** If a vendor only shows you near-final work, you are
  being managed, not collaborated with.
- **Give performance notes early and look notes late.** Resist the urge to
  comment on colour at blocking; it will change anyway and it uses up review
  attention you need elsewhere.
- **Watch it more than once.** Blocking is dense. The second viewing is where you
  notice that the pause before he speaks is half a beat too short.

None of this is complicated. It just requires everyone to agree, before the work
starts, on which conversation happens when.
