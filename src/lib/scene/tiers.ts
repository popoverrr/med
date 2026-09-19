/**
 * Уровни качества WebGL-сцены. Стартовый — по эвристике устройства, дальше решает QualityMonitor
 * (fps). Порядок в TIERS — от самого дешёвого к самому дорогому; ниже basic — только CSS-постер.
 *  - basic  — один проход: MeshPhysicalMaterial без преломления, минимум частиц (последний рубеж);
 *  - low    — преломление (1 сэмпл, буфер 192px), без пост-обработки и каустики — старт для телефонов;
 *  - medium — пост-обработка (bloom, виньетка), каустика, 4 сэмпла — старт для ноутбуков;
 *  - high   — задняя сторона капли, 8 сэмплов, AO/аберрация (только ≥8 ядер) — мощные десктопы.
 */
export type Quality = 'high' | 'medium' | 'low' | 'basic';

export const TIERS: Quality[] = ['basic', 'low', 'medium', 'high'];

export interface TierSpec {
  dpr: number;
  effects: boolean;
  caustics: boolean;
  particles: number;
  detail: number;
  samples: number;
  resolution: number;
  backside: boolean;
  transmission: boolean;
}

export const TIER: Record<Quality, TierSpec> = {
  basic:  { dpr: 1,    effects: false, caustics: false, particles: 400,  detail: 32, samples: 1, resolution: 128,  backside: false, transmission: false },
  low:    { dpr: 1.25, effects: false, caustics: false, particles: 600,  detail: 40, samples: 1, resolution: 192,  backside: false, transmission: true },
  medium: { dpr: 1.5,  effects: true,  caustics: true,  particles: 1500, detail: 64, samples: 4, resolution: 512,  backside: false, transmission: true },
  high:   { dpr: 1.75, effects: true,  caustics: true,  particles: 3000, detail: 96, samples: 8, resolution: 1024, backside: true,  transmission: true },
};

export function isQuality(v: string | null | undefined): v is Quality {
  return v === 'high' || v === 'medium' || v === 'low' || v === 'basic';
}
