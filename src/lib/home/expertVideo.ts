/**
 * Видеообращение специалиста в блоке Expert (главная).
 *
 * Состояния обёртки [data-expert-video] (data-state):
 *  idle    — постер, видео ещё не запускалось;
 *  playing — идёт воспроизведение (видео проявилось поверх постера, CSS-переход 1.2 с);
 *  paused  — пауза (пользователь нажал «Пауза» или блок ушёл из кадра);
 *  blocked — автозапуск невозможен (prefers-reduced-motion или браузер запретил) → большая кнопка «Смотреть видео».
 *
 * Загрузка ленивая: файл подтягивается, когда блок в ~600px от экрана (preload="none" в разметке),
 * поэтому 2 МБ видео не мешают первому экрану. Запуск — без звука, когда видно ≥ 35% блока;
 * пауза — когда видно < 10% или вкладка скрыта. «Включить звук» в первый раз перезапускает видео с начала.
 */
import { prefersReducedMotion } from '@/lib/gsap';

type State = 'idle' | 'playing' | 'paused' | 'blocked';

export function initExpertVideo(): () => void {
  const wrap = document.querySelector<HTMLElement>('[data-expert-video]');
  const video = wrap?.querySelector<HTMLVideoElement>('video');
  if (!wrap || !video) return () => {};

  const soundBtn = wrap.querySelector<HTMLButtonElement>('[data-xv-sound]');
  const soundLabel = wrap.querySelector<HTMLElement>('[data-xv-sound-label]');
  const toggleBtn = wrap.querySelector<HTMLButtonElement>('[data-xv-toggle]');
  const startBtn = wrap.querySelector<HTMLButtonElement>('[data-xv-start]');
  const reduced = prefersReducedMotion();

  let loaded = false;
  let userPaused = false;
  let soundUnlocked = false;
  let visible = false;

  const setState = (s: State) => { wrap.dataset.state = s; };

  const syncToggle = () => {
    if (!toggleBtn) return;
    const paused = video.paused;
    toggleBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
    toggleBtn.setAttribute('aria-label', (paused ? toggleBtn.dataset.play : toggleBtn.dataset.pause) ?? '');
  };

  const syncSound = () => {
    if (!soundBtn) return;
    const on = !video.muted;
    soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (soundLabel) soundLabel.textContent = (on ? soundBtn.dataset.off : soundBtn.dataset.on) ?? '';
  };

  const load = () => {
    if (loaded) return;
    loaded = true;
    const webm = video.dataset.srcWebm;
    const mp4 = video.dataset.srcMp4;
    // H.264 первым: он аппаратно декодируется везде и без сюрпризов. VP9 на части GPU/драйверов
    // (в т.ч. в браузерах на Chromium) портит картинку полосами — webm остаётся запасным вариантом
    // для браузеров без поддержки H.264.
    video.src = mp4 && video.canPlayType('video/mp4; codecs="avc1.64001f, mp4a.40.2"') ? mp4 : (webm ?? mp4 ?? '');
    video.preload = 'auto';
    video.load();
  };

  const play = async () => {
    load();
    try {
      await video.play();
      setState('playing');
    } catch {
      // Автозапуск запрещён (энергосбережение iOS и т. п.) — предлагаем запустить вручную
      setState('blocked');
    }
    syncToggle();
  };

  const pause = (byUser: boolean) => {
    if (byUser) userPaused = true;
    video.pause();
    if (wrap.dataset.state === 'playing') setState('paused');
    syncToggle();
  };

  // --- Кнопки ---
  const onToggle = () => {
    if (video.paused) { userPaused = false; void play(); }
    else pause(true);
  };
  const onStart = () => { userPaused = false; void play(); };
  const onSound = () => {
    const turnOn = video.muted;
    video.muted = !turnOn;
    if (turnOn && !soundUnlocked) {
      soundUnlocked = true;
      video.currentTime = 0; // со звуком — с начала, чтобы не начинать с середины фразы
    }
    if (turnOn && video.paused) { userPaused = false; void play(); }
    syncSound();
  };
  toggleBtn?.addEventListener('click', onToggle);
  startBtn?.addEventListener('click', onStart);
  soundBtn?.addEventListener('click', onSound);

  // --- Ленивая загрузка на подходе к блоку ---
  // Блок «Специалист» — второй экран, поэтому наблюдатель с запасом 600px сработал бы сразу при загрузке
  // страницы: 2 МБ видео конкурировали бы с первым экраном. Включаем его после первого действия
  // пользователя (скролл/указатель/клавиатура) — то есть когда к блоку действительно идут.
  // Если страница открыта уже прокрученной (якорь, восстановленная позиция) — сразу.
  const nearIO = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { load(); nearIO.disconnect(); }
  }, { rootMargin: '600px 0px' });

  const armLazyLoad = () => {
    window.removeEventListener('scroll', armLazyLoad);
    window.removeEventListener('pointerdown', armLazyLoad);
    window.removeEventListener('keydown', armLazyLoad);
    nearIO.observe(wrap);
  };
  if (window.scrollY > 0) armLazyLoad();
  else {
    window.addEventListener('scroll', armLazyLoad, { passive: true, once: true });
    window.addEventListener('pointerdown', armLazyLoad, { passive: true, once: true });
    window.addEventListener('keydown', armLazyLoad, { once: true });
  }

  // --- Запуск/пауза по видимости ---
  const viewIO = new IntersectionObserver((entries) => {
    const e = entries[entries.length - 1]!;
    const ratio = e.intersectionRatio;
    if (ratio >= 0.35 && !visible) {
      visible = true;
      if (reduced) { if (wrap.dataset.state === 'idle') setState('blocked'); return; }
      if (!userPaused) void play();
    } else if (ratio < 0.1 && visible) {
      visible = false;
      if (!video.paused) pause(false);
    }
  }, { threshold: [0, 0.1, 0.35, 0.6] });
  viewIO.observe(wrap);

  const onVisibility = () => {
    if (document.hidden && !video.paused) pause(false);
    else if (!document.hidden && visible && !userPaused && !reduced && wrap.dataset.state !== 'blocked') void play();
  };
  document.addEventListener('visibilitychange', onVisibility);

  syncSound();
  syncToggle();

  return () => {
    window.removeEventListener('scroll', armLazyLoad);
    window.removeEventListener('pointerdown', armLazyLoad);
    window.removeEventListener('keydown', armLazyLoad);
    nearIO.disconnect();
    viewIO.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    toggleBtn?.removeEventListener('click', onToggle);
    startBtn?.removeEventListener('click', onStart);
    soundBtn?.removeEventListener('click', onSound);
    video.pause();
  };
}
