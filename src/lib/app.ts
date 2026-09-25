/**
 * Клиентский оркестратор. Живёт весь сеанс (Astro ClientRouter не перезапускает модули):
 *  - постоянные модули (Lenis, курсор, page transitions) — один раз;
 *  - страничные модули — на каждый astro:page-load, снимаются на astro:before-swap.
 */
import { gsap, ScrollTrigger, prefersReducedMotion } from '@/lib/gsap';
import { initLenis, scrollToTop, getLenis } from '@/lib/scroll/lenis';
import { initReveals } from '@/lib/motion/reveal';
import { initBackground } from '@/lib/motion/background';
import { initParallax, initCounters, initMagnetic } from '@/lib/motion/effects';
import { initCursor } from '@/lib/motion/cursor';
import { initDrawOnScroll } from '@/lib/motion/svgPath';
import { initTransitions, curtainOut } from '@/lib/motion/transitions';
import { initHeader } from '@/lib/ui/header';
import { initBookingModal } from '@/lib/ui/modal';
import { initLightbox } from '@/lib/ui/lightbox';
import { initFaq, initCookieBanner, initMap } from '@/lib/ui/misc';

let pageCleanups: Array<() => void> = [];
let booted = false;

/** Уступить главный поток между этапами инициализации — дробим работу на короткие задачи (TBT/INP). */
const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));
/** Метки этапов для профилирования (performance.measure 'hm:*' — видны в DevTools Performance) */
const stage = (name: string, fn: () => void) => { const t0 = performance.now(); fn(); performance.measure(`hm:${name}`, { start: t0 }); };

function boot() {
  if (booted) return;
  booted = true;
  document.documentElement.classList.add('js');
  if (import.meta.env.DEV) (window as unknown as { __gsap: unknown }).__gsap = { gsap, ScrollTrigger };
  if (prefersReducedMotion()) document.documentElement.classList.remove('lenis');
  initTransitions();
  initLenis();
  initCursor();
  // Печать юр. документов без inline-обработчиков (строгий CSP)
  document.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('[data-print]')) window.print(); });
}

async function mountPage() {
  // Отделяем инициализацию от задачи, в которой выполняются модули и диспатчится astro:page-load
  await yieldToMain();
  stage('boot', boot);
  const html = document.documentElement;
  // Порядок важен: фон/шапка → появления → эффекты → UI. Между этапами уступаем главный поток.
  stage('header+bg', () => pageCleanups.push(initHeader(), initBackground()));
  await yieldToMain();
  stage('reveals', () => pageCleanups.push(initReveals()));
  await yieldToMain();
  stage('effects', () => pageCleanups.push(initParallax(), initCounters(), initDrawOnScroll(), initMagnetic()));
  await yieldToMain();
  stage('ui', () => pageCleanups.push(initBookingModal(), initLightbox(), initFaq(), initCookieBanner(), initMap()));
  const home = html.dataset.page === 'home';
  if (home) {
    const mod = await import('@/lib/home');
    await yieldToMain();
    stage('home', () => pageCleanups.push(mod.initHome()));
  }
  // Полный пересчёт триггеров — один раз (главная делает его сама после создания pin-секций)
  // и ещё раз после загрузки шрифтов, если они ещё грузятся
  const fontsPending = document.fonts && document.fonts.status !== 'loaded';
  if (!home) stage('refresh', () => { ScrollTrigger.sort(); ScrollTrigger.refresh(); });
  if (fontsPending) document.fonts.ready.then(() => stage('refresh-fonts', () => ScrollTrigger.refresh()));
  curtainOut();
  // QA: ?scrollTo=<px> — прокрутка к позиции для headless-скриншотов (scripts/shoot.mjs)
  const to = Number(new URLSearchParams(location.search).get('scrollTo'));
  if (to > 0) setTimeout(() => { ScrollTrigger.refresh(); const l = getLenis(); if (l) l.scrollTo(to, { immediate: true, force: true }); else window.scrollTo(0, to); }, 400);
}

function unmountPage() {
  pageCleanups.splice(0).forEach((fn) => { try { fn(); } catch { /* модуль уже снят */ } });
  ScrollTrigger.getAll().forEach((t) => t.kill());
}

document.addEventListener('astro:page-load', () => { void mountPage(); });
document.addEventListener('astro:before-swap', unmountPage);
document.addEventListener('astro:after-swap', () => scrollToTop(true));
