import ru from '@content/i18n/ru.json';
import kk from '@content/i18n/kk.json';
import { withBase, stripBase } from '@/lib/base';

export type Locale = 'ru' | 'kk';
export type Dict = typeof ru;

export const locales: readonly Locale[] = ['ru', 'kk'] as const;
export const defaultLocale: Locale = 'ru';

const dicts: Record<Locale, Dict> = { ru, kk: kk as unknown as Dict };

/** Словарь для локали. Структура kk проверяется скриптом scripts/check-i18n.mjs. */
export function t(locale: Locale): Dict {
  return dicts[locale];
}

/** Путь страницы в нужной локали (с учётом базового пути сайта): ru без префикса, kk с /kk. */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (locale === 'ru') return withBase(clean === '/' ? '/' : clean.replace(/\/$/, ''));
  return withBase(clean === '/' ? '/kk' : `/kk${clean.replace(/\/$/, '')}`);
}

/** Определяет локаль по текущему pathname. */
export function localeFromPath(pathname: string): Locale {
  const p = stripBase(pathname);
  return p === '/kk' || p.startsWith('/kk/') ? 'kk' : 'ru';
}

/** Путь без базового и локального префиксов. */
export function stripLocale(pathname: string): string {
  const p = stripBase(pathname);
  if (p === '/kk') return '/';
  if (p.startsWith('/kk/')) return p.slice(3) || '/';
  return p || '/';
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'ru' ? 'kk' : 'ru';
}

/** Достаёт локализованное значение из объекта вида { ru: string; kk: string }. */
export function pick<T>(value: Record<Locale, T> | T, locale: Locale): T {
  if (value && typeof value === 'object' && 'ru' in (value as object) && 'kk' in (value as object)) {
    return (value as Record<Locale, T>)[locale];
  }
  return value as T;
}
