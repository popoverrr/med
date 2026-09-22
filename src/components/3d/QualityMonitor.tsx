/**
 * Монитор качества сцены (вместо drei PerformanceMonitor — тот меряет любые кадры, а у нас
 * frameloop="demand": после гашения капли кадры идут только при скролле и «fps» вырождается).
 *  - меряет fps окнами по 1 с, только пока капля видима и вкладка активна;
 *  - после смены уровня — прогрев 2 с (компиляция шейдеров, выделение буферов);
 *  - < 45 fps три окна подряд → уровень вниз; ниже basic → onFallback (CSS-постер);
 *  - ≥ 57 fps (≥ 100 на 120-Гц экранах) пять окон подряд → уровень вверх, но никогда выше
 *    того, с которого уже пришлось спуститься — без «качелей» и лишних перекомпиляций.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { params } from '@/lib/three/params';
import { TIERS, type Quality } from '@/lib/scene/tiers';

interface Props {
  quality: Quality;
  onChange(next: Quality): void;
  onFallback(): void;
}

const WINDOW_MS = 1000;
const WARMUP_MS = 2000;
const FPS_LOW = 45;
const FPS_THROTTLED = 4;
const DECLINE_WINDOWS = 3;
const INCLINE_WINDOWS = 5;

export function QualityMonitor({ quality, onChange, onFallback }: Props) {
  const frames = useRef(0);
  const windowStart = useRef(0);
  const bad = useRef(0);
  const good = useRef(0);
  const ceiling = useRef(TIERS.length - 1);
  const changedAt = useRef(performance.now());
  const refreshRate = useRef(0);
  const seen = useRef(quality);

  if (seen.current !== quality) {
    seen.current = quality;
    changedAt.current = performance.now();
    frames.current = 0;
    windowStart.current = 0;
    bad.current = 0;
    good.current = 0;
  }

  useFrame(() => {
    const now = performance.now();
    const idle = params.opacity < 0.5 || document.visibilityState !== 'visible' || now - changedAt.current < WARMUP_MS;
    if (idle) {
      frames.current = 0;
      windowStart.current = now;
      return;
    }
    if (!windowStart.current) windowStart.current = now;
    frames.current += 1;
    const span = now - windowStart.current;
    if (span < WINDOW_MS) return;

    const fps = (frames.current / span) * 1000;
    frames.current = 0;
    windowStart.current = now;
    // Единицы кадров в секунду — это не «слабый GPU», а заторможенный rAF (фоновое/перекрытое окно,
    // энергосбережение): такие окна не учитываем
    if (fps < FPS_THROTTLED) { bad.current = 0; good.current = 0; return; }
    refreshRate.current = Math.max(refreshRate.current, fps);
    const fpsHigh = refreshRate.current > 100 ? 100 : 57;
    const i = TIERS.indexOf(quality);

    if (fps < FPS_LOW) {
      good.current = 0;
      if (++bad.current < DECLINE_WINDOWS) return;
      bad.current = 0;
      ceiling.current = Math.min(ceiling.current, i - 1);
      if (i === 0) onFallback();
      else onChange(TIERS[i - 1]!);
    } else if (fps >= fpsHigh) {
      bad.current = 0;
      if (++good.current < INCLINE_WINDOWS) return;
      good.current = 0;
      if (i < ceiling.current) onChange(TIERS[i + 1]!);
    } else {
      bad.current = 0;
      good.current = 0;
    }
  });

  return null;
}
