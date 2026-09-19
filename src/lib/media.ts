import { existsSync } from 'node:fs';
import { join } from 'node:path';
import manifest from '@content/media-manifest.json';
import type { Locale } from '@/lib/i18n';

export type SlotType = 'image' | 'video' | 'sequence';

export interface MediaSlot {
  id: string;
  type: SlotType;
  aspect: string;
  sizes: number[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  usage?: string;
  description: string;
  alt: Record<Locale, string>;
  frames?: number;
  pattern?: string;
}

const slots = manifest.slots as MediaSlot[];
const PUBLIC = join(process.cwd(), 'public');

export function getSlot(id: string): MediaSlot {
  const slot = slots.find((s) => s.id === id);
  if (!slot) throw new Error(`Медиа-слот "${id}" не описан в media-manifest.json`);
  return slot;
}

export function allSlots(): MediaSlot[] {
  return slots;
}

/** "16:9" -> { w: 16, h: 9, ratio: 1.777 } */
export function parseAspect(aspect: string): { w: number; h: number; ratio: number } {
  const [a, b] = aspect.split(':').map(Number);
  const w = a || 16;
  const h = b || 9;
  return { w, h, ratio: w / h };
}

/** Есть ли реальный файл для слота (проверка на этапе сборки). */
export function imageExists(id: string, width: number, ext = 'webp'): boolean {
  return existsSync(join(PUBLIC, 'media', `${id}-${width}.${ext}`));
}

export function videoExists(id: string): boolean {
  return existsSync(join(PUBLIC, 'media', `${id}.mp4`)) || existsSync(join(PUBLIC, 'media', `${id}.webm`));
}

export function sequenceAvailable(id: string, variant: '' | '640' = ''): boolean {
  return existsSync(join(PUBLIC, 'media', 'sequence', variant, `${id}-001.webp`));
}

/** Какие форматы реально лежат в public/media для слота (для <picture>). */
export function availableFormats(id: string, width: number): Array<'avif' | 'webp' | 'jpg'> {
  return (['avif', 'webp', 'jpg'] as const).filter((ext) => imageExists(id, width, ext));
}
