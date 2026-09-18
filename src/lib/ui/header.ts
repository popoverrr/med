/** Шапка: фон при скролле, скрытие при прокрутке вниз, мобильное меню с focus trap. */
import { stopScroll, startScroll } from '@/lib/scroll/lenis';
import { trapFocus } from './focus';

export function initHeader(): () => void {
  const header = document.querySelector<HTMLElement>('[data-header]');
  if (!header) return () => {};
  const toggle = header.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const menu = header.querySelector<HTMLElement>('[data-mobile-menu]');
  let lastY = window.scrollY;
  let ticking = false;
  let releaseTrap: (() => void) | null = null;

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 24);
      const menuOpen = menu && !menu.hidden;
      header.classList.toggle('is-hidden', !menuOpen && y > 320 && y > lastY + 4);
      if (y < lastY - 4) header.classList.remove('is-hidden');
      lastY = y;
      ticking = false;
    });
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const closeMenu = () => {
    if (!menu || menu.hidden) return;
    menu.classList.remove('is-open');
    toggle?.setAttribute('aria-expanded', 'false');
    releaseTrap?.();
    releaseTrap = null;
    startScroll();
    document.documentElement.classList.remove('menu-open');
    setTimeout(() => { menu.hidden = true; menu.style.zIndex = ''; }, 300);
    toggle?.focus();
  };
  const openMenu = () => {
    if (!menu) return;
    menu.hidden = false;
    menu.style.zIndex = '-1';
    requestAnimationFrame(() => menu.classList.add('is-open'));
    toggle?.setAttribute('aria-expanded', 'true');
    header.classList.remove('is-hidden');
    stopScroll();
    document.documentElement.classList.add('menu-open');
    releaseTrap = trapFocus(header, closeMenu);
  };
  const onToggle = () => (menu && !menu.hidden ? closeMenu() : openMenu());
  toggle?.addEventListener('click', onToggle);
  menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));

  return () => {
    window.removeEventListener('scroll', onScroll);
    toggle?.removeEventListener('click', onToggle);
    releaseTrap?.();
    startScroll();
  };
}
