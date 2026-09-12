/**
 * Central motion setup: Lenis smooth scroll + GSAP/ScrollTrigger, wired
 * together so they share one scroll position and one RAF loop.
 *
 * Everything here no-ops when the visitor has asked their OS for reduced
 * motion. That is an accessibility requirement, not a nicety — smooth-scroll
 * sites genuinely make some people motion sick.
 */
import type LenisType from 'lenis';
import type { gsap as GsapType } from 'gsap';

/**
 * GSAP, ScrollTrigger and Lenis are ~130KB of JavaScript, and a visitor who
 * has asked their OS for reduced motion runs none of it. They used to
 * download all of it anyway, because a static `import` is fetched and parsed
 * before the first line of this module executes — the reduced-motion check
 * happened far too late to save anybody anything.
 *
 * Importing them dynamically moves the check in front of the download. It
 * also gets the animation layer out of the critical path for everybody else:
 * the chunk is now requested after the page is interactive rather than as
 * part of the initial module graph.
 *
 * The cost is that everything below has to cope with `gsap` being null until
 * the import lands, which is why the reveal fallback exists.
 */
type Gsap = typeof GsapType;
type ScrollTriggerType = typeof import('gsap/ScrollTrigger')['ScrollTrigger'];

let gsap: Gsap | null = null;
let ScrollTrigger: ScrollTriggerType | null = null;
let lenis: LenisType | null = null;

/**
 * Set by teardownMotion, cleared by initMotion. A view transition can swap the
 * document while the dynamic import is still in flight; without this the
 * resolved import would wire a Lenis instance and a RAF ticker to a page that
 * no longer exists.
 */
let stale = false;

/**
 * The reveal failsafe's observer — see `watchForStuckReveals`. Held at module
 * level so a view transition can disconnect it along with everything else.
 */
let rescue: IntersectionObserver | null = null;

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

async function loadEngine() {
  if (gsap && ScrollTrigger) return;
  const [gsapMod, stMod] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
  gsap = gsapMod.gsap;
  ScrollTrigger = stMod.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);
}

export function initMotion() {
  // Re-running on every view transition would stack RAF loops.
  teardownMotion();
  stale = false;

  if (prefersReducedMotion()) {
    // Reveal everything immediately and skip the whole animation layer —
    // without loading it. Plain DOM, because gsap is not here and must not be
    // fetched just to set two properties.
    revealAllImmediately();
    initAnchors();
    landOnHash();
    return;
  }

  void (async () => {
    await loadEngine();
    const { default: Lenis } = await import('lenis');

    // A view transition may have fired teardown while we were importing. If
    // it did, this init is stale and must not start a RAF loop nobody owns.
    if (stale) return;

    lenis = new Lenis({ lerp: 0.08, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger!.update);

    gsap!.ticker.add((time) => lenis?.raf(time * 1000));
    gsap!.ticker.lagSmoothing(0);

    initReveals();
    initAnchors();
    ScrollTrigger!.refresh();
    landOnHash();
    watchForStuckReveals();

    /*
     * Measure again once the page has stopped moving.
     *
     * The triggers above were built against whatever the layout was at that
     * instant. The display face swaps in after first paint and every heading
     * changes height when it does, which moves every trigger's start — and on
     * a client-side navigation the new stylesheet can still be in flight, so
     * the first measurement can be of a layout that never actually renders.
     * A refresh costs nothing and is the difference between a trigger that
     * fires where the element is and one that fires where it briefly was.
     */
    void document.fonts?.ready.then(() => {
      if (!stale) ScrollTrigger?.refresh();
    });
  })();
}

/**
 * `[data-reveal]` elements are visible by default in CSS — GSAP animates them
 * *from* transparent rather than *to* opaque. So for reduced motion there is
 * nothing to undo; this only clears anything a previous non-reduced init left
 * behind, which can happen when the OS setting changes mid-session.
 */
function revealAllImmediately() {
  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    el.style.opacity = '';
    el.style.transform = '';
  });
}

/**
 * Last resort: show anything a visitor can see but the animation left hidden.
 *
 * WHY THIS HAS TO EXIST. Once the engine loads, every `[data-reveal]` element
 * is set to `opacity: 0` by `gsap.from()` and depends on a ScrollTrigger
 * firing to come back. That makes the page's content invisible BY DEFAULT and
 * visible only if a measurement is right — and a measurement taken before the
 * stylesheet applies is not right. When that happens the element never
 * returns, and the page renders as a heading over an empty screen with all of
 * its text present in the DOM.
 *
 * That is not a hypothetical: it is what `/blog/` did on staging after a
 * deploy landed mid-session. ClientRouter keeps the already-imported modules
 * and swaps in the new document, the new stylesheet arrives asynchronously,
 * and the triggers get built against a layout that is not the final one. A
 * hard reload fixed it, which is the signature of exactly this.
 *
 * So: watch every reveal, and if one is more than half on screen and STILL
 * transparent a beat later, clear it. A correct reveal has always finished by
 * then, so this never fights a working animation — it only ever rescues a
 * broken one. Cheap, and it makes "content permanently invisible" unreachable
 * no matter what else goes wrong upstream.
 */
