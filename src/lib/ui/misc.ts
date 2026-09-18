/**
 * FAQ-аккордеон (grid-template-rows 0fr → 1fr), cookie-согласие, консент-загрузка карты.
 */

// ---------- FAQ ----------
export function initFaq(root: ParentNode = document): () => void {
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-faq-item]'));
  const handlers: Array<[HTMLElement, EventListener]> = [];
  items.forEach((item) => {
    const btn = item.querySelector<HTMLButtonElement>('[data-faq-toggle]');
    const panel = item.querySelector<HTMLElement>('[data-faq-panel]');
    if (!btn || !panel) return;
    const onClick = () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      item.classList.toggle('is-open', !open);
      panel.hidden = false; // высота анимируется CSS через grid-template-rows; hidden только для reduced-motion/noscript
    };
    btn.addEventListener('click', onClick);
    handlers.push([btn, onClick]);
  });
  return () => handlers.forEach(([el, fn]) => el.removeEventListener('click', fn));
}

// ---------- Cookie consent ----------
export interface Consent { necessary: true; analytics: boolean; maps: boolean; ts: number; v: number }
const KEY = 'hm-consent';
const VERSION = 1;

export function getConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Consent;
    return c.v === VERSION ? c : null;
  } catch { return null; }
}

export function setConsent(analytics: boolean, maps: boolean) {
  const c: Consent = { necessary: true, analytics, maps, ts: Date.now(), v: VERSION };
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* приватный режим */ }
  document.dispatchEvent(new CustomEvent('hm:consent', { detail: c }));
}

export function initCookieBanner(): () => void {
  const banner = document.querySelector<HTMLElement>('[data-cookie]');
  if (!banner) return () => {};
  const settings = banner.querySelector<HTMLFormElement>('[data-cookie-settings]')!;
  const saveBtn = banner.querySelector<HTMLButtonElement>('[data-cookie-action="save"]')!;
  const settingsBtn = banner.querySelector<HTMLButtonElement>('[data-cookie-action="settings"]')!;

  const hide = () => { banner.classList.remove('is-visible'); setTimeout(() => { banner.hidden = true; }, 600); };
  const show = () => { banner.hidden = false; requestAnimationFrame(() => banner.classList.add('is-visible')); };

  if (!getConsent()) setTimeout(show, 1200);

  const onClick = (e: Event) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-cookie-action]');
    if (!btn) return;
    const action = btn.dataset.cookieAction;
    if (action === 'accept') { setConsent(true, true); hide(); }
    else if (action === 'reject') { setConsent(false, false); hide(); }
    else if (action === 'settings') { settings.hidden = false; saveBtn.hidden = false; settingsBtn.hidden = true; }
    else if (action === 'save') {
      const fd = new FormData(settings);
      setConsent(fd.get('analytics') === 'on', fd.get('maps') === 'on');
      hide();
    }
  };
  banner.addEventListener('click', onClick);
  return () => banner.removeEventListener('click', onClick);
}

// ---------- Карта: грузится только после согласия ----------
export function initMap(root: ParentNode = document): () => void {
  const box = root.querySelector<HTMLElement>('[data-map]');
  if (!box) return () => {};
  const src = box.dataset.mapSrc;
  const title = box.dataset.mapTitle || 'Map';
  const btn = box.querySelector<HTMLButtonElement>('[data-map-load]');
  let loaded = false;

  const load = () => {
    if (loaded || !src) return;
    loaded = true;
    const iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.title = title;
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.setAttribute('allowfullscreen', '');
    iframe.className = 'map__frame';
    box.querySelector('[data-map-placeholder]')?.replaceWith(iframe);
    box.classList.add('is-loaded');
  };
  const onConsent = (e: Event) => { if ((e as CustomEvent<Consent>).detail.maps) load(); };
  const onBtn = () => { const c = getConsent(); if (!c) setConsent(false, true); else if (!c.maps) setConsent(c.analytics, true); load(); };

  if (getConsent()?.maps) load();
  btn?.addEventListener('click', onBtn);
  document.addEventListener('hm:consent', onConsent);
  return () => { btn?.removeEventListener('click', onBtn); document.removeEventListener('hm:consent', onConsent); };
}
