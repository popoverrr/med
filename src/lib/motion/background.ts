/**
 * Плавная смена фона документа по скроллу (ТЗ §4.2.8): для каждой секции с data-bg
 * цвет --bg-current интерполируется от цвета предыдущей секции к её собственному
 * на отрезке «верх секции 68% → 42% вьюпорта» (короткий, чтобы промежуточный «грязный» тон был мимолётным). Параллельно переключается тон шапки
 * и обновляется стор сцены (WebGL красит свой фон тем же цветом).
 */
import { gsap, ScrollTrigger, prefersReducedMotion } from '@/lib/gsap';
import { sceneStore } from '@/lib/scene/store';

export const BG: Record<string, string> = {
  porcelain: '#f6f1ee',
  bone: '#fffcfa',
  dark: '#350a16',
  burgundy: '#4e0f21',
  ink: '#12080b',
};
const DARK = new Set(['dark', 'burgundy', 'ink']);

export function initBackground(): () => void {
  const html = document.documentElement;
  const header = document.querySelector<HTMLElement>('[data-header]');
  const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-bg]'));
  const triggers: ScrollTrigger[] = [];
  const rm = prefersReducedMotion();

  const setHeaderTone = (name: string) => {
    if (!header) return;
    const dark = DARK.has(name);
    header.classList.toggle('is-on-dark', dark);
    header.classList.toggle('is-on-light', !dark);
    document.querySelector<HTMLElement>('[data-cursor-ring]')?.classList.toggle('is-dark', dark);
  };

  if (!sections.length) {
    const start = html.dataset.page === 'home' || document.body.classList.contains('theme-dark') ? 'dark' : 'porcelain';
    setHeaderTone(start);
    return () => {};
  }

  // Стартовый цвет — первая секция
  const first = sections[0]!.dataset.bg || 'porcelain';
  html.style.setProperty('--bg-current', BG[first] ?? BG.porcelain!);
  sceneStore.getState().setBg(BG[first] ?? BG.porcelain!);
  setHeaderTone(first);

  sections.forEach((section, i) => {
    const name = section.dataset.bg || 'porcelain';
    const color = BG[name] ?? BG.porcelain!;
    const prevName = i > 0 ? sections[i - 1]!.dataset.bg || 'porcelain' : name;
    const prev = BG[prevName] ?? BG.porcelain!;

    // Тон шапки — пока секция под шапкой
    triggers.push(
      ScrollTrigger.create({
        trigger: section,
        start: 'top 72px',
        end: 'bottom 72px',
        onToggle: (self) => { if (self.isActive) setHeaderTone(name); },
      })
    );

    if (i === 0) return;
    if (rm || prev === color) {
      triggers.push(
        ScrollTrigger.create({
          trigger: section,
          start: 'top 60%',
          onEnter: () => { html.style.setProperty('--bg-current', color); sceneStore.getState().setBg(color); },
          onLeaveBack: () => { html.style.setProperty('--bg-current', prev); sceneStore.getState().setBg(prev); },
        })
      );
      return;
    }
    const proxy = { c: prev };
    const tween = gsap.fromTo(
      proxy,
      { c: prev },
      {
        c: color,
        ease: 'none',
        immediateRender: false,
        onUpdate: () => {
          html.style.setProperty('--bg-current', proxy.c);
          sceneStore.getState().setBg(proxy.c);
        },
        scrollTrigger: { trigger: section, start: 'top 68%', end: 'top 42%', scrub: 0.3 },
      }
    );
    if (tween.scrollTrigger) triggers.push(tween.scrollTrigger);
  });

  return () => triggers.forEach((t) => t.kill());
}
