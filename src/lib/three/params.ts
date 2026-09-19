/**
 * Параметры сцены — единственный мутируемый объект, который Director сглаживает к целевым
 * ключевым кадрам (по секции и локальному прогрессу), а меши читают в своих useFrame.
 */
import type { SceneKey } from '@/lib/scene/store';

export interface SceneParams {
  camZ: number;
  blobX: number;
  blobY: number;
  blobScale: number;
  /** Вытягивание капли в поток/трубку (0 — сфера) */
  stretch: number;
  /** Поворот вытянутой формы (π/2 — горизонтальная трубка) */
  rotZ: number;
  distortion: number;
  clarity: number;
  /** 0 — бургунди, 1 — aqua */
  colorMix: number;
  /** Частицы: капля → облако */
  spread: number;
  /** Частицы: облако → колонна */
  column: number;
  noise: number;
  /** Каустика → туман */
  fog: number;
  /** Прозрачность всего слоя (гашение сцены) */
  opacity: number;
  speed: number;
}

export const params: SceneParams = {
  camZ: 6.2, blobX: 1.35, blobY: 0.05, blobScale: 1.15, stretch: 0, rotZ: 0,
  distortion: 0.16, clarity: 0, colorMix: 0, spread: 0, column: 0, noise: 0.25, fog: 0, opacity: 1, speed: 0.2,
};

export const KEYFRAMES: Record<SceneKey, SceneParams> = {
  hero:      { camZ: 6.2, blobX: 1.35, blobY: 0.05, blobScale: 1.15, stretch: 0.0, rotZ: 0.0,  distortion: 0.12, clarity: 0.0, colorMix: 0.0,  spread: 0.0, column: 0.0, noise: 0.25, fog: 0.0, opacity: 1.0, speed: 0.2 },
  what:      { camZ: 6.9, blobX: 2.6, blobY: 0.2, blobScale: 0.95, stretch: 0.55, rotZ: -0.25, distortion: 0.16, clarity: 0.15, colorMix: 0.05, spread: 0.0, column: 0.0, noise: 0.25, fog: 0.0, opacity: 1.0, speed: 0.3 },
  how:       { camZ: 7.2, blobX: 1.3,  blobY: -1.55, blobScale: 0.28, stretch: 3.4, rotZ: 1.5708, distortion: 0.06, clarity: 0.6, colorMix: 0.3, spread: 0.0, column: 0.0, noise: 0.2, fog: 0.0, opacity: 1.0, speed: 0.35 },
  water:     { camZ: 6.6, blobX: 1.45, blobY: -0.15, blobScale: 0.8, stretch: 0.05, rotZ: 1.5708, distortion: 0.04, clarity: 1.0, colorMix: 1.0,  spread: 1.0, column: 0.0, noise: 0.35, fog: 0.0, opacity: 1.0, speed: 0.15 },
  equipment: { camZ: 7.0, blobX: -1.8, blobY: -0.3, blobScale: 0.4, stretch: 0.5, rotZ: 1.5708, distortion: 0.04, clarity: 1.0, colorMix: 0.7,  spread: 1.0, column: 1.0, noise: 0.15, fog: 0.3, opacity: 0.9, speed: 0.1 },
  fade:      { camZ: 7.5, blobX: -1.5, blobY: -0.9, blobScale: 0.2,  stretch: 0.0, rotZ: 1.5708,  distortion: 0.05, clarity: 1.0, colorMix: 0.4,  spread: 0.6, column: 0.5, noise: 0.1, fog: 1.0, opacity: 0.0, speed: 0.05 },
};

export const KEY_ORDER: SceneKey[] = ['hero', 'what', 'how', 'water', 'equipment', 'fade'];

/** Вертикальный угол камеры (Scene.tsx), половина — для расчёта видимой области в плоскости капли (z = 0). */
export const CAMERA_FOV = 35;

/**
 * Портретные экраны (телефоны, планшеты вертикально): позиция капли задаётся долями видимой области
 * (fx, fy ∈ −1…1 — от левого/нижнего края к правому/верхнему), чтобы не зависеть от пропорций экрана;
 * капля меньше и уходит в свободные от текста зоны (углы и кромки экрана).
 */
export interface PortraitPose { fx: number; fy: number; blobScale: number }

export const PORTRAIT_POSES: Record<SceneKey, PortraitPose> = {
  hero:      { fx: 0.8,   fy: 0.76,  blobScale: 0.45 },
  what:      { fx: 0.82,  fy: -0.82, blobScale: 0.45 },
  how:       { fx: 0.0,   fy: -0.9,  blobScale: 0.2 },
  water:     { fx: 0.92,  fy: 0.35,  blobScale: 0.45 },
  equipment: { fx: 0.92,  fy: 0.78,  blobScale: 0.28 },
  fade:      { fx: 0.95,  fy: 0.8,   blobScale: 0.15 },
};

export function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** Экспоненциальное сглаживание, независимое от FPS. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}
