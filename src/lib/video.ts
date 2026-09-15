/**
 * Every autoplaying video on the site: kept playing, and kept quiet.
 *
 * THE RULE, in one place rather than re-decided per component:
 *
 *   - A BACKGROUND video — `data-video="silent"` — is decoration. It is muted,
 *     it loops, and it is never allowed to stop. There is no control for its
 *     audio because it does not have any: the mute is re-asserted here, so no
 *     CMS field, no stray script and no browser gesture handler can turn sound
 *     on behind a headline.
 *   - A TILE video — `data-video="player"` — carries the browser's own control
 *     bar. It starts muted, the visitor may unmute it, and a pause they press
 *     is honoured from then on. Only one of them may have audio at a time.
 *
 * WHY THIS IS A MODULE AND NOT AN INLINE SCRIPT PER HERO, which is what it
 * replaced. `ClientRouter` turns every internal link into a document swap, and
 * it does NOT re-run an inline script that has already executed once. So the
 * two copies of the old reduced-motion snippet — the only thing that called
 * `play()` — ran on the first arrival and never again. Navigate away, come
 * back, and the hero was a still frame with no error anywhere: the video
 * element had been adopted out of a parsed document that never started it, and
 * nothing on the page was left to ask.
 *
 * `astro:page-load` fires on the first load AND after every swap, and the
 * listener that carries it lives on `document`, which survives the swap. That
 * is the hook — the same one `initMotion` already rides.
 *
 * The other half is that a video stops for reasons that are nobody's fault: a
 * backgrounded tab, a bfcache restore, a stalled range request on a CDN. Each
 * one leaves the poster showing, which looks exactly like a broken embed. So
 * rather than starting playback once and hoping, everything below is a
 * watchdog: the conditions under which a video SHOULD be playing are stated
 * once in `wants`, and every event that could have changed the answer re-asks.
 */

/** The elements this module owns. Anything without the attribute is not ours. */
const SELECTOR = 'video[data-video]';

/**
 * Pauses WE caused — the viewport gate below, or a hidden tab — as opposed to
 * the visitor pressing the button on a tile. Without the distinction the gate
 * would look like a deliberate stop the first time a tile scrolled away, and
 * the tile would never play again.
 */
const ourPause = new WeakSet<HTMLVideoElement>();

/**
 * The visitor pressed pause on a tile that offers the control. Honoured from
 * then on: nothing in here starts it again, because a video that restarts
 * itself after you stop it is the single most hostile thing a page can do.
 */
const stopped = new WeakSet<HTMLVideoElement>();

/** Wired once. `astro:page-load` can fire on a document that still holds
    elements from before, and listeners must not stack up on them. */
const wired = new WeakSet<HTMLVideoElement>();

/**
 * One `load()` recovery per element. A stalled fetch is worth one retry; a URL
 * that is genuinely dead would otherwise put us in a refetch loop, which is
 * the "lag" version of the bug we are fixing.
 */
const recovered = new WeakSet<HTMLVideoElement>();

/** Whether the element is currently in or near the viewport. Absent means "not
    measured yet", which is treated as visible — the hero is at the top of the
    page and must not wait a frame for an observer to agree. */
const offscreen = new WeakSet<HTMLVideoElement>();

/**
 * Videos whose bytes we have actually asked the network for.
 *
 * NOTHING ON THIS SITE SHIPS A `src` IN THE MARKUP ANY MORE. Every component
 * emits `data-src` with `preload="none"`, and `attach()` below is the only
 * thing that ever turns one into the other. That inversion is the whole point,
 * and it is not the same as pausing a video or hiding it:
 *
 * A `<video autoplay>` carrying a real `src` starts pulling the file the
 * instant the PARSER reaches it — in parallel with the stylesheet, the two
 * preloaded faces and the image the headline sits on, on the same connection
 * and at a priority the page has no way to lower. Pausing it afterwards does
 * not give those bytes back, because by then they have already been spent.
 * The decision has to happen BEFORE the URL exists, not after.
 *
 * A visitor without JavaScript therefore sees the poster. That is the same
 * thing `resolveVideo` in lib/pieces.ts degrades to for a malformed URL and
 * the same thing `VideoHero` degrades to for a refused one — the site's
 * established answer to "there is no video here", so it needs no new one.
 */
