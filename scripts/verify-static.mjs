// Проверка сборки перед сдачей (ТЗ §12.5, §11):
//  - dist/ статичен: нет серверного кода Node, нет ссылок на node_modules, нет source maps;
//  - все скрипты/стили — локальные (self-hosted), внешних CDN нет;
//  - обязательные файлы на месте (.htaccess, api/*.php, robots, sitemap, 404, kk-зеркало);
//  - секреты не попали в сборку (api/config.php);
//  - бюджеты: начальный JS главной (без WebGL-чанка) ≤ 180 КБ gzip, CSS ≤ 60 КБ gzip.
// Запуск: npm run verify:runtime
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
if (!existsSync(DIST)) { console.error('Нет dist/ — сначала npm run build'); process.exit(1); }

const files = [];
(function walk(dir) { for (const f of readdirSync(dir)) { const p = join(dir, f); statSync(p).isDirectory() ? walk(p) : files.push(p); } })(DIST);
const rel = (p) => p.replace(/\\/g, '/').replace(/^dist\//, '');
let errors = 0;
const fail = (m) => { errors++; console.log('FAIL ' + m); };
const ok = (m) => console.log('OK   ' + m);

// 1. Никакого Node в рантайме
const nodeish = files.filter((f) => /\.(mjs|cjs|ts)$/.test(f) && !f.includes(`${DIST}\\assets`) && !f.includes(`${DIST}/assets`));
nodeish.length ? fail('серверные модули в dist: ' + nodeish.map(rel).join(', ')) : ok('серверных модулей Node нет');
const maps = files.filter((f) => f.endsWith('.map'));
maps.length ? fail('source maps в dist: ' + maps.length) : ok('source maps отсутствуют');
const nm = files.filter((f) => /\.(js|html|css)$/.test(f) && readFileSync(f, 'utf8').includes('node_modules/'));
nm.length ? fail('ссылки на node_modules: ' + nm.map(rel).join(', ')) : ok('ссылок на node_modules нет');

// 2. Внешние ресурсы
const htmls = files.filter((f) => f.endsWith('.html'));
const external = new Set();
for (const h of htmls) {
  const html = readFileSync(h, 'utf8');
  for (const m of html.matchAll(/<(?:script|link)[^>]+(?:src|href)="(https?:\/\/[^"]+)"/g)) {
    const url = m[1];
    if (/<link[^>]*rel="(?:canonical|alternate|sitemap)"/.test(m[0])) continue;
    if (/rel="(?:canonical|alternate|sitemap)"/.test(m[0])) continue;
    external.add(url);
  }
  // inline-загрузчики островов Astro допустимы: их SHA-256 подставляются в CSP (scripts/postbuild-csp.mjs)
}
external.size ? fail('внешние скрипты/стили: ' + [...external].join(', ')) : ok('внешних скриптов и стилей нет (self-hosted)');

// 3. Обязательные файлы
for (const f of ['.htaccess', 'index.html', 'kk.html', '404.html', 'robots.txt', 'sitemap-index.xml', 'api/booking.php', 'api/contact.php', 'api/_bootstrap.php', 'api/.htaccess', 'api/lib/PHPMailer/PHPMailer.php', 'favicon.svg', 'documents/license-01-main-full.webp']) {
  existsSync(join(DIST, f)) ? ok('есть ' + f) : fail('нет ' + f);
}
existsSync(join(DIST, 'api/config.php')) ? fail('api/config.php попал в сборку — секреты!') : ok('api/config.php не в сборке');
const csp = readFileSync(join(DIST, '.htaccess'), 'utf8');
/script-src 'self' 'sha256-/.test(csp) ? ok('CSP содержит хеши inline-загрузчиков Astro') : fail('CSP без хешей inline-скриптов (postbuild-csp не отработал)');
existsSync(join(DIST, 'api/_data/requests.jsonl')) ? fail('журнал заявок попал в сборку') : ok('журнал заявок не в сборке');

// 4. Бюджеты главной
const index = readFileSync(join(DIST, 'index.html'), 'utf8');
const scripts = [...index.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
const styles = [...index.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]);
const gz = (p) => gzipSync(readFileSync(join(DIST, p.replace(/^\//, '')))).length;
// modulepreload + динамические импорты главной (все чанки, кроме webgl)
const preloads = [...index.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)].map((m) => m[1]);
const jsSet = new Set([...scripts, ...preloads].filter((s) => s.startsWith('/')));
// Чанки, которые главная догружает динамически (home, react-острова) — считаем тоже, кроме webgl
for (const f of files.filter((f) => f.includes('assets') && f.endsWith('.js'))) {
  const r = '/' + rel(f);
  if (/webgl|mount\./.test(r)) continue;
  if (/index\.|BookingForm|react|shared|motion-core|BaseLayout|ClientRouter|client\.|page\./.test(r)) jsSet.add(r);
}
const jsTotal = [...jsSet].reduce((s, p) => s + gz(p), 0);
const inlineCss = [...index.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
const cssTotal = styles.filter((s) => s.startsWith('/')).reduce((s, p) => s + gz(p), 0) + gzipSync(Buffer.from(inlineCss)).length;
const webgl = files.filter((f) => /webgl/.test(f)).reduce((s, f) => s + gzipSync(readFileSync(f)).length, 0);
console.log(`     JS главной (без WebGL, gzip): ${(jsTotal / 1024).toFixed(1)} КБ — ${[...jsSet].map((p) => p.split('/').pop() + ' ' + (gz(p) / 1024).toFixed(1)).join(', ')}`);
console.log(`     CSS главной (gzip): ${(cssTotal / 1024).toFixed(1)} КБ; WebGL-чанк (gzip, динамический): ${(webgl / 1024).toFixed(1)} КБ`);
jsTotal <= 180 * 1024 ? ok('JS ≤ 180 КБ gzip') : fail('JS главной превышает 180 КБ gzip');
cssTotal <= 60 * 1024 ? ok('CSS ≤ 60 КБ gzip') : fail('CSS превышает 60 КБ gzip');

// 5. Двуязычие: у каждой ru-страницы есть kk-зеркало
const ruPages = htmls.map(rel).filter((p) => !p.startsWith('kk/') && !p.startsWith('api/') && p !== 'kk.html' && p !== '404.html');
const missing = ruPages.filter((p) => !existsSync(join(DIST, p === 'index.html' ? 'kk.html' : 'kk/' + p)));
missing.length ? fail('нет kk-зеркала для: ' + missing.join(', ')) : ok(`kk-зеркало есть для всех ${ruPages.length} страниц`);

console.log(errors ? `\nПроблем: ${errors}` : '\nСборка статична и укладывается в бюджеты.');
process.exit(errors ? 1 : 0);
