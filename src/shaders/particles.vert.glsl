// Частицы воды (ТЗ §6): до 3000 точек, движение по curl-noise, три целевые формы.
// aOrigin — стартовая позиция внутри капли (почти в центре)
// aCloud  — рассеянное облако (секция «Вода»)
// aColumn — абстрактная колонна фильтра (секция «Оборудование»)
// aSeed   — индивидуальный сид (фаза, размер)
//
// uSpread  0..1 — капля → облако
// uColumn  0..1 — облако → колонна
// uNoise        — амплитуда curl-смещения
// uTime, uPixelRatio, uSize

uniform float uTime;
uniform float uSpread;
uniform float uColumn;
uniform float uNoise;
uniform float uPixelRatio;
uniform float uSize;
uniform vec3 uCenter;

attribute vec3 aOrigin;
attribute vec3 aCloud;
attribute vec3 aColumn;
attribute float aSeed;

varying float vAlpha;
varying float vSeed;

float easeInOut(float t) { return t * t * (3.0 - 2.0 * t); }

void main() {
  float spread = easeInOut(clamp(uSpread, 0.0, 1.0));
  float column = easeInOut(clamp(uColumn, 0.0, 1.0));

  // Базовая позиция: капля -> облако -> колонна
  vec3 base = mix(aOrigin, aCloud, spread);
  base = mix(base, aColumn, column);

  // Curl-noise: «течение». В колонне поток идёт вверх вдоль оси
  float t = uTime * 0.12 + aSeed * 6.2831;
  vec3 flow = curlNoise(base * 0.9 + vec3(0.0, t * 0.6, 0.0));
  vec3 rise = vec3(0.0, fract(uTime * 0.05 + aSeed) * 2.0 - 1.0, 0.0);
  vec3 displaced = base + flow * uNoise * (0.35 + 0.65 * spread) * (1.0 - column * 0.7)
                 + rise * column * 0.9;

  vec4 mvPosition = modelViewMatrix * vec4(displaced + uCenter, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Размер: по удалению от камеры и сиду; в капле частицы почти невидимы
  float size = uSize * (0.6 + aSeed * 0.8) * uPixelRatio;
  gl_PointSize = size * (6.0 / -mvPosition.z);

  // Прозрачность: появляются с разлётом, гаснут по краям облака
  float edge = 1.0 - smoothstep(1.6, 2.6, length(displaced));
  vAlpha = spread * mix(0.55, 1.0, edge) * (0.5 + 0.5 * sin(t * 2.0 + aSeed * 12.0)) ;
  vSeed = aSeed;
}