const sourced = new WeakSet<HTMLVideoElement>();

/**
 * Has the PAGE finished loading? Nothing requests a video byte before it has.
 *
 * THIS IS THE FIX FOR "the site takes forever to show anything on a phone",
 * and the mechanism is worth stating because the obvious reading — "video is
 * heavy, of course it is slow" — points at the wrong lever.
 *
 * A hero loop is 100% decoration and 0% content. To the browser's network
 * scheduler it is neither: it is simply another media fetch competing for the
 * same few hundred KB/s as the things a reader actually came for. On a desktop
 * connection that costs nothing and hides the problem completely. On a phone
 * it is the difference between the headline painting in half a second and
 * painting in eight — the text was in the HTML the entire time, queued behind
 * a file nobody had asked to watch.
 *
 * So: content first, decoration second, always. `load` is the moment the
 * page's own resources are done, which makes it the honest line between the
 * two. The poster is already on screen by then — it is a real element under
 * the video, and `fadeIn` below crossfades to the moving picture when it
 * arrives, so the deferral reads as the designed handover rather than as a
 * delay.
 *
 * It is also self-correcting: with no `src` in the markup, a video no longer
 * delays `load` ITSELF, which it did at `preload="metadata"` — so the event
 * this waits on now fires early rather than being held open by the very file
 * it gates. The first-load curtain in Loader.astro lifts on the same event and
 * gets the same benefit; see the note there.
 */
/*
 * A FUNCTION, RE-ASKED EVERY TIME — never a flag captured at module init.
 *
 * This was `let pageLoaded = document.readyState === 'complete'` plus a `load`
 * listener to flip it, and it was broken in the one way that matters: it never
 * let a single video play.
 *
 * `ClientRouter` dispatches the FIRST `astro:page-load` from inside its own
 * `window.addEventListener('load', ...)` handler. So the order on a cold
 * arrival is: this module evaluates (readyState `interactive`, flag captured
 * as false) -> `load` fires -> the router's handler runs -> `astro:page-load`
 * -> `initVideo` -> "the flag says the page has not loaded, so register a
 * `load` listener and wait". Waiting for an event that fired a moment ago and
 * will not fire again. The flag stayed false for the life of the page, every
 * `attach` refused, and the heroes sat on their posters forever.
 *
 * The trap is that the snapshot was taken at a different time from when it was
 * read, so re-reading is the entire fix. `readyState` is the browser's own
 * answer and it is never stale.
 */
const pageLoaded = () => document.readyState === 'complete';

/**
 * A connection we should not spend a DECORATIVE loop on.
 *
 * `saveData` is the visitor saying so outright — Data Saver on Android and
 * Chrome, and what iOS Low Data Mode surfaces through the same flag. A
 * full-screen background video is the most obvious thing on the site to
 * honour it with.
 *
 * `effectiveType` is the browser's own measurement of the round trip and
 * throughput it is currently getting, NOT the radio technology — a phone on
 * 5G in a lift reports `2g`. That is the number worth reading, because it
 * describes what this page is actually about to receive.
 *
 * ONLY BACKGROUND VIDEO IS REFUSED. A portfolio tile is the content of the
 * page — somebody on `/portfolio/animation/` came to watch the work, and
 * deciding on their behalf that they may not is a different and worse failure
 * than a slow one. Tiles are held to the viewport gate instead, which on a
 * phone is narrow enough that only what is on screen is ever fetched.
 *
 * Not a permanent verdict. `sweep()` re-asks on every event and the `change`
 * listener in `initVideo` re-asks when the estimate moves, so a visitor who
 * walks back into signal gets the hero without reloading the page.
 */
type Connection = { saveData?: boolean; effectiveType?: string };
const SLOW = new Set(['slow-2g', '2g', '3g']);

function thrifty(): boolean {
  const { saveData, effectiveType } =
    (navigator as Navigator & { connection?: Connection }).connection ?? {};
  return Boolean(saveData) || SLOW.has(effectiveType ?? '');
}

