/* Ранний скрипт (до рендера): классы окружения на <html>, чтобы CSS знал о JS,
   reduced-motion и типе указателя без вспышки. Внешний файл — ради строгого CSP. */
(function () {
  var h = document.documentElement;
  h.classList.add('js');
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) h.classList.add('rm');
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (fine) h.classList.add('fine');
    // Лёгкий режим: телефоны и планшеты (сенсор без мыши) или узкий экран. Фон секций не зависит
    // от кадров WebGL, 3D только на первых экранах, шапка не прячется, фон без scrub-интерполяции.
    if (!fine || window.innerWidth < 1024) h.classList.add('lite');
  } catch (e) {}
  // Запоминаем выбор языка для возможного авто-редиректа в будущем (пока только сохраняем)
  try {
    var loc = h.getAttribute('data-locale');
    if (loc) localStorage.setItem('hm-locale', loc);
  } catch (e) {}
})();
