/**
 * Единый стор сцены (Zustand vanilla, без React-обёртки — используется и из обычных скриптов,
 * и из 3D-острова). Хранит нормализованный прогресс скролла, диапазоны секций и текущий фон.
 */
import { createStore } from 'zustand/vanilla';
import type { Quality } from './tiers';

export type SceneKey = 'hero' | 'expert' | 'what' | 'how' | 'water' | 'equipment' | 'fade';

export interface SceneRange {
  key: SceneKey;
  start: number; // 0..1 в пределах scene-range
  end: number;
}

export interface SceneBand { top: number; color: string }

export interface SceneState {
  /** 0..1 — прогресс по всему #scene-range */
  progress: number;
  /** Цветовые полосы секций (верх в координатах документа) — фон WebGL-сцены */
  bands: SceneBand[];
  /** Нормализованные диапазоны секций (пересчитываются на ScrollTrigger refresh) */
  ranges: SceneRange[];
  /** Текущий цвет фона документа (hex) */
  bg: string;
  /** Указатель в нормализованных координатах (-1..1) для лёгкого parallax сцены */
  pointer: { x: number; y: number };
  /** Сцена смонтирована и рендерится */
  active: boolean;
  /** Уровень качества, выставляется QualityMonitor */
  quality: Quality;
  setProgress(p: number): void;
  setRanges(r: SceneRange[]): void;
  setBands(b: SceneBand[]): void;
  setBg(hex: string): void;
  setPointer(x: number, y: number): void;
  setActive(a: boolean): void;
  setQuality(q: SceneState['quality']): void;
}

export const sceneStore = createStore<SceneState>((set) => ({
  progress: 0,
  ranges: [],
  bands: [],
  bg: '#07313b',
  pointer: { x: 0, y: 0 },
  active: false,
  quality: 'high',
  setProgress: (progress) => set({ progress }),
  setRanges: (ranges) => set({ ranges }),
  setBands: (bands) => set({ bands }),
  setBg: (bg) => set({ bg }),
  setPointer: (x, y) => set({ pointer: { x, y } }),
  setActive: (active) => set({ active }),
  setQuality: (quality) => set({ quality }),
}));

/** Возвращает { key, t } — в какой секции находимся и локальный прогресс 0..1 внутри неё. */
export function locate(progress: number, ranges: SceneRange[]): { key: SceneKey; t: number; index: number } {
  if (!ranges.length) return { key: 'hero', t: 0, index: 0 };
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i]!;
    if (progress <= r.end || i === ranges.length - 1) {
      const span = Math.max(r.end - r.start, 1e-4);
      const t = Math.min(1, Math.max(0, (progress - r.start) / span));
      return { key: r.key, t, index: i };
    }
  }
  return { key: 'fade', t: 1, index: ranges.length - 1 };
}