/**
 * Give the element its source, if it is allowed one yet.
 *
 * Returns whether the element now has something to play, so `play()` can stop
 * rather than calling into an element with no source and collecting a
 * rejection for it.
 *
 * `forced` is a gesture: somebody pressed play on a tile's own control bar,
 * which outranks every policy above it for the same reason `invited` outranks
 * reduced motion — they asked.
 */
function attach(v: HTMLVideoElement, forced = false): boolean {
  if (sourced.has(v)) return true;

  const tag = v.querySelector<HTMLSourceElement>('source[data-src]');
  const url = v.dataset.src || tag?.dataset.src;

  /* Nothing deferred here: the element already carries its own `src`, or there
     is no video at all. Either way there is nothing for this to do, and saying
     so once stops every later call re-reading the DOM. */
  if (!url) {
    sourced.add(v);
    return true;
  }

  if (!forced) {
    if (!pageLoaded()) return false;
    if (!isPlayer(v) && thrifty()) return false;
  }

  sourced.add(v);

  /* `metadata`, never `auto`. A media element delays the window `load` event
     until its preload level is satisfied, and `auto` means frames rather than
     the header — see the note in Loader.astro. By the time this runs `load`
     has normally fired already, so the level chosen here cannot hold the
     curtain; leaving it at `auto` would make that true by accident rather
     than on purpose, and a forced attach can run before `load`. */
  v.preload = 'metadata';
  if (tag) tag.src = url;
  else v.src = url;

  /* Required after writing a <source>: the element only re-runs resource
     selection when asked. Harmless on the direct-`src` path. */
  v.load();
  return true;
}

/**
 * When the visitor last touched this video. A pause is theirs only if it
 * follows a gesture on the element within a moment.
 *
 * Reading `document.visibilityState` instead was the obvious approach and it
 * is wrong: a browser pausing media for a backgrounded tab and the
 * `visibilitychange` event are not ordered against each other, so switching
 * tabs was intermittently recorded as the visitor pressing pause — and the
 * tile then stayed dead for the rest of the session.
 */
const touched = new WeakMap<HTMLVideoElement, number>();
const GESTURE_WINDOW_MS = 1000;

/**
 * A tile the visitor started by hand.
 *
 * Only reduced motion cares. The setting suppresses playback nobody asked
 * for, which is every video here by default — but a tile carries a real
 * control bar, and somebody who presses play on it has asked. Without this the
 * next sweep would pause it again and the button would look broken.
 */
const invited = new WeakSet<HTMLVideoElement>();

let io: IntersectionObserver | null = null;
let listening = false;

const isPlayer = (v: HTMLVideoElement) => v.dataset.video === 'player';

/**
 * Held in a module-level reference rather than re-queried per call, for two
 * reasons: `wants` runs on every media event on every video, and a
 * `MediaQueryList` with a listener but no reference has historically been
 * collectable in WebKit — at which point the `change` handler below silently
 * stops firing and the setting only takes effect on the next page load.
 */
const reducedQuery = typeof matchMedia === 'function'
  ? matchMedia('(prefers-reduced-motion: reduce)')
  : null;

/**
 * Should this video be playing right now?
 *
 * Every branch below is a reason a browser or a person has already decided it
 * should not be, and stating them together is what stops the watchdog fighting
 * any of them. A watchdog that ignores one of these is worse than no watchdog.
 */
function wants(v: HTMLVideoElement): boolean {
  if (!v.isConnected) return false;
  /* A full-screen loop behind a headline is the clearest case there is for
     this setting, and CSS cannot help — `autoplay` has already fired by the
     time a media query could apply. Pausing leaves the poster: the same
     picture, holding still. A tile keeps its control bar, so a visitor who
     wants the motion can still ask for it, and `invited` is that asking. */
  if (reducedQuery?.matches && !invited.has(v)) return false;
  if (document.visibilityState !== 'visible') return false;
  if (offscreen.has(v)) return false;
  if (stopped.has(v)) return false;
  return true;
}

