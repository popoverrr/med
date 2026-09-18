/** Модалка записи: открывается с любой кнопки [data-open-booking] FLIP-переходом из неё. */
import { stopScroll, startScroll } from '@/lib/scroll/lenis';
import { trapFocus } from './focus';
import { flipIn, flipOut } from './flip';

export function initBookingModal(): () => void {
  const dialog = document.querySelector<HTMLDialogElement>('[data-booking-dialog]');
  if (!dialog) return () => {};
  const panel = dialog.querySelector<HTMLElement>('[data-modal-panel]')!;
  let opener: HTMLElement | null = null;
  let release: (() => void) | null = null;
  let closing = false;

  const close = async () => {
    if (!dialog.open || closing) return;
    closing = true;
    await flipOut(panel, opener);
    dialog.close();
    release?.();
    release = null;
    startScroll();
    closing = false;
  };

  const open = (from: HTMLElement | null) => {
    if (dialog.open) return;
    opener = from;
    dialog.showModal();
    stopScroll();
    flipIn(from, panel);
    release = trapFocus(panel, close);
  };

  const onClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const trigger = target.closest<HTMLElement>('[data-open-booking]');
    if (trigger) { e.preventDefault(); open(trigger); return; }
    if (target.closest('[data-modal-close]') && target.closest('[data-booking-dialog]')) { close(); return; }
    // клик по backdrop
    if (target === dialog) close();
  };
  const onCancel = (e: Event) => { e.preventDefault(); close(); };

  document.addEventListener('click', onClick);
  dialog.addEventListener('cancel', onCancel);
  return () => {
    document.removeEventListener('click', onClick);
    dialog.removeEventListener('cancel', onCancel);
    if (dialog.open) { dialog.close(); release?.(); startScroll(); }
  };
}
