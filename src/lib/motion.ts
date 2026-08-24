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
  ScrollTrigger.refresh();
}

/** Any element with data-reveal rises and fades in once, on scroll. */
function initReveals() {
  gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
    gsap.from(el, {
      opacity: 0,
      y: 24,
      duration: 0.9,
      ease: 'power3.out',
      delay: Number(el.dataset.revealDelay ?? 0),
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
    });
  });
}

export function teardownMotion() {
  ScrollTrigger.getAll().forEach((t) => t.kill());
  lenis?.destroy();
  lenis = null;
}

export { lenis, gsap, ScrollTrigger };
