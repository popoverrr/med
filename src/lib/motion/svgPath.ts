/**
 * Собственные SVG-приёмы (без MorphSVG / DrawSVG, ТЗ §2, §4.2.12):
 *  - drawOnScroll: stroke-dashoffset привязан к скроллу;
 *  - morph: интерполяция двух путей через сэмплирование точек по длине + сглаживание Catmull-Rom.
 */
import { gsap, ScrollTrigger, prefersReducedMotion } from '@/lib/gsap';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Сэмплирует N равномерных по длине точек пути. */
export function samplePath(d: string, samples = 120): Array<[number, number]> {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  svg.appendChild(path);
  svg.style.position = 'absolute';
  svg.style.width = '0';
  svg.style.height = '0';
  document.body.appendChild(svg);
  const len = path.getTotalLength();
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= samples; i++) {
    const p = path.getPointAtLength((len * i) / samples);
    pts.push([p.x, p.y]);
  }
  svg.remove();
  return pts;
}

/** Точки → сглаженный путь (Catmull-Rom → кубические Безье). */
export function pointsToPath(pts: Array<[number, number]>, tension = 0.5): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0]![0].toFixed(2)},${pts[0]![1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const c1x = p1[0] + ((p2[0] - p0[0]) * tension) / 3;
    const c1y = p1[1] + ((p2[1] - p0[1]) * tension) / 3;
    const c2x = p2[0] - ((p3[0] - p1[0]) * tension) / 3;
    const c2y = p2[1] - ((p3[1] - p1[1]) * tension) / 3;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

/** Возвращает функцию t(0..1) -> d, интерполирующую между путями. */
export function createMorph(from: string, to: string, samples = 120): (t: number) => string {
  const a = samplePath(from, samples);
  const b = samplePath(to, samples);
  return (t: number) => {
    const k = Math.min(1, Math.max(0, t));
    const pts = a.map((p, i) => [p[0] + (b[i]![0] - p[0]) * k, p[1] + (b[i]![1] - p[1]) * k] as [number, number]);
    return pointsToPath(pts);
  };
}

/** [data-draw] на <path>/<line>/<circle>: линия «прорисовывается» по мере скролла. */
export function initDrawOnScroll(root: ParentNode = document): () => void {
  const triggers: ScrollTrigger[] = [];
  const rm = prefersReducedMotion();
  root.querySelectorAll<SVGGeometryElement>('[data-draw]').forEach((el) => {
    const len = el.getTotalLength();
    el.style.strokeDasharray = `${len}`;
    if (rm) { el.style.strokeDashoffset = '0'; return; }
    el.style.strokeDashoffset = `${len}`;
    const scope = el.closest<HTMLElement>('[data-draw-scope]') ?? (el.ownerSVGElement as unknown as HTMLElement);
    const tween = gsap.to(el, {
      strokeDashoffset: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: scope,
        start: el.dataset.drawStart || 'top 80%',
        end: el.dataset.drawEnd || 'bottom 60%',
        scrub: 0.6,
      },
    });
    if (tween.scrollTrigger) triggers.push(tween.scrollTrigger);
  });
  return () => triggers.forEach((t) => t.kill());
}
