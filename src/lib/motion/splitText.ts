/**
 * Собственная кинетическая типографика (без GSAP SplitText, ТЗ §2/§4.2.2).
 * Разбивает текст элемента на слова / символы, сохраняя доступность:
 *  - исходный текст остаётся в aria-label элемента;
 *  - все обёртки помечены aria-hidden.
 * Разметка: <span class="w"><span class="c">слово</span></span> — .w = маска (overflow hidden), .c = анимируемая часть.
 */
export type SplitMode = 'words' | 'chars' | 'lines';

export interface SplitResult {
  el: HTMLElement;
  pieces: HTMLElement[];
  revert(): void;
}

export function splitText(el: HTMLElement, mode: SplitMode = 'words'): SplitResult {
  if (el.dataset.splitDone) {
    return { el, pieces: Array.from(el.querySelectorAll<HTMLElement>('.c')), revert: () => revert(el) };
  }
  const original = el.innerHTML;
  const text = el.textContent ?? '';
  el.dataset.splitOriginal = original;
  el.setAttribute('aria-label', text.replace(/\s+/g, ' ').trim());

  const frag = document.createDocumentFragment();
  const pieces: HTMLElement[] = [];

  // Строки, обозначенные <br>, сохраняем как отдельные блоки
  const lines = original.split(/<br\b[^>]*>/i).map((html) => stripTags(html));

  lines.forEach((line, li) => {
    const words = line.split(/\s+/).filter(Boolean);
    words.forEach((word, wi) => {
      const mask = document.createElement('span');
      mask.className = 'w';
      mask.setAttribute('aria-hidden', 'true');
      if (mode === 'chars') {
        for (const ch of word) {
          const c = document.createElement('span');
          c.className = 'c';
          c.textContent = ch;
          mask.appendChild(c);
          pieces.push(c);
        }
      } else {
        const c = document.createElement('span');
        c.className = 'c';
        c.textContent = word;
        mask.appendChild(c);
        pieces.push(c);
      }
      frag.appendChild(mask);
      if (wi < words.length - 1) frag.appendChild(document.createTextNode(' '));
    });
    if (li < lines.length - 1) frag.appendChild(document.createElement('br'));
  });

  el.replaceChildren(frag);
  el.dataset.splitDone = mode;
  return { el, pieces, revert: () => revert(el) };
}

function stripTags(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent ?? '';
}

export function revert(el: HTMLElement) {
  if (!el.dataset.splitDone) return;
  el.innerHTML = el.dataset.splitOriginal ?? el.textContent ?? '';
  el.removeAttribute('aria-label');
  delete el.dataset.splitDone;
  delete el.dataset.splitOriginal;
}
