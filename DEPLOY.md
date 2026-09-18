# DEPLOY — сборка и выкладка на Plesk (shared)

Сайт полностью статический (HTML/CSS/JS/медиа) + две PHP-точки для форм. В рантайме **не требуется Node.js**: он нужен только для сборки на вашем компьютере. Проверка: `npm run verify:runtime` (сканирует `dist/` на серверные зависимости).

## 0. Требования к хостингу

- Plesk с Apache (или nginx + Apache), включённые модули `mod_rewrite`, `mod_headers`, `mod_deflate` (brotli — опционально). Обычно включены по умолчанию.
- PHP **8.1+** для домена (Plesk → сайт → *PHP Settings*: версия 8.1/8.2/8.3, обработчик FPM). Расширения: `mbstring`, `json`, `curl` (для Telegram; иначе используется `file_get_contents`), `openssl` (SMTP TLS).
- SSL-сертификат (Let’s Encrypt в Plesk) — `.htaccess` принудительно редиректит на HTTPS.

## 1. Сборка локально

```bash
npm install
npm run fonts:check      # (один раз) проверка казахских глифов
npm run check            # типы
npm run build            # → dist/
npm run verify:runtime   # убедиться, что dist/ статичен
```

`dist/` содержит: все страницы `*.html` (чистые URL через `.htaccess`), `assets/` (хэшированные JS/CSS), `fonts/`, `media/`, `documents/`, `api/` (PHP), `.htaccess`, `robots.txt`, `sitemap-*.xml`, иконки.

## 2. Что заливать

Содержимое папки **`dist/`** → в `httpdocs/` домена (в корень, не в подпапку). Папка `api/` уже внутри `dist/` (копируется из `public/`).

Перед первой выкладкой на сервере:

1. Создать `httpdocs/api/config.php` из `config.example.php` (заполнить SMTP, получателей, Telegram, `allowed_origins` = ваш домен с https).
2. Создать каталог для журнала **вне** `httpdocs`: например `/var/www/vhosts/<домен>/api-data` (в File Manager — на уровень выше httpdocs), права `750`, и указать его в `config.php` → `'data_dir' => '/var/www/vhosts/<домен>/api-data'`. Если оставить `null`, используется `httpdocs/api/_data` (закрыт `.htaccess`, но лучше вынести).

`config.php` при последующих обновлениях **не перезаписывать** (его нет в `dist/`).

## 3. Способ A — File Manager Plesk

1. Plesk → *Файлы* → `httpdocs`.
2. Удалить старое содержимое (кроме `api/config.php` и, если создавали, `api/_data/`).
3. Загрузить архив `dist.zip` (заархивируйте содержимое `dist/`, не саму папку) → *Извлечь файлы*.
4. Убедиться, что `.htaccess` виден (включить показ скрытых файлов) и лежит в корне `httpdocs`.
5. Права: файлы `644`, каталоги `755`; `api/config.php` — `600` или `640`; `api/_data` (если используется) — `750`.

## 4. Способ B — FTP/SFTP

Загрузить содержимое `dist/` в `httpdocs/` любым клиентом (FileZilla, WinSCP) с включённой перезаписью. Не забыть скрытый `.htaccess`. `api/config.php` заливается отдельно и один раз.

## 5. Способ C — Git-деплой Plesk (расширение Git)

Репозиторий содержит исходники, а не сборку, поэтому на shared-хостинге без Node удобнее:

- либо коммитить `dist/` в отдельную ветку `deploy` (локально: `npm run build && git subtree push --prefix dist origin deploy`) и в Plesk Git подключить ветку `deploy` с каталогом развертывания `httpdocs`;
- либо использовать способы A/B.

Не подключайте ветку с исходниками к `httpdocs` — Node-сборка на сервере не запустится.

## 6. Настройки Plesk после выкладки

- *Apache & nginx Settings*: если включён nginx-прокси — оставить «Proxy mode» и разрешить обработку `.htaccess` Apache (по умолчанию так). Если включена опция «Serve static files directly by nginx», заголовки кэша/безопасности из `.htaccess` для статики не применятся — либо отключить её, либо продублировать заголовки в «Additional nginx directives» (см. ниже).
- *PHP Settings*: 8.1+, `memory_limit` 128M достаточно, `display_errors` Off.
- *Hosting Settings*: документный корень `httpdocs`, «Permanent SEO-safe 301 redirect from HTTP to HTTPS» — можно включить (дублирует `.htaccess`), «Preferred domain» — без www (согласовано с `.htaccess`; если нужен www — поменять правило в `.htaccess`).

Дополнительные директивы nginx (только если статика отдаётся nginx):

```
location ~* \.(js|css)$ { add_header Cache-Control "public, max-age=31536000, immutable"; }
location ~* \.(woff2|avif|webp|jpe?g|png|svg|ico|mp4|webm|pdf)$ { add_header Cache-Control "public, max-age=2592000"; }
```

## 7. Проверка после выкладки

1. `https://<домен>/` открывается, редирект с `http://` и `www.` работает.
2. Чистые URL: `/procedure`, `/kk`, `/kk/procedure`, `/legal/license` — без `.html`; `/procedure.html` → 301 на `/procedure`; `/kk/` → 301 на `/kk`.
3. 404: несуществующий адрес → стилизованная страница 404 (RU).
4. Заголовки: `curl -I https://<домен>/` — есть `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`; для `/assets/*.js` — `Cache-Control: immutable`; для `.html` — `no-cache`.
5. Закрытые файлы: `/api/config.php`, `/api/_bootstrap.php`, `/api/lib/PHPMailer/PHPMailer.php` → 403; `/api/_data/` → 403.
6. Формы: отправить тестовую заявку с сайта → письмо/Telegram пришли; `GET /api/booking.php` → 405 (JSON); повторная отправка 6 раз за 10 минут → 429.
7. Консоль браузера без ошибок CSP (если карта не грузится — добавить домен виджета карты в `frame-src`/`connect-src` в `.htaccess`).
8. Проверить, что сайт отдаётся без Node: в Plesk нет Node-приложения, PHP работает — всё.

## 8. Обновление сайта

`npm run build` → залить содержимое `dist/` поверх (способ A/B) — старые хэшированные ассеты можно удалить. `api/config.php` и `api-data` не трогать.

## 9. Отладка форм

- `500 {"ok":false,"error":"not_configured"}` — нет `api/config.php`.
- `403 {"error":"origin"}` — домен не в `allowed_origins` (учтите `https://` и www/без www).
- Письма не приходят — проверьте SMTP (Plesk → Почта: ящик отправителя существует, порт 587/TLS или 465/SSL), в `config.php` временно можно включить `error_log` PHP; ошибки PHPMailer пишутся в лог PHP домена (`logs/php_error.log` в Plesk).
- Telegram — бот должен быть добавлен в чат, `chat_id` для групп начинается с `-100`.
