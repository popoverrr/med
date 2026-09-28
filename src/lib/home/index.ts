/**
 * Хореография главной: диапазоны сцены для WebGL, постер-деградация, видеообращение, раскрытие блока врача.
 * Pin-секций, image-sequence и горизонтальных лент больше нет (посадочная стала короткой и читается сверху
 * вниз, особенно на телефоне). Грузится отдельным чанком только на главной.
 */
import { gsap, ScrollTrigger, isLite } from '@/lib/gsap';
import { sceneStore, type SceneKey, type SceneRange } from '@/lib/scene/store';
import { loadScene } from '@/lib/scene/loader';
import { initExpertVideo } from './expertVideo';
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
    const steps = [initExpert];
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

  // Reduced-motion: секции статичны — один refresh сразу
  mm.add('(prefers-reduced-motion: reduce)', () => {
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
/* Лёгкий режим: сцена «паркуется», когда «С чем помогает» закрыло экран */
/* ------------------------------------------------------------------ */
function initScenePark(): () => void {
  const what = document.querySelector<HTMLElement>('#help');
  if (!isLite() || !what) return () => {};
  const html = document.documentElement;
  // Ниже блока врача секции непрозрачны (base.css, html.lite) — канвас не виден, и рендерить его незачем:
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
  // Лёгкий режим: без анимации clip-path на видеокадре (перерисовка композитного слоя на каждом кадре)
  if (clip && !isLite()) tl.fromTo(clip, { clipPath: 'inset(16% 14% 16% 14% round 32px)' }, { clipPath: 'inset(0% 0% 0% 0% round 32px)' }, 0);
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
