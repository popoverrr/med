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

// ---------- Карусели (нативный scroll-snap + стрелки и точки) ----------
/**
 * [data-carousel] > [data-carousel-track] с [data-carousel-slide]; опционально [data-carousel-prev/next]
 * и [data-carousel-dots]. Скролл — нативный (плавный на телефоне без JS); JS только для стрелок и индикатора.
 */
export function initCarousels(root: ParentNode = document): () => void {
  const cleanups: Array<() => void> = [];
  root.querySelectorAll<HTMLElement>('[data-carousel]').forEach((wrap) => {
    const track = wrap.querySelector<HTMLElement>('[data-carousel-track]');
    if (!track) return;
    const slides = Array.from(track.querySelectorAll<HTMLElement>('[data-carousel-slide]'));
    const dots = Array.from(wrap.querySelectorAll<HTMLElement>('[data-carousel-dots] > *'));
    const prev = wrap.querySelector<HTMLButtonElement>('[data-carousel-prev]');
    const next = wrap.querySelector<HTMLButtonElement>('[data-carousel-next]');
    if (!slides.length) return;

    const index = () => {
      const left = track.scrollLeft + parseFloat(getComputedStyle(track).scrollPaddingLeft || '0');
      let best = 0, dist = Infinity;
      slides.forEach((s, i) => { const d = Math.abs(s.offsetLeft - left); if (d < dist) { dist = d; best = i; } });
      return best;
    };
    const update = () => {
      const i = index();
      dots.forEach((d, k) => d.classList.toggle('is-current', k === i));
      const max = track.scrollWidth - track.clientWidth - 2;
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max;
    };
    const go = (dir: 1 | -1) => {
      const i = Math.min(slides.length - 1, Math.max(0, index() + dir));
      const pad = parseFloat(getComputedStyle(track).scrollPaddingLeft || '0');
      track.scrollTo({ left: slides[i]!.offsetLeft - pad, behavior: 'smooth' });
    };
    let raf = 0;
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    const onPrev = () => go(-1);
    const onNext = () => go(1);
    track.addEventListener('scroll', onScroll, { passive: true });
    prev?.addEventListener('click', onPrev);
    next?.addEventListener('click', onNext);
    update();
    cleanups.push(() => { track.removeEventListener('scroll', onScroll); prev?.removeEventListener('click', onPrev); next?.removeEventListener('click', onNext); });
  });
  return () => cleanups.forEach((fn) => fn());
}

// ---------- Раскрывающийся список (противопоказания) ----------
export function initDisclosures(root: ParentNode = document): () => void {
  const cleanups: Array<() => void> = [];
  root.querySelectorAll<HTMLButtonElement>('[data-disclosure-toggle]').forEach((btn) => {
    const id = btn.getAttribute('aria-controls');
    const panel = id ? document.getElementById(id) : null;
    if (!panel) return;
    const labelOpen = btn.dataset.labelOpen ?? btn.textContent ?? '';
    const labelClose = btn.dataset.labelClose ?? labelOpen;
    const text = btn.querySelector<HTMLElement>('[data-disclosure-label]') ?? btn;
    const onClick = () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      panel.classList.toggle('is-open', !open);
      text.textContent = open ? labelOpen : labelClose;
    };
    btn.addEventListener('click', onClick);
    cleanups.push(() => btn.removeEventListener('click', onClick));
  });
  return () => cleanups.forEach((fn) => fn());
}

// ---------- Липкая панель действий на телефоне ----------
/** [data-sticky-cta] показывается после первого экрана и прячется, когда виден блок записи или футер. */
export function initStickyCta(root: ParentNode = document): () => void {
  const bar = root.querySelector<HTMLElement>('[data-sticky-cta]');
  if (!bar) return () => {};
  const hero = document.querySelector<HTMLElement>('#hero');
  const hideNear = Array.from(document.querySelectorAll<HTMLElement>('#booking, #footer'));
  let heroVisible = true;
  let nearBooking = false;
  const apply = () => { bar.classList.toggle('is-visible', !heroVisible && !nearBooking && !document.documentElement.classList.contains('menu-open')); };
  const ioHero = new IntersectionObserver((es) => { heroVisible = es.some((e) => e.isIntersecting); apply(); }, { threshold: 0.15 });
  if (hero) ioHero.observe(hero); else heroVisible = false;
  const ioBook = new IntersectionObserver((es) => { nearBooking = es.some((e) => e.isIntersecting); apply(); }, { threshold: 0.05 });
  hideNear.forEach((el) => ioBook.observe(el));
  const mo = new MutationObserver(apply);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  apply();
  return () => { ioHero.disconnect(); ioBook.disconnect(); mo.disconnect(); bar.classList.remove('is-visible'); };
}
