// Вершинный шейдер капли: два фрагмента, внедряемые в MeshTransmissionMaterial (drei)
// через onBeforeCompile. Функции noise.glsl и uniform'ы объявляются перед main().
//
// uTime       — время, с
// uDistortion — амплитуда «метаболического» шума (0 — идеальная сфера)
// uProgress   — общий прогресс сцены 0..1 (меняет частоту шума: капля → поток)
// uClarity    — 0..1, «чистота»: чем выше, тем спокойнее поверхность
//
// Файл делится маркером SPLIT (см. lib/three/glsl.ts): до него — замена beginnormal_vertex, после — замена begin_vertex.

// ---------- 1. Замена #include <beginnormal_vertex> ----------
vec3 nrm = normalize(position);
float freq = mix(1.1, 1.9, clamp(uProgress * 1.4, 0.0, 1.0));
float slow = uTime * 0.18;
vec3 off1 = vec3(slow, slow * 0.7, -slow * 0.5);
vec3 off2 = vec3(-slow * 1.3, slow * 0.9, slow * 0.4);
float rippleAmp = 0.05 * (1.0 - uClarity * 0.85);

// Смещение вдоль нормали: крупная форма + мелкая рябь (гасится «чистотой»)
float displacement = (snoise(nrm * freq + off1) * 0.7 + snoise(nrm * (freq * 3.2) + off2) * rippleAmp) * uDistortion;

// Численная нормаль по двум соседним точкам сферы (корректные блики и преломление)
float eps = 0.02;
vec3 tangent = normalize(cross(nrm, abs(nrm.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
vec3 bitangent = normalize(cross(nrm, tangent));
vec3 pT = normalize(nrm + tangent * eps);
vec3 pB = normalize(nrm + bitangent * eps);
float dT = (snoise(pT * freq + off1) * 0.7 + snoise(pT * (freq * 3.2) + off2) * rippleAmp) * uDistortion;
float dB = (snoise(pB * freq + off1) * 0.7 + snoise(pB * (freq * 3.2) + off2) * rippleAmp) * uDistortion;
vec3 posC = nrm * (1.0 + displacement);
vec3 posT = pT * (1.0 + dT);
vec3 posB = pB * (1.0 + dB);
vec3 objectNormal = normalize(cross(posT - posC, posB - posC));
if (dot(objectNormal, nrm) < 0.0) objectNormal = -objectNormal;
// @@SPLIT@@
// ---------- 2. Замена #include <begin_vertex> ----------
vec3 transformed = position + nrm * displacement;
