/**
 * Загрузка 3D на любых устройствах с автоадаптацией качества (решение заказчика, отклонение от ТЗ §4.3):
 *  - условия запуска: WebGL2 (без software-рендера) ∧ prefers-reduced-motion: no-preference ∧ ¬saveData;
 *  - стартовый уровень качества — по эвристике устройства, дальше QualityMonitor поднимает/опускает его;
 *  - если даже низший уровень не держит fps — сцена размонтируется, остаётся CSS-постер.
 * Чанк подгружается динамически после первого кадра (на мобильных — с большей задержкой).
 */
import { sceneStore } from './store';
import { isQuality, type Quality } from './tiers';

export type { Quality };

/** QA/демо: ?force3d — запуск без проверки GPU и без монитора; ?quality=basic|low|medium|high — фиксированный уровень */
function qaOptions(): { force: boolean; quality: Quality | null } {
  const q = new URLSearchParams(window.location.search);
  const quality = q.get('quality');
  return { force: q.has('force3d') || quality !== null, quality: isQuality(quality) ? quality : null };
}

export function canRunWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  const { force } = qaOptions();
  if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData === true) return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: !force });
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function isMobileDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
}

/** Стартовый уровень: телефоны — low, ноутбуки — medium, мощные десктопы — high. Дальше решает fps. */
export function initialQuality(): Quality {
  const qa = qaOptions().quality;
  if (qa) return qa;
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  if (isMobileDevice()) return 'low';
  if (cores >= 8 && memory >= 8 && window.innerWidth >= 1280) return 'high';
  return 'medium';
}

export function loadScene(): () => void {
  const host = document.getElementById('scene-root');
  if (!host) return () => {};
  if (!canRunWebGL()) {
    host.dataset.state = 'fallback';
    return () => {};
  }
  host.dataset.state = 'loading';
  let unmount: (() => void) | null = null;
  let cancelled = false;

  const onPointer = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    sceneStore.getState().setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  };

  const teardown = (state: string) => {
    unmount?.();
    unmount = null;
    document.documentElement.classList.remove('scene-on');
    sceneStore.getState().setActive(false);
    host.dataset.state = state;
  };

  const start = () => {
    import('@/components/3d/mount')
      .then((m) => {
        if (cancelled) return;
        const t0 = performance.now();
        unmount = m.mountScene(host, {
          quality: initialQuality(),
          monitor: !qaOptions().force,
          // Даже низший уровень не тянет — уступаем CSS-постеру
          onFallback: () => teardown('fallback'),
        });
        host.dataset.state = 'active';
        document.documentElement.classList.add('scene-on');
        sceneStore.getState().setActive(true);
        window.addEventListener('pointermove', onPointer, { passive: true });
        performance.measure('hm:scene:mount', { start: t0 });
      })
      .catch(() => { host.dataset.state = 'fallback'; });
  };
  // Не мешаем первому рендеру, LCP и первому взаимодействию; на мобильных ждём дольше
  const timeout = isMobileDevice() ? 3500 : 1500;
  if ('requestIdleCallback' in window) (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback(start, { timeout });
  else setTimeout(start, timeout / 3);

  return () => {
    cancelled = true;
    window.removeEventListener('pointermove', onPointer);
    teardown('');
    host.style.opacity = '';
  };
}
