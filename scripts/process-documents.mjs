// Обработка сканов документов (ТЗ §8.5): три размера WebP + PNG (полный) + PDF для скачивания.
// Вход: обработанные сканы (выровненные, без бликов). Выход: public/documents/<id>-{full,medium,preview}.webp, <id>-full.png, <id>.pdf
// Запуск: node scripts/process-documents.mjs [папка-с-исходниками]
import sharp from 'sharp';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const SRC_DIR = process.argv[2] ?? join(homedir(), 'Downloads');
const OUT = 'public/documents';
mkdirSync(OUT, { recursive: true });

const DOCS = [
  { id: 'license-01-main', file: 'license-01-main.webp' },
  { id: 'license-02-appendix', file: 'license-02-appendix.webp' },
  { id: 'certificate-hydrocolon-rahpatova', file: 'certificate-hydrocolon-rahpatova.webp' },
];

const SIZES = { full: 2048, medium: 1200, preview: 480 };

/** Минимальный PDF с одной страницей и JPEG-изображением (DCTDecode). Без внешних зависимостей. */
function jpegToPdf(jpeg, width, height) {
  // Страница по размеру изображения, масштаб под ширину 595pt (A4) при сохранении пропорций
  const pageW = 595.28;
  const pageH = (height / width) * pageW;
  const objects = [];
  const add = (s) => { objects.push(s); return objects.length; };
  const catalog = add('<< /Type /Catalog /Pages 2 0 R >>');
  add('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>`);
  const imgHeader = `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`;
  add({ header: imgHeader, stream: jpeg });
  const content = `q ${pageW.toFixed(2)} 0 0 ${pageH.toFixed(2)} 0 0 cm /Im1 Do Q`;
  add({ header: `<< /Length ${Buffer.byteLength(content)} >>`, stream: Buffer.from(content) });

  const parts = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary')];
  const offsets = [];
  let pos = parts[0].length;
  objects.forEach((obj, i) => {
    offsets.push(pos);
    let buf;
    if (typeof obj === 'string') buf = Buffer.from(`${i + 1} 0 obj\n${obj}\nendobj\n`, 'binary');
    else buf = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n${obj.header}\nstream\n`, 'binary'), obj.stream, Buffer.from('\nendstream\nendobj\n', 'binary')]);
    parts.push(buf);
    pos += buf.length;
  });
  const xrefPos = pos;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) xref += `${String(o).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  parts.push(Buffer.from(xref, 'binary'));
  return Buffer.concat(parts);
}

for (const doc of DOCS) {
  const src = join(SRC_DIR, doc.file);
  if (!existsSync(src)) { console.warn(`Пропуск: нет файла ${src}`); continue; }
  const image = sharp(src);
  const meta = await image.metadata();
  console.log(`${doc.id}: ${meta.width}×${meta.height}`);
  for (const [name, width] of Object.entries(SIZES)) {
    const out = join(OUT, `${doc.id}-${name}.webp`);
    await sharp(src).resize({ width: Math.min(width, meta.width), withoutEnlargement: true }).webp({ quality: name === 'preview' ? 72 : 82, effort: 5 }).toFile(out);
  }
  await sharp(src).png({ compressionLevel: 9, palette: false }).toFile(join(OUT, `${doc.id}-full.png`));
  const jpeg = await sharp(src).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  const { width, height } = await sharp(jpeg).metadata();
  writeFileSync(join(OUT, `${doc.id}.pdf`), jpegToPdf(jpeg, width, height));
  console.log(`  → webp full/medium/preview, png, pdf`);
}
console.log('Готово: public/documents');
