// Генерация иконок, OG-изображений и манифеста из фирменного SVG-знака (без внешних сервисов).
// Запуск: node scripts/gen-icons.mjs
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('public/media', { recursive: true });

const MARK = (color, bg, pad = 0) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  ${bg ? `<rect width="64" height="64" rx="14" fill="${bg}"/>` : ''}
  <g transform="translate(${16 + pad},${12 + pad}) scale(${(32 - pad * 2) / 32})">
    <path d="M16 2.5C16 2.5 4 16.2 4 25a12 12 0 0 0 24 0c0-8.8-12-22.5-12-22.5Z" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M16 12.5c0 0-6.2 7.6-6.2 12.4a6.2 6.2 0 0 0 12.4 0c0-4.8-6.2-12.4-6.2-12.4Z" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" opacity="0.75"/>
  </g>
</svg>`;

// favicon.svg — знак на глубокой бирюзе
writeFileSync('public/favicon.svg', MARK('#fbfdfd', '#0d4f5e'));

// PNG-иконки
const png = async (size, file, svg) => sharp(Buffer.from(svg)).resize(size, size).png().toFile(file);
await png(180, 'public/apple-touch-icon.png', MARK('#fbfdfd', '#0d4f5e'));
await png(192, 'public/icon-192.png', MARK('#fbfdfd', '#0d4f5e'));
await png(512, 'public/icon-512.png', MARK('#fbfdfd', '#0d4f5e'));
await png(512, 'public/media/logo-512.png', MARK('#0d4f5e', '#fbfdfd'));

// favicon.ico — контейнер ICO с PNG-записью 32×32 (поддерживается всеми современными браузерами)
const png32 = await sharp(Buffer.from(MARK('#fbfdfd', '#0d4f5e'))).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
const entry = Buffer.alloc(16);
entry.writeUInt8(32, 0); entry.writeUInt8(32, 1); entry.writeUInt8(0, 2); entry.writeUInt8(0, 3);
entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6); entry.writeUInt32LE(png32.length, 8); entry.writeUInt32LE(22, 12);
writeFileSync('public/favicon.ico', Buffer.concat([header, entry, png32]));

// OG-изображения (плейсхолдер в фирменном стиле; финальные — по IMAGE-PROMPTS.md)
const og = (title, sub, license) => `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a3a46"/><stop offset="0.6" stop-color="#07313b"/><stop offset="1" stop-color="#04141a"/></linearGradient>
    <radialGradient id="drop" cx="0.5" cy="0.45" r="0.5"><stop offset="0" stop-color="#4fc3d6" stop-opacity="0.85"/><stop offset="0.55" stop-color="#8fd6e2" stop-opacity="0.18"/><stop offset="1" stop-color="#4fc3d6" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <ellipse cx="920" cy="320" rx="260" ry="250" fill="url(#drop)"/>
  <g transform="translate(80,72) scale(1.6)">
    <path d="M16 2.5C16 2.5 4 16.2 4 25a12 12 0 0 0 24 0c0-8.8-12-22.5-12-22.5Z" fill="none" stroke="#fbfdfd" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M16 12.5c0 0-6.2 7.6-6.2 12.4a6.2 6.2 0 0 0 12.4 0c0-4.8-6.2-12.4-6.2-12.4Z" fill="none" stroke="#fbfdfd" stroke-width="1.2" stroke-linejoin="round" opacity="0.7"/>
  </g>
  <text x="150" y="112" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="500" fill="#fbfdfd">Hydromed</text>
  <text x="80" y="330" font-family="Segoe UI, Arial, sans-serif" font-size="66" font-weight="300" fill="#fbfdfd" letter-spacing="-2">${title}</text>
  <text x="80" y="400" font-family="Segoe UI, Arial, sans-serif" font-size="30" fill="#c3dbe0">${sub}</text>
  <text x="80" y="560" font-family="Segoe UI, Arial, sans-serif" font-size="22" fill="#c2a36b">${license}</text>
</svg>`;
await sharp(Buffer.from(og('Гидроколонотерапия в Алматы', 'Процедуры проводит врач с опытом 20 лет · лицензированный медицинский центр', 'Лицензия № 25011624 от 15.04.2025 · Имеются противопоказания. Необходима консультация специалиста.'))).jpeg({ quality: 86 }).toFile('public/media/og-image-ru-1200.jpg');
await sharp(Buffer.from(og('Алматыдағы гидроколонотерапия', 'Ем-шараларды 20 жылдық тәжірибесі бар дәрігер жүргізеді · лицензияланған орталық', 'Лицензия № 25011624, 15.04.2025 · Қарсы көрсетілімдер бар. Маманның кеңесі қажет.'))).jpeg({ quality: 86 }).toFile('public/media/og-image-kk-1200.jpg');

writeFileSync('public/site.webmanifest', JSON.stringify({
  name: 'Hydromed — гидроколонотерапия в Алматы',
  short_name: 'Hydromed',
  start_url: '/',
  display: 'browser',
  background_color: '#eef5f6',
  theme_color: '#0d4f5e',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
}, null, 2));

console.log('Иконки, OG и манифест сгенерированы');
