/** Точка входа 3D-чанка: монтирует React-корень со сценой в #scene-root. Импортируется динамически. */
import { createRoot } from 'react-dom/client';
import { Scene } from './Scene';
import type { Quality } from '@/lib/scene/tiers';

export interface MountOptions {
  /** Стартовый уровень качества (дальше решает QualityMonitor) */
  quality: Quality;
  /** false — уровень зафиксирован (QA/демо) */
  monitor: boolean;
  /** Вызывается, когда даже низший уровень не держит fps — загрузчик размонтирует сцену */
  onFallback: () => void;
}

export function mountScene(host: HTMLElement, options: MountOptions): () => void {
  const root = createRoot(host);
  root.render(<Scene host={host} initialQuality={options.quality} monitor={options.monitor} onFallback={options.onFallback} />);
  return () => root.unmount();
}
