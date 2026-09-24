// Плейсхолдеры кадров image-sequence (90 × 1280×720 WebP) в фирменном стиле с номером кадра,
// чтобы механика scroll-scrub была видна заказчику до появления реальных кадров.
// Реальные кадры кладутся на те же имена: public/media/sequence/procedure-seq-001.webp … 090 (1280×720)
// и public/media/sequence/640/procedure-seq-001.webp … 090 (640×360 — для мобильных).
// Запуск: node scripts/gen-placeholders.mjs
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'node:fs';

const DIR = 'public/media/sequence';
const FRAMES = 90;
const W = 1280;
const H = 720;
mkdirSync(DIR, { recursive: true });

function frameSvg(i) {
  const t = i / (FRAMES - 1);
  const cx = W * (0.18 + t * 0.64);
  const cy = H * (0.62 - Math.sin(t * Math.PI) * 0.25);
  const num = String(i + 1).padStart(3, '0');
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a3a46"/><stop offset="0.55" stop-color="#07313b"/><stop offset="1" stop-color="#04141a"/></linearGradient>
    <radialGradient id="light" cx="${(cx / W).toFixed(3)}" cy="${(cy / H).toFixed(3)}" r="0.42"><stop offset="0" stop-color="#4fc3d6" stop-opacity="0.55"/><stop offset="0.5" stop-color="#8fd6e2" stop-opacity="0.12"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.08"/></feComponentTransfer></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#light)"/>
  <rect width="${W}" height="${H}" filter="url(#noise)"/>
  <line x1="0" y1="${H * 0.72}" x2="${W}" y2="${H * 0.72}" stroke="#fbfdfd" stroke-opacity="0.18"/>
  <circle cx="${cx.toFixed(1)}" cy="${(H * 0.72).toFixed(1)}" r="4" fill="#fbfdfd" fill-opacity="0.7"/>
  <text x="${W / 2}" y="${H * 0.47}" text-anchor="middle" font-family="Consolas, monospace" font-size="${Math.round(H * 0.028)}" font-weight="500" fill="#fbfdfd" fill-opacity="0.85">procedure-seq-${num}</text>
  <text x="${W / 2}" y="${H * 0.525}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${Math.round(H * 0.02)}" fill="#fbfdfd" fill-opacity="0.55">IMAGE SEQUENCE · 16:9 · ${FRAMES} × ${W} px · кадр = прогресс скролла</text>
  <text x="${W - 40}" y="${H - 28}" text-anchor="end" font-family="Consolas, monospace" font-size="18" fill="#fbfdfd" fill-opacity="0.5">${num} / ${String(FRAMES).padStart(3, '0')}</text>
</svg>`;
}

mkdirSync(`${DIR}/640`, { recursive: true });
let made = 0;
for (let i = 0; i < FRAMES; i++) {
  const name = `procedure-seq-${String(i + 1).padStart(3, '0')}.webp`;
  const out = `${DIR}/${name}`;
  if (existsSync(out) && process.argv.includes('--keep')) continue;
  const svg = Buffer.from(frameSvg(i));
  await sharp(svg).webp({ quality: 58, effort: 4 }).toFile(out);
  await sharp(svg).resize(640, 360).webp({ quality: 60, effort: 4 }).toFile(`${DIR}/640/${name}`);
  made++;
}
console.log(`Сгенерировано кадров: ${made} → ${DIR}`);
