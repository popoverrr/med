/**
 * Director: читает стор (прогресс скролла, диапазоны секций, фон, указатель), вычисляет целевые
 * параметры по ключевым кадрам и сглаживает `params`. Управляет камерой, фоном и прозрачностью слоя.
 * Рендер по требованию: invalidate() вызывается только пока сцена видима и вкладка активна.
 */
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color } from 'three';
import { sceneStore, locate } from '@/lib/scene/store';
import { params, KEYFRAMES, KEY_ORDER, smoothstep, damp, type SceneParams } from '@/lib/three/params';

const HOLD = 0.62; // доля секции, в течение которой кадр «держится»; переход — в последней трети (после снятия pin)
const KEYS = Object.keys(KEYFRAMES.hero) as Array<keyof SceneParams>;

export function Director({ host }: { host: HTMLElement }) {
  const { invalidate, scene, gl, camera } = useThree();
  const bgColor = useRef(new Color(sceneStore.getState().bg));
  const target = useRef(new Color(sceneStore.getState().bg));
  const raf = useRef(0);
  const target2 = useRef<SceneParams>({ ...params });

  // Цикл invalidate: непрерывно — пока капля видима; после гашения — только при изменении скролла
  // (фон-полосы должны двигаться вместе со страницей)
  useEffect(() => {
    let running = true;
    let lastScroll = -1;
    const tick = () => {
      if (!running) return;
      const scroll = window.scrollY;
      if (document.visibilityState === 'visible' && (params.opacity > 0.01 || scroll !== lastScroll)) invalidate();
      lastScroll = scroll;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    const unsub = sceneStore.subscribe((s) => { target.current.set(s.bg); });
    scene.background = bgColor.current;
    gl.setClearColor(bgColor.current, 1);
    return () => { running = false; cancelAnimationFrame(raf.current); unsub(); };
  }, [invalidate, scene, gl]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const { progress, ranges, pointer } = sceneStore.getState();
    const { key, t, index } = locate(progress, ranges);
    const nextKey = KEY_ORDER[Math.min(KEY_ORDER.indexOf(key) + 1, KEY_ORDER.length - 1)] ?? key;
    const a = KEYFRAMES[key];
    const b = KEYFRAMES[nextKey];
    const k = index >= ranges.length - 1 ? 0 : smoothstep((t - HOLD) / (1 - HOLD));

    const tp = target2.current;
    for (const name of KEYS) tp[name] = a[name] + (b[name] - a[name]) * k;

    // Сглаживание: геометрия медленнее, прозрачность быстрее
    for (const name of KEYS) {
      const lambda = name === 'opacity' ? 8 : name === 'camZ' ? 3 : 4.5;
      params[name] = damp(params[name], tp[name], lambda, dt);
    }

    // Камера: отъезд + деликатный parallax по указателю
    camera.position.z = params.camZ;
    camera.position.x = damp(camera.position.x, pointer.x * 0.25, 2.5, dt);
    camera.position.y = damp(camera.position.y, pointer.y * 0.15, 2.5, dt);
    camera.lookAt(0, 0, 0);

    // Фон — тот же цвет, что интерполирует CSS (--bg-current)
    bgColor.current.lerp(target.current, 1 - Math.exp(-6 * dt));
    gl.setClearColor(bgColor.current, 1);

    void state;
    void host;
  }, -1);

  return null;
}
