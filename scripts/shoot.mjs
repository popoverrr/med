// Скриншоты страниц через headless Edge/Chrome по протоколу DevTools (CDP) — для QA и отчётов.
// Использование: node scripts/shoot.mjs <baseUrl> <out-dir> [preset] [--3d]
//   preset: all (по умолчанию) | home | pages | mobile | legal
//   --3d: включать WebGL (?force3d, медленно в headless: SwiftShader)
// Требуется запущенный dev/preview сервер. Node ≥ 22 (встроенный WebSocket).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://localhost:4321';
const out = process.argv[3] ?? 'reports/shots';
const preset = (process.argv[4] ?? 'all').replace(/^--.*/, 'all');
const with3d = process.argv.includes('--3d');
mkdirSync(out, { recursive: true });

const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
];
const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) { console.error('Не найден Edge/Chrome'); process.exit(1); }

const D = { w: 1440, h: 900 };
const M = { w: 390, h: 844, mobile: true };
const gl = with3d ? '?force3d' : '';
const home = [
  { name: 'home-hero', url: `/${gl}`, ...D, wait: 3500 },
  { name: 'home-what', url: `/${gl}`, ...D, scroll: 1700, wait: 2500 },
  { name: 'home-how', url: `/${gl}`, ...D, scroll: 4700, wait: 2500 },
  { name: 'home-water', url: `/${gl}`, ...D, scroll: 8300, wait: 2500 },
  { name: 'home-indications', url: `/${gl}`, ...D, scroll: 10300, wait: 2500 },
  { name: 'home-contra', url: '/', ...D, scroll: 12400, wait: 2000 },
  { name: 'home-sterility', url: '/', ...D, scroll: 14200, wait: 2000 },
  { name: 'home-specialist', url: '/', ...D, scroll: 15600, wait: 2000 },
  { name: 'home-license', url: '/', ...D, scroll: 17200, wait: 2000 },
  { name: 'home-prices', url: '/', ...D, scroll: 18800, wait: 2000 },
  { name: 'home-faq', url: '/', ...D, scroll: 20000, wait: 2000 },
  { name: 'home-booking', url: '/', ...D, scroll: 21600, wait: 2000 },
  { name: 'home-contacts', url: '/', ...D, scroll: 22800, wait: 2000 },
  { name: 'home-footer', url: '/', ...D, scroll: 99999, wait: 2000 },
];
const pages = ['procedure', 'water', 'prices', 'about', 'contacts', 'booking', 'kk', 'kk/procedure', '404'].map((p) => ({
  name: `page-${p.replace(/\//g, '-')}`, url: `/${p}`, ...D, wait: 2500,
}));
const legal = ['legal/privacy', 'legal/consent', 'legal/offer', 'legal/patient-rights', 'legal/license', 'kk/legal/license'].map((p) => ({
  name: `page-${p.replace(/\//g, '-')}`, url: `/${p}`, ...D, wait: 2500,
}));
const mobile = [
  { name: 'm-home', url: '/', ...M, wait: 3000 },
  { name: 'm-home-what', url: '/', ...M, scroll: 1400, wait: 2000 },
  { name: 'm-home-water', url: '/', ...M, scroll: 4200, wait: 2000 },
  { name: 'm-procedure', url: '/procedure', ...M, wait: 2500 },
  { name: 'm-booking', url: '/booking', ...M, wait: 2500 },
  { name: 'm-menu', url: '/about', ...M, wait: 2000, click: '[data-menu-toggle]' },
];
const threeD = [
  { name: '3d-hero', url: '/?force3d', ...D, wait: 6000 },
  { name: '3d-what', url: '/?force3d', ...D, scroll: 1700, wait: 6000 },
  { name: '3d-how', url: '/?force3d', ...D, scroll: 4700, wait: 6000 },
  { name: '3d-water', url: '/?force3d', ...D, scroll: 7400, wait: 7000 },
  { name: '3d-indications', url: '/?force3d', ...D, scroll: 9600, wait: 7000 },
  { name: '3d-sterility', url: '/?force3d', ...D, scroll: 13400, wait: 7000 },
];
const a11y = [
  { name: 'rm-home', url: '/', ...D, rm: true, wait: 2500 },
  { name: 'rm-home-how', url: '/', ...D, rm: true, scroll: 2600, wait: 2500 },
  { name: 'nojs-home', url: '/', ...D, nojs: true, wait: 1500 },
  { name: 'nojs-home-water', url: '/', ...D, nojs: true, scroll: 3200, wait: 1500 },
];
const sets = { home, pages, legal, mobile, '3d': threeD, '3d-quick': threeD.slice(2, 4), a11y };
const targets = preset === 'all' ? [...home, ...pages, ...legal, ...mobile] : sets[preset] ?? home;

