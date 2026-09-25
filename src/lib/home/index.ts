/**
 * Хореография главной страницы: pinned-секции со scrub, image-sequence, горизонтальные ленты,
 * диапазоны сцены для WebGL, «нить воды», постер-деградация. Грузится отдельным чанком только на главной.
 * Pin-режимы работают на всех ширинах (решение заказчика), отключаются только при prefers-reduced-motion.
 */
import { gsap, ScrollTrigger, isLite } from '@/lib/gsap';
import { sceneStore, type SceneKey, type SceneRange } from '@/lib/scene/store';
import { loadScene } from '@/lib/scene/loader';
import { initImageSequence } from './sequence';
import { initExpertVideo } from './expertVideo';
import { createMorph } from '@/lib/motion/svgPath';
import { BG } from '@/lib/motion/background';

const MOTION_OK = '(prefers-reduced-motion: no-preference)';
const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));

export function initHome(): () => void {
  const mm = gsap.matchMedia();
  const cleanups: Array<() => void> = [];

  cleanups.push(initSceneRange());
  cleanups.push(loadScene());
  cleanups.push(initPosterFade());
  // Видеообращение специалиста: работает и при reduced motion (тогда без автозапуска — по кнопке)
  cleanups.push(initExpertVideo());
  cleanups.push(initScenePark());

  mm.add(MOTION_OK, () => {
    const c: Array<() => void> = [];
    let alive = true;
    // Каждый pin — вставка pin-spacer'а и замер страницы (forced reflow). Дробим на короткие задачи,
    // чтобы не блокировать главный поток одним куском (TBT/INP на телефонах), и пересчитываем один раз в конце.
    const steps = [initExpert, initWhat, initHow, initWater, initIndications];
    if (window.innerWidth >= 1280) steps.push(initThread);
    void (async () => {
      await yieldToMain();
      for (const step of steps) {
        if (!alive) return;
        const t0 = performance.now();
        c.push(step());
        performance.measure(`hm:home:${step.name}`, { start: t0 });
        await yieldToMain();
      }
      if (!alive) return;
      const t0 = performance.now();
      // Триггеры шапки, фона и появлений созданы раньше pin-секций (app.ts) и при refresh не учитывали бы
      // высоту pin-spacer'ов выше себя: тон шапки и цвет фона переключались не там — светлая шапка над
      // тёмным блоком. sort() выстраивает все триггеры сверху вниз, после чего refresh считает их верно.
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
      performance.measure('hm:home:refresh', { start: t0 });
    })();
    return () => { alive = false; c.forEach((fn) => fn()); };
  });

  // Reduced-motion: секции статичны, все слайды видны, sequence → постер; pin-секций нет — один refresh сразу
  mm.add('(prefers-reduced-motion: reduce)', () => {
    document.querySelectorAll<HTMLElement>('[data-what-slide]').forEach((s) => s.removeAttribute('aria-hidden'));
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
    return () => {};
  });

  return () => {
    mm.revert();
    cleanups.forEach((fn) => fn());
  };
}

/* ------------------------------------------------------------------ */
/* Лёгкий режим: сцена «паркуется», когда «Что это» закрыло экран        */
/* ------------------------------------------------------------------ */
function initScenePark(): () => void {
  const what = document.querySelector<HTMLElement>('#what');
  if (!isLite() || !what) return () => {};
  const html = document.documentElement;
  // Ниже первых экранов секции непрозрачны (base.css, html.lite) — канвас не виден, и рендерить его незачем:
  // Director перестаёт запрашивать кадры, слой скрывается. Назад — сцена просыпается.
  const st = ScrollTrigger.create({
    trigger: what,
    start: 'top top',
    onEnter: () => html.classList.add('scene-parked'),
    onLeaveBack: () => html.classList.remove('scene-parked'),
  });
  return () => { st.kill(); html.classList.remove('scene-parked'); };
}