/**
 * Ask for playback, and do not care if the answer is no.
 *
 * `play()` rejects for a long list of ordinary reasons — the source is not
 * ready, another `load()` interrupted it, the tab lost focus mid-call — and an
 * unhandled rejection in any of them is a console error on a page that is
 * working fine. One retry covers the "not ready yet" case, which is the one
 * that actually left heroes frozen on a cold cache.
 */
function play(v: HTMLVideoElement, retry = true) {
  if (!wants(v)) return;
  /* Before `v.paused`, not after: an element that has never been given a
     source is paused AND has nothing to start, so asking it to play collects a
     rejection for a decision we have already made. */
  if (!attach(v)) return;
  if (!v.paused) return;
  const started = v.play();
  if (!started) return;
  started.catch(() => {
    if (!retry) return;
    setTimeout(() => play(v, false), 400);
  });
}

/** A pause of our own making, flagged so the handlers below do not read it as
    the visitor's. */
function halt(v: HTMLVideoElement) {
  if (v.paused) return;
  ourPause.add(v);
  v.pause();
}

/** Re-assert silence on a background video. Setting `muted` fires
    `volumechange`, which lands back here — harmless, because the second pass
    finds it already true and changes nothing. */
function silence(v: HTMLVideoElement) {
  if (!v.muted) v.muted = true;
  if (!v.loop) v.loop = true;
}

/**
 * One tile with audio, never two.
 *
 * Nine tiles autoplay on a discipline page. Without this, unmuting a second
 * one does not replace the first — it adds to it, and the visitor's only way
 * back to silence is to find every tile they have touched.
 */
function soloAudio(target: HTMLVideoElement) {
  for (const v of document.querySelectorAll<HTMLVideoElement>(SELECTOR)) {
    if (v !== target && isPlayer(v) && !v.muted) v.muted = true;
  }
}

/**
 * Hand over from the still to the moving picture without a cut.
 *
 * A `<video>`'s `poster` is swapped for the first decoded frame INSTANTLY and
 * unfaded. When the two are the same picture nobody notices; when they are not
 * — a poster picked from a good moment, a video that opens on black — the hero
 * visibly snaps the instant playback begins, and again on every loop. Choosing
 * a better still makes that worse, not better, because it widens the gap.
 *
 * So the video is faded in over whatever is behind it instead. Every component
 * that uses this already keeps the still as a real element underneath (the two
 * heroes, the discipline tile, the piece tile), so there is always something to
 * fade FROM.
 *
 * THE DEFAULT IS NO FADE, and that is what makes it safe. `data-fade` is set
 * here, in script, so a page whose JavaScript never runs has neither attribute
 * and renders exactly as it did before — video visible, native poster swap.
 * The opacity it fades TO is the component's business, not this module's: the
 * page-hero band sits at 0.38 so its picture reads through, and a rule here
 * that said `opacity: 1` would quietly break it.
 */
function fadeIn(v: HTMLVideoElement) {
  if (v.dataset.ready !== undefined) return;
  /* Two frames of actual painting, not just the `playing` event: `playing`
     fires when the element decides it will play, which on a cold buffer is
     before anything is on screen. Fading in there shows the gap rather than
     hiding it. */
  if (v.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      v.dataset.ready = '';
    });
  });
}

