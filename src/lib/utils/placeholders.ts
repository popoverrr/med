/** Токен вида {{CONTACT_PHONE}} — данные, которых ещё нет (см. CONTENT-TODO.md). */
const RE = /^\{\{([A-Z0-9_]+)\}\}$/;

export function isPlaceholder(value: unknown): boolean {
  return typeof value === 'string' && RE.test(value.trim());
}

export function placeholderName(value: string): string {
  const m = RE.exec(value.trim());
  return m?.[1] ?? value;
}

/** Возвращает значение, либо undefined если это плейсхолдер/пусто. */
export function real(value: string | undefined | null): string | undefined {
  if (!value || isPlaceholder(value)) return undefined;
  return value;
}
