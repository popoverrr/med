/** Focus trap для модалок/меню: Tab по кругу, Esc → onClose. Возвращает функцию снятия. */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function trapFocus(container: HTMLElement, onClose?: () => void): () => void {
  const previouslyFocused = document.activeElement as HTMLElement | null;
  const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose?.(); return; }
    if (e.key !== 'Tab') return;
    const list = focusables();
    if (!list.length) return;
    const first = list[0]!;
    const last = list[list.length - 1]!;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => {
    const list = focusables();
    (list.find((el) => el.hasAttribute('data-autofocus')) ?? list[0])?.focus();
  });
  return () => {
    document.removeEventListener('keydown', onKey);
    previouslyFocused?.focus?.();
  };
}
