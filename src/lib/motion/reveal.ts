/**
 * Появления по скроллу:
 *  [data-reveal]            — fade + лёгкий подъём (y 24px)
 *  [data-reveal="clip"]     — маска снизу (clip-path inset)
 *  [data-reveal-group]      — стаггер дочерних элементов
 *  [data-split="words|chars"] — кинетическая типографика: слова/символы выезжают из маски
 *  [data-line]              — линия-разделитель «прочерчивается» (scaleX 0 → 1)
 * Reduced motion: всё превращается в fade 200ms (ТЗ §4.3).
 *
 * Производительность:
 *  - появления запускаются IntersectionObserver'ом (один наблюдатель на порог), а не сотней
 *    ScrollTrigger'ов — без forced reflow при инициализации; ScrollTrigger остаётся для scrub/pin;
 *  - подготовка (разбиение текста, стартовые состояния, твины) делается сразу только для первых
 *    ~1,8 экрана; остальное готовится лениво, когда элемент подходит к вьюпорту (TBT на телефонах).
 */
import { gsap, prefersReducedMotion, isDesktop } from '@/lib/gsap';
import { splitText, type SplitMode } from './splitText';

/** 'top 88%' → элемент считается вошедшим, когда его верх пересёк 88% высоты вьюпорта */
function rootMarginFor(start: string): string {
  const m = /top (\d+)%/.exec(start);
  const pct = m ? Number(m[1]) : 90;
  return `0px 0px -${Math.max(0, 100 - pct)}% 0px`;
}

interface Item { el: HTMLElement; prep: () => void }

export function initReveals(root: ParentNode = document): () => void {
  const rm = prefersReducedMotion();
  const desktop = isDesktop();
  const observers: IntersectionObserver[] = [];
  const tweens: gsap.core.Tween[] = [];
  const players = new Map<string, { io: IntersectionObserver; map: Map<Element, () => void> }>();
  const items: Item[] = [];

  /** Запуск по входу во вьюпорт (один наблюдатель на порог); элемент выше вьюпорта (уже пройден) тоже считается вошедшим */
  const watch = (trigger: Element, start: string, play: () => void) => {
    const rootMargin = rootMarginFor(start);
    let p = players.get(rootMargin);
    if (!p) {
      const map = new Map<Element, () => void>();
      const io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const passed = entry.isIntersecting || entry.boundingClientRect.bottom < 0;
          if (!passed) continue;
          map.get(entry.target)?.();
          map.delete(entry.target);
          io.unobserve(entry.target);
        }
      }, { rootMargin, threshold: 0 });
      p = { io, map };
      players.set(rootMargin, p);
      observers.push(io);
    }
    p.map.set(trigger, play);
    p.io.observe(trigger);
  };

  // --- Кинетическая типографика (на всех ширинах; hero-заголовок [data-split-lcp] на мобильных виден сразу — ради LCP) ---
  root.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => {
    if (el.closest('[data-split-manual]')) return;
    if (!desktop && el.hasAttribute('data-split-lcp')) return;
    items.push({ el, prep: () => {
      const mode = (el.dataset.split as SplitMode) || 'words';
      const { pieces } = splitText(el, mode);
      if (rm) { el.classList.add('is-split'); return; }
      gsap.set(pieces, { yPercent: 110, willChange: 'transform' });
      el.classList.add('is-split');
      const tween = gsap.to(pieces, {
        yPercent: 0,
        duration: 1.1,
        ease: 'expo.out',
        stagger: mode === 'chars' ? 0.02 : 0.04,
        paused: true,
        onComplete: () => gsap.set(pieces, { clearProps: 'willChange' }),
      });
      tweens.push(tween);
      watch(el, 'top 88%', () => tween.play());
    } });
  });

  // --- Обычные reveal ---
  root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    if (el.closest('[data-reveal-group]') && el.dataset.reveal !== 'self') return;
    items.push({ el, prep: () => {
      const variant = el.dataset.reveal || 'fade';
      if (rm) { gsap.set(el, { opacity: 1 }); return; }
      const from: gsap.TweenVars = variant === 'clip' ? { opacity: 1, clipPath: 'inset(100% 0 0 0)' } : { opacity: 0, y: 24 };
      const to: gsap.TweenVars = variant === 'clip' ? { clipPath: 'inset(0% 0 0 0)', duration: 1.2 } : { opacity: 1, y: 0, duration: 1 };
      const delay = Number(el.dataset.revealDelay || 0);
      gsap.set(el, { ...from, willChange: 'transform, opacity' });
      const tween = gsap.to(el, { ...to, delay, ease: 'expo.out', paused: true, onComplete: () => gsap.set(el, { clearProps: 'willChange,clipPath' }) });
      tweens.push(tween);
      watch(el, el.dataset.revealStart || 'top 90%', () => tween.play());
    } });
  });

  // --- Группы со стаггером ---
  root.querySelectorAll<HTMLElement>('[data-reveal-group]').forEach((group) => {
    const els = Array.from(group.querySelectorAll<HTMLElement>('[data-reveal]')).filter((i) => i.dataset.reveal !== 'self');
    if (!els.length) return;
    items.push({ el: group, prep: () => {
      if (rm) { gsap.set(els, { opacity: 1 }); return; }
      gsap.set(els, { opacity: 0, y: 28, willChange: 'transform, opacity' });
      const tween = gsap.to(els, {
        opacity: 1, y: 0, duration: 1, ease: 'expo.out',
        stagger: Number(group.dataset.revealStagger || 0.08),
        paused: true,
        onComplete: () => gsap.set(els, { clearProps: 'willChange' }),
      });
      tweens.push(tween);
      watch(group, 'top 85%', () => tween.play());
    } });
  });

  // --- Прочерчивающиеся линии ---
  root.querySelectorAll<HTMLElement>('[data-line]').forEach((el) => {
    if (rm) return;
    items.push({ el, prep: () => {
      const origin = el.dataset.line === 'center' ? '50% 50%' : el.dataset.line === 'right' ? '100% 50%' : '0% 50%';
      gsap.set(el, { scaleX: 0, transformOrigin: origin });
      const tween = gsap.to(el, { scaleX: 1, duration: 1.4, ease: 'expo.out', paused: true, delay: Number(el.dataset.lineDelay || 0) });
      tweens.push(tween);
      watch(el, 'top 92%', () => tween.play());
    } });
  });

  // Ближние элементы (первые ~1,8 экрана) готовим сразу — без вспышки стартовых состояний;
  // один замер на всех (до любых записей в DOM), дальние — лениво за 1,5 экрана до появления
  const limit = window.innerHeight * 1.8;
  const tops = items.map((it) => it.el.getBoundingClientRect().top);
  const far = new Map<Element, () => void>();
  items.forEach((it, i) => { if (tops[i]! < limit) it.prep(); else far.set(it.el, it.prep); });
  if (far.size) {
    const prepIO = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const due = entry.isIntersecting || entry.boundingClientRect.bottom < 0;
        if (!due) continue;
        far.get(entry.target)?.();
        far.delete(entry.target);
        prepIO.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px 150% 0px', threshold: 0 });
    far.forEach((_, el) => prepIO.observe(el));
    observers.push(prepIO);
  }

  return () => {
    observers.forEach((o) => o.disconnect());
    tweens.forEach((t) => t.kill());
  };
}
