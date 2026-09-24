/**
 * Капля воды: икосаэдр с собственным вершинным шейдером (simplex-шум), внедряемым через onBeforeCompile.
 * Материал по уровню качества:
 *  - low/medium/high — MeshTransmissionMaterial (drei): преломление, толщина, хроматическая аберрация
 *    (число сэмплов и размер буфера — из TIER);
 *  - basic — MeshPhysicalMaterial без transmission (один проход рендера): та же «живая» форма,
 *    полупрозрачное «матовое стекло» — последний рубеж перед CSS-постером.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';
import { Color, type Mesh, type MeshPhysicalMaterial, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three';
import { params } from '@/lib/three/params';
import { NOISE, BLOB_NORMAL_CHUNK, BLOB_POSITION_CHUNK } from '@/lib/three/glsl';
import { TIER, type Quality } from '@/lib/scene/tiers';

// Палитра капли: только вода. colorMix 0 — «глубокая» капля (лёгкое бирюзовое поглощение на тёмном фоне),
// 1 — кристально прозрачная (на светлом фоне). Никаких тёплых/красных тонов: капля должна читаться как вода, а не клетка.
const COLOR_DEEP = new Color('#effcfe');
const COLOR_CLEAR = new Color('#fbffff');
const ATT_DEEP = new Color('#7fd3e0');
const ATT_CLEAR = new Color('#5cc3d6'); // на светлом фоне капле нужен явный аква-оттенок, иначе она читается «молочной»
const BASIC_DEEP = new Color('#8fd6e2');
const BASIC_CLEAR = new Color('#d9f4f8');

interface Props { quality: Quality }

export function WaterBlob({ quality }: Props) {
  const mesh = useRef<Mesh>(null);
  const mat = useRef<MeshPhysicalMaterial>(null);
  const tier = TIER[quality];
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDistortion: { value: params.distortion },
      uProgress: { value: 0 },
      uClarity: { value: 0 },
    }),
    []
  );
  const tint = useMemo(() => new Color(), []);
  const att = useMemo(() => new Color(), []);

  // Внедряем свой вершинный код поверх шейдера материала (drei сам патчит фрагмент через onBeforeCompile).
  // Зависимость от quality: при смене уровня материал пересоздаётся — оборачиваем заново.
  useLayoutEffect(() => {
    const m = mat.current;
    if (!m) return;
    const original = m.onBeforeCompile as (s: WebGLProgramParametersWithUniforms, r: WebGLRenderer) => void;
    m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) => {
      original.call(m, shader, renderer);
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          'void main() {',
          `uniform float uTime;\nuniform float uDistortion;\nuniform float uProgress;\nuniform float uClarity;\n${NOISE}\nvoid main() {`
        )
        .replace('#include <beginnormal_vertex>', BLOB_NORMAL_CHUNK)
        .replace('#include <begin_vertex>', BLOB_POSITION_CHUNK);
    };
    m.customProgramCacheKey = () => `hydromed-blob-${quality}`;
    m.needsUpdate = true;
  }, [uniforms, quality]);

  useFrame((state, delta) => {
    const m = mesh.current;
    if (!m) return;
    uniforms.uTime.value += delta * (0.6 + params.speed * 2);
    uniforms.uDistortion.value = params.distortion;
    uniforms.uClarity.value = params.clarity;
    uniforms.uProgress.value = params.stretch / 2.6;

    // Гашение сцены: капля сжимается и скрывается, фон-полосы остаются
    m.visible = params.opacity > 0.02;
    // Форма: сфера -> вытянутый поток/трубка (неравномерный масштаб), поворот
    const s = params.blobScale * (0.3 + 0.7 * Math.min(1, params.opacity));
    const st = params.stretch;
    m.scale.set(s / (1 + st * 0.28), s * (1 + st), s / (1 + st * 0.28));
    m.rotation.z = params.rotZ;
    m.rotation.y += delta * (0.08 + params.speed * 0.2);
    m.position.set(params.blobX, params.blobY + Math.sin(state.clock.elapsedTime * 0.6) * 0.06, 0);

    const pm = mat.current;
    if (!pm) return;
    if (tier.transmission) {
      tint.copy(COLOR_DEEP).lerp(COLOR_CLEAR, params.colorMix);
      att.copy(ATT_DEEP).lerp(ATT_CLEAR, params.colorMix);
      pm.color.copy(tint);
      pm.attenuationColor.copy(att);
      // Вода: почти нулевая шероховатость, слабое поглощение — капля прозрачна, объём читается по преломлению и бликам
      pm.roughness = 0.02 + (1 - params.clarity) * 0.03;
      pm.attenuationDistance = 6 - params.colorMix * 3.2;
      pm.thickness = 0.7 + params.colorMix * 0.35;
    } else {
      // Дешёвый материал: полупрозрачное «матовое стекло» без преломления
      tint.copy(BASIC_DEEP).lerp(BASIC_CLEAR, params.colorMix);
      pm.color.copy(tint);
      pm.opacity = 0.55 + params.colorMix * 0.1;
      pm.roughness = 0.1 + (1 - params.clarity) * 0.1;
    }
  });

  return (
    <mesh ref={mesh} position={[params.blobX, params.blobY, 0]} frustumCulled={false}>
      <icosahedronGeometry args={[1, tier.detail]} />
      {tier.transmission ? (
        <MeshTransmissionMaterial
          ref={mat as never}
          samples={tier.samples}
          resolution={tier.resolution}
          transmission={1}
          thickness={0.9}
          roughness={0.03}
          ior={1.33}
          chromaticAberration={quality === 'high' ? 0.035 : quality === 'medium' ? 0.015 : 0}
          anisotropy={0.1}
          distortion={0.06}
          distortionScale={0.4}
          temporalDistortion={0.03}
          attenuationDistance={6}
          attenuationColor="#7fd3e0"
          color="#effcfe"
          backside={tier.backside}
          backsideThickness={0.4}
          envMapIntensity={1.6}
          clearcoat={1}
          clearcoatRoughness={0.03}
        />
      ) : (
        <meshPhysicalMaterial
          ref={mat}
          color="#8fd6e2"
          roughness={0.06}
          metalness={0}
          clearcoat={0.6}
          clearcoatRoughness={0.15}
          envMapIntensity={1.4}
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      )}
    </mesh>
  );
}
