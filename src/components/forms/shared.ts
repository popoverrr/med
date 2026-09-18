/** Общая логика форм: маска телефона, валидация, отправка на PHP. Сервер верит только себе (ТЗ §10). */

export const PHONE_RE = /^\+7 \d{3} \d{3} \d{2} \d{2}$/;

/** "+7 XXX XXX XX XX" из любого ввода. Ведущие 8/7 нормализуются в +7. */
export function formatPhone(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('8')) d = '7' + d.slice(1);
  if (!d.startsWith('7')) d = '7' + d;
  d = d.slice(0, 11);
  const p = d.slice(1);
  let out = '+7';
  if (p.length) out += ' ' + p.slice(0, 3);
  if (p.length > 3) out += ' ' + p.slice(3, 6);
  if (p.length > 6) out += ' ' + p.slice(6, 8);
  if (p.length > 8) out += ' ' + p.slice(8, 10);
  return out;
}

export function isValidPhone(v: string): boolean {
  return PHONE_RE.test(v);
}

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export type SubmitResult =
  | { ok: true }
  | { ok: false; code: 'validation' | 'rate' | 'network' | 'server'; fields?: Record<string, string> };

/** POST JSON на PHP-эндпоинт. Ответ всегда JSON { ok, error?, fields? }. */
export async function submitForm(endpoint: string, payload: Record<string, unknown>): Promise<SubmitResult> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'same-origin',
    });
    if (res.status === 429) return { ok: false, code: 'rate' };
    const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; fields?: Record<string, string> } | null;
    if (!data) return { ok: false, code: 'server' };
    if (data.ok) return { ok: true };
    if (data.error === 'validation') return { ok: false, code: 'validation', fields: data.fields };
    if (data.error === 'rate_limit') return { ok: false, code: 'rate' };
    return { ok: false, code: 'server' };
  } catch {
    return { ok: false, code: 'network' };
  }
}
