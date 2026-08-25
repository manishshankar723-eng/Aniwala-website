/**
 * Central motion setup: Lenis smooth scroll + GSAP/ScrollTrigger, wired
 * together so they share one scroll position and one RAF loop.
 *
 * Everything here no-ops when the visitor has asked their OS for reduced
 * motion. That is an accessibility requirement, not a nicety — smooth-scroll
 * sites genuinely make some people motion sick.
 */
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let lenis: Lenis | null = null;

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initMotion() {
  // Re-running on every view transition would stack RAF loops.
  teardownMotion();

  if (prefersReducedMotion()) {
    // Reveal everything immediately and skip the whole animation layer.
    gsap.set('[data-reveal]', { opacity: 1, y: 0, clearProps: 'all' });
    return;
  }

  lenis = new Lenis({ lerp: 0.08, wheelMultiplier: 1 });
  lenis.on('scroll', ScrollTrigger.update);

  gsap.ticker.add((time) => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  initReveals();
  initAnchors();
  ScrollTrigger.refresh();
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
  const vh = window.innerHeight;

  gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
    const vars: gsap.TweenVars = {
      opacity: 0,
      y: 24,
      duration: 0.9,
      ease: 'power3.out',
      delay: Number(el.dataset.revealDelay ?? 0),
    };

    if (el.getBoundingClientRect().top < vh) {
      gsap.from(el, vars);
    } else {
      gsap.from(el, {
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
  ScrollTrigger.getAll().forEach((t) => t.kill());
  lenis?.destroy();
  lenis = null;
}

export { lenis, gsap, ScrollTrigger };
