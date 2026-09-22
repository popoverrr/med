/**
 * Базовый путь сайта (Astro `base`): на боевом хостинге — корень, на превью GitHub Pages — /med.
 * Все внутренние ссылки и пути к public/-ресурсам проходят через withBase(); localePath() уже его учитывает.
 */
export const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** Превью-сборка (PREVIEW=1): noindex, формы не отправляются. */
export const PREVIEW = import.meta.env.PUBLIC_PREVIEW === '1';

export function withBase(path: string): string {
  if (!BASE) return path;
  if (path === BASE || path.startsWith(`${BASE}/`)) return path;
  return `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Путь без базового префикса (для разбора location.pathname / Astro.url.pathname). */
export function stripBase(pathname: string): string {
  if (!BASE) return pathname;
  if (pathname === BASE) return '/';
  return pathname.startsWith(`${BASE}/`) ? pathname.slice(BASE.length) : pathname;
}