/* ------------------------------------------------------------------ */
/* Эксперт: портрет раскрывается из «окна», счётчик опыта, кольцо         */
/* ------------------------------------------------------------------ */
function initExpert(): () => void {
  const section = document.querySelector<HTMLElement>('#expert');
  if (!section) return () => {};
  const clip = section.querySelector<HTMLElement>('[data-expert-clip]');
  const media = section.querySelector<HTMLElement>('[data-expert-media]');
  const counter = section.querySelector<HTMLElement>('[data-expert-counter]');
  const ring = section.querySelector<SVGCircleElement>('[data-expert-ring]');
  const final = counter?.textContent ?? '';
  const target = Number(final) || 0;
  const proxy = { v: 0 };

  // Всё привязано к прохождению секции (scrub), без pin: к моменту, когда секция поднялась до верхней трети
  // экрана, портрет полностью открыт и счётчик показывает финальное значение.
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: section, start: 'top 92%', end: 'top 18%', scrub: 0.6 },
  });
  if (clip) tl.fromTo(clip, { clipPath: 'inset(16% 14% 16% 14% round 32px)' }, { clipPath: 'inset(0% 0% 0% 0% round 32px)' }, 0);
  if (media) tl.fromTo(media, { scale: 1.2 }, { scale: 1 }, 0);
  if (counter && target) {
    tl.fromTo(proxy, { v: 0 }, {
      v: target,
      ease: 'power2.out',
      onUpdate: () => { counter.textContent = String(Math.round(proxy.v)); },
    }, 0.15);
  }
  if (ring) tl.fromTo(ring, { strokeDashoffset: 1 }, { strokeDashoffset: 0 }, 0.2);

  // Уход секции: мягкий параллакс портрета (≤ 8%)
  const drift = media
    ? gsap.fromTo(media, { yPercent: 0 }, {
        yPercent: -8,
        ease: 'none',
        scrollTrigger: { trigger: section, start: 'top top', end: 'bottom top', scrub: 0.6 },
      })
    : null;

  return () => {
    tl.scrollTrigger?.kill();
    tl.kill();
    drift?.scrollTrigger?.kill();
    drift?.kill();
    if (counter) counter.textContent = final;
    gsap.set([clip, media, ring].filter(Boolean), { clearProps: 'all' });
  };
}

/* ------------------------------------------------------------------ */
/* Глобальный прогресс сцены + нормализованные диапазоны секций          */
/* ------------------------------------------------------------------ */
function initSceneRange(): () => void {
  const range = document.querySelector<HTMLElement>('[data-scene-range]');
  if (!range) return () => {};

  // Границы диапазона считаем сами после ScrollTrigger.refresh (когда pin-spacer'ы уже в DOM):
  // ScrollTrigger не учитывает pin-spacing вложенных pinned-секций в 'bottom' контейнера.
  let rangeStart = 0;
  let rangeEnd = 1;

  const update = (scroll: number) => {
    const p = Math.min(1, Math.max(0, (scroll - rangeStart) / Math.max(1, rangeEnd - rangeStart)));
    sceneStore.getState().setProgress(p);
  };

  const st = ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => update(self.scroll()),
  });

  const compute = () => {
    const top = range.getBoundingClientRect().top + window.scrollY;
    rangeStart = top;
    rangeEnd = top + range.offsetHeight - window.innerHeight;
    const span = Math.max(rangeEnd - rangeStart, 1);
    const els = Array.from(range.querySelectorAll<HTMLElement>('[data-scene]'));
    const tops = els.map((el) => el.getBoundingClientRect().top + window.scrollY);
    const ranges: SceneRange[] = els.map((el, i) => ({
      key: el.dataset.scene as SceneKey,
      start: Math.min(1, Math.max(0, (tops[i]! - rangeStart) / span)),
      end: i < els.length - 1 ? Math.min(1, Math.max(0, (tops[i + 1]! - rangeStart) / span)) : 1,
    }));
    // Дубли ключей (equipment встречается дважды) — объединяем в один диапазон
    const merged: SceneRange[] = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && last.key === r.key) last.end = r.end;
      else merged.push({ ...r });
    }
    sceneStore.getState().setRanges(merged);
    // Полосы фона для WebGL: все секции с data-bg на странице (включая футер)
    const bands = Array.from(document.querySelectorAll<HTMLElement>('[data-bg]')).map((el) => ({
      top: el.getBoundingClientRect().top + window.scrollY,
      color: BG[el.dataset.bg || 'porcelain'] ?? BG.porcelain!,
    }));
    sceneStore.getState().setBands(bands);
    update(window.scrollY);
  };
  // 'refresh' срабатывает после пересчёта всех триггеров и восстановления pin-spacer'ов
  ScrollTrigger.addEventListener('refresh', compute);
  compute();
  return () => {
    ScrollTrigger.removeEventListener('refresh', compute);
    st.kill();
  };
}

