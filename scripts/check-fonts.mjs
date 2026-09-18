// Проверка покрытия казахского алфавита (и базовой кириллицы/латиницы) в self-hosted шрифтах.
// Запуск: npm run fonts:check
import * as fontkit from 'fontkit';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FONT_DIRS = {
  'Onest Variable': 'node_modules/@fontsource-variable/onest/files',
  'Inter Tight Variable': 'node_modules/@fontsource-variable/inter-tight/files',
};

// Специфические буквы казахского алфавита + пара контрольных русских/латинских + типографика.
const KZ = 'әғқңөұүһіӘҒҚҢӨҰҮҺІ';
const RU = 'ёЁйЙщЩъЪ';
const LAT = 'AaZz';
const TYPO = '«»—–…№₸';
const SETS = { KZ, RU, LAT, TYPO };

let failed = false;

for (const [family, dir] of Object.entries(FONT_DIRS)) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.woff2') && !f.includes('italic'));
  // Объединяем покрытие всех subset-файлов семейства — так они и работают через unicode-range.
  const covered = new Set();
  for (const f of files) {
    const font = fontkit.create(readFileSync(join(dir, f)));
    for (const cp of font.characterSet) covered.add(cp);
  }
  console.log(`\n${family} (${files.length} файлов)`);
  for (const [name, chars] of Object.entries(SETS)) {
    const missing = [...chars].filter((ch) => !covered.has(ch.codePointAt(0)));
    const ok = missing.length === 0;
    if (!ok && name !== 'TYPO') failed = true;
    console.log(`  ${ok ? 'OK ' : 'НЕТ'} ${name.padEnd(5)} ${ok ? 'все ' + chars.length + ' глифов' : 'отсутствуют: ' + missing.join(' ')}`);
  }
}

if (failed) {
  console.error('\nШрифт без казахских глифов использовать нельзя (ТЗ §3.2).');
  process.exit(1);
}
console.log('\nПокрытие KZ/RU/Latin подтверждено для обоих семейств.');
