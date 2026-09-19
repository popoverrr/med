/**
 * Обёртка GSAP: единая регистрация плагинов, motion-токены, проверки окружения.
 * Club-плагины не используются (ТЗ §2): split-text, path-morph — собственные реализации в lib/motion.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
export const EASE_INOUT = 'cubic-bezier(0.65, 0, 0.35, 1)';
export const D = { fast: 0.24, base: 0.56, slow: 1.1 } as const;

gsap.defaults({ ease: 'expo.out', duration: D.base });
gsap.config({ nullTargetWarn: false });
// Пересчёт триггеров по 'load' не нужен: оркестратор (lib/app.ts) сам делает refresh после инициализации
// страницы и после загрузки шрифтов — иначе на телефонах получаем 3–4 полных замера страницы подряд.
ScrollTrigger.config({ autoRefreshEvents: 'visibilitychange,DOMContentLoaded,resize' });

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && window.innerWidth >= 1024;
}

export function isFinePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

/** Убрать will-change после завершения анимации (ТЗ §4.3). */
export function clearWillChange(targets: gsap.TweenTarget) {
  gsap.set(targets, { clearProps: 'willChange' });
}

export { gsap, ScrollTrigger };