/* CSS-постер (без WebGL): «капля» растворяется за первые 1.5 экрана */
function initPosterFade(): () => void {
  const poster = document.querySelector<HTMLElement>('[data-scene-poster]');
  if (!poster) return () => {};
  const drops = poster.querySelectorAll<HTMLElement>('.scene-poster__drop');
  const tween = gsap.to(drops, {
    opacity: 0,
    y: -80,
    ease: 'none',
    scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: 0.8 },
  });
  return () => { tween.scrollTrigger?.kill(); tween.kill(); };
}

/* ------------------------------------------------------------------ */
/* «Что это»: текст сменяет текст (pin + scrub)                          */
/* ------------------------------------------------------------------ */
function initWhat(): () => void {
  const section = document.querySelector<HTMLElement>('#what');
  const pin = section?.querySelector<HTMLElement>('[data-what-pin]');
  if (!section || !pin) return () => {};
  const slides = Array.from(section.querySelectorAll<HTMLElement>('[data-what-slide]'));
  const dots = Array.from(section.querySelectorAll<HTMLElement>('[data-what-dot] span'));
  const counter = section.querySelector<HTMLElement>('[data-what-counter]');
  const n = slides.length;
  section.classList.add('is-pinned');

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: () => `+=${Math.round(window.innerHeight * (n - 1) * 0.9)}`,
      pin,
      scrub: 0.8,
      anticipatePin: 1,
      onUpdate: (self) => {
        const idx = Math.min(n - 1, Math.floor(self.progress * n + 0.0001));
        slides.forEach((s, i) => { s.classList.toggle('is-current', i === idx); if (i === idx) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true'); });
      },
    },
  });
  slides.forEach((slide, i) => {
    gsap.set(slide, { opacity: i === 0 ? 1 : 0, y: i === 0 ? 0 : 28 });
    gsap.set(dots[i]!, { scaleX: i === 0 ? 1 : 0, transformOrigin: 'left' });
    if (i === 0) return;
    const prev = slides[i - 1]!;
    tl.to(prev, { opacity: 0, y: -24, duration: 0.45, ease: 'power2.in' }, (i - 1) + 0.35)
      .to(dots[i - 1]!, { scaleX: 1, duration: 0.1 }, '<')
      .fromTo(slide, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' }, (i - 1) + 0.7)
      .to(dots[i]!, { scaleX: 1, duration: 0.3, ease: 'none' }, '<');
  });
  // Пустой хвост, чтобы последний слайд «держался»
  tl.to({}, { duration: 0.6 });

  // Счётчик 45 минут — scrub внутри pin
  if (counter) {
    const target = Number(counter.dataset.counterTarget || counter.textContent || 45);
    const proxy = { v: 0 };
    counter.textContent = '0';
    tl.to(proxy, { v: target, duration: n * 0.8, ease: 'none', onUpdate: () => { counter.textContent = String(Math.round(proxy.v)); } }, 0);
  }

  return () => { tl.scrollTrigger?.kill(); tl.kill(); section.classList.remove('is-pinned'); gsap.set(slides, { clearProps: 'all' }); };
}

/* ------------------------------------------------------------------ */
/* «Как проходит»: pin + горизонтальный таймлайн + image-sequence        */
/* ------------------------------------------------------------------ */
function initHow(): () => void {
  const section = document.querySelector<HTMLElement>('#how');
  const pin = section?.querySelector<HTMLElement>('[data-how-pin]');
  const track = section?.querySelector<HTMLElement>('[data-how-track]');
  if (!section || !pin || !track) return () => {};
  const steps = Array.from(track.querySelectorAll<HTMLElement>('[data-how-step]'));
  const bar = section.querySelector<HTMLElement>('[data-how-bar]');
  const current = section.querySelector<HTMLElement>('[data-how-current]');
  const n = steps.length;
  section.classList.add('is-pinned');

  const seq = initImageSequence(section.querySelector<HTMLElement>('[data-sequence]'));
  // Ширина шага (карточка + gap) — замеряется на refresh, а не на каждом кадре скролла (forced reflow)
  let stepW = 0;
  const measure = () => { stepW = steps[0]!.offsetWidth + parseFloat(getComputedStyle(track).gap || '0'); };

  const st = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => `+=${Math.round(window.innerHeight * 3.2)}`,
    pin,
    scrub: 0.6,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onRefresh: measure,
    onUpdate: (self) => {
      const p = self.progress;
      // Кадр = функция прогресса
      seq.render(p);
      // Горизонтальный сдвиг: n карточек, каждая = ширина колонки
      if (!stepW) measure();
      // Карточка держится 55% сегмента, затем плавно уезжает — читается как шаги, а не непрерывный поток
      const raw = p * (n - 1);
      const k = Math.min(n - 2, Math.floor(raw));
      const f = Math.min(1, Math.max(0, (raw - k - 0.55) / 0.45));
      const idxF = k + f * f * (3 - 2 * f);
      gsap.set(track, { x: -idxF * stepW });
      const idx = Math.round(idxF);
      steps.forEach((s, i) => s.classList.toggle('is-current', i === idx));
      if (bar) gsap.set(bar, { scaleX: 0.2 + 0.8 * p });
      if (current) current.textContent = String(idx + 1);
    },
  });
  // Предзагрузка кадров, когда секция приближается
  const pre = ScrollTrigger.create({ trigger: section, start: 'top 150%', once: true, onEnter: () => seq.preload() });

  return () => { st.kill(); pre.kill(); seq.destroy(); section.classList.remove('is-pinned'); gsap.set(track, { clearProps: 'all' }); };
}

