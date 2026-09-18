/**
 * Появления по скроллу:
 *  [data-reveal]            — fade + лёгкий подъём (y 24px)
 *  [data-reveal="clip"]     — маска снизу (clip-path inset)
 *  [data-reveal-group]      — стаггер дочерних элементов
 *  [data-split="words|chars"] — кинетическая типографика: слова/символы выезжают из маски (десктоп)
 *  [data-line]              — линия-разделитель «прочерчивается» (scaleX 0 → 1)
 * Reduced motion: всё превращается в fade 200ms (ТЗ §4.3).
 *
 * Производительность: появления запускаются IntersectionObserver'ом (один наблюдатель на порог), а не
 * сотней ScrollTrigger'ов — без forced reflow при инициализации; ScrollTrigger остаётся для scrub/pin.
 */
import { gsap, prefersReducedMotion, isDesktop } from '@/lib/gsap';
import { splitText, type SplitMode } from './splitText';

/** 'top 88%' → элемент считается вошедшим, когда его верх пересёк 88% высоты вьюпорта */
interface Job { trigger: Element; start: string; play: () => void }

function rootMarginFor(start: string): string {
  const m = /top (d+)%/.exec(start);
  const pct = m ? Number(m[1]) : 90;
  return `0px 0px -${Math.max(0, 100 - pct)}% 0px`;
}

export function initReveals(root: ParentNode = document): () => void {
  const rm = prefersReducedMotion();
  const desktop = isDesktop();
  const observers: IntersectionObserver[] = [];
  const tweens: gsap.core.Tween[] = [];
  const jobs: Job[] = [];

  // --- Кинетическая типографика (только десктоп; на мобильных заголовки видны сразу — ради LCP) ---
  root.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => {
    if (el.closest('[data-split-manual]') || !desktop) return;
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
    jobs.push({ trigger: el, start: 'top 88%', play: () => tween.play() });
  });

  // --- Обычные reveal ---
  root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    if (el.closest('[data-reveal-group]') && el.dataset.reveal !== 'self') return;
    const variant = el.dataset.reveal || 'fade';
    if (rm) { gsap.set(el, { opacity: 1 }); return; }
    const from: gsap.TweenVars = variant === 'clip' ? { opacity: 1, clipPath: 'inset(100% 0 0 0)' } : { opacity: 0, y: 24 };
    const to: gsap.TweenVars = variant === 'clip' ? { clipPath: 'inset(0% 0 0 0)', duration: 1.2 } : { opacity: 1, y: 0, duration: 1 };
    const delay = Number(el.dataset.revealDelay || 0);
    gsap.set(el, { ...from, willChange: 'transform, opacity' });
    const tween = gsap.to(el, { ...to, delay, ease: 'expo.out', paused: true, onComplete: () => gsap.set(el, { clearProps: 'willChange,clipPath' }) });
    tweens.push(tween);
    jobs.push({ trigger: el, start: el.dataset.revealStart || 'top 90%', play: () => tween.play() });
  });

  // --- Группы со стаггером ---
  root.querySelectorAll<HTMLElement>('[data-reveal-group]').forEach((group) => {
    const items = Array.from(group.querySelectorAll<HTMLElement>('[data-reveal]')).filter((i) => i.dataset.reveal !== 'self');
    if (!items.length) return;
    if (rm) { gsap.set(items, { opacity: 1 }); return; }
    gsap.set(items, { opacity: 0, y: 28, willChange: 'transform, opacity' });
    const tween = gsap.to(items, {
      opacity: 1, y: 0, duration: 1, ease: 'expo.out',
      stagger: Number(group.dataset.revealStagger || 0.08),
      paused: true,
      onComplete: () => gsap.set(items, { clearProps: 'willChange' }),
    });
    tweens.push(tween);
    jobs.push({ trigger: group, start: 'top 85%', play: () => tween.play() });
  });

  // --- Прочерчивающиеся линии ---
  root.querySelectorAll<HTMLElement>('[data-line]').forEach((el) => {
    if (rm) return;
    const origin = el.dataset.line === 'center' ? '50% 50%' : el.dataset.line === 'right' ? '100% 50%' : '0% 50%';
    gsap.set(el, { scaleX: 0, transformOrigin: origin });
    const tween = gsap.to(el, { scaleX: 1, duration: 1.4, ease: 'expo.out', paused: true, delay: Number(el.dataset.lineDelay || 0) });
    tweens.push(tween);
    jobs.push({ trigger: el, start: 'top 92%', play: () => tween.play() });
  });

  // Один IntersectionObserver на порог; элемент выше вьюпорта (уже пройден) тоже считается вошедшим
  const byMargin = new Map<string, Job[]>();
  for (const job of jobs) {
    const key = rootMarginFor(job.start);
    (byMargin.get(key) ?? byMargin.set(key, []).get(key)!).push(job);
  }
  for (const [rootMargin, list] of byMargin) {
    const map = new Map(list.map((j) => [j.trigger, j.play]));
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const passed = entry.isIntersecting || entry.boundingClientRect.bottom < 0;
        if (!passed) continue;
        map.get(entry.target)?.();
        map.delete(entry.target);
        io.unobserve(entry.target);
      }
    }, { rootMargin, threshold: 0 });
    list.forEach((j) => io.observe(j.trigger));
    observers.push(io);
  }

  return () => {
    observers.forEach((o) => o.disconnect());
    tweens.forEach((t) => t.kill());
  };
}
