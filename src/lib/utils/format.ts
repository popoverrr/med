import type { Locale } from '@/lib/i18n';

/** 15000 -> "15 000" (неразрывный тонкий пробел между разрядами). */
export function formatNumber(value: string | number, locale: Locale = 'ru'): string {
  const n = typeof value === 'number' ? value : Number(String(value).replace(/\s/g, ''));
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat(locale === 'kk' ? 'kk-KZ' : 'ru-KZ', { maximumFractionDigits: 2 })
    .format(n)
    .replace(/ |\s/g, ' ');
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function waHref(phone: string): string {
  return `https://wa.me/${phone.replace(/[^\d]/g, '')}`;
}

export function tgHref(handle: string): string {
  return handle.startsWith('http') ? handle : `https://t.me/${handle.replace(/^@/, '')}`;
}