function wire(v: HTMLVideoElement) {
  if (wired.has(v)) return;
  wired.add(v);

  /* Marks the element as ours to fade. Paired with `data-ready` below by CSS
     in each component — see the note on `fadeIn`. */
  v.dataset.fade = '';
  v.addEventListener('playing', () => fadeIn(v));
  v.addEventListener('timeupdate', () => fadeIn(v));

  /* Belt and braces on top of the attributes. A `loop` stripped by an editor
     paste, or a `muted` lost to a browser restoring media state across a
     session, would otherwise be invisible until someone heard it. */
  v.loop = true;
  v.playsInline = true;
  if (!isPlayer(v)) {
    silence(v);
    /* Nothing to route to a TV or a floating window: this is wallpaper, and
       the picture-in-picture affordance on it is pure confusion. */
    v.disablePictureInPicture = true;
    (v as HTMLVideoElement & { disableRemotePlayback: boolean }).disableRemotePlayback = true;
  } else {
    /* Muted on arrival, every arrival — including a back-navigation, where a
       browser will happily restore the unmuted state the visitor left behind
       on a page they are now seeing for the first time again. */
    v.muted = true;
  }

  /* A press on a tile's own control bar is the visitor asking, which outranks
     every policy in `attach` — the page may still be loading, the connection
     may be metered, and neither is our call once somebody has reached for the
     play button. Same reasoning as `invited` against reduced motion. */
  const gesture = () => {
    touched.set(v, performance.now());
    if (isPlayer(v)) attach(v, true);
  };
  v.addEventListener('pointerdown', gesture, { passive: true });
  v.addEventListener('keydown', gesture, { passive: true });

  v.addEventListener('pause', () => {
    if (ourPause.delete(v)) return;

    /* A background loop has no pause button, so a pause it did not ask for is
       always the browser's doing and always worth undoing. */
    if (!isPlayer(v)) {
      play(v);
      return;
    }

    const recent = performance.now() - (touched.get(v) ?? -Infinity) < GESTURE_WINDOW_MS;
    if (recent) stopped.add(v);
    else play(v);
  });

  /* However playback started — our call, or the visitor pressing play on the
     control bar — the tile is live again and the earlier stop is spent. A
     press of their own also counts as asking for the motion, which is the one
     thing that outranks "reduce motion" here. */
  v.addEventListener('play', () => {
    stopped.delete(v);
    if (performance.now() - (touched.get(v) ?? -Infinity) < GESTURE_WINDOW_MS) invited.add(v);
  });

  v.addEventListener('ended', () => {
    /* `loop` makes this unreachable in every browser that honours it. It is
       here for the one that does not, where a hero would otherwise sit on its
       last frame — which is the exact symptom this module exists to kill. */
    v.currentTime = 0;
    play(v);
  });

  v.addEventListener('volumechange', () => {
    if (!isPlayer(v)) {
      silence(v);
      return;
    }
    if (!v.muted) soloAudio(v);
  });

  /*
   * A STALLED FETCH, which is what "it gets stuck on reload" usually is.
   *
   * `preload="metadata"` gets the browser the header and no more, so the first
   * frames are a second request — and a range request to a CDN that is cold,
   * rate-limited or mid-redeploy can simply never finish. The element stays on
   * its poster with `readyState` stuck below HAVE_FUTURE_DATA, fires no error,
   * and waits forever.
   *
   * `preload="auto"` is NOT the fix, tempting as it looks. A media element
   * delays the window `load` event until it has what its preload level asks
   * for, `auto` means the frames rather than the header, and the first-load
   * curtain in `Loader.astro` lifts on `load` — so raising it holds a black
   * screen in front of the visitor for longer and calls it a fix. That is the
   * "lag on refresh" version of this bug, bought with the cure for the other.
   *
   * `load()` abandons that request and starts the resource selection over,
   * which is the only lever there is. Once per element per page view.
   */
  const recover = () => {
    if (!wants(v) || recovered.has(v)) return;
    /* Nothing to recover from before there is a source to fetch. Without this
       an element still waiting on `attach` could spend its one retry on a
       request that was never made, leaving a genuinely stalled fetch later in
       the page's life with nothing left to try. */
    if (!sourced.has(v)) return;
    if (v.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return;
    recovered.add(v);
    v.load();
    play(v);
  };
  v.addEventListener('stalled', recover);
  v.addEventListener('suspend', () => play(v));
  v.addEventListener('waiting', () => setTimeout(recover, 2500));
  v.addEventListener('canplay', () => play(v));
  v.addEventListener('loadeddata', () => play(v));
}

/**
 * Don't decode what nobody is looking at.
 *
 * This is the part that answers "no lag". A discipline page can hold nine
 * autoplaying tiles, and a browser decodes every one of them whether or not it
 * is on screen — which is the whole video budget of the page spent on the
 * eight nobody is looking at, and it shows up as a janky scroll and a hot fan
 * rather than as anything obviously video-shaped.
 *
 * A generous margin, so a tile is already running by the time it is scrolled
 * to rather than visibly starting once it arrives.
 */
/**
 * How far outside the viewport a video may start loading.
 *
 * Two viewports is right on a desktop: the margin exists so a tile is already
 * running by the time it is scrolled to rather than visibly starting once it
 * arrives, and there the bytes are free.
 *
 * On a phone they are not. Two viewports of a one-column grid is most of the
 * page, so a generous margin there means fetching nearly every video on it at
 * once — over the one connection that the page, its images and its fonts are
 * also using. Half a viewport still starts a tile before it is reached at any
 * plausible scroll speed, and fetches only what somebody is actually
 * approaching.
 *
 * A FUNCTION, re-asked per observer rather than frozen once at module scope.
 * `teardownVideo` drops the observer on every navigation, so each page asks
 * again — and a phone turned on its side, or a desktop window dragged narrow,
 * cannot be left holding the margin the other shape was measured for.
 */
const margin = () =>
  typeof matchMedia === 'function' && matchMedia('(max-width: 820px)').matches
    ? '50% 0px'
    : '200% 0px';

function gate(v: HTMLVideoElement) {
  io ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLVideoElement;
        if (entry.isIntersecting) {
          offscreen.delete(el);
          play(el);
        } else {
          offscreen.add(el);
          halt(el);
        }
      }
    },
    { rootMargin: margin() }
  );
  io.observe(v);
}

