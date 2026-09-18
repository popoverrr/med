// Lighthouse-аудит собранного сайта (мобайл — по умолчанию, десктоп — с флагом --desktop).
// Использование: node scripts/lighthouse.mjs <baseUrl> [--desktop] [home procedure kk legal/privacy ...]
// Требует: сборка (npm run build) и запущенный `astro preview` на <baseUrl>; Chrome/Edge установлен.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith('http')) ?? 'http://localhost:4322';
const desktop = args.includes('--desktop');
// Пути можно передавать без ведущего слэша (Git Bash под Windows подменяет /path на путь MSYS)
const paths = args.filter((a) => !a.startsWith('http') && !a.startsWith('--')).map((a) => (a === 'home' ? '/' : '/' + a.replace(/^\/+/, '')));
const targets = paths.length ? paths : ['/', '/procedure', '/kk', '/legal/privacy'];

const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const chrome = BROWSERS.find((p) => existsSync(p));
if (!chrome) { console.error('Chrome/Edge не найден'); process.exit(1); }

const OUT = 'reports/lighthouse';
mkdirSync(OUT, { recursive: true });
const cli = join('node_modules', 'lighthouse', 'cli', 'index.js');

const summary = [];
for (const path of targets) {
  const name = (path === '/' ? 'home' : path.replace(/^\//, '').replace(/\//g, '-')) + (desktop ? '-desktop' : '-mobile');
  const outPath = join(OUT, name);
  const lhArgs = [cli, base + path, '--output=json', '--output=html', `--output-path=${outPath}`, '--quiet',
    '--chrome-flags=--headless=new --no-sandbox --disable-gpu', '--only-categories=performance,accessibility,best-practices,seo'];
  if (desktop) lhArgs.push('--preset=desktop');
  const r = spawnSync(process.execPath, lhArgs, { env: { ...process.env, CHROME_PATH: chrome }, stdio: 'pipe', timeout: 300000 });
  const json = `${outPath}.report.json`;
  if (!existsSync(json)) { console.log(`ERR ${path}: ${String(r.stderr).slice(-400)}`); continue; }
  const rep = JSON.parse(readFileSync(json, 'utf8'));
  const c = rep.categories;
  const a = rep.audits;
  const row = {
    path,
    perf: Math.round(c.performance.score * 100),
    a11y: Math.round(c.accessibility.score * 100),
    bp: Math.round(c['best-practices'].score * 100),
    seo: Math.round(c.seo.score * 100),
    lcp: a['largest-contentful-paint'].displayValue,
    cls: a['cumulative-layout-shift'].displayValue,
    tbt: a['total-blocking-time'].displayValue,
    fcp: a['first-contentful-paint'].displayValue,
  };
  summary.push(row);
  console.log(`${path.padEnd(16)} perf ${row.perf}  a11y ${row.a11y}  bp ${row.bp}  seo ${row.seo}   LCP ${row.lcp}  CLS ${row.cls}  TBT ${row.tbt}  FCP ${row.fcp}`);
  const weak = Object.values(a).filter((x) => x.score !== null && x.score < 0.9 && !['informative', 'notApplicable', 'manual'].includes(x.scoreDisplayMode));
  for (const x of weak) console.log(`   - ${x.id} (${Math.round(x.score * 100)}) ${x.displayValue ?? ''}`);
}
console.log(`\nОтчёты: ${OUT}/*.report.html`);

// Windows: chrome-launcher иногда оставляет headless-рендереры — они грузят CPU и искажают следующие замеры
if (process.platform === 'win32') {
  const ps = "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe' OR Name='chrome.exe'\" | Where-Object { $_.CommandLine -like '*--headless*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
  spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'ignore' });
}
