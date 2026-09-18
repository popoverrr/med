/**
 * Кастомный курсор (ТЗ §4.2.7): тонкое кольцо, следующее за указателем с lerp,
 * увеличивается над интерактивом ([data-cursor], a, button). Только для точного указателя.
 * Нативный курсор не скрываем — кольцо дополняет, а не заменяет (доступность).
 */
import { isFinePointer, prefersReducedMotion } from '@/lib/gsap';

export function initCursor(): () => void {
  const ring = document.querySelector<HTMLElement>('[data-cursor-ring]');
  if (!ring || !isFinePointer() || prefersReducedMotion()) return () => {};
  document.documentElement.classList.add('cursor-on');

  let x = window.innerWidth / 2, y = window.innerHeight / 2, tx = x, ty = y;
  let scale = 1, tscale = 1;
  let visible = false;
  let raf = 0;

  const loop = () => {
    x += (tx - x) * 0.22;
    y += (ty - y) * 0.22;
    scale += (tscale - scale) * 0.18;
    ring.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
    raf = requestAnimationFrame(loop);
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    tx = e.clientX;
    ty = e.clientY;
    if (!visible) { visible = true; ring.style.opacity = '1'; }
    const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-cursor], a, button, [role="button"], input, select, textarea, label');
    if (!target) tscale = 1;
    else if (target.matches('input, select, textarea')) tscale = 0.5;
    else if (target.dataset.cursor === 'button' || target.matches('button, .btn')) tscale = 1.9;
    else tscale = 1.5;
  };
  const onLeave = () => { visible = false; ring.style.opacity = '0'; };
  const onDown = () => { tscale *= 0.8; };
  const onUp = () => { tscale /= 0.8; };

  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    document.documentElement.classList.remove('cursor-on');
  };
}