function watchForStuckReveals() {
  rescue?.disconnect();

  const clear = (el: HTMLElement) => {
    if (Number(getComputedStyle(el).opacity) > 0.05) return;
    gsap?.killTweensOf(el);
    el.style.opacity = '';
    el.style.transform = '';
  };

  rescue = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target as HTMLElement;
        window.setTimeout(() => {
          if (!el.isConnected) return;
          clear(el);
          rescue?.unobserve(el);
        }, 700);
      });
    },
    { threshold: 0.5 }
  );

  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => rescue!.observe(el));
}

/** Breathing room under the thing an anchor jump has to bring into view. */
const ANCHOR_GUTTER = 16;

/**
 * How much FURTHER than a plain anchor jump to scroll, so the thing somebody
 * clicked the link for is actually on the screen.
 *
 * A section marks what matters with `data-anchor-fit`. The booking widget
 * does, and the reason is what this function exists for: an anchor jump puts
 * the SECTION's top under the header, and on `#book` that top is 120px of
 * section padding followed by a centred display headline. The widget itself —
 * the calendar, the slots, the form, the entire point of the link — started
 * below the fold, so the answer to "Book Appointment" was a screen of empty
 * space and a title, and the visitor still had to scroll to reach what they
 * had just asked for.
 *
 * THE LEAST SCROLL THAT WORKS. Not a centred target: centring moves the page
 * even when nothing needed moving, and on a section taller than the window it
 * cuts the heading off for no gain. This scrolls by the shortfall and no more,
 * so a widget that already fits is left exactly where a normal jump puts it.
 *
 * Clamped at the point where the widget's own top reaches the header. Beyond
 * that the section it belongs to has scrolled away and there is nothing left
 * to win — on a window too short to hold the whole widget, the top of it is
 * the half worth keeping.
 */
function fitShift(target: HTMLElement, margin: number): number {
  const fit = target.querySelector<HTMLElement>('[data-anchor-fit]');
  if (!fit) return 0;

  const rect = fit.getBoundingClientRect();
  /* Where the widget sits inside the section, which is what a jump to the
     section's top cannot see. */
  const inset = rect.top - target.getBoundingClientRect().top;

  const bottomAfterJump = margin + inset + rect.height + ANCHOR_GUTTER;
  const shortfall = bottomAfterJump - window.innerHeight;

  return shortfall > 0 ? Math.min(shortfall, inset) : 0;
}

/**
 * Route in-page anchor links through Lenis.
 *
 * A native `#id` jump moves the scroll position without Lenis knowing, so
 * Lenis's internal position goes stale and the value it feeds ScrollTrigger
 * disagrees with the real one. Triggers below the jump then never fire and
 * their elements stay at opacity 0 forever. Going through lenis.scrollTo
 * keeps both in sync — and gives the jump a smooth ride for free.
 *
 * BOTH SPELLINGS OF AN IN-PAGE LINK COUNT, which is why this no longer
 * matches `a[href^="#"]` alone. The gold "Book Appointment" button points at
 * `/contact/#book`, so on the contact page itself it is an in-page jump
 * written as a full path — and nothing treated it as one:
 *
 *   - ClientRouter only skips the page swap when the target has a fragment
 *     (see `samePage` in astro/dist/transitions/router.js), so the old
 *     hash-less `/contact/` re-rendered the page and reset the scroll. That
 *     is the "it reloads instead of scrolling" the button appeared to do.
 *   - With the fragment added, the router hands the jump to the browser
 *     instead — which is the native jump that desyncs Lenis, above.
 *
 * Comparing the resolved path against the current one catches `#book` and
 * `/contact/#book` with one rule, and leaves genuine page-to-page links to
 * the router untouched.
 */
function initAnchors() {
  /* `/contact` and `/contact/` are the same page, and which one is in the
     address bar depends on how the visitor arrived. */
  const samePath = (a: string, b: string) => a.replace(/\/+$/, '') === b.replace(/\/+$/, '');

  document.querySelectorAll('a[href*="#"]').forEach((link) => {
    /* An SVG <a> also carries an href attribute, and its `.href` is an
       SVGAnimatedString rather than a URL string. */
    if (!(link instanceof HTMLAnchorElement)) return;

    link.addEventListener('click', (e) => {
      const url = new URL(link.href, location.href);

      /* Another origin, another page, or no fragment: not an in-page jump.
         The router or the browser handles it, exactly as before. */
      if (url.origin !== location.origin) return;
      if (!samePath(url.pathname, location.pathname)) return;
      if (url.search !== location.search) return;
      if (!url.hash || url.hash === '#') return;

      /* By id rather than as a selector: a fragment is an id, and
         `querySelector('#2024-review')` throws on one that starts with a
         digit. Decoded, because a non-ASCII id arrives percent-encoded. */
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;

      e.preventDefault();
      jumpTo(target);
    });
  });
}

