/**
 * Загрузка 3D только при выполнении условий ТЗ §4.3:
 * WebGL2 ∧ prefers-reduced-motion: no-preference ∧ hardwareConcurrency ≥ 4 ∧ ширина ≥ 1024 ∧ ¬saveData.
 * Иначе — статичный постер (CSS). Чанк подгружается динамически после первого кадра.
 */
import { sceneStore } from './store';

export function canRunWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  // ?force3d — принудительный запуск для QA/демо (обходит только проверку производительности GPU)
  const force = new URLSearchParams(window.location.search).has('force3d');
  if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return false;
  if (window.innerWidth < 1024) return false;
  if ((navigator.hardwareConcurrency ?? 0) < 4) return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData === true) return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: !force });
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_lose_context');
    ext?.loseContext();
    return true;
  } catch {
    return false;
  }
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

  const start = () => {
    import('@/components/3d/mount')
      .then((m) => {
        if (cancelled) return;
        unmount = m.mountScene(host);
        host.dataset.state = 'active';
        document.documentElement.classList.add('scene-on');
        sceneStore.getState().setActive(true);
        window.addEventListener('pointermove', onPointer, { passive: true });
      })
      .catch(() => { host.dataset.state = 'fallback'; });
  };
  // Не мешаем первому рендеру и LCP
  if ('requestIdleCallback' in window) (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback(start, { timeout: 1500 });
  else setTimeout(start, 300);

  return () => {
    cancelled = true;
    window.removeEventListener('pointermove', onPointer);
    unmount?.();
    document.documentElement.classList.remove('scene-on');
    sceneStore.getState().setActive(false);
    host.dataset.state = '';
    host.style.opacity = '';
  };
}
