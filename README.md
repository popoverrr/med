# Hydromed — сайт медицинского центра гидроколонотерапии (Алматы)

Статический сайт (Astro 5 + React-острова + GSAP/Lenis + R3F) для shared-хостинга Plesk. В рантайме только HTML/CSS/JS/медиа и две PHP-точки для форм — Node не нужен.

## Быстрый старт

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # dist/ + подстановка CSP-хешей
npm run preview      # http://localhost:4322 (astro preview dist/)
```

Проверки:

```bash
npm run check          # типы (astro check)
npm run fonts:check    # казахские глифы в шрифтах
npm run contrast       # контраст пар дизайн-системы (WCAG)
npm run verify:runtime # dist/ статичен, бюджеты JS/CSS, kk-зеркало, CSP-хеши
node scripts/check-i18n.mjs                  # структура kk.json = ru.json, ветки _needsReview
node scripts/lighthouse.mjs http://localhost:4322 home procedure kk   # Lighthouse (нужен запущенный preview)
node scripts/shoot.mjs http://localhost:4321 reports/shots home       # скриншоты (headless Edge/Chrome, CDP)
```

## Структура

```
src/
  components/{ui,sections,3d,forms,layout,seo}/   компоненты
  layouts/BaseLayout.astro                        каркас страницы (SEO, шапка, футер, модалки, cookie)
  views/*.astro                                   страницы (общие для ru/kk), pages/ — тонкие роуты
  content/i18n/{ru,kk}.json                       ВЕСЬ текст сайта, включая юр. документы
  content/config/*.json                           факты о компании, контакты, вода, цены (плейсхолдеры {{TOKEN}})
  content/media-manifest.json                     реестр медиа-слотов
  lib/{gsap,scroll,motion,ui,home,scene,three,i18n,utils}/  клиентская логика
  shaders/*.glsl                                  собственные GLSL (капля, частицы, каустика)
  styles/{tokens,base,fonts,forms}.css            дизайн-токены и база
public/
  api/                                            PHP-формы (booking.php, contact.php, PHPMailer)
  documents/                                      сканы лицензии и сертификата (3 размера + PDF)
  fonts/, media/, scripts/early.js, .htaccess
scripts/                                          сборочные и QA-скрипты
```

Документы проекта: `DEPLOY.md` (выкладка на Plesk), `CONTENT-TODO.md` (что нужно от заказчика), `IMAGE-PROMPTS.md` (промпты для медиа), `LEGAL-REVIEW.md` (проверка юристом).

## Превью для заказчика (GitHub Pages)

Пуш в `main` → GitHub Actions (`.github/workflows/pages.yml`) собирает сайт с `SITE_URL=https://popoverrr.github.io SITE_BASE=/med PUBLIC_PREVIEW=1` и публикует на **https://popoverrr.github.io/med/**. Превью-сборка: все пути с префиксом `/med` (`lib/base.ts` → `withBase()`, `localePath()`), `noindex` + `robots.txt Disallow`, формы показывают пояснение и не отправляются (PHP на Pages не работает), `.htaccess` не действует (чистые URL отдаёт сам Pages). Боевая сборка для Plesk — обычный `npm run build` без этих переменных. Локально превью-сборку можно посмотреть так же, как её отдаёт Pages: `node scripts/serve-pages.mjs dist //med 4323`.

## Как это работает

- **Контент**: только `src/content/i18n/*.json`; факты — `src/content/config/*.json`. Плейсхолдеры `{{TOKEN}}` рендерятся как пунктирные метки, список — в `CONTENT-TODO.md`.
- **Медиа**: положите файлы в `public/media/` под именами из `media-manifest.json` — `<Picture>`/`<Video>` подхватят их при сборке, иначе показывается `<MediaPlaceholder>`.
- **Анимации**: `lib/motion/*` (reveal, split-text, фон, параллакс, счётчики, магнит, курсор, SVG), хореография главной — `lib/home/index.ts`. Pinned-секции, ленты, image-sequence (на телефонах — кадры 640px) и кинетическая типографика работают на всех ширинах; hero-заголовок на мобильных виден сразу (LCP). Reduced motion → fade 200 мс, pin отключён.
- **3D на всех устройствах** (решение заказчика, отклонение от ТЗ §4.3): `components/3d/*` грузятся динамически (`lib/scene/loader.ts`) при WebGL2 без software-рендера + prefers-reduced-motion: no-preference + без saveData. Четыре уровня качества (`lib/scene/tiers.ts`): `basic` (материал без преломления, 400 частиц) → `low` (преломление 1 сэмпл, без пост-обработки; старт для телефонов) → `medium` (bloom/виньетка, каустика; старт для ноутбуков) → `high` (задняя сторона капли, AO/аберрация; мощные десктопы). `components/3d/QualityMonitor.tsx` меряет fps только пока капля видима: < 45 fps три секунды подряд — уровень вниз, стабильно высокий fps — вверх, но не выше уровня, с которого уже спускались (без «качелей»); если не тянет даже `basic` — сцена размонтируется в CSS-постер. На портретных экранах позиция капли задаётся долями видимой области (`PORTRAIT_POSES` в `lib/three/params.ts`). QA: `?force3d` — запуск без проверки GPU и с зафиксированным уровнем, `?quality=basic|low|medium|high` — конкретный уровень.
- **Профилирование инициализации**: этапы помечены `performance.measure('hm:*')` (DevTools → Performance → Timings): `hm:boot`, `hm:reveals`, `hm:home:*`, `hm:scene:mount`.
- **Формы**: React-острова → `POST /api/*.php` (JSON). Сервер валидирует, honeypot + время заполнения + rate-limit, письмо через PHPMailer/SMTP и Telegram. Конфиг — `public/api/config.php` (не в репозитории, шаблон `config.example.php`).
- **CSP**: скрипты только `'self'` + SHA-256 inline-загрузчиков островов (подставляются `scripts/postbuild-csp.mjs`).