// --- CDP mini-client ---
const port = 9333;
const proc = spawn(browser, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--lang=ru-RU',
  '--user-data-dir=' + join(process.env.LOCALAPPDATA || process.cwd(), 'Temp', 'hm-cdp-profile'),
  `--remote-debugging-port=${port}`, '--remote-allow-origins=*', '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitForPort() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) return; } catch { /* ждём */ }
    await sleep(250);
  }
  throw new Error('DevTools не отвечает');
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = []; ws.onmessage = (e) => this.onMessage(JSON.parse(e.data)); }
  onMessage(msg) {
    if (msg.id && this.pending.has(msg.id)) { const { resolve, reject } = this.pending.get(msg.id); this.pending.delete(msg.id); msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result); }
    else if (msg.method) this.events.push(msg);
  }
  send(method, params = {}) { const id = ++this.id; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); }); }
  async waitEvent(name, timeout = 15000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) { const i = this.events.findIndex((e) => e.method === name); if (i >= 0) return this.events.splice(i, 1)[0]; await sleep(50); }
    return null;
  }
}

async function openTab() {
  const r = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
  const info = await r.json();
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  return { cdp: new CDP(ws), id: info.id };
}

try {
  await waitForPort();
  for (const t of targets) {
    const { cdp, id } = await openTab();
    try {
      await cdp.send('Page.enable');
      await cdp.send('Runtime.enable');
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: t.w, height: t.h, deviceScaleFactor: 1, mobile: !!t.mobile, screenWidth: t.w, screenHeight: t.h });
      if (t.mobile) await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      if (t.mobile) await cdp.send('Network.enable'), await cdp.send('Network.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36' });
      if (t.rm) await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
      if (t.nojs) await cdp.send('Emulation.setScriptExecutionDisabled', { value: true });
      await cdp.send('Page.navigate', { url: base + t.url });
      await cdp.waitEvent('Page.loadEventFired', 20000);
      await sleep(t.scroll ? 1200 : t.wait);
      if (t.scroll) {
        await cdp.send('Runtime.evaluate', { expression: `(() => { const l = window.__lenis; const y = Math.min(${t.scroll}, document.documentElement.scrollHeight - innerHeight); if (l) l.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); return y; })()`, awaitPromise: true });
        await sleep(t.wait);
      }
      if (t.click) {
        await cdp.send('Runtime.evaluate', { expression: `document.querySelector('${t.click}')?.click()` });
        await sleep(800);
      }
      // Убираем dev-тулбар Astro со скриншота
      await cdp.send('Runtime.evaluate', { expression: `document.querySelector('astro-dev-toolbar')?.remove(); document.querySelector('[data-cookie]')?.remove();` });
      if (t.nojs && t.scroll) { await cdp.send('Emulation.setScriptExecutionDisabled', { value: false }); await cdp.send('Runtime.evaluate', { expression: `window.scrollTo(0, ${t.scroll})` }); await sleep(300); }
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const file = join(out, `${t.name}.png`);
      writeFileSync(file, Buffer.from(shot.data, 'base64'));
      console.log(`OK  ${t.name} ${t.w}x${t.h} ${t.url}${t.scroll ? ' @' + t.scroll : ''}`);
    } catch (e) {
      console.log(`ERR ${t.name}: ${e.message}`);
    } finally {
      cdp.ws.close();
      await fetch(`http://127.0.0.1:${port}/json/close/${id}`).catch(() => {});
    }
  }
} finally {
  // Windows: убиваем всё дерево процессов браузера (proc.kill() оставляет рендереры жить)
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  else proc.kill();
}
