// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { SITE_URL, SITE_BASE } from './src/content/config/site.mjs';

/** Превью на GitHub Pages живёт в подпути (SITE_BASE=/med): абсолютные url() шрифтов в CSS получают префикс. */
function fontBasePlugin() {
  return {
    name: 'hydromed-font-base',
    transform(code, id) {
      if (!SITE_BASE || !/[\\/]src[\\/]styles[\\/]fonts\.css$/.test(id)) return null;
      return { code: code.replaceAll("url('/fonts/", `url('${SITE_BASE}/fonts/`), map: null };
    },
  };
}

export default defineConfig({
  site: SITE_URL,
  base: SITE_BASE || '/',
  output: 'static',
  trailingSlash: 'never',
  build: {
    // /procedure -> procedure.html; чистые URL отдаёт .htaccess (RewriteRule -> .html)
    format: 'file',
    // CSS инлайнится в HTML: нет render-blocking запросов (style-src 'unsafe-inline' в CSP это допускает)
    inlineStylesheets: 'always',
    assets: 'assets',
  },
  i18n: {
    defaultLocale: 'ru',
    locales: ['ru', 'kk'],
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
  },
  integrations: [
    react(),
    sitemap({
      i18n: {
        defaultLocale: 'ru',
        locales: { ru: 'ru-KZ', kk: 'kk-KZ' },
      },
      filter: (page) => !page.includes('/404'),
    }),
  ],
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  vite: {
    plugins: [tailwindcss(), fontBasePlugin()],
    build: {
      // 0 = ничего не инлайнить: скрипты всегда внешние (строгий CSP script-src 'self'),
      // шрифты/картинки не превращаются в data: URI.
      assetsInlineLimit: 0,
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const p = id.replace(/\\/g, '/');
            // Хелпер динамических импортов Vite — отдельно, иначе он утягивает webgl-чанк в статический граф главной
            if (p.includes('vite/preload-helper')) return 'preload';
            // Стор сцены: только vanilla-часть zustand (React-обёртку zustand использует R3F — она уходит в webgl)
            if (/node_modules\/zustand\/(esm\/)?vanilla/.test(p) || p.includes('/src/lib/scene/store')) return 'scene-store';
            // Весь 3D — отдельный чанк, грузится динамически только при выполнении условий §4.3
            if (/node_modules\/(three|@react-three|postprocessing|n8ao|maath|troika|stats-gl|camera-controls|hls\.js|meshline|detect-gpu|three-mesh-bvh|three-stdlib|zustand|suspend-react|its-fine|use-sync-external-store|react-reconciler|@monogrid|tunnel-rat)\//.test(p)) {
              return 'webgl';
            }
            if (/node_modules\/(react|react-dom|scheduler)\//.test(p)) return 'react';
            if (/node_modules\/(gsap|lenis)\//.test(p)) return 'motion-core';
            return undefined;
          },
        },
      },
    },
  },
});
