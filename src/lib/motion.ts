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
 * Route in-page anchor links through Lenis.
 *
 * A native `#id` jump moves the scroll position without Lenis knowing, so
 * Lenis's internal position goes stale and the value it feeds ScrollTrigger
 * disagrees with the real one. Triggers below the jump then never fire and
 * their elements stay at opacity 0 forever. Going through lenis.scrollTo
 * keeps both in sync — and gives the jump a smooth ride for free.
 */
function initAnchors() {
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const hash = link.getAttribute('href');
      if (!hash || hash === '#') return;

      const target = document.querySelector<HTMLElement>(hash);
      if (!target) return;

      e.preventDefault();

      if (lenis) {
        // Lenis scrolls to the element's raw offset and ignores
        // scroll-margin-top, so a heading would land underneath the fixed
        // header. Reading the property back and passing it as a negative
        // offset reproduces what a native anchor jump already does — and
        // keeps the amount declared in CSS next to the header height it
        // depends on, rather than hardcoded here.
        const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
        lenis.scrollTo(target, { offset: -margin });
      } else {
        // Native scrollIntoView honours scroll-margin-top by itself.
        target.scrollIntoView({ block: 'start' });
      }

      // Move keyboard focus too, or the skip link scrolls but strands the
      // caret in the nav. tabindex lets a non-interactive target receive it.
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  });
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
  lenis?.destroy();
  lenis = null;
}
