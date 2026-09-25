/**
 * Шапка: фон при скролле, скрытие при прокрутке вниз (только десктоп), мобильное меню с focus trap.
 * На телефонах/планшетах (html.lite) шапка не прячется: вместе с адресной строкой браузера она «дёргалась»
 * на каждом микродвижении пальца. На десктопе — гистерезис: прячем после 80px вниз, показываем после 40px вверх.
 */
import { stopScroll, startScroll } from '@/lib/scroll/lenis';
import { isLite } from '@/lib/gsap';
import { trapFocus } from './focus';

export function initHeader(): () => void {
  const header = document.querySelector<HTMLElement>('[data-header]');
  if (!header) return () => {};
  const toggle = header.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const menu = header.querySelector<HTMLElement>('[data-mobile-menu]');
  let lastY = window.scrollY;
  let travel = 0; // накопленный путь в текущем направлении (+ вниз, − вверх)
  let ticking = false;
  const autoHide = !isLite();
  const HIDE_AFTER = 80;
  const SHOW_AFTER = 40;
  let releaseTrap: (() => void) | null = null;

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 24);
      const menuOpen = menu && !menu.hidden;
      const dy = y - lastY;
      if (dy !== 0) travel = Math.sign(dy) === Math.sign(travel) ? travel + dy : dy;
      if (!autoHide || menuOpen || y < 320) header.classList.remove('is-hidden');
      else if (travel > HIDE_AFTER) header.classList.add('is-hidden');
      else if (travel < -SHOW_AFTER) header.classList.remove('is-hidden');
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
