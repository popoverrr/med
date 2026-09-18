/** Точка входа 3D-чанка: монтирует React-корень со сценой в #scene-root. Импортируется динамически. */
import { createRoot } from 'react-dom/client';
import { Scene } from './Scene';

export function mountScene(host: HTMLElement): () => void {
  const root = createRoot(host);
  root.render(<Scene host={host} />);
  return () => root.unmount();
}
