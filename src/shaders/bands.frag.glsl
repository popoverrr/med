// Фон сцены = цвета секций страницы, синхронно движущиеся со скроллом (uTops — верх каждой секции
// в px от верха вьюпорта). На границах — мягкая кромка шириной uFeather, а не резкая линия.
#define MAX_BANDS 16
uniform float uTops[MAX_BANDS];
uniform vec3 uColors[MAX_BANDS];
uniform int uCount;
uniform float uHeight;
uniform float uFeather;
uniform vec3 uBase;

varying vec2 vUv;

void main() {
  float y = (1.0 - vUv.y) * uHeight; // px от верха вьюпорта
  vec3 col = uBase;
  for (int i = 0; i < MAX_BANDS; i++) {
    if (i >= uCount) break;
    float t = smoothstep(uTops[i] - uFeather * 0.5, uTops[i] + uFeather * 0.5, y);
    col = mix(col, uColors[i], t);
  }
  gl_FragColor = vec4(col, 1.0);
}
