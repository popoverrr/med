// Локальная проверка превью-сборки как на GitHub Pages: <dir> под подпутём <base>, /x → x.html,
// /dir → /dir/ → index.html, 404.html. Использование (Git Bash экранирует /med как путь — пишите //med):
//   MSYS_NO_PATHCONV=1 SITE_URL=https://popoverrr.github.io SITE_BASE=/med PUBLIC_PREVIEW=1 npm run build
//   node scripts/serve-pages.mjs dist //med 4323  →  http://127.0.0.1:4323/med/
import { createServer } from 'node:http';
import { statSync, existsSync, createReadStream } from 'node:fs';
import { join, extname } from 'node:path';
const [dir, base = '/med', port = '4323'] = process.argv.slice(2);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.webmanifest': 'application/manifest+json' };
createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!url.startsWith(base + '/') && url !== base) { res.writeHead(url === '/' ? 302 : 404, url === '/' ? { Location: base + '/' } : {}); return res.end('404'); }
  let rel = url === base ? '/' : url.slice(base.length);
  let file = join(dir, rel);
  if (existsSync(file) && statSync(file).isDirectory()) { if (!rel.endsWith('/')) { res.writeHead(301, { Location: url + '/' }); return res.end(); } file = join(file, 'index.html'); }
  if (!existsSync(file) && existsSync(file + '.html')) file += '.html';
  if (!existsSync(file)) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); return createReadStream(join(dir, '404.html')).pipe(res); }
  res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(+port, '127.0.0.1', () => console.log(`serving ${dir} at http://127.0.0.1:${port}${base}/`));
