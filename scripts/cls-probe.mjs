// Диагностика layout shift: какие элементы сдвигаются после первой отрисовки (десктоп 1350×940).
// Использование: node scripts/cls-probe.mjs <url>
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://localhost:4322/';
const browser = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const port = 9334;
const proc = spawn(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--user-data-dir=' + join(process.env.LOCALAPPDATA, 'Temp', 'hm-cls-profile'), `--remote-debugging-port=${port}`, '--remote-allow-origins=*', '--window-size=1350,940', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch { /* */ } await sleep(250); }
const info = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(info.webSocketDebuggerUrl);
await new Promise((res) => (ws.onopen = res));
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1350, height: 940, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__shifts = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (e.hadRecentInput) continue; window.__shifts.push({ t: Math.round(e.startTime), value: +e.value.toFixed(4), sources: (e.sources || []).map((s) => { const n = s.node; let sel = n ? (n.tagName + (n.id ? '#' + n.id : '') + (n.className && typeof n.className === 'string' ? '.' + n.className.split(' ').slice(0,2).join('.') : '')) : '?'; return sel + ' ' + JSON.stringify(s.previousRect).slice(0,60) + ' -> ' + JSON.stringify(s.currentRect).slice(0,60); }) }); } }).observe({ type: 'layout-shift', buffered: true });` });
  await send('Page.navigate', { url });
  await sleep(6000);
  const r = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__shifts)', returnByValue: true });
  const shifts = JSON.parse(r.result.value);
  console.log(`layout shifts: ${shifts.length}, total ${shifts.reduce((s, x) => s + x.value, 0).toFixed(4)}`);
  for (const s of shifts) console.log(s.t + 'ms', s.value, '\n   ' + s.sources.join('\n   '));
} finally {
  ws.close();
  spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
}
