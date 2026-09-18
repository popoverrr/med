/* Ранний скрипт (до рендера): классы окружения на <html>, чтобы CSS знал о JS,
   reduced-motion и типе указателя без вспышки. Внешний файл — ради строгого CSP. */
(function () {
  var h = document.documentElement;
  h.classList.add('js');
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) h.classList.add('rm');
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) h.classList.add('fine');
  } catch (e) {}
  // Запоминаем выбор языка для возможного авто-редиректа в будущем (пока только сохраняем)
  try {
    var loc = h.getAttribute('data-locale');
    if (loc) localStorage.setItem('hm-locale', loc);
  } catch (e) {}
})();
