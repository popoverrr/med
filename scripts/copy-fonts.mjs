// Копирует нужные subset-файлы шрифтов (RU + KZ + Latin) из node_modules в public/fonts.
// Курсив не используется в дизайн-системе — не копируем, экономим вес.
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'public/fonts';
mkdirSync(OUT, { recursive: true });

const SUBSETS = ['cyrillic-ext', 'cyrillic', 'latin-ext', 'latin'];
const FAMILIES = [
  { pkg: '@fontsource-variable/onest', prefix: 'onest' },
  { pkg: '@fontsource-variable/inter-tight', prefix: 'inter-tight' },
];

let total = 0;
for (const { pkg, prefix } of FAMILIES) {
  for (const subset of SUBSETS) {
    const name = `${prefix}-${subset}-wght-normal.woff2`;
    const src = join('node_modules', pkg, 'files', name);
    copyFileSync(src, join(OUT, name));
    const kb = statSync(src).size / 1024;
    total += kb;
    console.log(`${name.padEnd(44)} ${kb.toFixed(1)} KB`);
  }
}
console.log(`Итого: ${total.toFixed(0)} KB (грузятся только subset'ы, нужные странице)`);
