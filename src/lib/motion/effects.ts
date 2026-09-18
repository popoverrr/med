/**
 * Небольшие скролл-эффекты:
 *  [data-parallax="0.08"]  — послойный параллакс, смещение ≤ 12% высоты вьюпорта (ТЗ §4.2.9)
 *  [data-counter="45"]     — числовой счётчик, привязанный к scrub, а не к таймеру (ТЗ §4.2.11)
 *  [data-magnetic]         — магнитные кнопки: радиус 80px, lerp 0.15, только десктоп (ТЗ §4.2.6)
 */
import { gsap, ScrollTrigger, prefersReducedMotion, isFinePointer, isDesktop } from '@/lib/gsap';

export function initParallax(root: ParentNode = document): () => void {
  if (prefersReducedMotion() || !isDesktop()) return () => {};
  const triggers: ScrollTrigger[] = [];
  root.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) => {
    const factor = Math.min(0.12, Math.abs(Number(el.dataset.parallax || 0.06))) * Math.sign(Number(el.dataset.parallax || 1) || 1);
    const range = () => window.innerHeight * factor;
    const tween = gsap.fromTo(el, { y: () => -range() }, {
      y: () => range(),
      ease: 'none',
      scrollTrigger: { trigger: el.closest('[data-parallax-scope]') ?? el, start: 'top bottom', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true },
    });
    if (tween.scrollTrigger) triggers.push(tween.scrollTrigger);
  });
  return () => triggers.forEach((t) => t.kill());
}

export function initCounters(root: ParentNode = document): () => void {
  const triggers: ScrollTrigger[] = [];
  const rm = prefersReducedMotion();
  root.querySelectorAll<HTMLElement>('[data-counter]').forEach((el) => {
    const target = Number(el.dataset.counter);
    if (!Number.isFinite(target)) return;
    const decimals = Number(el.dataset.decimals || 0);
    const fmt = (v: number) => v.toFixed(decimals).replace('.', ',');
    if (rm) { el.textContent = fmt(target); return; }
    const proxy = { v: 0 };
    el.textContent = fmt(0);
    const tween = gsap.to(proxy, {
      v: target,
      ease: 'none',
      onUpdate: () => { el.textContent = fmt(proxy.v); },
      scrollTrigger: {
        trigger: el.closest('[data-counter-scope]') ?? el,
        start: el.dataset.counterStart || 'top 80%',
        end: el.dataset.counterEnd || 'top 40%',
        scrub: 0.5,
      },
    });
    if (tween.scrollTrigger) triggers.push(tween.scrollTrigger);
  });
  return () => triggers.forEach((t) => t.kill());
}

export function initMagnetic(root: ParentNode = document): () => void {
  if (!isFinePointer() || prefersReducedMotion() || !isDesktop()) return () => {};
  const RADIUS = 80;
  const LERP = 0.15;
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-magnetic]'));
  const state = items.map((el) => ({ el, tx: 0, ty: 0, x: 0, y: 0, active: false }));
  let raf = 0;
  let running = false;

  const loop = () => {
    let any = false;
    for (const s of state) {
      s.x += (s.tx - s.x) * LERP;
      s.y += (s.ty - s.y) * LERP;
      if (Math.abs(s.x) > 0.05 || Math.abs(s.y) > 0.05 || s.active) {
        any = true;
        s.el.style.transform = `translate3d(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px, 0)`;
      } else if (s.el.style.transform) {
        s.el.style.transform = '';
        s.el.style.willChange = '';
      }
    }
    if (any) raf = requestAnimationFrame(loop);
    else running = false;
  };
  const kick = () => { if (!running) { running = true; raf = requestAnimationFrame(loop); } };

  const onMove = (e: PointerEvent) => {
    for (const s of state) {
      const r = s.el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      const reach = RADIUS + Math.max(r.width, r.height) / 2;
      if (dist < reach) {
        const k = 1 - dist / reach;
        s.tx = dx * 0.35 * k;
        s.ty = dy * 0.35 * k;
        if (!s.active) { s.active = true; s.el.style.willChange = 'transform'; }
      } else if (s.active) {
        s.active = false;
        s.tx = 0;
        s.ty = 0;
      }
    }
    kick();
  };
  const onLeave = () => { state.forEach((s) => { s.active = false; s.tx = 0; s.ty = 0; }); kick(); };

  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  return () => {
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerleave', onLeave);
    cancelAnimationFrame(raf);
    state.forEach((s) => { s.el.style.transform = ''; s.el.style.willChange = ''; });
  };
}
