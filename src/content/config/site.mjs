// Единый источник правды о домене. Домен пока не подтверждён заказчиком (см. CONTENT-TODO.md).
// Для превью на GitHub Pages сборка параметризуется переменными окружения (см. .github/workflows/pages.yml):
//   SITE_URL — origin превью (https://popoverrr.github.io), SITE_BASE — подпуть (/med), PUBLIC_PREVIEW=1 — noindex, формы отключены.
export const SITE_URL = process.env.SITE_URL || 'https://hydromed.kz';
export const SITE_BASE = (process.env.SITE_BASE || '').replace(/\/+$/, '');
export const PREVIEW = process.env.PUBLIC_PREVIEW === '1';
export const SITE_NAME = 'Hydromed';
