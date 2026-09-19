/**
 * Image-sequence на canvas (приём AirPods, ТЗ §4.2.3): 60–90 кадров WebP, кадр = функция прогресса
 * закреплённой секции. Кадры предзагружаются с приоритетом (первый/последний, затем по порядку).
 * Пока реальных кадров нет — рисуется процедурный плейсхолдер с номером кадра, чтобы механика была видна.
 */
export interface Sequence {
  preload(): void;
  render(progress: number): void;
  destroy(): void;
}

export function initImageSequence(wrap: HTMLElement | null): Sequence {
  const noop: Sequence = { preload() {}, render() {}, destroy() {} };
  if (!wrap) return noop;
  const host = wrap;
  const canvas = host.querySelector('canvas');
  const label = host.querySelector<HTMLElement>('[data-sequence-label]');
  if (!canvas) return noop;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return noop;

  const frames = Math.max(1, Number(host.dataset.sequenceFrames || 90));
  // Мобильные: кадры 640×360 (в 4 раза меньше трафика), если они есть
  const mobile = window.innerWidth < 768 && !!host.dataset.sequenceBaseMobile;
  const base = (mobile ? host.dataset.sequenceBaseMobile : host.dataset.sequenceBase) || '';
  const available = host.dataset.sequenceAvailable === '1';
  if (mobile) { canvas.width = 640; canvas.height = 360; }
  const W = canvas.width;
  const H = canvas.height;
  const images: Array<HTMLImageElement | null> = new Array(frames).fill(null);
  let lastFrame = -1;
  let destroyed = false;
  let preloaded = false;

  const src = (i: number) => `${base}${String(i + 1).padStart(3, '0')}.webp`;

  function load(i: number, priority: 'high' | 'low' = 'low'): Promise<void> {
    if (images[i]) return Promise.resolve();
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = priority;
      img.onload = () => { images[i] = img; if (i === lastFrame) draw(i); resolve(); };
      img.onerror = () => resolve();
      img.src = src(i);
    });
  }

  async function preload() {
    if (preloaded || destroyed) return;
    preloaded = true;
    if (!available) { host.classList.add('is-ready'); draw(lastFrame < 0 ? 0 : lastFrame); return; }
    await Promise.all([load(0, 'high'), load(frames - 1, 'high'), load(Math.floor(frames / 2), 'high')]);
    host.classList.add('is-ready');
    draw(lastFrame < 0 ? 0 : lastFrame);
    // Остальные — пачками, чтобы не забивать сеть
    const queue = Array.from({ length: frames }, (_, i) => i).filter((i) => !images[i]);
    const BATCH = 6;
    for (let k = 0; k < queue.length && !destroyed; k += BATCH) {
      await Promise.all(queue.slice(k, k + BATCH).map((i) => load(i)));
    }
  }

  function drawPlaceholder(i: number) {
    const t = i / Math.max(1, frames - 1);
    const g = ctx!.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#4e0f21');
    g.addColorStop(0.55, '#350a16');
    g.addColorStop(1, '#12080b');
    ctx!.fillStyle = g;
    ctx!.fillRect(0, 0, W, H);
    // «Свет», движущийся по прогрессу — визуализация того, что кадр = функция скролла
    const cx = W * (0.18 + t * 0.64);
    const cy = H * (0.62 - Math.sin(t * Math.PI) * 0.25);
    const r = ctx!.createRadialGradient(cx, cy, 0, cx, cy, W * 0.42);
    r.addColorStop(0, 'rgba(196,86,110,0.55)');
    r.addColorStop(0.5, 'rgba(143,194,206,0.12)');
    r.addColorStop(1, 'rgba(0,0,0,0)');
    ctx!.fillStyle = r;
    ctx!.fillRect(0, 0, W, H);
    // Горизонт-линия и подпись слота
    ctx!.strokeStyle = 'rgba(255,252,250,0.18)';
    ctx!.lineWidth = 1;
    ctx!.beginPath();
    ctx!.moveTo(0, H * 0.72);
    ctx!.lineTo(W, H * 0.72);
    ctx!.stroke();
    ctx!.fillStyle = 'rgba(255,252,250,0.82)';
    ctx!.textAlign = 'center';
    ctx!.font = `500 ${Math.round(H * 0.026)}px ui-monospace, Consolas, monospace`;
    ctx!.fillText(`procedure-seq-${String(i + 1).padStart(3, '0')}`, W / 2, H * 0.47);
    ctx!.fillStyle = 'rgba(255,252,250,0.55)';
    ctx!.font = `400 ${Math.round(H * 0.02)}px system-ui, sans-serif`;
    ctx!.fillText(`IMAGE SEQUENCE · 16:9 · ${frames} × 1280 px · кадр = прогресс скролла`, W / 2, H * 0.52);
  }

  function drawImage(img: HTMLImageElement) {
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    ctx!.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  function draw(i: number) {
    if (destroyed) return;
    const img = images[i];
    if (img) drawImage(img);
    else if (!available) drawPlaceholder(i);
    else {
      // ближайший загруженный кадр, чтобы не мигать
      let j = i;
      while (j >= 0 && !images[j]) j--;
      if (j >= 0) drawImage(images[j]!);
      else return;
    }
    if (label) label.textContent = String(i + 1).padStart(3, '0');
  }

  function render(progress: number) {
    const i = Math.min(frames - 1, Math.max(0, Math.round(progress * (frames - 1))));
    if (i === lastFrame) return;
    lastFrame = i;
    if (preloaded) draw(i);
    if (available && !images[i]) load(i, 'high');
  }

  return {
    preload,
    render,
    destroy() { destroyed = true; images.fill(null); host.classList.remove('is-ready'); },
  };
}
