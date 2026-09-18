// После сборки: собирает SHA-256 всех inline-скриптов Astro (загрузчики островов, astro-island)
// и подставляет их в CSP dist/.htaccess вместо маркера __INLINE_SCRIPT_HASHES__.
// JSON-LD (type="application/ld+json") не исполняется и хешей не требует.
// Запуск: автоматически в `npm run build`.
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const DIST = 'dist';
const files = [];
(function walk(dir) { for (const f of readdirSync(dir)) { const p = join(dir, f); statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') && files.push(p); } })(DIST);

const hashes = new Set();
const re = /<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g;
for (const f of files) {
  const html = readFileSync(f, 'utf8');
  for (const m of html.matchAll(re)) {
    const attrs = m[1] ?? '';
    if (/type="application\/ld\+json"/.test(attrs)) continue;
    const body = m[2] ?? '';
    if (!body.trim()) continue;
    hashes.add("'sha256-" + createHash('sha256').update(body, 'utf8').digest('base64') + "'");
  }
}

const ht = join(DIST, '.htaccess');
if (!existsSync(ht)) { console.error('dist/.htaccess не найден'); process.exit(1); }
let text = readFileSync(ht, 'utf8');
const list = [...hashes].join(' ');
if (!text.includes('__INLINE_SCRIPT_HASHES__')) { console.error('В .htaccess нет маркера __INLINE_SCRIPT_HASHES__'); process.exit(1); }
text = text.replace('__INLINE_SCRIPT_HASHES__', list).replace(/  +/g, ' ');
writeFileSync(ht, text);
console.log(`CSP: добавлено хешей inline-скриптов: ${hashes.size} (страниц: ${files.length})`);
