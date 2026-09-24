// Каустика и «туман»: два слоя ячеистого узора (аналог Voronoi через шум) + мягкая радиальная заливка.
// uProgress управляет переходом «каустика → гладкий градиентный туман» (финал сцены).
uniform float uTime;
uniform float uProgress;   // 0..1 общий прогресс сцены
uniform float uFog;        // 0..1 — доля тумана вместо каустики
uniform vec3 uColorA;      // глубокий аква-блик
uniform vec3 uColorB;      // aqua
uniform float uColorMix;
uniform float uOpacity;
uniform vec2 uFocus;       // центр каустики в UV (под каплей)

varying vec2 vUv;

// Каустический узор: складываем несколько сдвинутых полей шума и берём «гребни»
float caustic(vec2 p, float t) {
  float n1 = snoise(vec3(p * 3.0, t * 0.25));
  float n2 = snoise(vec3(p * 3.0 + 7.3, -t * 0.2));
  float ridge = 1.0 - abs(n1 + n2) * 0.9;
  ridge = pow(clamp(ridge, 0.0, 1.0), 9.0);
  float n3 = snoise(vec3(p * 6.5 - 3.1, t * 0.35));
  float fine = pow(clamp(1.0 - abs(n3), 0.0, 1.0), 14.0) * 0.35;
  return ridge + fine;
}

void main() {
  vec2 p = vUv - uFocus;
  float dist = length(p);
  float falloff = smoothstep(0.34, 0.04, dist);          // каустика только вокруг капли
  float c = caustic(vUv + vec2(0.0, uTime * 0.02), uTime) * falloff;

  vec3 tint = mix(uColorA, uColorB, uColorMix);
  // Туман: мягкое радиальное свечение, чуть смещённое вверх
  float fog = smoothstep(0.9, 0.0, length(vUv - vec2(0.5, 0.62))) * 0.55;

  float amount = mix(c * 0.6, fog, uFog);
  float alpha = amount * uOpacity;
  gl_FragColor = vec4(tint, alpha);
  #include <colorspace_fragment>
}
