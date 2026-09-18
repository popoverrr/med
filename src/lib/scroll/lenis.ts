/** Инерционный скролл Lenis, синхронизированный с тикером GSAP и ScrollTrigger. */
import Lenis from 'lenis';
import { gsap, ScrollTrigger, prefersReducedMotion } from '@/lib/gsap';

let lenis: Lenis | null = null;

export function getLenis(): Lenis | null {
  return lenis;
}

export function initLenis(): Lenis | null {
  if (lenis) return lenis;
  if (prefersReducedMotion()) return null;

  lenis = new Lenis({
    lerp: 0.1,
    wheelMultiplier: 1,
    touchMultiplier: 1.3,
    smoothWheel: true,
    syncTouch: false,
    anchors: { offset: -80 },
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  document.documentElement.classList.add('lenis');
  if (import.meta.env.DEV) (window as unknown as { __lenis: Lenis }).__lenis = lenis; // QA: scripts/shoot.mjs
  return lenis;
}

export function stopScroll() { lenis?.stop(); }
export function startScroll() { lenis?.start(); }

export function scrollToTop(immediate = true) {
  if (lenis) lenis.scrollTo(0, { immediate });
  else window.scrollTo({ top: 0, behavior: 'auto' });
}
