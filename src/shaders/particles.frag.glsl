// Фрагмент частиц: мягкий круглый спрайт, цвет — смесь глубокого свечения и aqua по uColorMix.
uniform vec3 uColorA;   // глубокая вода (glow)
uniform vec3 uColorB;   // aqua
uniform float uColorMix;
uniform float uOpacity;

varying float vAlpha;
varying float vSeed;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  // Мягкий диск с ядром
  float disk = smoothstep(0.5, 0.18, d);
  float core = smoothstep(0.22, 0.0, d) * 0.6;
  float a = (disk * 0.7 + core) * vAlpha * uOpacity;
  if (a < 0.004) discard;
  vec3 col = mix(uColorA, uColorB, clamp(uColorMix + (vSeed - 0.5) * 0.3, 0.0, 1.0));
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}
