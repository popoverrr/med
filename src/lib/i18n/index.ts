import ru from '@content/i18n/ru.json';
import kk from '@content/i18n/kk.json';

export type Locale = 'ru' | 'kk';
export type Dict = typeof ru;

export const locales: readonly Locale[] = ['ru', 'kk'] as const;
export const defaultLocale: Locale = 'ru';

const dicts: Record<Locale, Dict> = { ru, kk: kk as unknown as Dict };

/** Словарь для локали. Структура kk проверяется скриптом scripts/check-i18n.mjs. */
export function t(locale: Locale): Dict {
  return dicts[locale];
}

/** Путь страницы в нужной локали: ru без префикса, kk с /kk. */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (locale === 'ru') return clean === '/' ? '/' : clean.replace(/\/$/, '');
  return clean === '/' ? '/kk' : `/kk${clean.replace(/\/$/, '')}`;
}

/** Определяет локаль по текущему pathname. */
export function localeFromPath(pathname: string): Locale {
  return pathname === '/kk' || pathname.startsWith('/kk/') ? 'kk' : 'ru';
}

/** Путь без локального префикса. */
export function stripLocale(pathname: string): string {
  if (pathname === '/kk') return '/';
  if (pathname.startsWith('/kk/')) return pathname.slice(3) || '/';
  return pathname || '/';
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
