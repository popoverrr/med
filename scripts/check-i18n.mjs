// Сверяет структуру kk.json с ru.json (эталон) и печатает ветки с "_needsReview".
// Запуск: node scripts/check-i18n.mjs
import { readFileSync } from 'node:fs';

const ru = JSON.parse(readFileSync('src/content/i18n/ru.json', 'utf8'));
const kk = JSON.parse(readFileSync('src/content/i18n/kk.json', 'utf8'));

const missing = [];
const extra = [];
const review = [];

function walk(a, b, path) {
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return missing.push(path);
    if (a.length !== b.length) missing.push(`${path} (length ${a.length} vs ${b.length})`);
    a.forEach((item, i) => walk(item, b[i], `${path}[${i}]`));
    return;
  }
  if (a && typeof a === 'object') {
    if (!b || typeof b !== 'object') return missing.push(path);
    for (const key of Object.keys(a)) {
      if (key.startsWith('_')) continue;
      if (!(key in b)) missing.push(`${path}.${key}`);
      else walk(a[key], b[key], `${path}.${key}`);
    }
    for (const key of Object.keys(b)) {
      if (key === '_needsReview') review.push(path || '(root)');
      else if (!key.startsWith('_') && !(key in a)) extra.push(`${path}.${key}`);
    }
    return;
  }
  if (typeof a !== typeof b) missing.push(`${path} (type)`);
}

walk(ru, kk, '');

console.log(`Отсутствует в kk: ${missing.length}`);
missing.forEach((m) => console.log('  -', m));
console.log(`Лишнее в kk: ${extra.length}`);
extra.forEach((m) => console.log('  -', m));
console.log(`Ветки с _needsReview: ${review.length}`);
review.forEach((m) => console.log('  -', m));

if (missing.length) process.exit(1);
