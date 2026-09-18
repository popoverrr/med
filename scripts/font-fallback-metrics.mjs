// Метрики fallback-шрифтов (size-adjust / ascent-override / descent-override / line-gap-override),
// чтобы Arial до загрузки woff2 занимал тот же объём — CLS ≈ 0 при font-display: swap.
// Ширина сравнивается по реальному тексту (RU+KZ+Latin), а не по OS/2.xAvgCharWidth.
// Запуск: node scripts/font-fallback-metrics.mjs  → вставить вывод в src/styles/fonts.css
import * as fontkit from 'fontkit';
import { readFileSync, existsSync } from 'node:fs';

const SAMPLE = 'Вода, подготовленная под вашу процедуру. Гидроколонотерапия в лицензированном медицинском центре Алматы. Сіздің ем-шараңызға арнайы дайындалған су. Hydromed, VOKO Aqualuxe, TYENT NMP 0123456789';
const arialPath = ['C:/Windows/Fonts/arial.ttf', '/Library/Fonts/Arial.ttf'].find((p) => existsSync(p));
if (!arialPath) { console.error('Arial не найден'); process.exit(1); }
const arial = fontkit.create(readFileSync(arialPath));
const width = (font) => font.layout(SAMPLE).advanceWidth / font.unitsPerEm;
const arialW = width(arial);

const FONTS = {
  'Onest Fallback': ['node_modules/@fontsource-variable/onest/files/onest-latin-wght-normal.woff2', 'node_modules/@fontsource-variable/onest/files/onest-cyrillic-wght-normal.woff2'],
  'Inter Tight Fallback': ['node_modules/@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2', 'node_modules/@fontsource-variable/inter-tight/files/inter-tight-cyrillic-wght-normal.woff2'],
};
for (const [name, files] of Object.entries(FONTS)) {
  // latin-файл даёт вертикальные метрики; ширину меряем по латинской части + кириллице из второго subset
  const latin = fontkit.create(readFileSync(files[0]));
  const cyr = fontkit.create(readFileSync(files[1]));
  const measure = (font, text) => font.layout(text).advanceWidth / font.unitsPerEm;
  const latinText = SAMPLE.replace(/[^\x00-\x7F]/g, '');
  const cyrText = SAMPLE.replace(/[\x00-\x7F]/g, '');
  const w = measure(latin, latinText) + measure(cyr, cyrText);
  const aw = measure(arial, latinText) + measure(arial, cyrText);
  const sizeAdjust = w / aw;
  const upm = latin.unitsPerEm;
  const asc = (latin.ascent / upm) / sizeAdjust;
  const desc = (Math.abs(latin.descent) / upm) / sizeAdjust;
  const gap = (latin.lineGap / upm) / sizeAdjust;
  console.log(`@font-face { font-family: '${name}'; src: local('Arial'); size-adjust: ${(sizeAdjust * 100).toFixed(2)}%; ascent-override: ${(asc * 100).toFixed(2)}%; descent-override: ${(desc * 100).toFixed(2)}%; line-gap-override: ${(gap * 100).toFixed(2)}%; }`);
}
