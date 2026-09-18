/**
 * Page transitions (ТЗ §4.2.10): Astro View Transitions (ClientRouter) + GSAP-занавес
 * цвета бургунди. Занавес закрывается до загрузки следующей страницы и открывается
 * после инициализации новой (astro:page-load). Reduced motion → без занавеса.
 */
import { gsap, prefersReducedMotion } from '@/lib/gsap';

const curtain = () => document.querySelector<HTMLElement>('[data-curtain]');

export function curtainIn(): Promise<void> {
  const el = curtain();
  if (!el || prefersReducedMotion()) return Promise.resolve();
  return new Promise((resolve) => {
    gsap.killTweensOf(el);
    gsap.fromTo(el, { yPercent: 101 }, { yPercent: 0, duration: 0.56, ease: 'expo.inOut', onComplete: resolve });
  });
}

export function curtainOut(): Promise<void> {
  const el = curtain();
  if (!el) return Promise.resolve();
  if (prefersReducedMotion()) { gsap.set(el, { yPercent: 101 }); return Promise.resolve(); }
  return new Promise((resolve) => {
    gsap.killTweensOf(el);
    gsap.to(el, { yPercent: -101, duration: 0.7, ease: 'expo.inOut', delay: 0.05, onComplete: () => { gsap.set(el, { yPercent: 101 }); resolve(); } });
  });
}

let armed = false;
export function initTransitions() {
  if (armed) return;
  armed = true;
  const el = curtain();
  if (el) { gsap.set(el, { yPercent: 101 }); el.classList.add('is-armed'); }
  document.addEventListener('astro:before-preparation', (ev) => {
    const e = ev as Event & { loader: () => Promise<void>; navigationType: string };
    const original = e.loader;
    e.loader = async () => {
      await Promise.all([curtainIn(), original()]);
    };
  });
}