/**
 * Scroll so that `target` — and the thing inside it actually worth seeing —
 * is on screen.
 *
 * LENIS APPLIES scroll-margin-top ITSELF, as of 1.3: it reads the computed
 * property off the target and subtracts it (see `scrollTo` in lenis.mjs).
 * This used to pass `offset: -margin` to reproduce a native jump, which is
 * what older versions needed; against this version it subtracted the margin a
 * SECOND time and every anchor landed a full header-height too low. On #book
 * that was most of a screen of empty space above the heading, with the widget
 * pushed off the bottom. So the margin is read only for the arithmetic in
 * `fitShift`, and the offset carries nothing but the shift.
 *
 * `immediate` is for a jump the visitor did not watch begin — arriving on a
 * page that already carries the fragment. Animating that would scroll the
 * page out from under someone who has not seen it yet.
 */
function jumpTo(target: HTMLElement, immediate = false) {
  const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
  const shift = fitShift(target, margin);

  if (lenis) {
    lenis.scrollTo(target, { offset: shift, immediate });
  } else if (shift) {
    // scrollIntoView cannot express "and then a bit further", so the
    // destination is computed outright. Same arithmetic the browser does
    // for scroll-margin-top, plus the shift.
    const top = window.scrollY + target.getBoundingClientRect().top - margin + shift;
    window.scrollTo({ top });
  } else {
    // Native scrollIntoView honours scroll-margin-top by itself.
    target.scrollIntoView({ block: 'start' });
  }

  // Move keyboard focus too, or the skip link scrolls but strands the
  // caret in the nav. tabindex lets a non-interactive target receive it.
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

/**
 * Land on the fragment the page was OPENED with.
 *
 * `initAnchors` only ever handled a click on a link to the page you were
 * already on. That covered "Book Appointment" on the two pages that carry the
 * widget — the homepage and the contact page — and covered nothing at all on
 * the other sixty-odd, where the same button is a real navigation to
 * `/contact/#book`. Those arrived through the browser, or through
 * ClientRouter, and got a plain anchor jump: the top of the section, under
 * the header, which on `#book` is 120px of padding and a centred display
 * headline with the calendar below the fold. The button said "Book
 * Appointment" and delivered a title.
 *
 * So the correction `fitShift` exists to make is applied on arrival too, and
 * the button means the same thing from every page on the site.
 *
 * TWO PASSES, because the page is still moving when the first one runs:
 *
 *   The calendar does not exist in the HTML — `BookCall` builds the day grid
 *   in its own `astro:page-load` handler — so the widget's height, which is
 *   the whole input to `fitShift`, is wrong until that has run. A frame is
 *   enough: every handler for that event has fired synchronously by then.
 *
 *   The display face swaps in after first paint, and the headline above the
 *   target changes height when it does, moving the target out from under the
 *   position just scrolled to. Hence the second pass — skipped if the visitor
 *   has scrolled in the meantime, because then the page is theirs.
 */
function landOnHash() {
  if (!location.hash || location.hash === '#') return;

  const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (!target) return;

  let landedAt = -1;
  const land = () => {
    jumpTo(target, true);
    landedAt = window.scrollY;
  };

  requestAnimationFrame(land);

  if (document.fonts && document.fonts.status !== 'loaded') {
    void document.fonts.ready.then(() =>
      requestAnimationFrame(() => {
        if (Math.abs(window.scrollY - landedAt) < 4) land();
      })
    );
  }
}

/**
 * Any element with data-reveal rises and fades in.
 *
 * Elements already on screen at load animate immediately. Giving them a
 * ScrollTrigger instead would leave them stuck at opacity 0 forever on any
 * page that fits the viewport, because no scroll ever happens to fire it.
 */
function initReveals() {
  if (!gsap) return;
  const g = gsap;
  const vh = window.innerHeight;

  g.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
    const vars: GSAPTweenVars = {
      opacity: 0,
      y: 24,
      duration: 0.9,
      ease: 'power3.out',
      delay: Number(el.dataset.revealDelay ?? 0),
    };

    if (el.getBoundingClientRect().top < vh) {
      g.from(el, vars);
    } else {
      g.from(el, {
        ...vars,
        scrollTrigger: {
          trigger: el,
          // clamp() keeps the start position inside the scrollable range.
          // Without it, an element near the bottom of the page computes a
          // start beyond max scroll, is never reachable, and stays at
          // opacity 0 forever.
          start: 'clamp(top 85%)',
          once: true,
        },
      });
    }
  });
}

/**
 * Freeze the page behind an overlay (mobile drawer, lightbox).
 *
 * `body { overflow: hidden }` alone is not enough: Lenis scrolls
 * programmatically and ignores it, so the page keeps moving under the
 * overlay. Lenis must be told to stop as well.
 */
export function lockScroll() {
  lenis?.stop();
  document.body.style.overflow = 'hidden';
}

export function unlockScroll() {
  lenis?.start();
  document.body.style.overflow = '';
}

export function teardownMotion() {
  // Any init still waiting on its import must abandon itself when it lands.
  stale = true;

  // Null before the engine has ever loaded — on a reduced-motion visit it
  // never loads at all, and teardown still runs on every navigation.
  ScrollTrigger?.getAll().forEach((t) => t.kill());
  rescue?.disconnect();
  rescue = null;
  lenis?.destroy();
  lenis = null;
}