/** Re-ask the question for every video on the page. */
function sweep() {
  for (const v of document.querySelectorAll<HTMLVideoElement>(SELECTOR)) {
    if (!isPlayer(v)) silence(v);
    if (wants(v)) play(v);
    else halt(v);
  }
}

/**
 * Wire up whatever is on the page now.
 *
 * Called from `astro:page-load`, so it runs on the first arrival and again
 * after every client-side swap. Everything it touches is idempotent — the
 * WeakSets above are what make calling it twice on the same element free.
 */
export function initVideo() {
  const videos = [...document.querySelectorAll<HTMLVideoElement>(SELECTOR)];
  for (const v of videos) {
    wire(v);
    gate(v);
  }

  if (!listening) {
    listening = true;

    /*
     * A BACK-NAVIGATION OUT OF THE BFCACHE, the other half of "come back from
     * another page". The document is restored wholesale, frozen exactly as it
     * was left — including any video the browser paused on the way out. No
     * `astro:page-load` fires, because as far as the router is concerned
     * nothing was loaded.
     */
    window.addEventListener('pageshow', sweep);

    /* A backgrounded tab has its media paused by the browser and is not given
       it back on return. */
    document.addEventListener('visibilitychange', sweep);

    /* Turning the setting on mid-visit should stop the motion then and there,
       and turning it off should give it back. */
    reducedQuery?.addEventListener('change', sweep);

    /*
     * The moment the deferral above is waiting for.
     *
     * Normally DEAD CODE, and deliberately kept anyway. `initVideo` is driven
     * by `astro:page-load`, which the router fires from its own `load`
     * handler — so by the time this runs `pageLoaded()` is already true and
     * there is nothing to wait for.
     *
     * It exists for the arrangement where that is not true: a host that fires
     * the event earlier, or a direct call to `initVideo` from somewhere else.
     * Then this re-sweeps once the page is done and the videos start. It is
     * one listener, registered at most once, and it is the difference between
     * "the ordering changed" and "the videos silently never play again".
     */
    if (!pageLoaded()) window.addEventListener('load', sweep, { once: true });

    /* A visitor who walks out of a lift, or turns Data Saver off, should get
       the hero without reloading. Not implemented everywhere — Safari has no
       Network Information API at all, which `thrifty()` reads as "not slow"
       and is the right default for a browser that will not say. */
    (
      navigator as Navigator & { connection?: { addEventListener?: typeof addEventListener } }
    ).connection?.addEventListener?.('change', sweep);
  }

  sweep();
}

/**
 * Drop the viewport observer before a swap.
 *
 * The elements it watches are about to leave the document, and an observer
 * holding references to them across every navigation of a session is a leak
 * that grows with how much of the site somebody reads. The document-level
 * listeners above are deliberately NOT removed: they are registered once, they
 * outlive any single page, and re-adding them per page is how you end up with
 * forty copies of the same handler.
 */
export function teardownVideo() {
  io?.disconnect();
  io = null;
}