/* ------------------------------------------------------------------ */
/* «Вода»: pin на один экран, чтобы частицы и показатели «дожили» до конца */
/* ------------------------------------------------------------------ */
function initWater(): () => void {
  const section = document.querySelector<HTMLElement>('#water');
  const pin = section?.querySelector<HTMLElement>('[data-water-pin]');
  if (!section || !pin) return () => {};
  if (pin.offsetHeight > window.innerHeight * 1.1) return () => {}; // контент выше экрана — не пиним
  section.classList.add('is-pinned');
  const st = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => `+=${Math.round(window.innerHeight * 0.9)}`,
    pin,
    pinSpacing: true,
    anticipatePin: 1,
  });
  return () => { st.kill(); section.classList.remove('is-pinned'); };
}

/* ------------------------------------------------------------------ */
/* «Показания»: горизонтальная лента внутри вертикального скролла        */
/* ------------------------------------------------------------------ */
function initIndications(): () => void {
  const section = document.querySelector<HTMLElement>('#indications');
  const pin = section?.querySelector<HTMLElement>('[data-ind-pin]');
  const track = section?.querySelector<HTMLElement>('[data-ind-track]');
  if (!section || !pin || !track) return () => {};
  section.classList.add('is-pinned');
  const distance = () => {
    const gutter = parseFloat(getComputedStyle(track).paddingRight) || 0;
    return Math.max(0, track.scrollWidth - window.innerWidth + gutter * 0.5);
  };
  const tween = gsap.to(track, {
    x: () => -distance(),
    ease: 'none',
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: () => `+=${Math.round(distance() + window.innerHeight * 0.4)}`,
      pin,
      scrub: 0.8,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });
  return () => { tween.scrollTrigger?.kill(); tween.kill(); section.classList.remove('is-pinned'); gsap.set(track, { clearProps: 'all' }); };
}

/* ------------------------------------------------------------------ */
/* «Нить воды»: draw-on-scroll + morph прямая → волна                    */
/* ------------------------------------------------------------------ */
function initThread(): () => void {
  const wrap = document.querySelector<HTMLElement>('[data-thread]');
  const path = wrap?.querySelector<SVGPathElement>('[data-thread-path]');
  const range = document.querySelector<HTMLElement>('[data-scene-range]');
  if (!wrap || !path || !range) return () => {};

  const straight = 'M20 0 C20 250 20 500 20 750 C20 850 20 950 20 1000';
  const wave = 'M20 0 C34 160 6 320 20 480 C34 640 6 800 20 1000';
  const morph = createMorph(straight, wave, 90);
  const proxy = { t: 0, draw: 0 };
  let len = 0;
  const measure = () => { path.setAttribute('d', morph(proxy.t)); len = path.getTotalLength(); path.style.strokeDasharray = `${len}`; path.style.strokeDashoffset = `${len * (1 - proxy.draw)}`; };
  measure();

  const st = ScrollTrigger.create({
    trigger: range,
    start: 'top 80%',
    end: 'bottom 60%',
    scrub: 0.6,
    onUpdate: (self) => {
      proxy.draw = self.progress;
      // волна максимальна в секции «Вода» (середина диапазона), затихает к концу
      const mid = 1 - Math.min(1, Math.abs(self.progress - 0.55) / 0.35);
      proxy.t = mid * mid;
      measure();
    },
  });
  return () => st.kill();
}
