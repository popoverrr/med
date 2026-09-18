/**
 * FLIP-переход (ТЗ §4.2.4): элемент «превращается» в модальное окно.
 * First: rect источника; Last: rect цели; Invert: transform цели под источник; Play: анимация к identity.
 */
import { gsap, prefersReducedMotion } from '@/lib/gsap';

/** Страховка: если rAF остановлен (фоновая вкладка), промис всё равно завершится. */
const withTimeout = (p: Promise<void>, ms: number) => Promise.race([p, new Promise<void>((r) => setTimeout(r, ms))]);

export function flipIn(from: HTMLElement | null, to: HTMLElement, duration = 0.7): Promise<void> {
  if (!from || prefersReducedMotion()) {
    return withTimeout(new Promise((resolve) => gsap.fromTo(to, { opacity: 0 }, { opacity: 1, duration: 0.2, onComplete: resolve })), 400);
  }
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const sx = a.width / b.width;
  const sy = a.height / b.height;
  const dx = a.left + a.width / 2 - (b.left + b.width / 2);
  const dy = a.top + a.height / 2 - (b.top + b.height / 2);
  gsap.set(to, { transformOrigin: '50% 50%', x: dx, y: dy, scaleX: sx, scaleY: sy, opacity: 0.6, willChange: 'transform, opacity' });
  return withTimeout(new Promise((resolve) => {
    gsap.to(to, {
      x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1,
      duration,
      ease: 'expo.out',
      onComplete: () => { gsap.set(to, { clearProps: 'transform,willChange' }); resolve(); },
    });
  }), duration * 1000 + 300).then(() => { gsap.killTweensOf(to); gsap.set(to, { clearProps: 'transform,willChange,opacity' }); });
}

export function flipOut(to: HTMLElement, from: HTMLElement | null, duration = 0.45): Promise<void> {
  if (!from || prefersReducedMotion()) {
    return withTimeout(new Promise((resolve) => gsap.to(to, { opacity: 0, duration: 0.2, onComplete: resolve })), 400).then(() => { gsap.killTweensOf(to); gsap.set(to, { clearProps: 'opacity' }); });
  }
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  return withTimeout(new Promise((resolve) => {
    gsap.to(to, {
      x: a.left + a.width / 2 - (b.left + b.width / 2),
      y: a.top + a.height / 2 - (b.top + b.height / 2),
      scaleX: a.width / b.width,
      scaleY: a.height / b.height,
      opacity: 0,
      duration,
      ease: 'expo.in',
      onComplete: () => { gsap.set(to, { clearProps: 'transform,opacity' }); resolve(); },
    });
  }), duration * 1000 + 300).then(() => { gsap.killTweensOf(to); gsap.set(to, { clearProps: 'transform,opacity,willChange' }); });
}
