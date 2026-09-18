/**
 * Lightbox документов. Триггер: [data-lightbox] с атрибутами
 * data-lightbox-src, data-lightbox-pdf, data-lightbox-caption, data-lightbox-group, data-lightbox-alt.
 * FLIP из превью, зум 100–400%, стрелки по группе, Esc, focus trap, возврат фокуса.
 */
import { stopScroll, startScroll } from '@/lib/scroll/lenis';
import { trapFocus } from './focus';
import { flipIn, flipOut } from './flip';

export function initLightbox(): () => void {
  const dialog = document.querySelector<HTMLDialogElement>('[data-lightbox-dialog]');
  if (!dialog) return () => {};
  const img = dialog.querySelector<HTMLImageElement>('[data-lightbox-img]')!;
  const stage = dialog.querySelector<HTMLElement>('[data-lightbox-stage]')!;
  const caption = dialog.querySelector<HTMLElement>('[data-lightbox-caption]')!;
  const pdf = dialog.querySelector<HTMLAnchorElement>('[data-lightbox-pdf]')!;
  const zoomLabel = dialog.querySelector<HTMLElement>('[data-lightbox-zoom-label]')!;
  const prev = dialog.querySelector<HTMLButtonElement>('[data-lightbox-nav="-1"]')!;
  const next = dialog.querySelector<HTMLButtonElement>('[data-lightbox-nav="1"]')!;

  let group: HTMLElement[] = [];
  let index = 0;
  let zoom = 1;
  let opener: HTMLElement | null = null;
  let release: (() => void) | null = null;

  const applyZoom = () => {
    // Зум — через ширину (прокрутка в stage), а не transform: transform принадлежит FLIP-анимации
    img.style.maxWidth = zoom > 1 ? 'none' : '100%';
    img.style.maxHeight = zoom > 1 ? 'none' : '100%';
    img.style.width = zoom > 1 ? `${100 * zoom}%` : '';
    stage.classList.toggle('is-zoomed', zoom > 1);
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  };
  const setZoom = (z: number) => { zoom = Math.min(4, Math.max(1, Math.round(z * 100) / 100)); applyZoom(); };

  const show = (i: number) => {
    const el = group[i];
    if (!el) return;
    index = i;
    img.src = el.dataset.lightboxSrc || '';
    img.alt = el.dataset.lightboxAlt || '';
    caption.textContent = el.dataset.lightboxCaption || '';
    const pdfHref = el.dataset.lightboxPdf;
    pdf.hidden = !pdfHref;
    if (pdfHref) pdf.href = pdfHref;
    const multi = group.length > 1;
    prev.hidden = !multi;
    next.hidden = !multi;
    setZoom(1);
  };

  const open = (trigger: HTMLElement) => {
    const g = trigger.dataset.lightboxGroup;
    group = g ? Array.from(document.querySelectorAll<HTMLElement>(`[data-lightbox][data-lightbox-group="${g}"]`)) : [trigger];
    opener = trigger;
    show(Math.max(0, group.indexOf(trigger)));
    dialog.showModal();
    stopScroll();
    img.style.transition = 'none'; // FLIP ведёт GSAP; CSS-transition зума не должен вмешиваться
    flipIn(trigger.querySelector('img') ?? trigger, img, 0.6).then(() => { img.style.transition = ''; });
    release = trapFocus(dialog, close);
  };

  const close = async () => {
    if (!dialog.open) return;
    img.style.transition = 'none';
    await flipOut(img, opener?.querySelector('img') ?? opener, 0.4);
    img.style.transition = '';
    dialog.close();
    release?.();
    release = null;
    startScroll();
  };

  const onClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    const trigger = t.closest<HTMLElement>('[data-lightbox]');
    if (trigger) { e.preventDefault(); open(trigger); return; }
    if (!dialog.open) return;
    if (t.closest('[data-lightbox-close]')) return void close();
    const nav = t.closest<HTMLElement>('[data-lightbox-nav]');
    if (nav) return show((index + Number(nav.dataset.lightboxNav) + group.length) % group.length);
    const z = t.closest<HTMLElement>('[data-lightbox-zoom]');
    if (z) return setZoom(zoom + (z.dataset.lightboxZoom === 'in' ? 0.5 : -0.5));
  };
  const onDbl = (e: MouseEvent) => { if (e.target === img) setZoom(zoom > 1 ? 1 : 2); };
  const onWheel = (e: WheelEvent) => {
    if (!dialog.open || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setZoom(zoom - Math.sign(e.deltaY) * 0.25);
  };
  const onKey = (e: KeyboardEvent) => {
    if (!dialog.open) return;
    if (e.key === 'ArrowRight' && group.length > 1) show((index + 1) % group.length);
    if (e.key === 'ArrowLeft' && group.length > 1) show((index - 1 + group.length) % group.length);
    if (e.key === '+' || e.key === '=') setZoom(zoom + 0.5);
    if (e.key === '-') setZoom(zoom - 0.5);
  };
  const onCancel = (e: Event) => { e.preventDefault(); close(); };

  document.addEventListener('click', onClick);
  img.addEventListener('dblclick', onDbl);
  stage.addEventListener('wheel', onWheel, { passive: false });
  document.addEventListener('keydown', onKey);
  dialog.addEventListener('cancel', onCancel);
  return () => {
    document.removeEventListener('click', onClick);
    img.removeEventListener('dblclick', onDbl);
    stage.removeEventListener('wheel', onWheel);
    document.removeEventListener('keydown', onKey);
    dialog.removeEventListener('cancel', onCancel);
    if (dialog.open) { dialog.close(); release?.(); startScroll(); }
  };
}
